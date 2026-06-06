"""Cache tier definitions — ADR-024 §5."""
from enum import Enum


class CacheTier(str, Enum):
    """Three-tier cache policy for Databricks query results.

    GLOBAL_300S: shared across all users (dimension data, slow-moving reference tables)
    PER_USER_60S: scoped to a single user's OAuth identity (operational data, shift-sensitive)
    NONE: no caching (real-time data, audit trails)
    """

    GLOBAL_300S = "global_300s"
    PER_USER_60S = "per_user_60s"
    NONE = "none"
