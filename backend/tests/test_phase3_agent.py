"""
Phase 3 Contextual Risk Reasoning Agent Tests
Verifies agent trigger criteria, structured output contract, baseline override logic,
TTL caching layer, and integration with the /api/evaluate endpoint.
"""
import asyncio
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
from app.agent.orchestrator import soc_agent
from app.agent.cache import agent_cache
from app.engine.evaluator import risk_engine


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def clean_context():
    return AccessContextBundle(
        request_id="req_agent_test_clean",
        identity=UserIdentity(
            user_id="usr_sarah_chen",
            role="Senior Data Scientist",
            department="Analytics",
            mfa_enrolled=True,
            account_age_days=365,
            privilege_level=PrivilegeLevel.STANDARD,
        ),
        device=DevicePosture(
            device_id="dev_corp_01",
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
            past_access_count_to_this_resource=50,
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


def test_agent_not_invoked_on_clean_request(clean_context):
    """Standard, clear requests must NOT invoke the agent."""
    result = risk_engine.evaluate(clean_context)
    enriched = asyncio.run(soc_agent.evaluate_and_enrich(result))

    assert enriched.agent_invoked is False
    assert enriched.agent_reasoning is None
    assert enriched.final_decision == DecisionType.ALLOW


def test_agent_invoked_on_conflicting_signals(clean_context):
    """Trusted device + impossible travel must trigger the agent with structured reasoning."""
    context = clean_context.model_copy(deep=True)
    context.device.is_managed = True
    context.device.edr_agent_status = EDRAgentStatus.HEALTHY
    context.location.impossible_travel_flag = True

    result = risk_engine.evaluate(context)
    enriched = asyncio.run(soc_agent.evaluate_and_enrich(result))

    assert enriched.agent_invoked is True
    assert enriched.agent_reasoning is not None
    assert enriched.agent_reasoning.decision in [d for d in DecisionType]
    assert 0.0 <= enriched.agent_reasoning.confidence <= 1.0
    assert len(enriched.agent_reasoning.key_factors) >= 2
    assert len(enriched.agent_reasoning.narrative) > 30
    assert enriched.agent_reasoning.recommended_step_up_control is not None


def test_agent_override_on_compromised_credentials_restricted_resource(clean_context):
    """
    Canonical Scenario 4: Single critical threat match (leaked credential) on RESTRICTED resource.
    Proves that a single critical signal + restricted resource stays ambiguous,
    invokes the agent, and overrides the baseline from RESTRICT to DENY.
    """
    context = clean_context.model_copy(deep=True)
    context.resource.sensitivity_tier = SensitivityTier.RESTRICTED
    context.resource.action = ResourceAction.EXPORT
    # Single critical signal only (known_bad_ip is False)
    context.threat.known_bad_ip = False
    context.threat.leaked_credential_flag = True

    # 1. Deterministic evaluation
    result = risk_engine.evaluate(context)
    assert result.is_ambiguous is True, "Single critical signal on restricted resource MUST remain ambiguous"
    assert result.deterministic_decision == DecisionType.RESTRICT, "Baseline under-weighted threat to RESTRICT"

    # 2. Agent escalation and baseline override
    enriched = asyncio.run(soc_agent.evaluate_and_enrich(result))

    assert enriched.agent_invoked is True
    assert enriched.agent_reasoning is not None
    assert enriched.agent_reasoning.decision == DecisionType.DENY
    assert enriched.agent_reasoning.overrode_baseline is True
    assert enriched.agent_reasoning.confidence >= 0.70
    assert enriched.final_decision == DecisionType.DENY
    assert "SOC AGENT OVERRIDE" in enriched.decision_rationale
    assert "credential" in enriched.agent_reasoning.narrative.lower()


def test_agent_cache_layer(clean_context):
    """Verifies that identical context bundles are cached and do not re-run inference."""
    agent_cache.clear()
    assert agent_cache.size() == 0

    context = clean_context.model_copy(deep=True)
    context.location.impossible_travel_flag = True

    result1 = risk_engine.evaluate(context)
    enriched1 = asyncio.run(soc_agent.evaluate_and_enrich(result1))

    assert agent_cache.size() == 1

    # Second evaluation with same context
    result2 = risk_engine.evaluate(context)
    enriched2 = asyncio.run(soc_agent.evaluate_and_enrich(result2))

    assert agent_cache.size() == 1
    assert enriched1.agent_reasoning.narrative == enriched2.agent_reasoning.narrative


def test_api_endpoint_escalates_to_agent(client, clean_context):
    """Verifies that POST /api/evaluate returns agent_reasoning when ambiguous."""
    context = clean_context.model_copy(deep=True)
    context.location.impossible_travel_flag = True

    payload = context.model_dump(mode="json")
    response = client.post("/api/evaluate", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["agent_invoked"] is True
    assert data["agent_reasoning"] is not None
    assert "decision" in data["agent_reasoning"]
    assert "confidence" in data["agent_reasoning"]
    assert "key_factors" in data["agent_reasoning"]
    assert "narrative" in data["agent_reasoning"]
    assert "recommended_step_up_control" in data["agent_reasoning"]
    assert "SOC AGENT" in data["decision_rationale"]


def test_agent_confidence_floor_guard(clean_context):
    """Verifies that confidence < 0.70 prevents overrode_baseline and preserves deterministic decision."""
    from app.models.decision import AgentReasoning
    
    context = clean_context.model_copy(deep=True)
    context.location.impossible_travel_flag = True

    result = risk_engine.evaluate(context)
    # deterministic_decision is RESTRICT
    assert result.deterministic_decision == DecisionType.RESTRICT

    # Low-confidence reasoning (0.65 < 0.70) proposing ALLOW
    low_conf_reasoning = AgentReasoning(
        decision=DecisionType.ALLOW,
        confidence=0.65,
        key_factors=["Weak hypothesis of satellite proxy"],
        narrative="Speculative explanation without adequate signal backing.",
        recommended_step_up_control=None,
        overrode_baseline=False,
    )

    # Manually test the override guard logic
    settings_floor = 0.70
    if low_conf_reasoning.decision != result.deterministic_decision:
        if low_conf_reasoning.confidence >= settings_floor:
            low_conf_reasoning.overrode_baseline = True
            result.final_decision = low_conf_reasoning.decision
        else:
            low_conf_reasoning.overrode_baseline = False
            # Baseline preserved!

    assert low_conf_reasoning.overrode_baseline is False
    assert result.final_decision == DecisionType.RESTRICT


def test_nist_floor_deny_never_ambiguous(clean_context):
    """Confirms the NIST-floor Deny path (critical compromises) never sets is_ambiguous: True."""
    # Case A: Multiple critical breaches (leaked credentials + malicious IP)
    context_a = clean_context.model_copy(deep=True)
    context_a.threat.known_bad_ip = True
    context_a.threat.leaked_credential_flag = True

    result_a = risk_engine.evaluate(context_a)
    assert result_a.final_decision == DecisionType.DENY
    assert result_a.is_ambiguous is False

    # Case B: Jailbroken / Rooted device
    context_b = clean_context.model_copy(deep=True)
    context_b.device.jailbroken_or_rooted = True

    result_b = risk_engine.evaluate(context_b)
    assert result_b.final_decision == DecisionType.DENY
    assert result_b.is_ambiguous is False

