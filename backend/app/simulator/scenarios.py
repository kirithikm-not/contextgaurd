from typing import List, Dict, Any
from app.models.signals import (
    UserIdentity,
    DevicePosture,
    LocationSignal,
    BehaviorSignal,
    ResourceSignal,
    AccessHistorySignal,
    ThreatSignal,
    AccessContextBundle,
    PrivilegeLevel,
    OSPatchLevel,
    DiskEncryption,
    EDRAgentStatus,
    SensitivityTier,
    ResourceAction,
)
from app.models.decision import DecisionType

# Canonical User Identity (Sarah Chen - Lead Security & Financial Data Scientist)
CANONICAL_USER = UserIdentity(
    user_id="usr_sarah_chen",
    role="Senior Data Scientist",
    department="Financial Modeling & Analytics",
    mfa_enrolled=True,
    account_age_days=420,
    privilege_level=PrivilegeLevel.STANDARD,
)

# 1. Canonical Scenario 1: Trusted Corporate Baseline
SCENARIO_1 = {
    "id": "scenario_1_trusted_baseline",
    "title": "1. Trusted Corporate Baseline",
    "description": "Sarah connects from her corporate-issued MacBook on the corporate San Francisco network during normal business hours to read internal financial models.",
    "expected_decision": DecisionType.ALLOW,
    "expected_score_range": "0 – 15 (Allow)",
    "agent_expected": False,
    "key_takeaway": "Clean baseline context grants frictionless zero-trust access without user friction.",
    "context": AccessContextBundle(
        request_id="req_scen_1_baseline",
        identity=CANONICAL_USER,
        device=DevicePosture(
            device_id="dev_mac_corp_441",
            is_managed=True,
            os_patch_level=OSPatchLevel.CURRENT,
            disk_encryption=DiskEncryption.ON,
            edr_agent_status=EDRAgentStatus.HEALTHY,
            jailbroken_or_rooted=False,
        ),
        location=LocationSignal(
            geo_ip_country="US",
            geo_ip_city="San Francisco",
            is_corporate_network=True,
            is_known_location=True,
            impossible_travel_flag=False,
            vpn_tor_detected=False,
        ),
        behavior=BehaviorSignal(
            request_time_hour=14,
            is_outside_working_hours=False,
            typing_velocity_anomaly=False,
            resource_access_pattern_deviation=False,
            failed_logins_last_hour=0,
        ),
        resource=ResourceSignal(
            resource_id="doc_q3_financial_models",
            sensitivity_tier=SensitivityTier.INTERNAL,
            action=ResourceAction.READ,
        ),
        access_history=AccessHistorySignal(
            past_access_count_to_this_resource=85,
            last_successful_access_days_ago=1.0,
            historical_deny_count=0,
            average_historical_risk_score=6.0,
        ),
        threat=ThreatSignal(
            known_bad_ip=False,
            leaked_credential_flag=False,
            active_campaign_targeting_sector=False,
            incident_correlated_travel=False,
        ),
    ),
}

# 2. Canonical Scenario 2: New Device, Unusual Hour
SCENARIO_2 = {
    "id": "scenario_2_new_device_unusual_hour",
    "title": "2. New Personal Device at 2:30 AM",
    "description": "Same user (Sarah Chen) attempts to access the exact same financial document at 2:30 AM from an unmanaged personal iPad over home residential Wi-Fi.",
    "expected_decision": DecisionType.CHALLENGE,
    "expected_score_range": "30 – 54 (Challenge)",
    "agent_expected": False,
    "key_takeaway": "Same credentials, but unmanaged host and off-hours timing trigger automated step-up MFA challenge.",
    "context": AccessContextBundle(
        request_id="req_scen_2_unusual_hour",
        identity=CANONICAL_USER,
        device=DevicePosture(
            device_id="dev_ipad_personal_92",
            is_managed=False,
            os_patch_level=OSPatchLevel.CURRENT,
            disk_encryption=DiskEncryption.OFF,
            edr_agent_status=EDRAgentStatus.ABSENT,
            jailbroken_or_rooted=False,
        ),
        location=LocationSignal(
            geo_ip_country="US",
            geo_ip_city="Oakland",
            is_corporate_network=False,
            is_known_location=True,
            impossible_travel_flag=False,
            vpn_tor_detected=False,
        ),
        behavior=BehaviorSignal(
            request_time_hour=2,
            is_outside_working_hours=True,
            typing_velocity_anomaly=True,
            resource_access_pattern_deviation=False,
            failed_logins_last_hour=0,
        ),
        resource=ResourceSignal(
            resource_id="doc_q3_financial_models",
            sensitivity_tier=SensitivityTier.INTERNAL,
            action=ResourceAction.READ,
        ),
        access_history=AccessHistorySignal(
            past_access_count_to_this_resource=0,
            last_successful_access_days_ago=1.0,
            historical_deny_count=0,
            average_historical_risk_score=8.0,
        ),
        threat=ThreatSignal(
            known_bad_ip=False,
            leaked_credential_flag=False,
            active_campaign_targeting_sector=False,
            incident_correlated_travel=False,
        ),
    ),
}

# 3. Canonical Scenario 3: Impossible Travel + Outdated Device
SCENARIO_3 = {
    "id": "scenario_3_impossible_travel_outdated",
    "title": "3. Impossible Travel + Outdated Device",
    "description": "9 minutes after logging in from San Francisco, Sarah's account requests confidential analytics from London, UK using an unpatched laptop with degraded EDR telemetry.",
    "expected_decision": DecisionType.RESTRICT,
    "expected_score_range": "55 – 79 (Restrict)",
    "agent_expected": True,
    "key_takeaway": "Impossible travel velocity plus degraded host posture flags ambiguity; agent confines user to an isolated read-only sandbox container.",
    "context": AccessContextBundle(
        request_id="req_scen_3_impossible_travel",
        identity=CANONICAL_USER,
        device=DevicePosture(
            device_id="dev_thinkpad_legacy_77",
            is_managed=True,
            os_patch_level=OSPatchLevel.OUTDATED,
            disk_encryption=DiskEncryption.ON,
            edr_agent_status=EDRAgentStatus.DEGRADED,
            jailbroken_or_rooted=False,
        ),
        location=LocationSignal(
            geo_ip_country="GB",
            geo_ip_city="London",
            is_corporate_network=False,
            is_known_location=False,
            impossible_travel_flag=True,
            vpn_tor_detected=False,
        ),
        behavior=BehaviorSignal(
            request_time_hour=14,
            is_outside_working_hours=False,
            typing_velocity_anomaly=False,
            resource_access_pattern_deviation=True,
            failed_logins_last_hour=1,
        ),
        resource=ResourceSignal(
            resource_id="db_q3_customer_analytics",
            sensitivity_tier=SensitivityTier.CONFIDENTIAL,
            action=ResourceAction.READ,
        ),
        access_history=AccessHistorySignal(
            past_access_count_to_this_resource=15,
            last_successful_access_days_ago=3.0,
            historical_deny_count=0,
            average_historical_risk_score=12.0,
        ),
        threat=ThreatSignal(
            known_bad_ip=False,
            leaked_credential_flag=False,
            active_campaign_targeting_sector=False,
            incident_correlated_travel=False,
        ),
    ),
}

# 4. Canonical Scenario 4: Compromised Credential on Restricted Resource (Agent Override)
SCENARIO_4 = {
    "id": "scenario_4_credential_leak_override",
    "title": "4. Leaked Credential & Restricted Export (AI Override)",
    "description": "Sarah's credentials match a recent darknet dump attempting to export customer PII. The deterministic engine yields Restrict (60.0), but the AI SOC Analyst overrides the baseline to DENY.",
    "expected_decision": DecisionType.DENY,
    "expected_score_range": "Deterministic Restrict ➔ AI Override to Deny (88.0)",
    "agent_expected": True,
    "key_takeaway": "Showcases AI Analyst overriding a rigid 5% threat weight to prevent catastrophic data exfiltration.",
    "context": AccessContextBundle(
        request_id="req_scen_4_compromised_creds",
        identity=CANONICAL_USER,
        device=DevicePosture(
            device_id="dev_mac_corp_441",
            is_managed=True,
            os_patch_level=OSPatchLevel.CURRENT,
            disk_encryption=DiskEncryption.ON,
            edr_agent_status=EDRAgentStatus.HEALTHY,
            jailbroken_or_rooted=False,
        ),
        location=LocationSignal(
            geo_ip_country="US",
            geo_ip_city="San Francisco",
            is_corporate_network=True,
            is_known_location=True,
            impossible_travel_flag=False,
            vpn_tor_detected=False,
        ),
        behavior=BehaviorSignal(
            request_time_hour=14,
            is_outside_working_hours=False,
            typing_velocity_anomaly=False,
            resource_access_pattern_deviation=False,
            failed_logins_last_hour=0,
        ),
        resource=ResourceSignal(
            resource_id="db_customer_pii_vault",
            sensitivity_tier=SensitivityTier.RESTRICTED,
            action=ResourceAction.EXPORT,
        ),
        access_history=AccessHistorySignal(
            past_access_count_to_this_resource=10,
            last_successful_access_days_ago=5.0,
            historical_deny_count=0,
            average_historical_risk_score=10.0,
        ),
        threat=ThreatSignal(
            known_bad_ip=False,
            leaked_credential_flag=True,
            active_campaign_targeting_sector=False,
            incident_correlated_travel=False,
        ),
    ),
}

CANONICAL_SCENARIOS = [SCENARIO_1, SCENARIO_2, SCENARIO_3, SCENARIO_4]
SCENARIOS_MAP = {s["id"]: s for s in CANONICAL_SCENARIOS}


# Session Drift Sequence: Continuous Risk Evolution
SESSION_DRIFT_STEPS = [
    {
        "step": 1,
        "time_label": "09:00 AM (Login)",
        "event_description": "Initial morning login from office corporate network on managed laptop.",
        "expected_decision": DecisionType.ALLOW,
        "expected_score": 1.5,
        "context_diff": "Clean baseline context",
        "context": SCENARIO_1["context"],
    },
    {
        "step": 2,
        "time_label": "11:45 AM (Host Drift)",
        "event_description": "Endpoint disk encryption disabled by user and EDR agent telemetry degrades.",
        "expected_decision": DecisionType.CHALLENGE,
        "expected_score": 38.5,
        "context_diff": "Disk encryption OFF, EDR degraded, outside office Wi-Fi",
        "context": AccessContextBundle(
            request_id="req_drift_step_2",
            identity=CANONICAL_USER,
            device=DevicePosture(
                device_id="dev_mac_corp_441",
                is_managed=False,
                os_patch_level=OSPatchLevel.CURRENT,
                disk_encryption=DiskEncryption.OFF,
                edr_agent_status=EDRAgentStatus.DEGRADED,
                jailbroken_or_rooted=False,
            ),
            location=LocationSignal(
                geo_ip_country="US",
                geo_ip_city="San Francisco",
                is_corporate_network=False,
                is_known_location=False,
                impossible_travel_flag=False,
                vpn_tor_detected=False,
            ),
            behavior=BehaviorSignal(
                request_time_hour=11,
                is_outside_working_hours=False,
                typing_velocity_anomaly=False,
                resource_access_pattern_deviation=False,
                failed_logins_last_hour=2,
            ),
            resource=ResourceSignal(
                resource_id="doc_q3_financial_models",
                sensitivity_tier=SensitivityTier.INTERNAL,
                action=ResourceAction.READ,
            ),
            access_history=AccessHistorySignal(
                past_access_count_to_this_resource=86,
                last_successful_access_days_ago=0.1,
                historical_deny_count=0,
                average_historical_risk_score=7.0,
            ),
            threat=ThreatSignal(
                known_bad_ip=False,
                leaked_credential_flag=False,
                active_campaign_targeting_sector=False,
                incident_correlated_travel=False,
            ),
        ),
    },
    {
        "step": 3,
        "time_label": "12:05 PM (Impossible Travel)",
        "event_description": "20 minutes later, simultaneous requests originate from Frankfurt, Germany with Tor exit proxy.",
        "expected_decision": DecisionType.RESTRICT,
        "expected_score": 60.0,
        "context_diff": "Impossible travel flag TRUE, Tor exit node, confidential resource",
        "context": AccessContextBundle(
            request_id="req_drift_step_3",
            identity=CANONICAL_USER,
            device=DevicePosture(
                device_id="dev_mac_corp_441",
                is_managed=True,
                os_patch_level=OSPatchLevel.CURRENT,
                disk_encryption=DiskEncryption.OFF,
                edr_agent_status=EDRAgentStatus.DEGRADED,
                jailbroken_or_rooted=False,
            ),
            location=LocationSignal(
                geo_ip_country="DE",
                geo_ip_city="Frankfurt",
                is_corporate_network=False,
                is_known_location=False,
                impossible_travel_flag=True,
                vpn_tor_detected=True,
            ),
            behavior=BehaviorSignal(
                request_time_hour=12,
                is_outside_working_hours=False,
                typing_velocity_anomaly=True,
                resource_access_pattern_deviation=True,
                failed_logins_last_hour=2,
            ),
            resource=ResourceSignal(
                resource_id="db_q3_customer_analytics",
                sensitivity_tier=SensitivityTier.CONFIDENTIAL,
                action=ResourceAction.READ,
            ),
            access_history=AccessHistorySignal(
                past_access_count_to_this_resource=16,
                last_successful_access_days_ago=0.01,
                historical_deny_count=0,
                average_historical_risk_score=15.0,
            ),
            threat=ThreatSignal(
                known_bad_ip=False,
                leaked_credential_flag=False,
                active_campaign_targeting_sector=False,
                incident_correlated_travel=False,
            ),
        ),
    },
    {
        "step": 4,
        "time_label": "12:15 PM (Exfiltration Attempt)",
        "event_description": "Immediate bulk export requested on Restricted PII database while user token is flagged in credential dump.",
        "expected_decision": DecisionType.DENY,
        "expected_score": 88.0,
        "context_diff": "Restricted tier, Export action, Darknet leaked credential",
        "context": SCENARIO_4["context"],
    },
]
