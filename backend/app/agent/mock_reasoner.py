from typing import List
from app.models.signals import SensitivityTier, ResourceAction
from app.models.decision import (
    AccessEvaluationResult,
    AgentReasoning,
    DecisionType,
)


class MockSOCReasoner:
    """
    High-fidelity deterministic SOC Analyst reasoner used when running in offline mode
    or when no external LLM API key is configured.
    Generates authentic, contextual SOC reasoning and handles overrides cleanly.
    """

    @classmethod
    def reason(cls, result: AccessEvaluationResult) -> AgentReasoning:
        bundle = result.context
        base_decision = result.deterministic_decision
        base_score = result.deterministic_score

        # Case 1: Active Threat Match on Sensitive/Restricted Resource (Canonical Scenario 4)
        if (bundle.threat.known_bad_ip or bundle.threat.leaked_credential_flag) and (
            bundle.resource.sensitivity_tier in (SensitivityTier.RESTRICTED, SensitivityTier.CONFIDENTIAL)
        ):
            override = (base_decision != DecisionType.DENY)
            return AgentReasoning(
                decision=DecisionType.DENY,
                confidence=0.98,
                key_factors=[
                    "Active threat intelligence feed correlation (breached credential / C2 IP)",
                    f"Target resource classified as {bundle.resource.sensitivity_tier.value.upper()}",
                    f"Requested high-impact operation: {bundle.resource.action.value.upper()}",
                    "Deterministic static threat weight (5%) insufficiently captures credential compromise",
                ],
                narrative=(
                    "While identity attributes match an active employee profile, the connection originates from an IP "
                    "correlated with active threat actor campaigns alongside compromised darknet credential telemetry. "
                    "The deterministic rule engine under-weighted this threat vector due to rigid 5% category weighting, "
                    "failing to account for the catastrophic blast radius on restricted data. In zero-trust doctrine, "
                    "confirmed credential compromise overrides historical trust; immediate access denial is required."
                ),
                recommended_step_up_control="Force immediate password invalidation, revoke active session tokens, and dispatch SecOps Tier-2 containment.",
                overrode_baseline=override,
            )

        # Case 2: Impossible Travel Velocity with Outdated/Degraded Host (Canonical Scenario 3)
        if bundle.location.impossible_travel_flag:
            target_decision = DecisionType.DENY if bundle.resource.sensitivity_tier == SensitivityTier.RESTRICTED else DecisionType.RESTRICT
            override = (base_decision != target_decision)
            return AgentReasoning(
                decision=target_decision,
                confidence=0.94,
                key_factors=[
                    "Impossible geographical travel velocity detected across geographic bounds",
                    f"Device posture compromised (patch level: {bundle.device.os_patch_level.value}, EDR: {bundle.device.edr_agent_status.value})",
                    "High probability of session token hijacking or automated proxy routing",
                ],
                narrative=(
                    f"Request arrives from {bundle.location.geo_ip_city}, {bundle.location.geo_ip_country}, violating physical transit "
                    f"timelines relative to this user's recent activity. The host device also exhibits an outdated patch level and degraded "
                    f"EDR telemetry, making it susceptible to credential exfiltration malware. Access is strictly clamped to {target_decision.value} "
                    f"to isolate sensitive core services while preserving non-destructive audit observability."
                ),
                recommended_step_up_control="Quarantine request into an ephemeral browser isolation sandbox and prompt hardware WebAuthn challenge.",
                overrode_baseline=override,
            )

        # Case 3: Trusted Managed Device vs. Geographic Anomaly (Conflicting Signals)
        dev_score = result.category_scores["device"].score
        loc_score = result.category_scores["location"].score
        if dev_score <= 15.0 and loc_score >= 50.0:
            target_decision = DecisionType.CHALLENGE
            override = (base_decision != target_decision)
            return AgentReasoning(
                decision=target_decision,
                confidence=0.89,
                key_factors=[
                    "Device is fully managed with healthy EDR telemetry and full-disk encryption",
                    "Anomalous geographic origin or untrusted external network connection",
                    "Deterministic engine over-penalized legitimate roaming / business travel",
                ],
                narrative=(
                    "The endpoint maintains healthy corporate device hygiene, enterprise disk encryption, and active EDR telemetry. "
                    "The elevated location risk appears consistent with legitimate international business travel or mobile hotspot transit. "
                    "The deterministic engine over-weighted the network penalty; stepping up authentication with MFA verifies employee "
                    "presence without unnecessarily disrupting executive workflow."
                ),
                recommended_step_up_control="Issue biometric WebAuthn FIDO2 push verification to user's registered mobile authenticator.",
                overrode_baseline=override,
            )

        # Case 4: Severe Behavioral Anomaly on Corporate Network
        if bundle.device.is_managed and bundle.location.is_corporate_network and result.category_scores["behavior"].score >= 45.0:
            return AgentReasoning(
                decision=DecisionType.CHALLENGE,
                confidence=0.87,
                key_factors=[
                    "High biometric keystroke velocity deviation or abnormal data retrieval volume",
                    "Request originated from verified corporate network perimeter",
                    "Possibility of insider threat or unattended unlocked workstation misuse",
                ],
                narrative=(
                    "Although the connection originates from an authenticated corporate workstation, the keystroke cadence and access "
                    "velocity exhibit severe anomalies characteristic of automated scraping tools or an unattended workstation. "
                    "To prevent internal data loss, a step-up interactive challenge is mandated prior to granting resource access."
                ),
                recommended_step_up_control="Enforce re-authentication with local biometric sensor (TouchID / Windows Hello).",
                overrode_baseline=(base_decision != DecisionType.CHALLENGE),
            )

        # Case 5: Boundary Score Proximity (±5 pts of threshold)
        t_allow = result.deterministic_score
        target_decision = base_decision
        if base_score >= 26.0 and base_score <= 33.0:
            target_decision = DecisionType.CHALLENGE if not bundle.device.is_managed else DecisionType.ALLOW
        elif base_score >= 50.0 and base_score <= 58.0:
            target_decision = DecisionType.RESTRICT if bundle.resource.sensitivity_tier in (SensitivityTier.RESTRICTED, SensitivityTier.CONFIDENTIAL) else DecisionType.CHALLENGE

        override = (target_decision != base_decision)
        return AgentReasoning(
            decision=target_decision,
            confidence=0.85,
            key_factors=[
                f"Composite score ({base_score:.1f}) hovered directly on decision boundary threshold",
                f"Evaluated specific sensitivity of resource: {bundle.resource.resource_id}",
                f"User historical trust baseline ({bundle.access_history.past_access_count_to_this_resource} prior successful sessions)",
            ],
            narrative=(
                f"The deterministic evaluation produced a borderline composite risk score of {base_score:.1f}/100. "
                f"Upon deep contextual review of user role ({bundle.identity.role}) and past access cadence, "
                f"the analyst recommends '{target_decision.value}' as the optimal balance of zero-trust security and business enablement."
            ),
            recommended_step_up_control="Log high-granularity audit telemetry and issue contextual MFA prompt if write operations are attempted.",
            overrode_baseline=override,
        )
