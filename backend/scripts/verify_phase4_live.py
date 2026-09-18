import httpx

base = "http://localhost:8000"
with httpx.Client(base_url=base, timeout=10.0) as client:
    # 1. List scenarios
    scens = client.get("/api/scenarios").json()
    print(f"1. Scenarios loaded: {len(scens)}")
    for s in scens:
        print(f"   - {s['id']}: {s['title']} -> Expected: {s['expected_decision']}")

    # 2. Replay all 4 scenarios live
    print("\n2. Replaying 4 canonical scenarios live:")
    for s in scens:
        r = client.post(f"/api/scenarios/{s['id']}/replay").json()
        print(f"   * {s['id']}: Final Decision={r['final_decision']}, Score={r['final_score']}, Agent={r['agent_invoked']}")

    # 3. Replay session drift
    print("\n3. Replaying continuous session drift:")
    drift = client.post("/api/simulator/drift-session").json()
    for step in drift["timeline"]:
        eval_data = step["evaluation"]
        print(f"   * Step {step['step']} ({step['time_label']}) -> {eval_data['final_decision']} (Score: {eval_data['final_score']})")

    # 4. Live knob-tuning mutation
    print("\n4. Live knob-tuning mutation:")
    mut_payload = {
        "base_scenario_id": "scenario_1_trusted_baseline",
        "mutations": {
            "location": {"impossible_travel_flag": True, "is_corporate_network": False}
        }
    }
    mut_res = client.post("/api/simulator/mutate", json=mut_payload).json()
    print(f"   * Mutated Baseline -> Decision={mut_res['final_decision']}, Score={mut_res['final_score']}")

    # 5. Query audit log
    print("\n5. Querying audit log:")
    logs = client.get("/api/audit-log?limit=5").json()
    print(f"   * Total evaluations in DB: {logs['total']}")
    print(f"   * Latest evaluation ID: {logs['items'][0]['evaluation_id']}, Decision: {logs['items'][0]['final_decision']}")
