import json
import logging
import httpx
from typing import Optional

from app.core.config import settings
from app.models.signals import SensitivityTier
from app.models.decision import (
    AccessEvaluationResult,
    AgentReasoning,
    DecisionType,
)
from app.agent.prompts import SOC_SYSTEM_PROMPT, build_soc_context_prompt
from app.agent.cache import agent_cache
from app.agent.mock_reasoner import MockSOCReasoner

logger = logging.getLogger("contextguard.agent")


class ContextualRiskReasoningAgent:
    """
    Orchestrates the single SOC Analyst LLM invocation.
    Only triggered for ambiguous-zone scores, conflicting signals, or high-value threat matches.
    Employs caching, strict JSON schema validation, guardrail enforcement, and mock fallback.
    """

    def should_trigger(self, result: AccessEvaluationResult) -> bool:
        """
        Determines whether the access request requires agent escalation.
        Conditions:
        1. Explicitly flagged as ambiguous by the deterministic engine.
        2. Boundary zone score (within ±5 of Allow/Challenge/Restrict/Deny).
        3. Conflicting signals (e.g. trusted device + impossible travel).
        4. Restricted resource combined with any non-zero threat signal.
        """
        # Condition 1 & 2 & 3: Checked in evaluator
        if result.is_ambiguous:
            return True

        # Condition 4: Restricted resource with non-zero threat score
        threat_score = result.category_scores["threat"].score
        if result.context.resource.sensitivity_tier == SensitivityTier.RESTRICTED and threat_score > 0:
            return True

        return False

    async def _call_claude_api(self, prompt: str) -> Optional[dict]:
        """Calls Anthropic Claude API via direct async HTTP."""
        if not settings.ANTHROPIC_API_KEY:
            return None

        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": settings.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": settings.ANTHROPIC_MODEL,
            "max_tokens": 1024,
            "system": SOC_SYSTEM_PROMPT,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    content_text = data["content"][0]["text"].strip()
                    # Strip any possible markdown fence
                    if content_text.startswith("```json"):
                        content_text = content_text[7:]
                    if content_text.endswith("```"):
                        content_text = content_text[:-3]
                    return json.loads(content_text.strip())
                else:
                    logger.warning(f"Claude API returned status {res.status_code}: {res.text}")
                    return None
        except Exception as e:
            logger.error(f"Claude API call failed: {e}")
            return None

    async def evaluate_and_enrich(self, result: AccessEvaluationResult) -> AccessEvaluationResult:
        """
        Main entry point for agent reasoning.
        Evaluates trigger -> checks cache -> calls LLM / mock -> validates -> applies override.
        """
        if not self.should_trigger(result):
            # Deterministic decision stands without agent intervention
            return result

        cache_key = agent_cache.generate_cache_key(result.context, result.deterministic_score)
        cached_reasoning = agent_cache.get(cache_key)

        if cached_reasoning:
            logger.info(f"Agent cache HIT for key {cache_key[:10]}...")
            reasoning = cached_reasoning
        else:
            reasoning = None
            prompt = build_soc_context_prompt(result)

            # Try live Claude API if key configured and not in forced mock mode
            if settings.ANTHROPIC_API_KEY and not settings.USE_MOCK_AGENT:
                raw_json = await self._call_claude_api(prompt)
                if raw_json and "decision" in raw_json:
                    try:
                        # Guardrail: validate decision mapping
                        valid_decision = DecisionType(raw_json["decision"].capitalize())
                        reasoning = AgentReasoning(
                            decision=valid_decision,
                            confidence=float(raw_json.get("confidence", 0.9)),
                            key_factors=list(raw_json.get("key_factors", [])),
                            narrative=str(raw_json.get("narrative", "")),
                            recommended_step_up_control=raw_json.get("recommended_step_up_control"),
                            overrode_baseline=(valid_decision != result.deterministic_decision),
                        )
                    except Exception as e:
                        logger.warning(f"Failed to parse LLM response into AgentReasoning: {e}")
                        reasoning = None

            # Fallback to high-fidelity mock reasoner if no API response
            if not reasoning:
                logger.info("Using high-fidelity Mock SOC Reasoner")
                reasoning = MockSOCReasoner.reason(result)

            # Save in cache
            agent_cache.set(cache_key, reasoning)

        # Apply reasoning to the evaluation result
        result.agent_invoked = True
        result.agent_reasoning = reasoning

        # Check if agent disagreed with deterministic baseline
        if reasoning.decision != result.deterministic_decision:
            # Guardrail: Enforce confidence floor (>= 0.70) before allowing override
            confidence_floor = settings.AGENT_CONFIDENCE_FLOOR
            if reasoning.confidence >= confidence_floor:
                reasoning.overrode_baseline = True
                result.final_decision = reasoning.decision
                # Re-align final score if agent escalated or de-escalated
                if reasoning.decision == DecisionType.DENY and result.final_score < 80.0:
                    result.final_score = 88.0
                elif reasoning.decision == DecisionType.CHALLENGE and result.final_score > 54.0:
                    result.final_score = 48.0
                elif reasoning.decision == DecisionType.RESTRICT and result.final_score < 55.0:
                    result.final_score = 65.0

                result.decision_rationale += (
                    f" [SOC AGENT OVERRIDE: {reasoning.narrative} "
                    f"Baseline '{result.deterministic_decision.value}' overridden to '{reasoning.decision.value}']"
                )
            else:
                reasoning.overrode_baseline = False
                result.decision_rationale += (
                    f" [SOC AGENT REJECTED OVERRIDE: Recommended '{reasoning.decision.value}' "
                    f"but confidence ({reasoning.confidence:.2f}) was below floor ({confidence_floor:.2f}). "
                    f"Deterministic baseline '{result.deterministic_decision.value}' preserved.]"
                )
        else:
            reasoning.overrode_baseline = False
            result.decision_rationale += f" [SOC AGENT CONFIRMED: {reasoning.narrative}]"

        return result


# Global singleton agent
soc_agent = ContextualRiskReasoningAgent()
