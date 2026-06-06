"""Allowlist policy for per-request Unity Catalog overrides (x-databricks-catalog).

Catalog overrides are optional. When absent, ``object_resolver`` uses environment
catalog variables unchanged. When present, the value must be a safe identifier
and appear in ``DATABRICKS_ALLOWED_CATALOGS`` (comma-separated).
"""
from __future__ import annotations

import os
import re

from .errors import DatabricksCatalogTargetError

ALLOWLIST_ENV_VAR = "DATABRICKS_ALLOWED_CATALOGS"
UNSUPPORTED_CATALOG_DETAIL = "Unsupported Databricks catalog target"

# Characters/patterns that must never appear in a catalog override value.
_UNSAFE_PATTERN = re.compile(r"[`;/\s]|--|\.\.|'|\"|\\")

# Unity Catalog catalog names: letters, digits, underscore (no dots/hyphens).
_IDENTIFIER_PATTERN = re.compile(r"^[a-zA-Z0-9_]+$")


def parse_allowed_catalogs(env_value: str | None = None) -> frozenset[str]:
    """Parse ``DATABRICKS_ALLOWED_CATALOGS`` (or explicit env string) into a set."""
    raw = env_value if env_value is not None else os.getenv(ALLOWLIST_ENV_VAR, "")
    if not raw or not raw.strip():
        return frozenset()
    return frozenset(part.strip() for part in raw.split(",") if part.strip())


def normalize_catalog_override(raw: str | None) -> str | None:
    """Return a trimmed catalog name, or ``None`` when override is absent/blank."""
    if raw is None or not isinstance(raw, str):
        return None
    stripped = raw.strip()
    return stripped if stripped else None


def assert_allowed_catalog_target(
    catalog_target: str | None,
    *,
    allowed_catalogs: frozenset[str] | None = None,
) -> str | None:
    """Validate override and return normalized catalog, or ``None`` if absent.

    Blank/whitespace-only values are treated as absent (no override).

    Raises:
        DatabricksCatalogTargetError: unsafe identifier, unknown catalog, or
            override supplied when allowlist is empty.
    """
    normalized = normalize_catalog_override(catalog_target)
    if normalized is None:
        return None

    if _UNSAFE_PATTERN.search(normalized) or not _IDENTIFIER_PATTERN.match(normalized):
        raise DatabricksCatalogTargetError()

    allowed = (
        allowed_catalogs
        if allowed_catalogs is not None
        else parse_allowed_catalogs()
    )
    if not allowed or normalized not in allowed:
        raise DatabricksCatalogTargetError()

    return normalized
