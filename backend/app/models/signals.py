from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class PrivilegeLevel(str, Enum):
    STANDARD = "standard"
    ELEVATED = "elevated"
    ADMIN = "admin"


class OSPatchLevel(str, Enum):
    CURRENT = "current"
    OUTDATED = "outdated"


class DiskEncryption(str, Enum):
    ON = "on"
    OFF = "off"


class EDRAgentStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    ABSENT = "absent"


class SensitivityTier(str, Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class ResourceAction(str, Enum):
    READ = "read"
    WRITE = "write"
    EXPORT = "export"
    ADMIN = "admin"


# 1. User Identity Signal
class UserIdentity(BaseModel):
    user_id: str = Field(..., description="Unique user identifier (e.g. usr_sarah_chen)")
    role: str = Field(default="Senior Data Scientist", description="Job title or role")
    department: str = Field(default="Engineering", description="Department name")
    mfa_enrolled: bool = Field(default=True, description="Whether user has enrolled in MFA")
    account_age_days: int = Field(default=365, ge=0, description="Age of account in days")
    privilege_level: PrivilegeLevel = Field(default=PrivilegeLevel.STANDARD, description="Privilege tier")
    mfa_verified_this_session: bool = Field(default=False, description="Whether MFA was actively verified for this session")


# 2. Device Posture Signal
class DevicePosture(BaseModel):
    device_id: str = Field(..., description="Device identifier (e.g. dev_mac_corp_441)")
    is_managed: bool = Field(default=True, description="Whether MDM/enterprise management is active")
    os_patch_level: OSPatchLevel = Field(default=OSPatchLevel.CURRENT, description="OS patch health")
    disk_encryption: DiskEncryption = Field(default=DiskEncryption.ON, description="Disk encryption state")
    edr_agent_status: EDRAgentStatus = Field(default=EDRAgentStatus.HEALTHY, description="Endpoint detection agent status")
    jailbroken_or_rooted: bool = Field(default=False, description="Whether device is rooted/jailbroken")


# 3. Location Signal
class LocationSignal(BaseModel):
    geo_ip_country: str = Field(default="US", description="Two-letter country code")
    geo_ip_city: str = Field(default="San Francisco", description="City name")
    is_corporate_network: bool = Field(default=True, description="Whether request originates from corporate IP")
    is_known_location: bool = Field(default=True, description="Whether user routinely connects from this location")
    impossible_travel_flag: bool = Field(default=False, description="Computed from delta of last location + time")
    vpn_tor_detected: bool = Field(default=False, description="Whether commercial VPN or Tor exit node detected")


# 4. Behavior Signal
class BehaviorSignal(BaseModel):
    request_time_hour: int = Field(default=14, ge=0, le=23, description="Hour of request in local 24h format")
    is_outside_working_hours: bool = Field(default=False, description="Whether request falls outside working profile")
    typing_velocity_anomaly: bool = Field(default=False, description="Simulated keystroke/interaction velocity anomaly")
    resource_access_pattern_deviation: bool = Field(default=False, description="Deviation such as bulk export or unusual traversal")
    failed_logins_last_hour: int = Field(default=0, ge=0, description="Count of failed auth attempts in past 60 mins")


# 5. Requested Resource Signal
class ResourceSignal(BaseModel):
    resource_id: str = Field(..., description="Resource identifier (e.g. db_customer_financial_records)")
    sensitivity_tier: SensitivityTier = Field(default=SensitivityTier.INTERNAL, description="Data sensitivity classification")
    action: ResourceAction = Field(default=ResourceAction.READ, description="Requested operation")


# 6. Access History Signal
class AccessHistorySignal(BaseModel):
    past_access_count_to_this_resource: int = Field(default=120, ge=0, description="Historical access count")
    last_successful_access_days_ago: float = Field(default=1.0, ge=0, description="Days since last successful access")
    historical_deny_count: int = Field(default=0, ge=0, description="Number of past denials recorded")
    average_historical_risk_score: float = Field(default=12.5, ge=0, le=100, description="Baseline risk average")


# 7. Threat Signals
class ThreatSignal(BaseModel):
    known_bad_ip: bool = Field(default=False, description="IP matches known malicious actor feeds")
    leaked_credential_flag: bool = Field(default=False, description="Credential appeared in recent darknet dump")
    active_campaign_targeting_sector: bool = Field(default=False, description="Sector actively under attack by APT")
    incident_correlated_travel: bool = Field(default=False, description="Travel anomaly coincides with active security incident")


# Complete Context Request Bundle
class AccessContextBundle(BaseModel):
    request_id: Optional[str] = Field(default=None, description="Client or session provided request ID")
    identity: UserIdentity
    device: DevicePosture
    location: LocationSignal
    behavior: BehaviorSignal
    resource: ResourceSignal
    access_history: AccessHistorySignal
    threat: ThreatSignal
