import httpx

res = httpx.post("http://localhost:8000/api/simulator/drift-session").json()
for s in res["timeline"]:
    ev = s["evaluation"]
    step_num = s["step"]
    time_lbl = s["time_label"]
    dec = ev["final_decision"]
    score = ev["final_score"]
    amb = ev["is_ambiguous"]
    inv = ev["agent_invoked"]
    print(f"Step {step_num} ({time_lbl}): Decision={dec}, Score={score}, is_ambiguous={amb}, agent_invoked={inv}")
    if inv and ev.get("agent_reasoning"):
        print(f"   Agent Decision={ev['agent_reasoning']['decision']}, Overrode={ev['agent_reasoning']['overrode_baseline']}")
        print(f"   Agent Narrative: {ev['agent_reasoning']['narrative'][:100]}...")
