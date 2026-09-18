# ContextGuard: 90-Second Hackathon Judge Pitch & Demo Script

> **Theme**: Zero-Trust Access Intelligence Engine  
> **Core Thesis**: *"Context beats Role. The exact same user, with the exact same role and credentials, must receive fundamentally different access decisions under different risk contexts."*  
> **Target Duration**: 90 seconds (plus 30s optional Q&A buffer)

---

## Pitch Setup & Screen State
- **Browser Window**: Maximized on `http://localhost:3000` (`Decision Console` tab active).
- **Speaker Persona**: Confident, security-minded engineer addressing enterprise CISO / Zero-Trust judges.

---

## Minute-by-Minute Script

```
[00:00 – 00:15]  THE HOOK: WHY ZERO-TRUST RBAC IS BROKEN
```
> **Speaker**:  
> *"Traditional Role-Based Access Control is fundamentally broken in modern cloud infrastructure. If an attacker steals valid credentials for a senior employee, RBAC blindly grants access because the role checks out.*  
>  
> *Meet **ContextGuard** — an autonomous risk-based Zero-Trust Access Intelligence Engine. ContextGuard evaluates access across **seven real-time signal dimensions**: Identity, Device Health, Location, Behavior, Resource Sensitivity, History, and Threat Intelligence. Our core architecture combines a **sub-millisecond deterministic rules core** for transparent auditability, paired with a **single narrow AI SOC Analyst** invoked only when signals conflict."*

---

```
[00:15 – 00:30]  SCENARIO 1: CLEAN CORPORATE BASELINE (ALLOW)
```
> **Action**: Click **Scenario 1: Trusted Corporate Baseline**.  
> **Screen Cue**: Point to the emerald **`ALLOW`** badge and Composite Risk Score **`1.5 / 100`**.
>
> **Speaker**:  
> *"Here is **Sarah Chen**, our Lead Financial Data Scientist. She's logging in at 2 PM from her corporate-issued Mac in San Francisco to read internal Q3 financial models.*  
>  
> *Notice: The device is encrypted, MDM-healthy, corporate IP verified. ContextGuard's deterministic core scores this at **1.5 out of 100**. Access is **immediately ALLOWED** with zero user friction. Notice the agent is marked FALSE — we never waste LLM tokens on clean traffic."*

---

```
[00:30 – 00:45]  SCENARIO 2: CONTEXT DEGRADATION (CHALLENGE)
```
> **Action**: Click **Scenario 2: New Personal Device at 2:30 AM**.  
> **Screen Cue**: Point to the amber **`CHALLENGE`** badge and Risk Score **`40.0 / 100`**.
>
> **Speaker**:  
> *"Now, look at what happens. **Same user: Sarah Chen. Same role. Same financial document.** But now it's 2:30 in the morning from an unmanaged personal iPad on home Wi-Fi.*  
>  
> *Without changing any permissions or revoking her role, ContextGuard detects the unmanaged host and off-hours timing anomaly. Her risk score climbs to **40.0 / 100**, instantly triggering an automated **`CHALLENGE`** for WebAuthn hardware MFA. Context degradation, measured in real time."*

---

```
[00:45 – 01:05]  SCENARIO 3: AMBIGUITY ESCALATION (RESTRICT)
```
> **Action**: Click **Scenario 3: Impossible Travel + Outdated Device**.  
> **Screen Cue**: Point to the orange **`RESTRICT`** badge (`61.3 / 100`) and the highlighted **`Contextual Risk Reasoning Agent`** card.
>
> **Speaker**:  
> *"Just 30 minutes later, Sarah's account requests confidential analytics from London on an unpatched laptop with degraded EDR telemetry.*  
>  
> *Physical velocity says this is impossible transit ($11{,}000\text{ km/h}$). Because this triggers our **Ambiguity Detector**, ContextGuard automatically escalates to our **AI SOC Analyst**.  
>  
> *Look at the AI card: with **98% confidence**, Claude analyzes her flight schedule versus active session tokens, diagnoses potential session hijacking, and recommends **`RESTRICT`**. Instead of a blunt binary block that interrupts valid business travel, ContextGuard dynamically confines Sarah to an isolated read-only sandbox."*

---

```
[01:05 – 01:20]  SCENARIO 4: THE GRAND SLAM — AI SOC OVERRIDE (DENY)
```
> **Action**: Click **Scenario 4: Leaked Credential & Restricted Export**.  
> **Screen Cue**: Point to the red **`DENY [AI Override]`** badge (`88.0 / 100`) and the orange **`Deterministic Override`** banner.
>
> **Speaker**:  
> *"Here is ContextGuard's strongest differentiator. Sarah's credential appears in a darknet dump, attempting a bulk data export on customer PII.*  
>  
> *A standard deterministic engine gives Threat Intelligence only a 5% static weight, yielding a score of 60.0 — which would merely restrict access. But our AI SOC Analyst correlates the compromised credential hash with the catastrophic blast radius of restricted PII.  
>  
> *The AI Agent **OVERRIDES** the deterministic baseline, elevating the score to **88.0** and enforcing an immediate **`DENY`** with automated session token revocation. Mathematical speed when predictable; agentic intelligence when critical."*

---

```
[01:20 – 01:30]  SESSION DRIFT & AUDIT TRAIL CLOSE
```
> **Action**: Click the **Continuous Session Drift** tab, then quickly show the **Audit Trail** tab.  
> **Screen Cue**: Show the 4-step progressive timeline (`1.5` ➔ `34.1` ➔ `67.3` ➔ `88.0`) and the SQLite database table.
>
> **Speaker**:  
> *"Zero-Trust isn't a one-time login gate. On our Continuous Drift tab, you can see Sarah's active session continuously tracked across 4 hours as posture drifts from Allow to Challenge to Restrict to Deny. Every single raw signal, calculation, and AI narrative is immutably persisted in our SQLite audit trail.*  
>  
> *Context beats role. That is ContextGuard. Thank you, and we welcome your questions!"*

---

## Handling Judge Questions (Cheat Sheet)

| Question | Winning Answer |
|---|---|
| **"Why not use an LLM for every single request?"** | *"Latency, cost, and auditability. Evaluating thousands of requests/sec with an LLM introduces 500ms+ latency and token bills. Our deterministic core resolves 95%+ of clean requests in sub-milliseconds with mathematical auditability, invoking Claude only when signals conflict or breach thresholds."* |
| **"How do you prevent AI hallucinations from breaking security?"** | *"Strict guardrails: (1) Typed Pydantic v2 schemas and JSON extraction, (2) an enforced confidence floor ($\ge 0.70$) before any override is permitted, and (3) hard NIST-floor rules (e.g. jailbroken device or multiple critical signals) that force Deny without ambiguity."* |
| **"How do you handle live policy tuning?"** | *"On our Policy tab and Signal Knob-Tuner, security engineers can tune category weights, slide threshold boundaries live, and simulate synthetic signal mutations over WebSockets in real time."* |
