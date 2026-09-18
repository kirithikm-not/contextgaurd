from pydantic import BaseModel, Field, model_validator


class CategoryWeights(BaseModel):
    identity: float = Field(default=0.15, ge=0.0, le=1.0)
    device: float = Field(default=0.20, ge=0.0, le=1.0)
    location: float = Field(default=0.20, ge=0.0, le=1.0)
    behavior: float = Field(default=0.15, ge=0.0, le=1.0)
    resource: float = Field(default=0.15, ge=0.0, le=1.0)
    history: float = Field(default=0.10, ge=0.0, le=1.0)
    threat: float = Field(default=0.05, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def validate_weights_sum(self):
        total = round(
            self.identity + self.device + self.location + 
            self.behavior + self.resource + self.history + self.threat, 
            2
        )
        # Allow slight float rounding variance (e.g. 0.99 to 1.01)
        if not (0.98 <= total <= 1.02):
            raise ValueError(f"Category weights must sum to approximately 1.0 (current sum: {total})")
        return self


class DecisionThresholds(BaseModel):
    allow_max: float = Field(default=29.0, ge=0.0, le=100.0, description="0 to allow_max -> Allow")
    challenge_max: float = Field(default=54.0, ge=0.0, le=100.0, description="allow_max+1 to challenge_max -> Challenge")
    restrict_max: float = Field(default=79.0, ge=0.0, le=100.0, description="challenge_max+1 to restrict_max -> Restrict")
    ambiguous_boundary_delta: float = Field(default=5.0, ge=0.0, le=15.0, description="Margin around thresholds triggering agent")


class EnginePolicy(BaseModel):
    policy_id: str = Field(default="default_zero_trust_v1")
    name: str = Field(default="Standard Enterprise Zero-Trust Policy")
    weights: CategoryWeights = Field(default_factory=CategoryWeights)
    thresholds: DecisionThresholds = Field(default_factory=DecisionThresholds)
