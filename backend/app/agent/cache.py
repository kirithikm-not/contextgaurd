import hashlib
import json
import time
from typing import Dict, Optional, Tuple
from app.models.decision import AgentReasoning
from app.models.signals import AccessContextBundle


class ContextReasoningCache:
    """TTL cache for LLM agent evaluations to prevent redundant API calls during live demos."""

    def __init__(self, default_ttl_seconds: int = 300):
        self.default_ttl = default_ttl_seconds
        # Mapping: hash_key -> (AgentReasoning, expire_timestamp)
        self._cache: Dict[str, Tuple[AgentReasoning, float]] = {}

    @staticmethod
    def generate_cache_key(bundle: AccessContextBundle, baseline_score: float) -> str:
        """Generates a canonical hash key based on all context signals and baseline score."""
        # Dump context omitting volatile request_id
        bundle_dict = bundle.model_dump(exclude={"request_id"}, mode="json")
        bundle_dict["_baseline_score"] = round(baseline_score, 1)
        canonical_str = json.dumps(bundle_dict, sort_keys=True)
        return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    def get(self, cache_key: str) -> Optional[AgentReasoning]:
        now = time.time()
        if cache_key in self._cache:
            reasoning, expires_at = self._cache[cache_key]
            if now < expires_at:
                return reasoning
            else:
                del self._cache[cache_key]
        return None

    def set(self, cache_key: str, reasoning: AgentReasoning, ttl: Optional[int] = None):
        ttl_seconds = ttl or self.default_ttl
        expires_at = time.time() + ttl_seconds
        self._cache[cache_key] = (reasoning, expires_at)

    def clear(self):
        self._cache.clear()

    def size(self) -> int:
        now = time.time()
        # Clean expired on query
        self._cache = {k: v for k, v in self._cache.items() if now < v[1]}
        return len(self._cache)


agent_cache = ContextReasoningCache()
