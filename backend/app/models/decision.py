from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.signals import AccessContextBundle


class DecisionType(str, Enum):
    ALLOW = "Allow"
    CHALLENGE = "Challenge"
    RESTRICT = "Restrict"
    DENY = "Deny"


class RuleSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RuleTrigger(BaseModel):
    rule_id: str = Field(..., description="Unique rule identifier (e.g. DEV_OUTDATED_OS)")
    category: str = Field(..., description="Signal category (e.g. device, location)")
    severity: RuleSeverity = Field(..., description="Rule severity impact")
    description: str = Field(..., description="Human-readable explanation of why this rule fired")
    score_impact: float = Field(..., description="Subscore points contributed by this rule")


class AgentReasoning(BaseModel):
    decision: DecisionType = Field(..., description="Recommended decision from agent")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Agent confidence score (0.0 to 1.0)")
    key_factors: List[str] = Field(..., description="List of primary signals considered")
    narrative: str = Field(..., description="Plain-English explanation (2-4 sentences)")
    recommended_step_up_control: Optional[str] = Field(
        default=None, 
        description="Actionable control such as WebAuthn FIDO2 re-auth, sandbox isolation, or supervisor approval"
    )
    overrode_baseline: bool = Field(default=False, description="Whether agent changed deterministic outcome")


class CategoryScore(BaseModel):
    score: float = Field(..., ge=0.0, le=100.0, description="Raw sub-score (0-100)")
    weight: float = Field(..., ge=0.0, le=1.0, description="Configured weight applied")
    weighted_score: float = Field(..., ge=0.0, le=100.0, description="score * weight")
    rules: List[RuleTrigger] = Field(default_factory=list, description="Rules fired in this category")


class AccessEvaluationResult(BaseModel):
    evaluation_id: str = Field(..., description="Unique evaluation GUID")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Evaluation timestamp UTC")
    context: AccessContextBundle = Field(..., description="Snapshot of original context evaluated")
    
    # Deterministic Engine Output
    deterministic_score: float = Field(..., ge=0.0, le=100.0, description="Composite weighted risk score (0-100)")
    deterministic_decision: DecisionType = Field(..., description="Baseline decision before agent review")
    category_scores: Dict[str, CategoryScore] = Field(..., description="Breakdown across all 7 signal categories")
    fired_rules: List[RuleTrigger] = Field(default_factory=list, description="All triggered rules across categories")
    
    # Ambiguity & Agent Layer
    is_ambiguous: bool = Field(default=False, description="Whether request triggered ambiguity/conflict criteria")
    agent_invoked: bool = Field(default=False, description="Whether AI agent was called")
    agent_reasoning: Optional[AgentReasoning] = Field(default=None, description="SOC agent reasoning if invoked")
    
    # Final Outcome (Agent override takes precedence if agent was invoked)
    final_score: float = Field(..., ge=0.0, le=100.0, description="Final applied risk score")
    final_decision: DecisionType = Field(..., description="Final access decision")
    decision_rationale: str = Field(..., description="Structured executive summary of the decision")

    # Step-Up MFA Challenge Session Integration
    decision: Optional[str] = Field(default=None, description="Top-level decision string")
    mfa_required: bool = Field(default=False, description="Whether active TOTP MFA step-up verification is required")
    challenge_id: Optional[str] = Field(default=None, description="Active challenge session ID if Challenge decision")

