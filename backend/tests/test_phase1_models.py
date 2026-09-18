"""
Phase 1 Model Parity & Validation Tests
Ensures all 7 context signal models and evaluation schemas are valid and instantiable.
"""
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
from app.models.decision import (
    DecisionType,
    RuleSeverity,
    RuleTrigger,
    CategoryScore,
    AgentReasoning,
    AccessEvaluationResult,
)
from app.models.policy import EnginePolicy


def test_models_instantiation():
    # 1. User Identity
    identity = UserIdentity(
        user_id="usr_sarah_chen",
        role="Lead Security Architect",
        department="SecOps",
        mfa_enrolled=True,
        account_age_days=420,
        privilege_level=PrivilegeLevel.ELEVATED,
    )

    # 2. Device Posture
    device = DevicePosture(
        device_id="dev_mac_corp_902",
        is_managed=True,
        os_patch_level=OSPatchLevel.CURRENT,
        disk_encryption=DiskEncryption.ON,
        edr_agent_status=EDRAgentStatus.HEALTHY,
        jailbroken_or_rooted=False,
    )

    # 3. Location Signal
    location = LocationSignal(
        geo_ip_country="US",
        geo_ip_city="Seattle",
        is_corporate_network=True,
        is_known_location=True,
        impossible_travel_flag=False,
        vpn_tor_detected=False,
    )

    # 4. Behavior Signal
    behavior = BehaviorSignal(
        request_time_hour=11,
        is_outside_working_hours=False,
        typing_velocity_anomaly=False,
        resource_access_pattern_deviation=False,
        failed_logins_last_hour=0,
    )

    # 5. Resource Signal
    resource = ResourceSignal(
        resource_id="db_pii_vault_production",
        sensitivity_tier=SensitivityTier.RESTRICTED,
        action=ResourceAction.READ,
    )

    # 6. Access History Signal
    history = AccessHistorySignal(
        past_access_count_to_this_resource=45,
        last_successful_access_days_ago=0.5,
        historical_deny_count=0,
        average_historical_risk_score=10.0,
    )

    # 7. Threat Signal
    threat = ThreatSignal(
        known_bad_ip=False,
        leaked_credential_flag=False,
        active_campaign_targeting_sector=False,
        incident_correlated_travel=False,
    )

    bundle = AccessContextBundle(
        request_id="req_test_001",
        identity=identity,
        device=device,
        location=location,
        behavior=behavior,
        resource=resource,
        access_history=history,
        threat=threat,
    )

    assert bundle.identity.user_id == "usr_sarah_chen"
    assert bundle.resource.sensitivity_tier == SensitivityTier.RESTRICTED
    assert bundle.device.is_managed is True

    # Policy
    policy = EnginePolicy()
    assert policy.thresholds.allow_max == 29.0

    print("Phase 1 model validation tests PASSED successfully!")


if __name__ == "__main__":
    test_models_instantiation()
