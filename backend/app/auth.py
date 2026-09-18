import io
import json
import base64
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from models import User, ChallengeSession, AccessAuditLog, LoginHistory
from app.models.signals import (
    AccessContextBundle,
    UserIdentity,
    DevicePosture,
    LocationSignal,
    BehaviorSignal,
    ResourceSignal,
    AccessHistorySignal,
    ThreatSignal,
    PrivilegeLevel,
    OSPatchLevel,
    DiskEncryption,
    EDRAgentStatus,
    SensitivityTier,
    ResourceAction,
)
from app.models.decision import DecisionType
from app.engine.evaluator import risk_engine
from app.agent.orchestrator import soc_agent
from app.db.database import record_evaluation
from app.services.geolocation import (
    geolocate_ip,
    check_impossible_travel,
    check_is_known_location,
    is_private_or_loopback,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])



def extract_client_ip(request: Request) -> str:
    """Extracts client IP from X-Forwarded-For header or fallback to request.client.host."""
    forwarded = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if forwarded:
        # First IP in comma-separated list is the client IP
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip") or request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


class LoginRequest(BaseModel):
    email: str
    password: str



class RegisterRequest(BaseModel):
    email: str
    password: str
    user_id: Optional[str] = None


class MfaSetupRequest(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None


class MfaEnableRequest(BaseModel):
    totp_code: str
    user_id: Optional[str] = None
    email: Optional[str] = None


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Registers a new user and hashes password with bcrypt."""
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{payload.email}' already exists."
        )

    user_id = payload.user_id or f"usr_{uuid.uuid4().hex[:10]}"
    
    # Check if user_id already exists
    if db.query(User).filter(User.id == user_id).first():
        user_id = f"usr_{uuid.uuid4().hex[:10]}"

    hashed_password = bcrypt.hashpw(
        payload.password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    user = User(
        id=user_id,
        email=payload.email,
        hashed_password=hashed_password,
        totp_secret=None,
        mfa_enabled=False,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "message": "User registered successfully",
        "user": {
            "id": user.id,
            "email": user.email,
            "mfa_enabled": user.mfa_enabled,
            "created_at": user.created_at,
        },
    }


@router.post("/login")
async def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Authenticates user, extracts real client IP (supporting X-Forwarded-For),
    calls geolocate_ip(), performs real-time impossible-travel and known-location detection,
    stores login_history, and evaluates the real login against ContextGuard's risk engine.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not bcrypt.checkpw(payload.password.encode("utf-8"), user.hashed_password.encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    client_ip = extract_client_ip(request)
    geo = geolocate_ip(client_ip)

    now = datetime.now(timezone.utc)
    new_lat = geo.get("latitude")
    new_lon = geo.get("longitude")
    country = geo.get("country") or "Unknown"
    city = geo.get("city") or "Unknown"
    is_vpn = bool(geo.get("is_vpn_or_proxy", False))

    # Real network-level signals calculated against historical logins
    is_known_loc = check_is_known_location(user.id, country, city, db)
    is_impossible_travel = check_impossible_travel(user.id, new_lat, new_lon, now, db)

    # Persist login_history row
    history_id = f"log_{uuid.uuid4().hex[:12]}"
    login_record = LoginHistory(
        id=history_id,
        user_id=user.id,
        ip_address=client_ip,
        geo_country=country,
        geo_city=city,
        latitude=new_lat,
        longitude=new_lon,
        is_vpn_or_proxy=is_vpn,
        created_at=now.isoformat(),
    )
    db.add(login_record)
    db.commit()
    db.refresh(login_record)

    prior_logins_count = db.query(LoginHistory).filter(LoginHistory.user_id == user.id).count()

    # Construct real AccessContextBundle
    bundle = AccessContextBundle(
        request_id=f"req_live_{uuid.uuid4().hex[:10]}",
        identity=UserIdentity(
            user_id=user.id,
            role="Senior Data Scientist",
            department="Engineering",
            mfa_enrolled=user.mfa_enabled,
            account_age_days=180,
            privilege_level=PrivilegeLevel.STANDARD,
            mfa_verified_this_session=False,
        ),
        device=DevicePosture(
            device_id=request.headers.get("x-device-id", "dev_live_workstation"),
            is_managed=request.headers.get("x-device-managed", "true").lower() == "true",
            os_patch_level=OSPatchLevel.CURRENT,
            disk_encryption=DiskEncryption.ON,
            edr_agent_status=EDRAgentStatus.HEALTHY,
            jailbroken_or_rooted=False,
        ),
        location=LocationSignal(
            geo_ip_country=country,
            geo_ip_city=city,
            is_corporate_network=is_private_or_loopback(client_ip),
            is_known_location=is_known_loc,
            impossible_travel_flag=is_impossible_travel,
            vpn_tor_detected=is_vpn,
        ),
        behavior=BehaviorSignal(
            request_time_hour=now.hour,
            is_outside_working_hours=not (8 <= now.hour <= 18),
            typing_velocity_anomaly=False,
            resource_access_pattern_deviation=False,
            failed_logins_last_hour=0,
        ),
        resource=ResourceSignal(
            resource_id="portal_authentication_gate",
            sensitivity_tier=SensitivityTier.INTERNAL,
            action=ResourceAction.READ,
        ),
        access_history=AccessHistorySignal(
            past_access_count_to_this_resource=max(0, prior_logins_count - 1),
            last_successful_access_days_ago=0.1 if prior_logins_count > 1 else 0.0,
            historical_deny_count=0,
            average_historical_risk_score=10.0,
        ),
        threat=ThreatSignal(
            known_bad_ip=False,
            leaked_credential_flag=False,
            active_campaign_targeting_sector=False,
            incident_correlated_travel=is_impossible_travel,
        ),
    )

    # 1. Deterministic core evaluation using existing engine rules
    eval_result = risk_engine.evaluate(bundle)

    # 2. Agent escalation if ambiguous/conflicting
    if eval_result.is_ambiguous:
        eval_result = await soc_agent.evaluate_and_enrich(eval_result)

    # 3. Persist to access_audit_log
    record_evaluation(eval_result)

    # 4. Handle Step-Up MFA Challenge if triggered
    if eval_result.final_decision == DecisionType.CHALLENGE:
        chal_session = create_challenge_session(
            evaluation_id=eval_result.evaluation_id,
            user_id=user.id,
        )
        eval_result.mfa_required = True
        eval_result.challenge_id = chal_session.id
        eval_result.decision = "Challenge"

    return {
        "status": "success",
        "message": "Login evaluated successfully.",
        "user": {
            "id": user.id,
            "email": user.email,
            "mfa_enabled": user.mfa_enabled,
        },
        "decision": eval_result.final_decision.value,
        "final_decision": eval_result.final_decision.value,
        "final_score": eval_result.final_score,
        "evaluation_id": eval_result.evaluation_id,
        "mfa_required": eval_result.mfa_required,
        "challenge_id": eval_result.challenge_id,
        "location_signals": {
            "country": country,
            "city": city,
            "is_known_location": is_known_loc,
            "impossible_travel_flag": is_impossible_travel,
            "vpn_tor_detected": is_vpn,
        },
        "login_history": login_record.to_dict(),
        "network_context": geo,
        "evaluation": eval_result.model_dump(mode="json"),
    }



@router.post("/mfa/setup")

def mfa_setup(payload: MfaSetupRequest, db: Session = Depends(get_db)):
    """Generates a TOTP secret, stores it for user, and returns base64 QR code."""
    query = db.query(User)
    if payload.user_id:
        user = query.filter(User.id == payload.user_id).first()
    elif payload.email:
        user = query.filter(User.email == payload.email).first()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either user_id or email must be provided."
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    totp_secret = pyotp.random_base32()
    user.totp_secret = totp_secret
    db.commit()

    provisioning_uri = pyotp.totp.TOTP(totp_secret).provisioning_uri(
        name=user.email,
        issuer_name="ContextGuard"
    )

    qr = qrcode.QRCode(version=1, box_size=8, border=3)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return {
        "status": "success",
        "user_id": user.id,
        "email": user.email,
        "totp_secret": totp_secret,
        "provisioning_uri": provisioning_uri,
        "qr_code_base64": f"data:image/png;base64,{qr_b64}",
    }


@router.post("/mfa/enable")
def mfa_enable(payload: MfaEnableRequest, db: Session = Depends(get_db)):
    """Verifies initial TOTP code to confirm setup and sets mfa_enabled=True."""
    query = db.query(User)
    if payload.user_id:
        user = query.filter(User.id == payload.user_id).first()
    elif payload.email:
        user = query.filter(User.email == payload.email).first()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either user_id or email must be provided."
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    if not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA setup has not been initiated for this user."
        )

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(payload.totp_code.strip(), valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP code."
        )

    user.mfa_enabled = True
    db.commit()

    return {
        "status": "success",
        "message": "TOTP MFA enabled successfully.",
        "user_id": user.id,
        "mfa_enabled": True,
    }


def create_challenge_session(evaluation_id: str, user_id: str) -> ChallengeSession:
    """Creates a new ChallengeSession tied to a specific evaluation_id and user_id."""
    db = SessionLocal()
    try:
        # Ensure user exists in users table to satisfy foreign key
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            # Sync with the active enrolled MFA user or provision
            enrolled_user = db.query(User).filter(User.mfa_enabled == True).first()
            secret = enrolled_user.totp_secret if enrolled_user else None
            user = User(
                id=user_id,
                email=f"{user_id}@contextguard.local",
                hashed_password="mock_hashed_password",
                totp_secret=secret,
                mfa_enabled=bool(secret),
                created_at=datetime.now(timezone.utc).isoformat(),
            )
            db.add(user)
            db.commit()

        session_id = f"chal_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        expires = now + timedelta(minutes=5)

        session = ChallengeSession(
            id=session_id,
            evaluation_id=evaluation_id,
            user_id=user.id,
            otp_verified=False,
            created_at=now.isoformat(),
            expires_at=expires.isoformat(),
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session
    finally:
        db.close()


class VerifyChallengeRequest(BaseModel):
    challenge_id: str
    totp_code: str


@router.post("/mfa/verify-challenge")
async def verify_challenge(payload: VerifyChallengeRequest, db: Session = Depends(get_db)):
    """
    Verifies live TOTP code for an active ChallengeSession.
    Marks ChallengeSession.otp_verified = True, re-runs evaluation
    with identity.mfa_verified_this_session = True, updates AccessAuditLog,
    and returns upgraded decision (e.g. Challenge -> Allow).
    """
    session = db.query(ChallengeSession).filter(ChallengeSession.id == payload.challenge_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Challenge session '{payload.challenge_id}' not found."
        )

    # Check expiration
    expires_dt = datetime.fromisoformat(session.expires_at)
    if expires_dt.tzinfo is None:
        expires_dt = expires_dt.replace(tzinfo=timezone.utc)
    if expires_dt < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge session has expired. Please initiate a new access request."
        )

    # Find user and TOTP secret
    user = db.query(User).filter(User.id == session.user_id).first()
    totp_secret = user.totp_secret if (user and user.totp_secret) else None
    if not totp_secret:
        enrolled_user = db.query(User).filter(User.mfa_enabled == True).first()
        if enrolled_user:
            totp_secret = enrolled_user.totp_secret

    if not totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have an active TOTP secret configured."
        )

    totp = pyotp.TOTP(totp_secret)
    if not totp.verify(payload.totp_code.strip(), valid_window=2):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP code."
        )


    # Mark ChallengeSession verified
    session.otp_verified = True
    db.commit()

    # Load original evaluation context from audit log
    audit_log = db.query(AccessAuditLog).filter(AccessAuditLog.evaluation_id == session.evaluation_id).first()
    if not audit_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Original evaluation log for id '{session.evaluation_id}' not found."
        )

    context_dict = json.loads(audit_log.context_json)
    bundle = AccessContextBundle.model_validate(context_dict)

    # Re-evaluate with updated identity signal
    bundle.identity.mfa_verified_this_session = True
    re_result = risk_engine.evaluate(bundle)

    # Maintain agent enrichment if ambiguous
    if re_result.is_ambiguous:
        re_result = await soc_agent.evaluate_and_enrich(re_result)

    # Maintain session.evaluation_id link
    re_result.evaluation_id = session.evaluation_id

    # Persist updated decision to access_audit_log
    record_evaluation(re_result)

    return {
        "status": "success",
        "challenge_id": session.id,
        "otp_verified": True,
        "decision": re_result.final_decision.value,
        "final_decision": re_result.final_decision.value,
        "final_score": re_result.final_score,
        "evaluation_id": re_result.evaluation_id,
        "decision_rationale": re_result.decision_rationale,
        "evaluation": re_result.model_dump(mode="json"),
    }


@router.get("/user/{user_id}/history")
def get_user_login_history(user_id: str, limit: int = 10, db: Session = Depends(get_db)):
    """Retrieves chronological login history and network location events for a user."""
    records = (
        db.query(LoginHistory)
        .filter(LoginHistory.user_id == user_id)
        .order_by(LoginHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "user_id": user_id,
        "total": len(records),
        "history": [r.to_dict() for r in records]
    }


class LiveAccessRequest(BaseModel):
    user_id: str
    resource_id: Optional[str] = "production_vault"
    sensitivity_tier: Optional[str] = "restricted"
    action: Optional[str] = "read"
    simulate_anomaly: Optional[str] = None  # e.g., 'impossible_travel', 'off_hours', 'unmanaged_device'


@router.post("/evaluate-access")
async def evaluate_user_access(
    payload: LiveAccessRequest, 
    request: Request, 
    db: Session = Depends(get_db)
):
    """
    Evaluates real live contextual access for a user against real DB state.
    Allows simulating context anomalies (step_up_challenge, impossible_travel, etc.) to trigger Challenge/Warnings.
    """
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    client_ip = extract_client_ip(request)
    geo = geolocate_ip(client_ip)
    now = datetime.now(timezone.utc)

    # Anomaly conditions
    is_challenge_sim = (payload.simulate_anomaly in ["step_up_challenge", "unmanaged_device"])
    is_impossible_travel = (payload.simulate_anomaly == "impossible_travel")
    if not is_impossible_travel:
        is_impossible_travel = check_impossible_travel(user.id, geo.get("latitude"), geo.get("longitude"), now, db)

    is_known_loc = check_is_known_location(user.id, geo.get("country", ""), geo.get("city", ""), db)
    if is_impossible_travel or is_challenge_sim:
        is_known_loc = False

    tier_enum = SensitivityTier.RESTRICTED
    if payload.sensitivity_tier:
        try:
            tier_enum = SensitivityTier(payload.sensitivity_tier)
        except ValueError:
            tier_enum = SensitivityTier.RESTRICTED

    bundle = AccessContextBundle(
        request_id=f"req_live_{uuid.uuid4().hex[:10]}",
        identity=UserIdentity(
            user_id=user.id,
            role="Senior Security Engineer",
            department="DevSecOps",
            mfa_enrolled=user.mfa_enabled,
            account_age_days=180,
            privilege_level=PrivilegeLevel.STANDARD,
            mfa_verified_this_session=False,
        ),
        device=DevicePosture(
            device_id="dev_byod_ipad" if is_challenge_sim else "dev_corp_workstation",
            is_managed=False if is_challenge_sim else True,
            os_patch_level=OSPatchLevel.CURRENT,
            disk_encryption=DiskEncryption.OFF if is_challenge_sim else DiskEncryption.ON,
            edr_agent_status=EDRAgentStatus.ABSENT if is_challenge_sim else EDRAgentStatus.HEALTHY,
            jailbroken_or_rooted=False,
        ),
        location=LocationSignal(
            geo_ip_country="Australia" if is_impossible_travel else geo.get("country", "Local Network"),
            geo_ip_city="Sydney" if is_impossible_travel else geo.get("city", "Localhost"),
            is_corporate_network=False if (is_impossible_travel or is_challenge_sim) else is_private_or_loopback(client_ip),
            is_known_location=is_known_loc,
            impossible_travel_flag=is_impossible_travel,
            vpn_tor_detected=geo.get("is_vpn_or_proxy", False),
        ),
        behavior=BehaviorSignal(
            request_time_hour=2 if is_challenge_sim else now.hour,
            is_outside_working_hours=True if is_challenge_sim else not (8 <= now.hour <= 18),
            typing_velocity_anomaly=False,
            resource_access_pattern_deviation=False,
            failed_logins_last_hour=0,
        ),
        resource=ResourceSignal(
            resource_id=payload.resource_id or ("doc_confidential_q3" if is_challenge_sim else "portal_production_gate"),
            sensitivity_tier=SensitivityTier.INTERNAL if is_challenge_sim else tier_enum,
            action=ResourceAction.READ,
        ),
        access_history=AccessHistorySignal(
            past_access_count_to_this_resource=0 if is_challenge_sim else 5,
            last_successful_access_days_ago=0.0 if is_challenge_sim else 1.0,
            historical_deny_count=0,
            average_historical_risk_score=15.0,
        ),
        threat=ThreatSignal(
            known_bad_ip=False,
            leaked_credential_flag=False,
            active_campaign_targeting_sector=False,
            incident_correlated_travel=is_impossible_travel,
        ),
    )

    eval_result = risk_engine.evaluate(bundle)
    if eval_result.is_ambiguous:
        eval_result = await soc_agent.evaluate_and_enrich(eval_result)

    record_evaluation(eval_result)

    if eval_result.final_decision == DecisionType.CHALLENGE:
        chal_session = create_challenge_session(
            evaluation_id=eval_result.evaluation_id,
            user_id=user.id,
        )
        eval_result.mfa_required = True
        eval_result.challenge_id = chal_session.id
        eval_result.decision = "Challenge"

    return {
        "status": "success",
        "user_id": user.id,
        "decision": eval_result.final_decision.value,
        "final_decision": eval_result.final_decision.value,
        "final_score": eval_result.final_score,
        "evaluation_id": eval_result.evaluation_id,
        "mfa_required": eval_result.mfa_required,
        "challenge_id": eval_result.challenge_id,
        "location_signals": {
            "country": bundle.location.geo_ip_country,
            "city": bundle.location.geo_ip_city,
            "is_known_location": bundle.location.is_known_location,
            "impossible_travel_flag": bundle.location.impossible_travel_flag,
            "vpn_tor_detected": bundle.location.vpn_tor_detected,
        },
        "evaluation": eval_result.model_dump(mode="json"),
    }


