// ContextGuard TypeScript Data Models

export type PrivilegeLevel = 'standard' | 'elevated' | 'admin';
export type OSPatchLevel = 'current' | 'outdated';
export type DiskEncryption = 'on' | 'off';
export type EDRAgentStatus = 'healthy' | 'degraded' | 'absent';
export type SensitivityTier = 'public' | 'internal' | 'confidential' | 'restricted';
export type ResourceAction = 'read' | 'write' | 'export' | 'admin';
export type DecisionType = 'Allow' | 'Challenge' | 'Restrict' | 'Deny';
export type RuleSeverity = 'low' | 'medium' | 'high' | 'critical';

// 1. User Identity Signal
export interface UserIdentity {
  user_id: string;
  role: string;
  department: string;
  mfa_enrolled: boolean;
  account_age_days: number;
  privilege_level: PrivilegeLevel;
}

// 2. Device Posture Signal
export interface DevicePosture {
  device_id: string;
  is_managed: boolean;
  os_patch_level: OSPatchLevel;
  disk_encryption: DiskEncryption;
  edr_agent_status: EDRAgentStatus;
  jailbroken_or_rooted: boolean;
}

// 3. Location Signal
export interface LocationSignal {
  geo_ip_country: string;
  geo_ip_city: string;
  is_corporate_network: boolean;
  is_known_location: boolean;
  impossible_travel_flag: boolean;
  vpn_tor_detected: boolean;
}

// 4. Behavior Signal
export interface BehaviorSignal {
  request_time_hour: number;
  is_outside_working_hours: boolean;
  typing_velocity_anomaly: boolean;
  resource_access_pattern_deviation: boolean;
  failed_logins_last_hour: number;
}

// 5. Requested Resource Signal
export interface ResourceSignal {
  resource_id: string;
  sensitivity_tier: SensitivityTier;
  action: ResourceAction;
}

// 6. Access History Signal
export interface AccessHistorySignal {
  past_access_count_to_this_resource: number;
  last_successful_access_days_ago: number;
  historical_deny_count: number;
  average_historical_risk_score: number;
}

// 7. Threat Signal
export interface ThreatSignal {
  known_bad_ip: boolean;
  leaked_credential_flag: boolean;
  active_campaign_targeting_sector: boolean;
  incident_correlated_travel: boolean;
}

// Full Context Bundle
export interface AccessContextBundle {
  request_id?: string;
  identity: UserIdentity;
  device: DevicePosture;
  location: LocationSignal;
  behavior: BehaviorSignal;
  resource: ResourceSignal;
  access_history: AccessHistorySignal;
  threat: ThreatSignal;
}

// Rule Triggered
export interface RuleTrigger {
  rule_id: string;
  category: string;
  severity: RuleSeverity;
  description: string;
  score_impact: number;
}

// Category Sub-Score
export interface CategoryScore {
  score: number;
  weight: number;
  weighted_score: number;
  rules: RuleTrigger[];
}

// Agent Reasoning
export interface AgentReasoning {
  decision: DecisionType;
  confidence: number;
  key_factors: string[];
  narrative: string;
  recommended_step_up_control?: string;
  overrode_baseline: boolean;
}

// Complete Evaluation Result
export interface AccessEvaluationResult {
  evaluation_id: string;
  timestamp: string;
  context: AccessContextBundle;
  deterministic_score: number;
  deterministic_decision: DecisionType;
  category_scores: Record<string, CategoryScore>;
  fired_rules: RuleTrigger[];
  is_ambiguous: boolean;
  agent_invoked: boolean;
  agent_reasoning?: AgentReasoning | null;
  final_score: number;
  final_decision: DecisionType;
  decision_rationale: string;
}

// Scoring Weights & Thresholds
export interface CategoryWeights {
  identity: number;
  device: number;
  location: number;
  behavior: number;
  resource: number;
  history: number;
  threat: number;
}

export interface DecisionThresholds {
  allow_max: number;
  challenge_max: number;
  restrict_max: number;
  ambiguous_boundary_delta: number;
}

export interface EnginePolicy {
  policy_id: string;
  name: string;
  weights: CategoryWeights;
  thresholds: DecisionThresholds;
}

// Canonical Demo Scenario
export interface DemoScenario {
  id: string;
  title: string;
  description: string;
  expected_decision: DecisionType;
  expected_agent_trigger: boolean;
  context: AccessContextBundle;
}
