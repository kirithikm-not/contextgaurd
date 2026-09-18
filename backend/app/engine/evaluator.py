import uuid
from datetime import datetime
from typing import Dict, List, Tuple, Optional

from app.models.signals import AccessContextBundle, SensitivityTier
from app.models.decision import (
    AccessEvaluationResult,
    CategoryScore,
    DecisionType,
    RuleTrigger,
    RuleSeverity,
)
from app.models.policy import EnginePolicy
from app.engine.rules import (
    evaluate_identity_rules,
    evaluate_device_rules,
    evaluate_location_rules,
    evaluate_behavior_rules,
    evaluate_resource_rules,
    evaluate_history_rules,
    evaluate_threat_rules,
)


class DeterministicRiskEngine:
    def __init__(self, policy: Optional[EnginePolicy] = None):
        self.policy = policy or EnginePolicy()

    def update_policy(self, policy: EnginePolicy):
        self.policy = policy

    def detect_ambiguity(
        self,
        composite_score: float,
        category_scores: Dict[str, CategoryScore],
        bundle: AccessContextBundle,
    ) -> Tuple[bool, List[str]]:
        """
        Detects if this request lands in an ambiguous zone or has conflicting signals
        that warrant SOC AI Analyst contextual reasoning.
        """
        reasons: List[str] = []
        delta = self.policy.thresholds.ambiguous_boundary_delta

        # 1. Boundary score proximity (± delta around threshold boundaries)
        t_allow = self.policy.thresholds.allow_max
        t_chal = self.policy.thresholds.challenge_max
        t_rest = self.policy.thresholds.restrict_max

        if abs(composite_score - t_allow) <= delta:
            reasons.append(f"Score ({composite_score:.1f}) is in boundary zone (±{delta}) of Allow/Challenge ({t_allow})")
        if abs(composite_score - t_chal) <= delta:
            reasons.append(f"Score ({composite_score:.1f}) is in boundary zone (±{delta}) of Challenge/Restrict ({t_chal})")
        if abs(composite_score - t_rest) <= delta:
            reasons.append(f"Score ({composite_score:.1f}) is in boundary zone (±{delta}) of Restrict/Deny ({t_rest})")

        # 2. Conflicting signals: Impossible travel velocity anomaly (physical distance vs. time delta)
        if bundle.location.impossible_travel_flag:
            reasons.append("Impossible travel velocity anomaly: physical transit timeline suggests potential session token hijacking or proxying")

        # 3. Conflicting signals: Trusted device vs. Anomaly location
        dev_score = category_scores["device"].score
        loc_score = category_scores["location"].score
        if dev_score <= 15.0 and loc_score >= 50.0:
            reasons.append("Conflicting signals: Trusted managed device combined with high-risk location or anonymizing network")

        # 4. Conflicting signals: Restricted resource + non-zero threat intel
        thr_score = category_scores["threat"].score
        res_score = category_scores["resource"].score
        if bundle.resource.sensitivity_tier == SensitivityTier.RESTRICTED and thr_score > 0:
            reasons.append("Conflicting signals: Restricted resource access requested with active threat intelligence indicators")

        # 5. Conflicting signals: High behavioral deviation despite clean corporate network & device
        beh_score = category_scores["behavior"].score
        if bundle.device.is_managed and bundle.location.is_corporate_network and beh_score >= 50.0:
            reasons.append("Conflicting signals: Severe behavioral anomaly observed on corporate network and managed device")

        is_ambiguous = len(reasons) > 0
        return is_ambiguous, reasons

    def map_score_to_decision(self, score: float) -> DecisionType:
        """Deterministic threshold mapping."""
        t = self.policy.thresholds
        if score <= t.allow_max:
            return DecisionType.ALLOW
        elif score <= t.challenge_max:
            return DecisionType.CHALLENGE
        elif score <= t.restrict_max:
            return DecisionType.RESTRICT
        else:
            return DecisionType.DENY

    def evaluate(
        self, 
        bundle: AccessContextBundle, 
        override_policy: Optional[EnginePolicy] = None
    ) -> AccessEvaluationResult:
        """
        Full deterministic evaluation of 7 context signal dimensions.
        """
        policy = override_policy or self.policy
        weights = policy.weights

        # Evaluate rules per category
        id_score, id_rules = evaluate_identity_rules(bundle.identity)
        dev_score, dev_rules = evaluate_device_rules(bundle.device)
        loc_score, loc_rules = evaluate_location_rules(bundle.location)
        beh_score, beh_rules = evaluate_behavior_rules(bundle.behavior)
        res_score, res_rules = evaluate_resource_rules(bundle.resource)
        hist_score, hist_rules = evaluate_history_rules(bundle.access_history)
        thr_score, thr_rules = evaluate_threat_rules(bundle.threat)

        # Assemble CategoryScore objects
        cat_scores: Dict[str, CategoryScore] = {
            "identity": CategoryScore(
                score=id_score,
                weight=weights.identity,
                weighted_score=round(id_score * weights.identity, 2),
                rules=id_rules,
            ),
            "device": CategoryScore(
                score=dev_score,
                weight=weights.device,
                weighted_score=round(dev_score * weights.device, 2),
                rules=dev_rules,
            ),
            "location": CategoryScore(
                score=loc_score,
                weight=weights.location,
                weighted_score=round(loc_score * weights.location, 2),
                rules=loc_rules,
            ),
            "behavior": CategoryScore(
                score=beh_score,
                weight=weights.behavior,
                weighted_score=round(beh_score * weights.behavior, 2),
                rules=beh_rules,
            ),
            "resource": CategoryScore(
                score=res_score,
                weight=weights.resource,
                weighted_score=round(res_score * weights.resource, 2),
                rules=res_rules,
            ),
            "history": CategoryScore(
                score=hist_score,
                weight=weights.history,
                weighted_score=round(hist_score * weights.history, 2),
                rules=hist_rules,
            ),
            "threat": CategoryScore(
                score=thr_score,
                weight=weights.threat,
                weighted_score=round(thr_score * weights.threat, 2),
                rules=thr_rules,
            ),
        }

        # Consolidate all triggered rules
        all_fired_rules: List[RuleTrigger] = []
        for cat in cat_scores.values():
            all_fired_rules.extend(cat.rules)

        # Base weighted composite score
        raw_composite = sum(c.weighted_score for c in cat_scores.values())

        # Security Invariants for Critical Breaches (NIST SP 800-207 Zero-Trust principle)
        critical_count = sum(1 for r in all_fired_rules if r.severity == RuleSeverity.CRITICAL)
        high_count = sum(1 for r in all_fired_rules if r.severity == RuleSeverity.HIGH)
        is_nist_hard_deny = (critical_count >= 2) or bundle.device.jailbroken_or_rooted

        if is_nist_hard_deny:
            # Multi-vector critical breach (e.g. leaked creds + malicious IP or jailbreak)
            raw_composite = max(raw_composite + 35.0, 88.0)
        elif critical_count == 1:
            # Single critical vector (e.g. impossible travel)
            raw_composite = max(raw_composite + 18.0, 60.0)
        elif high_count >= 3:
            raw_composite = max(raw_composite + 12.0, 56.0)

        # Active Session Step-Up MFA Assurance (mitigates challenge risk after live verification)
        if getattr(bundle.identity, "mfa_verified_this_session", False) and not is_nist_hard_deny:
            raw_composite = max(0.0, raw_composite - 15.0)

        composite_score = round(max(0.0, min(100.0, raw_composite)), 1)

        # Deterministic decision lookup
        decision = self.map_score_to_decision(composite_score)

        # Check ambiguous zone: Only true NIST hard-floor breaches (multi-vector critical or jailbreak) bypass ambiguity
        if is_nist_hard_deny:
            is_ambiguous = False
            ambiguity_reasons = []
        else:
            is_ambiguous, ambiguity_reasons = self.detect_ambiguity(composite_score, cat_scores, bundle)

        # Build structured rationale
        top_risk_categories = sorted(
            [(name, c.weighted_score) for name, c in cat_scores.items() if c.weighted_score > 0],
            key=lambda x: x[1],
            reverse=True,
        )

        if all_fired_rules:
            high_sev_count = sum(1 for r in all_fired_rules if r.severity in ("critical", "high"))
            top_drivers = ", ".join([f"{name} (+{score:.1f})" for name, score in top_risk_categories[:3]])
            rationale = (
                f"Evaluated with composite risk score of {composite_score}/100 resulting in '{decision.value}'. "
                f"{len(all_fired_rules)} rule(s) fired ({high_sev_count} high/critical). "
                f"Primary drivers: {top_drivers}."
            )
            if is_ambiguous:
                rationale += f" [Ambiguity Flagged: {'; '.join(ambiguity_reasons[:2])}]"
        else:
            rationale = f"All 7 context signals clean. Low baseline risk ({composite_score}/100) -> '{decision.value}' granted."

        if getattr(bundle.identity, "mfa_verified_this_session", False):
            rationale += " [Step-Up Assurance: Live TOTP MFA verified for this session (-15.0 risk score)]"

        eval_id = f"eval_{uuid.uuid4().hex[:12]}"

        return AccessEvaluationResult(
            evaluation_id=eval_id,
            timestamp=datetime.utcnow(),
            context=bundle,
            deterministic_score=composite_score,
            deterministic_decision=decision,
            category_scores=cat_scores,
            fired_rules=all_fired_rules,
            is_ambiguous=is_ambiguous,
            agent_invoked=False,
            agent_reasoning=None,
            final_score=composite_score,
            final_decision=decision,
            decision=decision.value,
            decision_rationale=rationale,
        )



# Global singleton engine instance
risk_engine = DeterministicRiskEngine()
