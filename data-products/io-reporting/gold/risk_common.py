"""
Shared helpers for operational risk scoring (Spec 16 — Operational Intelligence Foundation).

Provides:
  evidence_confidence(evidence_flags)   — PySpark Column: High / Medium / Low / Unknown.
  base_severity_from_evidence(...)      — Critical / High / Medium / Low / Unknown.
  REASON_CODES                          — dict keyed by reason_code, loaded from the CSV taxonomy.

CRITICAL invariant: Unknown means evidence is *missing* — NOT a synonym for Low.
  - Unknown when a required linkage field (order_number for production, delivery_number for
    logistics, lot_number for quality) is null.
  - Low when evidence is present but weak (e.g. small shortfall, minor delay).
  - Never collapse Unknown to Low in downstream severity rules.
"""

import csv
import pathlib

from pyspark.sql import functions as F
from pyspark.sql.types import StringType

# ---------------------------------------------------------------------------
# Taxonomy CSV — loaded once at module import.
# ---------------------------------------------------------------------------
_CSV = pathlib.Path(__file__).parent.parent / "resources" / "config" / "risk_reason_taxonomy.csv"


def _load_taxonomy() -> list[dict]:
    """Parse risk_reason_taxonomy.csv into a list of row dicts."""
    with open(_CSV, encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


# Public constant: {reason_code: row_dict, ...}
REASON_CODES: dict[str, dict] = {row["reason_code"]: row for row in _load_taxonomy()}

# Explicit string constants — canonical reason code identifiers.
# These allow the parity guard (check_risk_taxonomy_parity.py) to verify that every
# CSV row is referenced in source, and allow callers to use RC.MATERIAL_SHORTFALL etc.
RC_MATERIAL_SHORTFALL = "MATERIAL_SHORTFALL"
RC_STAGING_INCOMPLETE = "STAGING_INCOMPLETE"
RC_TR_AGEING = "TR_AGEING"
RC_TO_UNCONFIRMED = "TO_UNCONFIRMED"
RC_ORDER_NOT_STARTED = "ORDER_NOT_STARTED"
RC_PRODUCTION_BEHIND_PLAN = "PRODUCTION_BEHIND_PLAN"
RC_QUALITY_HOLD = "QUALITY_HOLD"
RC_INSPECTION_LOT_OPEN = "INSPECTION_LOT_OPEN"
RC_UD_MISSING = "UD_MISSING"
RC_MIC_RESULT_MISSING = "MIC_RESULT_MISSING"
RC_MIC_RESULT_FAILED = "MIC_RESULT_FAILED"
RC_OUTBOUND_PICK_INCOMPLETE = "OUTBOUND_PICK_INCOMPLETE"
RC_DELIVERY_PAST_GI = "DELIVERY_PAST_GI"
RC_PREVIOUS_ORDER_OVERRUN = "PREVIOUS_ORDER_OVERRUN"
RC_SCHEDULE_CHANGED = "SCHEDULE_CHANGED"
RC_STALE_SOURCE = "STALE_SOURCE"
RC_MISSING_MAPPING = "MISSING_MAPPING"
RC_UNKNOWN = "UNKNOWN"


# ---------------------------------------------------------------------------
# Confidence helper
# ---------------------------------------------------------------------------

def evidence_confidence(evidence_flags: dict) -> "Column":  # noqa: F821
    """Return a PySpark Column expression: High / Medium / Low / Unknown.

    Args:
        evidence_flags: mapping of label → Column expression (boolean/nullable).
            Keys that end with ``_required`` are treated as **critical** — if null/false,
            the result is **Unknown** (not Low).  All other keys are advisory signals.

            Convention:
              required keys   → Column that is True when evidence IS present.
              advisory keys   → Column that is True when the signal IS positive.

            Confidence levels:
              Unknown : any required evidence column is null (data linkage absent).
              High    : all required fields present + all advisory signals positive.
              Medium  : all required fields present + at least one advisory signal positive.
              Low     : all required fields present + no advisory signals positive.

    Returns:
        A PySpark Column expression of StringType.
    """
    required = {k: v for k, v in evidence_flags.items() if k.endswith("_required")}
    advisory = {k: v for k, v in evidence_flags.items() if not k.endswith("_required")}

    # Unknown when ANY required evidence field is null.
    unknown_condition = None
    for col_expr in required.values():
        cond = col_expr.isNull()
        unknown_condition = cond if unknown_condition is None else (unknown_condition | cond)

    # Score advisory signals (count True).
    advisory_cols = list(advisory.values())
    if advisory_cols:
        advisory_true_count = sum(
            F.when(c.isNotNull() & c, F.lit(1)).otherwise(F.lit(0))
            for c in advisory_cols
        )
        advisory_total = len(advisory_cols)
    else:
        advisory_true_count = F.lit(0)
        advisory_total = 0

    if unknown_condition is not None:
        base = (
            F.when(unknown_condition, F.lit("Unknown"))
        )
    else:
        base = None

    if advisory_total > 0:
        high_cond = advisory_true_count == advisory_total
        medium_cond = advisory_true_count > F.lit(0)
        confidence_expr = (
            F.when(high_cond, F.lit("High"))
            .when(medium_cond, F.lit("Medium"))
            .otherwise(F.lit("Low"))
        )
    else:
        # No advisory signals: if required evidence present = High (all we can say).
        confidence_expr = F.lit("High")

    if base is not None:
        return base.otherwise(confidence_expr).cast(StringType())
    return confidence_expr.cast(StringType())


# ---------------------------------------------------------------------------
# Severity from evidence
# ---------------------------------------------------------------------------

def base_severity_from_evidence(
    severity_hint_col: "Column",  # noqa: F821
    confidence_col: "Column",     # noqa: F821
) -> "Column":  # noqa: F821
    """Derive base severity from the taxonomy severity hint + confidence score.

    Rules:
      - Unknown confidence  → Unknown severity  (NEVER downgrade to Low).
      - Low confidence      → downgrade severity_hint by one band (Critical→High, High→Medium, etc.).
      - Medium/High         → use severity_hint as-is.
      - Unknown hint        → Unknown severity  (missing taxonomy mapping).

    Returns:
        A PySpark Column of StringType: Critical / High / Medium / Low / Unknown.
    """
    downgrade = (
        F.when(severity_hint_col == "Critical", F.lit("High"))
        .when(severity_hint_col == "High", F.lit("Medium"))
        .when(severity_hint_col == "Medium", F.lit("Low"))
        .when(severity_hint_col == "Low", F.lit("Low"))
        .otherwise(F.lit("Unknown"))
    )

    return (
        F.when(confidence_col == "Unknown", F.lit("Unknown"))
        .when(confidence_col.isNull(), F.lit("Unknown"))
        .when(severity_hint_col.isNull(), F.lit("Unknown"))
        .when(severity_hint_col == "Unknown", F.lit("Unknown"))
        .when(confidence_col == "Low", downgrade)
        .otherwise(severity_hint_col)
    ).cast(StringType())
