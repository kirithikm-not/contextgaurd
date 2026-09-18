import json
from typing import Optional, Dict, Any

from app.models.decision import AccessEvaluationResult
from database import engine, SessionLocal, Base, init_db
from models import AccessAuditLog, User, ChallengeSession, LoginHistory



def record_evaluation(result: AccessEvaluationResult):
    """Persists an access evaluation result to PostgreSQL/SQLite using SQLAlchemy."""
    db = SessionLocal()
    try:
        agent_conf = result.agent_reasoning.confidence if result.agent_reasoning else None
        overrode = 1 if (result.agent_reasoning and result.agent_reasoning.overrode_baseline) else 0

        record = AccessAuditLog(
            evaluation_id=result.evaluation_id,
            timestamp=result.timestamp.isoformat(),
            user_id=result.context.identity.user_id,
            user_role=result.context.identity.role,
            device_id=result.context.device.device_id,
            resource_id=result.context.resource.resource_id,
            resource_tier=result.context.resource.sensitivity_tier.value,
            action=result.context.resource.action.value,
            deterministic_score=result.deterministic_score,
            deterministic_decision=result.deterministic_decision.value,
            final_score=result.final_score,
            final_decision=result.final_decision.value,
            is_ambiguous=1 if result.is_ambiguous else 0,
            agent_invoked=1 if result.agent_invoked else 0,
            overrode_baseline=overrode,
            agent_confidence=agent_conf,
            fired_rules_count=len(result.fired_rules),
            decision_rationale=result.decision_rationale,
            context_json=json.dumps(result.context.model_dump(mode="json")),
            result_json=json.dumps(result.model_dump(mode="json")),
        )
        db.merge(record)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def query_audit_logs(
    user_id: Optional[str] = None,
    decision: Optional[str] = None,
    agent_invoked: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """Queries audit logs with filtering and pagination using SQLAlchemy."""
    db = SessionLocal()
    try:
        query = db.query(AccessAuditLog)

        if user_id:
            query = query.filter(AccessAuditLog.user_id == user_id)
        if decision:
            query = query.filter(AccessAuditLog.final_decision == decision)
        if agent_invoked is not None:
            query = query.filter(AccessAuditLog.agent_invoked == (1 if agent_invoked else 0))

        total = query.count()
        rows = (
            query.order_by(AccessAuditLog.timestamp.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        items = [row.to_dict() for row in rows]
        return {
            "total": total,
            "items": items,
            "limit": limit,
            "offset": offset,
        }
    finally:
        db.close()


# Auto-initialize DB schema on load
init_db()
