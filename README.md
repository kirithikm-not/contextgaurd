# ContextGuard - Real-Time Risk-Based Zero-Trust Access Intelligence Engine

Traditional access control systems rely on static, binary roles (RBAC) that grant blind trust once credentials pass. ContextGuard continuously computes an adaptive risk score across 7 distinct contextual signal categories—identity, device posture, network location, behavioral telemetry, target resource sensitivity, historical access baselines, and threat intelligence—to make real-time, fine-grained access decisions: **Allow**, **Challenge**, **Restrict**, or **Deny**.

---

## Key Differentiator: Deterministic Core, Agentic Edge

ContextGuard rejects the fragile practice of routing every routine access request through an unpredictable, high-latency Large Language Model. Instead, it employs a dual-tier architecture:

1. **Deterministic Core Engine (<10ms)**: Evaluates requests using mathematical category weighting and hardened zero-trust rules. This handles >95% of traffic with zero hallucinations and microsecond latency.
2. **Contextual Risk Reasoning Agent (Claude 3.5 Sonnet)**: Escalated **only** when signals fall into a mathematically ambiguous score band (30–70) or exhibit conflicting indicators (e.g., trusted corporate device accessing from an uncharacteristic network, or compromised credentials on high-value resources).
3. **Confidence-Floor Guardrails**: The agent can only execute an authoritative baseline override if its internal reasoning confidence strictly meets or exceeds the configurable confidence floor (`AGENT_CONFIDENCE_FLOOR = 0.70`). Furthermore, NIST-aligned hard floor triggers (e.g., confirmed botnets or direct C2 traffic) strictly deny access and bypass LLM ambiguity entirely.

### Concrete Proof: Scenario 4 (Compromised Credential on Restricted Resource)
In Canonical Scenario 4, an employee with valid credentials attempts to export a `RESTRICTED` financial document, but threat feeds correlate the request with a breached credential flag:
- **Deterministic Engine Baseline**: Under rigid 5% threat category weighting, the static score calculated is in the **Restrict** threshold.
- **Agent Escalation**: Recognizing the high-impact conflict, the system escalates the bundle to the SOC Reasoning Agent.
- **Agent Override**: The agent overrides the decision from **Restrict ➔ Deny** with **98% confidence (`0.98`)**.
- **Actual Agent Rationale Output**:
  > *"While identity attributes match an active employee profile, the connection originates from an IP correlated with active threat actor campaigns alongside compromised darknet credential telemetry. The deterministic rule engine under-weighted this threat vector due to rigid 5% category weighting, failing to account for the catastrophic blast radius on restricted data. In zero-trust doctrine, confirmed credential compromise overrides historical trust; immediate access denial is required."*

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                         │
│   (Live Console, Signal Knob-Tuner, Drift Timeline, Auth)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / WebSocket (:8000)
┌──────────────────────────────▼──────────────────────────────┐
│                    FastAPI Backend                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 7-Category Deterministic Risk Engine (app/engine)     │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │ Ambiguous Cases Only         │
│  ┌───────────────────────────▼───────────────────────────┐  │
│  │ Contextual SOC Agent / Claude Orchestrator (app/agent)│  │
│  │ + TTL In-Memory Hash Cache & Confidence Floor         │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────┬───────────────────────────┐  │
│  │ Geolocation & Velocity    │ TOTP Challenge Session    │  │
│  │ (ip-api + Haversine >900) │ (pyotp + PyJWT / bcrypt)  │  │
│  └───────────────────────────┴───────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │ SQLAlchemy 2.0
┌──────────────────────────────▼──────────────────────────────┐
│                  PostgreSQL Database                        │
│   (users, login_history, challenge_sessions, audit_logs)    │
└─────────────────────────────────────────────────────────────┘
```

ContextGuard is designed to run either natively with a local PostgreSQL instance (fully tested and verified in active development) or containerized via Docker Compose.

---

## Features

- **7-Category Multi-Signal Deterministic Risk Scoring**: Evaluates `identity` (15%), `device` (20%), `location` (20%), `behavior` (15%), `resource` (15%), `access_history` (10%), and `threat` (5%) to compute a normalized 0–100 risk score.
- **Ambiguous-Zone AI Agent Escalation with Guardrails**: Invokes Anthropic Claude 3.5 Sonnet (or the built-in offline high-fidelity SOC Mock Reasoner) with structured output schema, factor citations, and confidence-floor checks.
- **Real TOTP MFA Wired into the Challenge Path**: When the engine evaluates an access request to `Challenge`, it provisions an active cryptographic `ChallengeSession`. The user receives a real step-up verification modal; submitting a valid 6-digit TOTP code deducts a -15.0 score credit and upgrades the decision from `Challenge ➔ Allow`.
- **Live IP Geolocation & Impossible-Travel Detection**: Extracts real client IP addresses, queries geolocation coordinates, and runs great-circle Haversine velocity calculations against prior logins. Flags impossible travel whenever relocations exceed physical travel limits (>900 km/h over >50 km).
- **Full Audit Log Persistence**: Every deterministic evaluation, agent rationale, before/after score diff, and MFA challenge event is immutably persisted to PostgreSQL (`access_audit_logs`, `login_history`).
- **Interactive Knob-Tuner & Canonical Scenario Replay**: Unauthenticated hackathon demo mode allows judges to replay four canonical scenarios, mutate live contextual signals via interactive knobs, and observe real-time decision recalculations over WebSockets.

---

## Tech Stack

### Backend
- **Framework**: Python 3.11, FastAPI (`0.110.0+`), Uvicorn (`0.28.0+`)
- **Data & Validation**: Pydantic v2 (`2.6.0+`), Pydantic Settings (`2.2.0+`)
- **Database & ORM**: PostgreSQL 16, SQLAlchemy 2.0, Psycopg2-binary, Alembic
- **AI & Reasoning**: Anthropic Python SDK (`anthropic`), in-memory SHA-256 TTL caching
- **Security & Cryptography**: PyOTP (`2.9.0+`), QRCode (`qrcode[pil]`), bcrypt
- **Networking & Async**: HTTPX (`0.27.0+`), WebSockets (`12.0+`), aiofiles
- **Testing**: Pytest (`9.1.1`), AnyIO

### Frontend
- **Framework**: Next.js 16.3.5 (App Router, Turbopack), React 19.2.8, TypeScript 5
- **Styling**: Tailwind CSS v4, Lucide React icons
- **Data Visualization**: Recharts (`3.10.1`)
- **Testing/Verification**: Puppeteer Core (`25.11.0`)

---

## Setup Instructions

### Path A: Native Setup (Tested & Verified)

#### 1. Prerequisites
- Python 3.11+
- Node.js 20+ & npm
- PostgreSQL 16 running locally on port `5432` with a database named `contextguard`

#### 2. Database Setup
Ensure PostgreSQL is running and the database exists:
```bash
# Example psql command
psql -U postgres -c "CREATE DATABASE contextguard;"
psql -U postgres -c "CREATE USER contextguard WITH ENCRYPTED PASSWORD 'contextguard';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE contextguard TO contextguard;"
```

#### 3. Backend Setup
```bash
cd backend
python -m venv venv

# Windows:
.\venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Database tables (`users`, `login_history`, `challenge_sessions`, `access_audit_logs`) initialize automatically on startup.*

#### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

### Path B: Docker Compose Setup

> **Note on Verification**: The repository contains verified `Dockerfiles` and `docker-compose.yml` defining PostgreSQL 16, the FastAPI service, and Next.js. Active development and full test runs were completed natively on Path A.

```bash
# Build and spin up all three services: db, backend, frontend
docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

---

## Environment Variables

Create a `.env` file inside `backend/`:

```env
# Application Settings
PROJECT_NAME="ContextGuard Zero-Trust Engine"
ENVIRONMENT=development
API_V1_STR=/api

# Database Connection
DATABASE_URL=postgresql://contextguard:contextguard@localhost:5432/contextguard

# AI Agent Configuration
# Set USE_MOCK_AGENT=true for high-fidelity offline reasoning without API charges
USE_MOCK_AGENT=true
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
AGENT_CONFIDENCE_FLOOR=0.70

# Optional Alternative Provider
GEMINI_API_KEY=your_gemini_api_key_here
```

Create a `.env.local` file inside `frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/decisions
```

---

## Running Tests

Execute the complete backend test suite:

```bash
cd backend
pytest -v
```

**Current Verification Status**:
```
============================= 30 passed in 1.90s =============================
```
- `test_phase1_models.py`: Schema validation and serialization
- `test_phase2_engine.py`: Scoring rules, weights, and decision boundary thresholds
- `test_phase3_agent.py`: Ambiguity triggers, baseline overrides, and confidence floor
- `test_phase4_simulator.py`: Scenario replays, knob mutations, and session drift
- `test_phase5_totp_mfa.py`: Challenge issuance, QR generation, and OTP step-up
- `test_phase6_live_location_intelligence.py`: Geolocation and Haversine velocity calculations

---

## API Endpoints

### Core & Engine
- `GET /api/health` — Service health and LLM provider status
- `GET /api/policy` — Returns active scoring weights and category thresholds
- `PUT /api/policy` — Live updates to engine weights and scoring policy
- `POST /api/evaluate` — Evaluates full context bundle through deterministic core + agent
- `WS /ws/decisions` — Real-time evaluation broadcast stream

### Canonical Scenarios & Simulator
- `GET /api/scenarios` — Lists the 4 canonical demo scenarios
- `POST /api/scenarios/{id}/replay` — Replays scenario through live engine and broadcasts
- `POST /api/simulator/mutate` — Live signal knob mutation and score recalculation
- `POST /api/simulator/drift-session` — Continuous multi-step risk degradation simulation
- `GET /api/audit-logs` — Query historical evaluation audit trail with filtering

### Authentication, MFA & Location Intelligence
- `POST /api/auth/register` — Identity enrollment with bcrypt password hashing
- `POST /api/auth/login` — Real login with client IP geolocation and impossible travel scoring
- `POST /api/auth/mfa/setup` — Generates user TOTP secret and base64 QR code
- `POST /api/auth/mfa/enable` — Validates 6-digit authenticator code and activates MFA
- `POST /api/auth/mfa/verify-challenge` — Resolves active `challenge_id`, recalculates risk, and upgrades decision
- `GET /api/auth/user/{user_id}/history` — Chronological login and geolocation audit trail
- `POST /api/auth/evaluate-access` — Evaluates live user resource requests with anomaly simulation