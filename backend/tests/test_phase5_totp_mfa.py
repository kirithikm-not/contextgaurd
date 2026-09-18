"""
Phase 5 TOTP-based MFA Integration Tests
Verifies user registration, MFA setup, MFA enable, challenge issuance on Challenge decision,
and challenge verification upgrading Challenge to Allow.
"""
import pyotp
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.simulator.scenarios import SCENARIO_2


@pytest.fixture
def client():
    return TestClient(app)


def test_auth_registration_and_mfa_flow(client):
    test_email = "autotest_user@contextguard.local"
    test_pass = "TestPassword999!"
    user_id = "usr_autotest_01"

    # 1. Register User
    res = client.post(
        "/api/auth/register",
        json={"email": test_email, "password": test_pass, "user_id": user_id},
    )
    # 201 or 400 if already created
    assert res.status_code in (201, 400)

    # 2. MFA Setup
    res = client.post("/api/auth/mfa/setup", json={"user_id": user_id})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "totp_secret" in data
    assert "qr_code_base64" in data
    assert data["qr_code_base64"].startswith("data:image/png;base64,")

    secret = data["totp_secret"]

    # 3. MFA Enable with valid TOTP code
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    res = client.post(
        "/api/auth/mfa/enable",
        json={"user_id": user_id, "totp_code": valid_code},
    )
    assert res.status_code == 200
    enable_data = res.json()
    assert enable_data["mfa_enabled"] is True


def test_evaluate_challenge_session_issuance_and_verification(client):
    # 1. Replay Scenario 2 which produces Challenge
    res = client.post("/api/scenarios/scenario_2_new_device_unusual_hour/replay")
    assert res.status_code == 200
    data = res.json()
    assert data["final_decision"] == "Challenge"
    assert data["mfa_required"] is True
    assert data["challenge_id"] is not None
    challenge_id = data["challenge_id"]

    # 2. Fetch user's TOTP secret to generate valid code
    from database import SessionLocal
    from models import ChallengeSession, User
    db = SessionLocal()
    try:
        session = db.query(ChallengeSession).filter(ChallengeSession.id == challenge_id).first()
        assert session is not None
        assert session.otp_verified is False
        user = db.query(User).filter(User.id == session.user_id).first()
        assert user is not None
        totp = pyotp.TOTP(user.totp_secret)
        code = totp.now()
    finally:
        db.close()

    # 3. Verify Challenge
    res = client.post(
        "/api/auth/mfa/verify-challenge",
        json={"challenge_id": challenge_id, "totp_code": code},
    )
    assert res.status_code == 200
    verify_data = res.json()
    assert verify_data["status"] == "success"
    assert verify_data["otp_verified"] is True
    assert verify_data["final_decision"] == "Allow"
    assert verify_data["final_score"] <= 29.0
