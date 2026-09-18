import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "ContextGuard Zero-Trust Engine"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = "development"
    
    # LLM Settings (for Phase 3)
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-latest"
    GEMINI_API_KEY: str = ""
    USE_MOCK_AGENT: bool = True
    
    # Agent Guardrails
    AGENT_CONFIDENCE_FLOOR: float = 0.70
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
