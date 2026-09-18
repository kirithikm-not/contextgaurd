import asyncio
from typing import Dict, Any, List, Optional

from app.models.signals import AccessContextBundle
from app.models.decision import AccessEvaluationResult
from app.engine.evaluator import risk_engine
from app.agent.orchestrator import soc_agent
from app.db.database import record_evaluation
from app.simulator.scenarios import SCENARIOS_MAP, SESSION_DRIFT_STEPS


class ScenarioRunner:
    """Orchestrates scenario execution, continuous session drift replay, and signal mutation."""

    @staticmethod
    async def evaluate_and_record(bundle: AccessContextBundle) -> AccessEvaluationResult:
        """Executes full evaluation (Deterministic + Agent) and persists to SQLite audit log."""
        # 1. Deterministic evaluation
        result = risk_engine.evaluate(bundle)
        # 2. Agent escalation if ambiguous/conflicting
        enriched = await soc_agent.evaluate_and_enrich(result)
        # 3. Persistent audit logging
        record_evaluation(enriched)
        return enriched

    @classmethod
    async def replay_scenario(cls, scenario_id: str) -> AccessEvaluationResult:
        if scenario_id not in SCENARIOS_MAP:
            raise ValueError(f"Scenario '{scenario_id}' not found in registered scenarios.")

        scenario = SCENARIOS_MAP[scenario_id]
        context = scenario["context"].model_copy(deep=True)
        return await cls.evaluate_and_record(context)

    @classmethod
    async def run_drift_session(cls) -> List[Dict[str, Any]]:
        """
        Executes a continuous 4-step session drift sequence over time,
        demonstrating step-down actions (Allow ➔ Challenge ➔ Restrict ➔ Deny).
        """
        timeline = []
        for step_data in SESSION_DRIFT_STEPS:
            context = step_data["context"].model_copy(deep=True)
            result = await cls.evaluate_and_record(context)

            timeline.append({
                "step": step_data["step"],
                "time_label": step_data["time_label"],
                "event_description": step_data["event_description"],
                "context_diff": step_data["context_diff"],
                "expected_decision": step_data["expected_decision"].value,
                "evaluation": result.model_dump(mode="json"),
            })

        return timeline

    @classmethod
    async def mutate_and_evaluate(
        cls, 
        base_scenario_id: Optional[str], 
        context_bundle: Optional[AccessContextBundle] = None,
        mutations: Optional[Dict[str, Any]] = None
    ) -> AccessEvaluationResult:
        """
        Applies live knob-tuning mutations onto a scenario or context bundle.
        """
        if context_bundle:
            bundle_dict = context_bundle.model_dump()
        elif base_scenario_id and base_scenario_id in SCENARIOS_MAP:
            bundle_dict = SCENARIOS_MAP[base_scenario_id]["context"].model_dump()
        else:
            raise ValueError("Must provide either a valid base_scenario_id or a context_bundle.")

        if mutations:
            # Apply nested mutations (e.g. {"device": {"is_managed": False}, "location": {"impossible_travel_flag": True}})
            for category, fields in mutations.items():
                if category in bundle_dict and isinstance(fields, dict):
                    bundle_dict[category].update(fields)
                elif category in bundle_dict:
                    bundle_dict[category] = fields

        updated_bundle = AccessContextBundle.model_validate(bundle_dict)
        return await cls.evaluate_and_record(updated_bundle)


scenario_runner = ScenarioRunner()
