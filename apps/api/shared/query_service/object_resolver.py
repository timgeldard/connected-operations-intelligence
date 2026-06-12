"""Catalog/schema-aware SQL object resolution for native Databricks queries.

V1-compatible fallback chains (verified from ConnectIO-RAD source):
  CQ_CATALOG  → falls back to TRACE_CATALOG (CQ and Trace share a workspace)
  CQ_SCHEMA   → falls back to POH_SCHEMA, then "csm_process_order_history"
  POH_CATALOG → no fallback (empty string if unset)
  POH_SCHEMA  → defaults to "csm_process_order_history"
  TRACE_CATALOG → no fallback (empty string if unset)
  TRACE_SCHEMA  → defaults to "gold"
  ENVMON domain → shares TRACE_CATALOG / TRACE_SCHEMA (confirmed from V1 em_config.py:
    LOT_TBL_NAME, POINT_TBL_NAME, RESULT_TBL_NAME all use f"{TRACE_CATALOG}.{TRACE_SCHEMA}.*")
  SPC domain → uses SPC_CATALOG / SPC_SCHEMA (default: "gold"); falls back to TRACE_CATALOG
    because connected_plant_uat.gold.spc_quality_metric_subgroup_mv is in the same
    catalog as the TRACE/EnvMon views (UAT confirmed 2026-05-22 — pp.txt)
  WH360 domain → uses WH360_CATALOG / WH360_SCHEMA (default: "wh360")
  QUALITY_LAB domain → uses QUALITY_LAB_CATALOG / QUALITY_LAB_SCHEMA (default: "gold_io_reporting")
    Points to the governed gold_io_reporting schema where vw_consumption_quality_lab_*
    consumption views live. Falls back to WH360_CATALOG (same catalog as the io-reporting
    product — connected_plant_uat / _prod).

Object names passed to these functions must be code constants — never user-supplied
request parameters. Caller is responsible for this invariant.
"""
from __future__ import annotations

import contextvars
import os

from shared.query_service.errors import DatabricksConfigError

# Context variable to hold a per-request catalog override (e.g. 'uat' or 'prod')
# Injected by the route handler based on the X-Databricks-Catalog header.
catalog_context: contextvars.ContextVar[str | None] = contextvars.ContextVar("catalog_context", default=None)

_CATALOG_ENV: dict[str, str] = {
    "poh": "POH_CATALOG",
    "cq": "CQ_CATALOG",
    "trace2": "TRACE_CATALOG",
    "envmon": "TRACE_CATALOG",
    "spc": "SPC_CATALOG",
    "wh360": "WH360_CATALOG",
    # quality_lab: governed io-reporting gold schema; same catalog as wh360 / io-reporting product.
    "quality_lab": "QUALITY_LAB_CATALOG",
}

_SCHEMA_ENV: dict[str, tuple[str, str]] = {
    "poh": ("POH_SCHEMA", "csm_process_order_history"),
    "cq": ("CQ_SCHEMA", "csm_process_order_history"),
    "trace2": ("TRACE_SCHEMA", "gold"),
    "envmon": ("TRACE_SCHEMA", "gold"),
    "spc": ("SPC_SCHEMA", "gold"),
    "wh360": ("WH360_SCHEMA", "wh360"),
    # quality_lab: consumption views live in gold_io_reporting (same schema as all io-reporting gold).
    "quality_lab": ("QUALITY_LAB_SCHEMA", "gold_io_reporting"),
}


def quote_identifier(name: str) -> str:
    """Return a backtick-quoted SQL identifier (catalog, schema, or object name)."""
    return f"`{name}`"


def qualify_object(catalog: str, schema: str, object_name: str) -> str:
    """Return a fully-qualified backtick-quoted three-part object reference.

    Produces: `catalog`.`schema`.`object_name`
    """
    return f"`{catalog}`.`{schema}`.`{object_name}`"


def resolve_domain_object(
    domain: str,
    object_name: str,
    *,
    schema_override: str | None = None,
    catalog_override: str | None = None,
) -> str:
    """Return a fully-qualified backtick-quoted object reference for domain/object_name.

    Reads catalog and schema from domain-specific environment variables.
    Applies V1-compatible fallback chains. Raises DatabricksConfigError if the
    catalog cannot be resolved (missing env var and no override).

    Args:
        domain: One of "poh", "cq", "trace2", "envmon", "spc", "wh360", "quality_lab".
        object_name: Code constant — the table/view name without qualification.
            Must never be a user-supplied value.
        schema_override: When set, bypasses the schema env var (e.g., "gold" for
            CQ lab plants which always uses the gold schema regardless of CQ_SCHEMA).
        catalog_override: When set, bypasses the catalog env var.

    Returns:
        Fully-qualified reference: `` `catalog`.`schema`.`object_name` ``

    Raises:
        DatabricksConfigError: Catalog env var is unset and no override given.
        ValueError: Unknown domain.
    """
    if domain not in _CATALOG_ENV:
        raise ValueError(f"Unknown domain: {domain!r}. Known domains: {sorted(_CATALOG_ENV)}")

    catalog_env = _CATALOG_ENV[domain]

    context_catalog = catalog_context.get()
    if context_catalog:
        catalog = context_catalog
    else:
        catalog = catalog_override or os.getenv(catalog_env, "")

    # CQ_CATALOG falls back to TRACE_CATALOG (V1 behaviour — CQ and Trace share workspace)
    if not catalog and domain in ("cq", "envmon", "spc"):
        catalog = os.getenv("TRACE_CATALOG", "")

    # QUALITY_LAB_CATALOG falls back to WH360_CATALOG (both target the io-reporting product catalog)
    if not catalog and domain == "quality_lab":
        catalog = os.getenv("WH360_CATALOG", "")

    if not catalog:
        if domain in ("cq", "envmon", "spc"):
            fallback_note = " (or TRACE_CATALOG for cq/envmon/spc domain)"
        elif domain == "quality_lab":
            fallback_note = " (or WH360_CATALOG for quality_lab domain)"
        else:
            fallback_note = ""
        raise DatabricksConfigError(
            [catalog_env],
            detail=(
                f"Missing Unity Catalog identifier for domain {domain!r}. "
                f"Set {catalog_env}{fallback_note}."
            ),
        )

    schema_env, schema_default = _SCHEMA_ENV[domain]
    schema = schema_override or os.getenv(schema_env, schema_default)

    return qualify_object(catalog, schema, object_name)
