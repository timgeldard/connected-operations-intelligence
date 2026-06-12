"""Catalog/schema-aware SQL object resolution for native Databricks queries.

V1-compatible fallback chains (verified from ConnectIO-RAD source):
  CQ_CATALOG  → falls back to TRACE_CATALOG (CQ and Trace share a workspace)
  CQ_SCHEMA   → falls back to POH_SCHEMA, then "csm_process_order_history"
  POH_CATALOG → no fallback (empty string if unset)
  POH_SCHEMA  → defaults to "csm_process_order_history"
  TRACE_CATALOG → no fallback (empty string if unset)
  TRACE_SCHEMA  → defaults to "gold" (LEGACY schema for trace2 views and EnvMon)
  TRACE_GOVERNED_SCHEMA → defaults to "gold_io_reporting" (governed io-reporting schema).
    Used only for the two governed trace2 objects that live in gold_io_reporting:
      • gold_trace_anchor_secured  (RLS-enforced anchor MV, batch-search primary source)
      • gold_batch_lineage          (T2 governed MV, batch-search po_match + trace-graph)
    All other trace2 objects (gold_material, gold_plant, gold_batch_stock_v, …) remain
    on TRACE_SCHEMA ("gold") — no governed equivalents exist for those yet.
    app.yaml must set TRACE_GOVERNED_SCHEMA: gold_io_reporting explicitly because
    DAB ${var.*} substitution does not apply to app.yaml (per-environment literals only).
  ENVMON domain → shares TRACE_CATALOG / TRACE_SCHEMA (confirmed from V1 em_config.py:
    LOT_TBL_NAME, POINT_TBL_NAME, RESULT_TBL_NAME all use f"{TRACE_CATALOG}.{TRACE_SCHEMA}.*")
  SPC domain → uses SPC_CATALOG / SPC_SCHEMA (default: "gold"); falls back to TRACE_CATALOG
    because connected_plant_uat.gold.spc_quality_metric_subgroup_mv is in the same
    catalog as the TRACE/EnvMon views (UAT confirmed 2026-05-22 — pp.txt)
  WH360 domain → uses WH360_CATALOG / WH360_SCHEMA (default: "wh360")

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
}

_SCHEMA_ENV: dict[str, tuple[str, str]] = {
    "poh": ("POH_SCHEMA", "csm_process_order_history"),
    "cq": ("CQ_SCHEMA", "csm_process_order_history"),
    "trace2": ("TRACE_SCHEMA", "gold"),
    "envmon": ("TRACE_SCHEMA", "gold"),
    "spc": ("SPC_SCHEMA", "gold"),
    "wh360": ("WH360_SCHEMA", "wh360"),
}


def quote_identifier(name: str) -> str:
    """Return a backtick-quoted SQL identifier (catalog, schema, or object name)."""
    return f"`{name}`"


def qualify_object(catalog: str, schema: str, object_name: str) -> str:
    """Return a fully-qualified backtick-quoted three-part object reference.

    Produces: `catalog`.`schema`.`object_name`
    """
    return f"`{catalog}`.`{schema}`.`{object_name}`"


def resolve_governed_trace2_object(object_name: str) -> str:
    """Return a fully-qualified reference for a governed trace2 object.

    Governed trace2 objects live in TRACE_GOVERNED_SCHEMA (default: "gold_io_reporting")
    rather than TRACE_SCHEMA (default: "gold", the legacy schema).  The two governed
    objects are:
      • gold_trace_anchor_secured  — RLS-enforced anchor MV (batch-search primary source)
      • gold_batch_lineage          — T2 governed MV (batch-search po_match + trace-graph)

    The catalog is still read from TRACE_CATALOG (same workspace, same catalog — only the
    schema differs).  All other trace2 objects (gold_material, gold_plant, …) continue to
    resolve via resolve_domain_object("trace2", …) on TRACE_SCHEMA.

    CAVEAT: end-user reads of governed gold_batch_lineage require the `traceability-readers`
    UC group (not yet provisioned in UAT as of 2026-06-12).  Owner/admin identities work
    today.  This is an accepted track-level gate, not a blocker for this change.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    governed_schema = os.getenv("TRACE_GOVERNED_SCHEMA", "gold_io_reporting")
    return resolve_domain_object("trace2", object_name, schema_override=governed_schema)


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
        domain: One of "poh", "cq", "trace2", "envmon", "spc", "wh360".
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

    if not catalog:
        fallback_note = " (or TRACE_CATALOG for cq/envmon/spc domain)" if domain in ("cq", "envmon", "spc") else ""
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
