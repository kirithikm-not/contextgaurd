import json
from sqlalchemy import Column, String, Float, Integer, Boolean, Text, Index, ForeignKey
from database import Base


class AccessAuditLog(Base):
    __tablename__ = "access_audit_log"

    evaluation_id = Column(String, primary_key=True, index=True)
    timestamp = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    user_role = Column(String, nullable=True)
    device_id = Column(String, nullable=True)
    resource_id = Column(String, nullable=False)
    resource_tier = Column(String, nullable=False)
    action = Column(String, nullable=False)
    deterministic_score = Column(Float, nullable=False)
    deterministic_decision = Column(String, nullable=False)
    final_score = Column(Float, nullable=False)
    final_decision = Column(String, nullable=False, index=True)
    is_ambiguous = Column(Integer, nullable=False)
    agent_invoked = Column(Integer, nullable=False)
    overrode_baseline = Column(Integer, nullable=False)
    agent_confidence = Column(Float, nullable=True)
    fired_rules_count = Column(Integer, nullable=False)
    decision_rationale = Column(Text, nullable=False)
    context_json = Column(Text, nullable=False)
    result_json = Column(Text, nullable=False)

    __table_args__ = (
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_timestamp", "timestamp"),
        Index("idx_audit_decision", "final_decision"),
    )

    def to_dict(self):
        """Converts the database row to the exact dictionary shape expected by callers."""
        return {
            "evaluation_id": self.evaluation_id,
            "timestamp": self.timestamp,
            "user_id": self.user_id,
            "user_role": self.user_role,
            "device_id": self.device_id,
            "resource_id": self.resource_id,
            "resource_tier": self.resource_tier,
            "action": self.action,
            "deterministic_score": self.deterministic_score,
            "deterministic_decision": self.deterministic_decision,
            "final_score": self.final_score,
            "final_decision": self.final_decision,
            "is_ambiguous": self.is_ambiguous,
            "agent_invoked": self.agent_invoked,
            "overrode_baseline": self.overrode_baseline,
            "agent_confidence": self.agent_confidence,
            "fired_rules_count": self.fired_rules_count,
            "decision_rationale": self.decision_rationale,
            "context": json.loads(self.context_json),
            "result": json.loads(self.result_json),
        }


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    totp_secret = Column(String, nullable=True)
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    created_at = Column(String, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "totp_secret": self.totp_secret,
            "mfa_enabled": self.mfa_enabled,
            "created_at": self.created_at,
        }


class ChallengeSession(Base):
    __tablename__ = "challenge_sessions"

    id = Column(String, primary_key=True, index=True)
    evaluation_id = Column(String, ForeignKey("access_audit_log.evaluation_id"), nullable=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    otp_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(String, nullable=False)
    expires_at = Column(String, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "evaluation_id": self.evaluation_id,
            "user_id": self.user_id,
            "otp_verified": self.otp_verified,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
        }


class LoginHistory(Base):
    __tablename__ = "login_history"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    ip_address = Column(String, nullable=False, index=True)
    geo_country = Column(String, nullable=True)
    geo_city = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    is_vpn_or_proxy = Column(Boolean, default=False, nullable=False)
    created_at = Column(String, nullable=False, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "ip_address": self.ip_address,
            "geo_country": self.geo_country,
            "geo_city": self.geo_city,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "is_vpn_or_proxy": self.is_vpn_or_proxy,
            "created_at": self.created_at,
        }


