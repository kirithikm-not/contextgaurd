from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import logging

from app.core.config import settings
from app.models.signals import AccessContextBundle
from app.models.decision import AccessEvaluationResult, DecisionType
from app.models.policy import EnginePolicy
from app.engine.evaluator import risk_engine
from app.agent.orchestrator import soc_agent
from app.db.database import record_evaluation, query_audit_logs, init_db
from app.simulator.scenarios import CANONICAL_SCENARIOS, SCENARIOS_MAP
from app.simulator.runner import scenario_runner

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("contextguard")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager to initialize database tables on startup."""
    logger.info("Initializing database tables on startup...")
    init_db()
    logger.info("Database tables initialized successfully.")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="ContextGuard: Real-Time Risk-Based Zero-Trust Access Intelligence Engine",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.auth import router as auth_router, create_challenge_session
app.include_router(auth_router)


# Active WebSocket connections manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total active: {len(self.active_connections)}")

    async def broadcast_json(self, data: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception as e:
                logger.error(f"Error broadcasting to WebSocket: {e}")

ws_manager = ConnectionManager()


@app.get("/api/health")
async def health_check():
    """Health check endpoint for container orchestrators and frontend ping."""
    return {
        "status": "healthy",
        "service": "ContextGuard Access Intelligence Engine",
        "version": "1.0.0",
        "mock_agent_mode": settings.USE_MOCK_AGENT,
        "anthropic_model": settings.ANTHROPIC_MODEL,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/api/policy", response_model=EnginePolicy)
async def get_policy():
    """Returns the active engine policy and scoring weights."""
    return risk_engine.policy


@app.put("/api/policy", response_model=EnginePolicy)
async def update_policy(policy: EnginePolicy):
    """Updates active engine scoring weights and thresholds."""
    try:
        risk_engine.update_policy(policy)
        logger.info(f"Policy updated: {policy.name}")
        return risk_engine.policy
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/evaluate", response_model=AccessEvaluationResult)
async def evaluate_access(bundle: AccessContextBundle):
    """
    Evaluates an access request context bundle against all 7 signal categories
    using the deterministic scoring core and escalates ambiguous/conflicting cases
    to the Contextual Risk Reasoning Agent. Persists decision to audit log.
    If decision is Challenge, provisions a live ChallengeSession for TOTP step-up.
    """
    # 1. Deterministic Core Evaluation
    result = risk_engine.evaluate(bundle)

    # 2. Agentic Edge: Contextual Risk Reasoning Agent
    enriched_result = await soc_agent.evaluate_and_enrich(result)
    
    # 3. Persist to audit database
    record_evaluation(enriched_result)

    # 4. Handle Step-Up MFA Challenge
    if enriched_result.final_decision == DecisionType.CHALLENGE:
        chal_session = create_challenge_session(
            evaluation_id=enriched_result.evaluation_id,
            user_id=bundle.identity.user_id,
        )
        enriched_result.mfa_required = True
        enriched_result.challenge_id = chal_session.id
        enriched_result.decision = "Challenge"

    # 5. Broadcast evaluation event to live WebSocket clients
    await ws_manager.broadcast_json({
        "type": "EVALUATION_COMPLETED",
        "data": enriched_result.model_dump(mode="json"),
    })
    
    return enriched_result


# ==========================================
# Scenario Simulator & Synthetic Data Engine
# ==========================================

@app.get("/api/scenarios")
async def list_canonical_scenarios():
    """Returns the four canonical zero-trust demo scenarios proving context-awareness."""
    return [
        {
            "id": s["id"],
            "title": s["title"],
            "description": s["description"],
            "expected_decision": s["expected_decision"].value,
            "expected_score_range": s["expected_score_range"],
            "agent_expected": s["agent_expected"],
            "key_takeaway": s["key_takeaway"],
            "context": s["context"].model_dump(mode="json"),
        }
        for s in CANONICAL_SCENARIOS
    ]


@app.post("/api/scenarios/{scenario_id}/replay", response_model=AccessEvaluationResult)
async def replay_canonical_scenario(scenario_id: str):
    """Replays a specific canonical scenario, logs to DB, and broadcasts via WebSocket."""
    if scenario_id not in SCENARIOS_MAP:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    result = await scenario_runner.replay_scenario(scenario_id)

    if result.final_decision == DecisionType.CHALLENGE:
        scenario = SCENARIOS_MAP[scenario_id]
        chal_session = create_challenge_session(
            evaluation_id=result.evaluation_id,
            user_id=scenario["context"].identity.user_id,
        )
        result.mfa_required = True
        result.challenge_id = chal_session.id
        result.decision = "Challenge"

    await ws_manager.broadcast_json({
        "type": "SCENARIO_REPLAYED",
        "scenario_id": scenario_id,
        "data": result.model_dump(mode="json"),
    })

    return result



@app.post("/api/simulator/drift-session")
async def replay_session_drift():
    """
    Simulates a continuous session over time where context drifts
    mid-session, showing automatic access step-down (Allow -> Challenge -> Restrict -> Deny).
    """
    timeline = await scenario_runner.run_drift_session()

    await ws_manager.broadcast_json({
        "type": "SESSION_DRIFT_COMPLETED",
        "timeline": timeline,
    })

    return {"status": "success", "timeline": timeline}


class MutationPayload(BaseModel):
    base_scenario_id: Optional[str] = None
    context_bundle: Optional[AccessContextBundle] = None
    mutations: Optional[Dict[str, Any]] = None


@app.post("/api/simulator/mutate", response_model=AccessEvaluationResult)
async def mutate_and_evaluate(payload: MutationPayload):
    """
    Knob-tuning endpoint: mutates context signals live via UI sliders/toggles
    and re-runs evaluation instantly.
    """
    try:
        result = await scenario_runner.mutate_and_evaluate(
            base_scenario_id=payload.base_scenario_id,
            context_bundle=payload.context_bundle,
            mutations=payload.mutations,
        )

        await ws_manager.broadcast_json({
            "type": "KNOB_MUTATION_EVALUATED",
            "data": result.model_dump(mode="json"),
        })

        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==========================================
# Audit Log & Decision History
# ==========================================

@app.get("/api/audit-log")
async def get_audit_logs(
    user_id: Optional[str] = None,
    decision: Optional[str] = None,
    agent_invoked: Optional[bool] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """Retrieves persisted access evaluation audit logs with optional filters."""
    return query_audit_logs(
        user_id=user_id,
        decision=decision,
        agent_invoked=agent_invoked,
        limit=limit,
        offset=offset,
    )


@app.websocket("/ws/decisions")
async def websocket_decisions_endpoint(websocket: WebSocket):
    """WebSocket stream for real-time decision broadcasting."""
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"type": "PONG", "message": "ContextGuard stream active"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
