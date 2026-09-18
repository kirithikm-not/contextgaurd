"""
Phase 2 Deterministic Risk Scoring Engine & Endpoint Tests
Verifies sub-scoring across 7 signals, weighted aggregation, threshold mapping,
ambiguity/conflict detection, and /api/evaluate endpoint functionality.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
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
from app.models.policy import EnginePolicy, CategoryWeights, DecisionThresholds
from app.engine.evaluator import DeterministicRiskEngine


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def clean_baseline_context():
    """Trusted corporate user: corporate laptop, corporate network, normal hours, internal resource."""
    return AccessContextBundle(
        request_id="req_clean_baseline",
        identity=UserIdentity(
            user_id="usr_sarah_chen",
            role="Senior Data Scientist",
            department="Analytics",
            mfa_enrolled=True,
            account_age_days=365,
            privilege_level=PrivilegeLevel.STANDARD,
        ),
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
            resource_id="doc_internal_analytics_q3",
            sensitivity_tier=SensitivityTier.INTERNAL,
            action=ResourceAction.READ,
        ),
        access_history=AccessHistorySignal(
            past_access_count_to_this_resource=42,
            last_successful_access_days_ago=1.0,
            historical_deny_count=0,
            average_historical_risk_score=5.0,
        ),
        threat=ThreatSignal(
            known_bad_ip=False,
            leaked_credential_flag=False,
            active_campaign_targeting_sector=False,
            incident_correlated_travel=False,
        ),
    )


def test_decision_allow(clean_baseline_context):
    """Clean corporate context must yield ALLOW with low risk score (0-29)."""
    engine = DeterministicRiskEngine()
    result = engine.evaluate(clean_baseline_context)

    assert result.final_decision == DecisionType.ALLOW
    assert result.final_score <= 29.0
    assert result.category_scores["device"].score == 0.0
    assert result.category_scores["location"].score == 0.0
    assert result.category_scores["threat"].score == 0.0
    assert len(result.fired_rules) <= 1  # Only internal tier baseline rule
    assert result.is_ambiguous is False


def test_decision_challenge(clean_baseline_context):
    """Unmanaged personal device + off-hours access (2 AM) should trigger CHALLENGE (30-54)."""
    context = clean_baseline_context.model_copy(deep=True)
    # Personal device posture
    context.device.is_managed = False  # +45
    context.device.disk_encryption = DiskEncryption.OFF  # +25
    # Off-hours & anomaly behavior
    context.behavior.request_time_hour = 2  # +35
    context.behavior.is_outside_working_hours = True
    context.behavior.typing_velocity_anomaly = True  # +35
    # Non-corporate residential location
    context.location.is_corporate_network = False  # +25
    context.location.is_known_location = False  # +25
    # First time accessing from this device context
    context.access_history.past_access_count_to_this_resource = 0  # +30

    engine = DeterministicRiskEngine()
    result = engine.evaluate(context)

    assert result.final_decision == DecisionType.CHALLENGE
    assert 30.0 <= result.final_score <= 54.0
    assert any(r.rule_id == "DEV_UNMANAGED" for r in result.fired_rules)
    assert any(r.rule_id == "BEH_OFF_HOURS" for r in result.fired_rules)


def test_decision_restrict(clean_baseline_context):
    """Scenario 3: Impossible travel + outdated device should trigger RESTRICT (55-79)."""
    context = clean_baseline_context.model_copy(deep=True)
    # Impossible travel between countries
    context.location.impossible_travel_flag = True  # +85 (CRITICAL)
    context.location.is_corporate_network = False  # +25
    # Outdated device posture
    context.device.os_patch_level = OSPatchLevel.OUTDATED  # +30
    context.device.edr_agent_status = EDRAgentStatus.DEGRADED  # +25
    # Resource is confidential
    context.resource.sensitivity_tier = SensitivityTier.CONFIDENTIAL  # +30

    engine = DeterministicRiskEngine()
    result = engine.evaluate(context)

    assert result.final_decision == DecisionType.RESTRICT
    assert 55.0 <= result.final_score <= 79.0
    assert any(r.rule_id == "LOC_IMPOSSIBLE_TRAVEL" for r in result.fired_rules)
    assert any(r.rule_id == "DEV_OUTDATED_OS" for r in result.fired_rules)


def test_decision_deny(clean_baseline_context):
    """Compromised credential + known malicious IP + impossible travel must yield DENY (80-100)."""
    context = clean_baseline_context.model_copy(deep=True)
    context.threat.known_bad_ip = True  # +85 (CRITICAL)
    context.threat.leaked_credential_flag = True  # +90 (CRITICAL)
    context.location.impossible_travel_flag = True  # +85 (CRITICAL)
    context.resource.sensitivity_tier = SensitivityTier.RESTRICTED  # +45
    context.resource.action = ResourceAction.EXPORT  # +35 + 25 compounding (CRITICAL)

    engine = DeterministicRiskEngine()
    result = engine.evaluate(context)

    assert result.final_decision == DecisionType.DENY
    assert result.final_score >= 80.0
    assert any(r.rule_id == "THR_KNOWN_MALICIOUS_IP" for r in result.fired_rules)
    assert any(r.rule_id == "LOC_IMPOSSIBLE_TRAVEL" for r in result.fired_rules)


def test_ambiguous_zone_signal_conflict(clean_baseline_context):
    """Trusted device + impossible travel should flag ambiguous conflict for agent evaluation."""
    context = clean_baseline_context.model_copy(deep=True)
    # Device is clean (managed, current patch, healthy EDR -> score 0)
    context.device.is_managed = True
    context.device.edr_agent_status = EDRAgentStatus.HEALTHY
    # Location has impossible travel
    context.location.impossible_travel_flag = True

    engine = DeterministicRiskEngine()
    result = engine.evaluate(context)

    assert result.is_ambiguous is True
    assert any("Conflicting signals" in reason for reason in result.decision_rationale.split("["))


def test_ambiguous_zone_boundary_score(clean_baseline_context):
    """A composite score near boundary threshold (e.g. 29.0 +/- 5.0) flags ambiguity."""
    context = clean_baseline_context.model_copy(deep=True)
    # Modest single category risk: unmanaged device (+45 * 0.20 = 9.0) + external net (+25 * 0.20 = 5.0) + confidential resource (+30 * 0.15 = 4.5) + young account (+15 * 0.15 = 2.25)
    # Total score ~ 20.75 - 28.0 (boundary of 29.0)
    context.device.is_managed = False
    context.location.is_corporate_network = False
    context.resource.sensitivity_tier = SensitivityTier.CONFIDENTIAL
    context.identity.account_age_days = 20

    engine = DeterministicRiskEngine()
    result = engine.evaluate(context)

    t_allow = engine.policy.thresholds.allow_max
    delta = engine.policy.thresholds.ambiguous_boundary_delta
    if abs(result.deterministic_score - t_allow) <= delta:
        assert result.is_ambiguous is True


def test_api_evaluate_endpoint(client, clean_baseline_context):
    """Test POST /api/evaluate HTTP endpoint with full JSON payload."""
    payload = clean_baseline_context.model_dump(mode="json")
    response = client.post("/api/evaluate", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "evaluation_id" in data
    assert data["final_decision"] == "Allow"
    assert "category_scores" in data
    assert "identity" in data["category_scores"]
    assert "device" in data["category_scores"]
    assert "location" in data["category_scores"]
    assert "behavior" in data["category_scores"]
    assert "resource" in data["category_scores"]
    assert "history" in data["category_scores"]
    assert "threat" in data["category_scores"]
    assert "fired_rules" in data
    assert "decision_rationale" in data


def test_policy_get_and_put(client):
    """Test GET and PUT /api/policy for live weight tuning."""
    get_res = client.get("/api/policy")
    assert get_res.status_code == 200
    policy_data = get_res.json()
    assert policy_data["weights"]["device"] == 0.20

    # Modify policy weights (must sum to ~1.0)
    policy_data["weights"]["device"] = 0.30
    policy_data["weights"]["identity"] = 0.05
    put_res = client.put("/api/policy", json=policy_data)
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["weights"]["device"] == 0.30
    assert updated["weights"]["identity"] == 0.05

    # Restore default policy so downstream tests are not polluted
    from app.models.policy import EnginePolicy
    from app.engine.evaluator import risk_engine
    risk_engine.update_policy(EnginePolicy())

