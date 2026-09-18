import json
from app.models.signals import AccessContextBundle
from app.models.decision import AccessEvaluationResult

SOC_SYSTEM_PROMPT = """You are the Senior Security Operations Center (SOC) Risk Analyst for ContextGuard, a real-time Zero-Trust Access Intelligence Engine.

Your task is to analyze contextual access requests that have fallen into the "Ambiguous Zone" or contain conflicting security signals where rigid mathematical rules may either under-weight or over-weight risk factors.

You must reason like an expert security investigator:
1. Identify which signals matter most in this specific combination (e.g. why an impossible-travel anomaly outweighs a corporate device tag, or why leaked credentials paired with a restricted resource export requires immediate denial).
2. Note anything the deterministic rule engine likely under-weighted or over-weighted.
3. Recommend one of four strict access decisions: "Allow", "Challenge", "Restrict", or "Deny". (You CANNOT invent any other decision).
4. Provide a plain-English, executive narrative in 2 to 4 sentences (clear, persuasive, no technical jargon dumps).
5. Suggest an actionable security control (e.g. FIDO2/WebAuthn re-auth, isolated virtual sandbox, or supervisor authorization).

Output strictly valid JSON with no markdown wrapping or preamble, matching this exact schema:
{
  "decision": "Allow" | "Challenge" | "Restrict" | "Deny",
  "confidence": <float between 0.0 and 1.0>,
  "key_factors": [<list of string signal descriptions>],
  "narrative": "<2-4 sentences plain English justification>",
  "recommended_step_up_control": "<specific control or action>"
}
"""


def build_soc_context_prompt(result: AccessEvaluationResult) -> str:
    """Builds a dense, structured context prompt for the LLM."""
    bundle = result.context
    cat_scores = {k: v.score for k, v in result.category_scores.items()}
    fired_rule_descs = [f"[{r.severity.upper()}] {r.rule_id}: {r.description} (+{r.score_impact} pts)" for r in result.fired_rules]

    context_dict = {
        "evaluation_id": result.evaluation_id,
        "deterministic_baseline": {
            "composite_score": result.deterministic_score,
            "baseline_decision": result.deterministic_decision.value,
            "category_scores": cat_scores,
            "fired_rules": fired_rule_descs,
        },
        "ambiguity_triggers": [r for r in result.decision_rationale.split("[Ambiguity Flagged: ")[-1].rstrip("]").split("; ") if "Ambiguity Flagged" in result.decision_rationale],
        "user_identity": {
            "user_id": bundle.identity.user_id,
            "role": bundle.identity.role,
            "department": bundle.identity.department,
            "mfa_enrolled": bundle.identity.mfa_enrolled,
            "privilege_level": bundle.identity.privilege_level.value,
            "account_age_days": bundle.identity.account_age_days,
        },
        "device_posture": {
            "device_id": bundle.device.device_id,
            "is_managed": bundle.device.is_managed,
            "os_patch_level": bundle.device.os_patch_level.value,
            "disk_encryption": bundle.device.disk_encryption.value,
            "edr_agent_status": bundle.device.edr_agent_status.value,
            "jailbroken_or_rooted": bundle.device.jailbroken_or_rooted,
        },
        "location_vector": {
            "geo_ip_city": bundle.location.geo_ip_city,
            "geo_ip_country": bundle.location.geo_ip_country,
            "is_corporate_network": bundle.location.is_corporate_network,
            "is_known_location": bundle.location.is_known_location,
            "impossible_travel_flag": bundle.location.impossible_travel_flag,
            "vpn_tor_detected": bundle.location.vpn_tor_detected,
        },
        "behavior_profile": {
            "request_time_hour": bundle.behavior.request_time_hour,
            "is_outside_working_hours": bundle.behavior.is_outside_working_hours,
            "typing_velocity_anomaly": bundle.behavior.typing_velocity_anomaly,
            "resource_access_pattern_deviation": bundle.behavior.resource_access_pattern_deviation,
            "failed_logins_last_hour": bundle.behavior.failed_logins_last_hour,
        },
        "requested_resource": {
            "resource_id": bundle.resource.resource_id,
            "sensitivity_tier": bundle.resource.sensitivity_tier.value,
            "action": bundle.resource.action.value,
        },
        "access_history": {
            "past_access_count": bundle.access_history.past_access_count_to_this_resource,
            "last_successful_access_days_ago": bundle.access_history.last_successful_access_days_ago,
            "historical_deny_count": bundle.access_history.historical_deny_count,
            "average_historical_risk_score": bundle.access_history.average_historical_risk_score,
        },
        "threat_intel": {
            "known_bad_ip": bundle.threat.known_bad_ip,
            "leaked_credential_flag": bundle.threat.leaked_credential_flag,
            "active_campaign_targeting_sector": bundle.threat.active_campaign_targeting_sector,
            "incident_correlated_travel": bundle.threat.incident_correlated_travel,
        },
    }

    return (
        f"ACCESS REQUEST EVALUATION BUNDLE:\n"
        f"{json.dumps(context_dict, indent=2)}\n\n"
        f"Please analyze the conflicting signals and ambiguity. Output the JSON reasoning."
    )
