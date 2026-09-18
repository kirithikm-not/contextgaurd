"""
Phase 4 Scenario Simulator & Synthetic Data Engine Tests
Verifies the 4 canonical scenarios, continuous session risk drift, live signal mutations (knob-tuning),
and SQLite audit log persistence and filtering.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.simulator.scenarios import CANONICAL_SCENARIOS, SCENARIOS_MAP
from app.db.database import query_audit_logs


@pytest.fixture
def client():
    return TestClient(app)


def test_list_canonical_scenarios(client):
    """GET /api/scenarios must return exactly the four canonical scenarios."""
    response = client.get("/api/scenarios")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 4
    scenario_ids = [s["id"] for s in data]
    assert "scenario_1_trusted_baseline" in scenario_ids
    assert "scenario_2_new_device_unusual_hour" in scenario_ids
    assert "scenario_3_impossible_travel_outdated" in scenario_ids
    assert "scenario_4_credential_leak_override" in scenario_ids


def test_replay_scenario_1_trusted_baseline(client):
    """Scenario 1: Sarah Chen corporate baseline -> ALLOW (0-29)."""
    response = client.post("/api/scenarios/scenario_1_trusted_baseline/replay")
    assert response.status_code == 200
    data = response.json()
    assert data["final_decision"] == "Allow"
    assert data["final_score"] <= 29.0
    assert data["agent_invoked"] is False


def test_replay_scenario_2_new_device_unusual_hour(client):
    """Scenario 2: Same Sarah Chen on unmanaged iPad at 2:30 AM -> CHALLENGE (30-54)."""
    response = client.post("/api/scenarios/scenario_2_new_device_unusual_hour/replay")
    assert response.status_code == 200
    data = response.json()
    assert data["final_decision"] == "Challenge"
    assert 30.0 <= data["final_score"] <= 54.0


def test_replay_scenario_3_impossible_travel(client):
    """Scenario 3: Same Sarah Chen with impossible travel to London -> RESTRICT + Agent."""
    response = client.post("/api/scenarios/scenario_3_impossible_travel_outdated/replay")
    assert response.status_code == 200
    data = response.json()
    assert data["final_decision"] == "Restrict"
    assert 55.0 <= data["final_score"] <= 79.0
    assert data["agent_invoked"] is True


def test_replay_scenario_4_credential_leak_ai_override(client):
    """
    Scenario 4: Leaked credential on restricted resource export ->
    Deterministic Restrict (60.0), Agent overrides baseline to DENY (88.0).
    """
    response = client.post("/api/scenarios/scenario_4_credential_leak_override/replay")
    assert response.status_code == 200
    data = response.json()
    assert data["deterministic_decision"] == "Restrict"
    assert data["deterministic_score"] == 60.0
    assert data["is_ambiguous"] is True
    assert data["agent_invoked"] is True
    assert data["agent_reasoning"]["decision"] == "Deny"
    assert data["agent_reasoning"]["overrode_baseline"] is True
    assert data["final_decision"] == "Deny"
    assert data["final_score"] == 88.0
    assert "SOC AGENT OVERRIDE" in data["decision_rationale"]


def test_session_drift_simulation(client):
    """
    POST /api/simulator/drift-session executes continuous risk step-downs:
    Step 1: Allow -> Step 2: Challenge -> Step 3: Restrict -> Step 4: Deny.
    """
    response = client.post("/api/simulator/drift-session")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    timeline = data["timeline"]
    assert len(timeline) == 4

    decisions = [t["evaluation"]["final_decision"] for t in timeline]
    assert decisions[0] == "Allow"
    assert decisions[1] == "Challenge"
    assert decisions[2] == "Restrict"
    assert decisions[3] == "Deny"


def test_knob_tuning_mutation(client):
    """
    POST /api/simulator/mutate: Take baseline and toggle impossible travel flag.
    Verifies that mutating a single signal on the fly alters the outcome in real time.
    """
    payload = {
        "base_scenario_id": "scenario_1_trusted_baseline",
        "mutations": {
            "location": {
                "impossible_travel_flag": True,
                "is_corporate_network": False
            }
        }
    }
    response = client.post("/api/simulator/mutate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["final_decision"] in ("Restrict", "Deny")
    assert data["category_scores"]["location"]["score"] > 80.0


def test_audit_log_persistence_and_filtering(client):
    """Verifies that all evaluations are stored in SQLite and can be filtered."""
    # Trigger an evaluation
    client.post("/api/scenarios/scenario_1_trusted_baseline/replay")

    # Query audit logs
    logs_res = client.get("/api/audit-log?limit=10")
    assert logs_res.status_code == 200
    data = logs_res.json()
    assert data["total"] > 0
    assert len(data["items"]) > 0

    first_entry = data["items"][0]
    assert "evaluation_id" in first_entry
    assert "user_id" in first_entry
    assert "final_decision" in first_entry
    assert "context" in first_entry

    # Test filter by decision
    deny_res = client.get("/api/audit-log?decision=Deny")
    assert deny_res.status_code == 200
    deny_data = deny_res.json()
    for item in deny_data["items"]:
        assert item["final_decision"] == "Deny"
