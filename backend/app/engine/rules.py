from typing import List, Tuple
from app.models.signals import (
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
from app.models.decision import RuleTrigger, RuleSeverity


def evaluate_identity_rules(identity: UserIdentity) -> Tuple[float, List[RuleTrigger]]:
    """Calculates identity sub-score (0-100) and triggered rules."""
    score = 0.0
    rules: List[RuleTrigger] = []

    if not identity.mfa_enrolled:
        rules.append(RuleTrigger(
            rule_id="ID_NO_MFA",
            category="identity",
            severity=RuleSeverity.HIGH,
            description="User has not enrolled in Multi-Factor Authentication (MFA)",
            score_impact=45.0,
        ))
        score += 45.0

    if identity.privilege_level == PrivilegeLevel.ADMIN:
        rules.append(RuleTrigger(
            rule_id="ID_ADMIN_PRIVILEGE",
            category="identity",
            severity=RuleSeverity.MEDIUM,
            description="Account holds administrative privileges, expanding blast radius",
            score_impact=25.0,
        ))
        score += 25.0
    elif identity.privilege_level == PrivilegeLevel.ELEVATED:
        rules.append(RuleTrigger(
            rule_id="ID_ELEVATED_PRIVILEGE",
            category="identity",
            severity=RuleSeverity.LOW,
            description="Account holds elevated organizational privileges",
            score_impact=15.0,
        ))
        score += 15.0

    if identity.account_age_days < 7:
        rules.append(RuleTrigger(
            rule_id="ID_VERY_NEW_ACCOUNT",
            category="identity",
            severity=RuleSeverity.HIGH,
            description=f"Account is newly provisioned ({identity.account_age_days} days old)",
            score_impact=35.0,
        ))
        score += 35.0
    elif identity.account_age_days < 30:
        rules.append(RuleTrigger(
            rule_id="ID_YOUNG_ACCOUNT",
            category="identity",
            severity=RuleSeverity.LOW,
            description=f"Account is under 30 days old ({identity.account_age_days} days)",
            score_impact=15.0,
        ))
        score += 15.0

    if getattr(identity, "mfa_verified_this_session", False):
        rules.append(RuleTrigger(
            rule_id="ID_MFA_STEPUP_VERIFIED",
            category="identity",
            severity=RuleSeverity.LOW,
            description="Live TOTP step-up MFA challenge successfully verified for this session",
            score_impact=-15.0,
        ))

    return min(score, 100.0), rules



def evaluate_device_rules(device: DevicePosture) -> Tuple[float, List[RuleTrigger]]:
    """Calculates device posture sub-score (0-100) and triggered rules."""
    score = 0.0
    rules: List[RuleTrigger] = []

    if device.jailbroken_or_rooted:
        rules.append(RuleTrigger(
            rule_id="DEV_JAILBROKEN",
            category="device",
            severity=RuleSeverity.CRITICAL,
            description="Host firmware integrity breached: Jailbroken or Rooted device detected",
            score_impact=90.0,
        ))
        score += 90.0

    if not device.is_managed:
        rules.append(RuleTrigger(
            rule_id="DEV_UNMANAGED",
            category="device",
            severity=RuleSeverity.HIGH,
            description="Device is unmanaged (BYOD / non-MDM enrolled)",
            score_impact=45.0,
        ))
        score += 45.0

    if device.os_patch_level == OSPatchLevel.OUTDATED:
        rules.append(RuleTrigger(
            rule_id="DEV_OUTDATED_OS",
            category="device",
            severity=RuleSeverity.MEDIUM,
            description="Operating system patch level is outdated with unpatched CVEs",
            score_impact=30.0,
        ))
        score += 30.0

    if device.disk_encryption == DiskEncryption.OFF:
        rules.append(RuleTrigger(
            rule_id="DEV_NO_ENCRYPTION",
            category="device",
            severity=RuleSeverity.MEDIUM,
            description="Local storage disk encryption (FileVault/BitLocker) is disabled",
            score_impact=25.0,
        ))
        score += 25.0

    if device.edr_agent_status == EDRAgentStatus.ABSENT:
        rules.append(RuleTrigger(
            rule_id="DEV_EDR_ABSENT",
            category="device",
            severity=RuleSeverity.HIGH,
            description="Endpoint Detection & Response (EDR) agent is missing",
            score_impact=45.0,
        ))
        score += 45.0
    elif device.edr_agent_status == EDRAgentStatus.DEGRADED:
        rules.append(RuleTrigger(
            rule_id="DEV_EDR_DEGRADED",
            category="device",
            severity=RuleSeverity.MEDIUM,
            description="EDR agent telemetry is degraded or out-of-sync",
            score_impact=25.0,
        ))
        score += 25.0

    return min(score, 100.0), rules


def evaluate_location_rules(location: LocationSignal) -> Tuple[float, List[RuleTrigger]]:
    """Calculates location & network sub-score (0-100) and triggered rules."""
    score = 0.0
    rules: List[RuleTrigger] = []

    if location.impossible_travel_flag:
        rules.append(RuleTrigger(
            rule_id="LOC_IMPOSSIBLE_TRAVEL",
            category="location",
            severity=RuleSeverity.CRITICAL,
            description="Impossible travel velocity detected: rapid geographical transition exceeds physical speed limits",
            score_impact=85.0,
        ))
        score += 85.0

    if location.vpn_tor_detected:
        rules.append(RuleTrigger(
            rule_id="LOC_VPN_TOR_PROXY",
            category="location",
            severity=RuleSeverity.HIGH,
            description="Anonymizing proxy, commercial VPN, or Tor exit node detected",
            score_impact=45.0,
        ))
        score += 45.0

    if not location.is_corporate_network:
        rules.append(RuleTrigger(
            rule_id="LOC_EXTERNAL_NETWORK",
            category="location",
            severity=RuleSeverity.LOW,
            description="Connection originates outside corporate protected perimeter / zero-trust subnet",
            score_impact=25.0,
        ))
        score += 25.0

    if not location.is_known_location:
        rules.append(RuleTrigger(
            rule_id="LOC_UNKNOWN_GEO",
            category="location",
            severity=RuleSeverity.MEDIUM,
            description=f"Unfamiliar geographical origin ({location.geo_ip_city}, {location.geo_ip_country}) for this user",
            score_impact=25.0,
        ))
        score += 25.0

    return min(score, 100.0), rules


def evaluate_behavior_rules(behavior: BehaviorSignal) -> Tuple[float, List[RuleTrigger]]:
    """Calculates behavior sub-score (0-100) and triggered rules."""
    score = 0.0
    rules: List[RuleTrigger] = []

    if behavior.is_outside_working_hours or (behavior.request_time_hour < 6 or behavior.request_time_hour > 21):
        rules.append(RuleTrigger(
            rule_id="BEH_OFF_HOURS",
            category="behavior",
            severity=RuleSeverity.MEDIUM,
            description=f"Access requested at {behavior.request_time_hour:02d}:00, outside baseline working profile",
            score_impact=35.0,
        ))
        score += 35.0

    if behavior.typing_velocity_anomaly:
        rules.append(RuleTrigger(
            rule_id="BEH_BIOMETRIC_ANOMALY",
            category="behavior",
            severity=RuleSeverity.MEDIUM,
            description="Interaction cadence or keystroke timing anomaly detected (automated tool or credential stuffer)",
            score_impact=35.0,
        ))
        score += 35.0

    if behavior.resource_access_pattern_deviation:
        rules.append(RuleTrigger(
            rule_id="BEH_PATTERN_DEVIATION",
            category="behavior",
            severity=RuleSeverity.HIGH,
            description="Anomalous resource retrieval pattern detected (e.g. sudden bulk directory traversal)",
            score_impact=40.0,
        ))
        score += 40.0

    if behavior.failed_logins_last_hour >= 5:
        rules.append(RuleTrigger(
            rule_id="BEH_EXCESSIVE_FAILED_AUTH",
            category="behavior",
            severity=RuleSeverity.HIGH,
            description=f"High frequency of failed authentication attempts ({behavior.failed_logins_last_hour}) in past 60 mins",
            score_impact=50.0,
        ))
        score += 50.0
    elif behavior.failed_logins_last_hour > 0:
        pts = min(behavior.failed_logins_last_hour * 12.0, 40.0)
        rules.append(RuleTrigger(
            rule_id="BEH_FAILED_AUTH",
            category="behavior",
            severity=RuleSeverity.LOW,
            description=f"{behavior.failed_logins_last_hour} failed authentication attempt(s) recorded in past hour",
            score_impact=pts,
        ))
        score += pts

    return min(score, 100.0), rules


def evaluate_resource_rules(resource: ResourceSignal) -> Tuple[float, List[RuleTrigger]]:
    """Calculates resource sensitivity sub-score (0-100) and triggered rules."""
    score = 0.0
    rules: List[RuleTrigger] = []

    # Sensitivity tier baseline
    if resource.sensitivity_tier == SensitivityTier.RESTRICTED:
        rules.append(RuleTrigger(
            rule_id="RES_RESTRICTED_TIER",
            category="resource",
            severity=RuleSeverity.HIGH,
            description=f"Target resource '{resource.resource_id}' is classified as RESTRICTED (highest sensitivity)",
            score_impact=45.0,
        ))
        score += 45.0
    elif resource.sensitivity_tier == SensitivityTier.CONFIDENTIAL:
        rules.append(RuleTrigger(
            rule_id="RES_CONFIDENTIAL_TIER",
            category="resource",
            severity=RuleSeverity.MEDIUM,
            description=f"Target resource '{resource.resource_id}' is classified as CONFIDENTIAL",
            score_impact=30.0,
        ))
        score += 30.0
    elif resource.sensitivity_tier == SensitivityTier.INTERNAL:
        rules.append(RuleTrigger(
            rule_id="RES_INTERNAL_TIER",
            category="resource",
            severity=RuleSeverity.LOW,
            description=f"Target resource '{resource.resource_id}' is classified as INTERNAL",
            score_impact=10.0,
        ))
        score += 10.0

    # Action impact
    if resource.action == ResourceAction.ADMIN:
        rules.append(RuleTrigger(
            rule_id="RES_ACTION_ADMIN",
            category="resource",
            severity=RuleSeverity.HIGH,
            description="Administrative modification or schema mutation requested",
            score_impact=40.0,
        ))
        score += 40.0
    elif resource.action == ResourceAction.EXPORT:
        rules.append(RuleTrigger(
            rule_id="RES_ACTION_EXPORT",
            category="resource",
            severity=RuleSeverity.HIGH,
            description="Bulk data export operation requested (exfiltration vector)",
            score_impact=35.0,
        ))
        score += 35.0
    elif resource.action == ResourceAction.WRITE:
        rules.append(RuleTrigger(
            rule_id="RES_ACTION_WRITE",
            category="resource",
            severity=RuleSeverity.MEDIUM,
            description="Write/mutation action requested on target resource",
            score_impact=20.0,
        ))
        score += 20.0

    # Compounding risk: Restricted + Export/Admin
    if resource.sensitivity_tier == SensitivityTier.RESTRICTED and resource.action in (ResourceAction.EXPORT, ResourceAction.ADMIN):
        rules.append(RuleTrigger(
            rule_id="RES_RESTRICTED_HIGH_RISK_ACTION",
            category="resource",
            severity=RuleSeverity.HIGH,
            description="Compounding risk: High-impact action (export/admin) on RESTRICTED enterprise resource",
            score_impact=25.0,
        ))
        score += 25.0

    return min(score, 100.0), rules


def evaluate_history_rules(history: AccessHistorySignal) -> Tuple[float, List[RuleTrigger]]:
    """Calculates access history sub-score (0-100) and triggered rules."""
    score = 0.0
    rules: List[RuleTrigger] = []

    if history.historical_deny_count >= 3:
        rules.append(RuleTrigger(
            rule_id="HIST_RECURRENT_DENIALS",
            category="history",
            severity=RuleSeverity.HIGH,
            description=f"User has accumulated {history.historical_deny_count} historical access denials",
            score_impact=50.0,
        ))
        score += 50.0
    elif history.historical_deny_count > 0:
        pts = history.historical_deny_count * 18.0
        rules.append(RuleTrigger(
            rule_id="HIST_PRIOR_DENIAL",
            category="history",
            severity=RuleSeverity.MEDIUM,
            description=f"User record contains {history.historical_deny_count} prior access denial(s)",
            score_impact=pts,
        ))
        score += pts

    if history.past_access_count_to_this_resource == 0:
        rules.append(RuleTrigger(
            rule_id="HIST_FIRST_TIME_ACCESS",
            category="history",
            severity=RuleSeverity.MEDIUM,
            description="User has no prior access history to this specific resource",
            score_impact=30.0,
        ))
        score += 30.0
    elif history.last_successful_access_days_ago > 60:
        rules.append(RuleTrigger(
            rule_id="HIST_DORMANT_ACCESS",
            category="history",
            severity=RuleSeverity.LOW,
            description=f"Access resumption after {history.last_successful_access_days_ago:.0f} days of dormancy",
            score_impact=25.0,
        ))
        score += 25.0

    if history.average_historical_risk_score > 45.0:
        rules.append(RuleTrigger(
            rule_id="HIST_ELEVATED_BASELINE_RISK",
            category="history",
            severity=RuleSeverity.MEDIUM,
            description=f"User baseline historical risk average is elevated ({history.average_historical_risk_score:.1f}/100)",
            score_impact=25.0,
        ))
        score += 25.0

    return min(score, 100.0), rules


def evaluate_threat_rules(threat: ThreatSignal) -> Tuple[float, List[RuleTrigger]]:
    """Calculates threat intelligence sub-score (0-100) and triggered rules."""
    score = 0.0
    rules: List[RuleTrigger] = []

    if threat.known_bad_ip:
        rules.append(RuleTrigger(
            rule_id="THR_KNOWN_MALICIOUS_IP",
            category="threat",
            severity=RuleSeverity.CRITICAL,
            description="Connection IP address matches active threat intelligence blacklist / C2 infrastructure",
            score_impact=85.0,
        ))
        score += 85.0

    if threat.leaked_credential_flag:
        rules.append(RuleTrigger(
            rule_id="THR_LEAKED_CREDENTIAL",
            category="threat",
            severity=RuleSeverity.CRITICAL,
            description="User credentials matched active breach repository / darknet credential dump",
            score_impact=90.0,
        ))
        score += 90.0

    if threat.incident_correlated_travel:
        rules.append(RuleTrigger(
            rule_id="THR_INCIDENT_CORRELATED",
            category="threat",
            severity=RuleSeverity.HIGH,
            description="Anomalous origin correlates with active security incident in this sector",
            score_impact=65.0,
        ))
        score += 65.0

    if threat.active_campaign_targeting_sector:
        rules.append(RuleTrigger(
            rule_id="THR_APT_CAMPAIGN_TARGET",
            category="threat",
            severity=RuleSeverity.MEDIUM,
            description="Organization industry sector is under active targeting by threat actor campaign",
            score_impact=35.0,
        ))
        score += 35.0

    return min(score, 100.0), rules
