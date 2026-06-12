"""
Quality Lab Board silver tables — short-lookback result and spec for the rotating
Lab Board wallboard (quality-batch-release workspace, lab-board view).

Two tables:
  quality_lab_inspection_result       — from QAMR (one row per lot × operation × MIC)
  quality_lab_characteristic_spec     — from QAMV (spec limits per lot × operation × MIC)

DESIGN DIFFERENCES FROM quality.py result-family tables:
  1. Gate:  quality gate (qm_enabled_flag only — NOT the two-tier spc gate), matching
     the lot/UD tables in quality.py. Lab-board consumers are QA release staff who see
     all QM-enabled plants, not the narrower SPC pilot set.
  2. Lookback: `lab_board_lookback_days` pipeline conf (default 30), a SHORT rolling
     window to keep scans tiny for a real-time wallboard. Uses the raw-string pushdown
     pattern from traceability.py (BUDAT fix — dual-format AEDATTM support; see note).
     The window is intentionally tighter than `qm_lookback_years` (used by the lot/UD
     tables) — 30 days of failures is sufficient for a lab wallboard; multi-year history
     is the SPC domain (feature/spc-result-grain, held for cost reasons, DO NOT MERGE
     that branch — it adds ~660M-row scans to quality runs).
  3. These tables RECONCILE with quality_inspection_result / quality_inspection_characteristic
     when SPC Phase 1 merges: same source tables, overlapping rows within the shorter window.
     Co-existence is intentional; the two sets serve different product areas.

NOTE on raw-string pushdown for AEDATTM:
  QAMR/QAMV carry AEDATTM as a TIMESTAMP column (Aecorsoft replication watermark), so the
  dual-format string issue from traceability.py (BUDAT DATS string) does NOT apply here.
  We use a direct timestamp comparison: AEDATTM >= (current_date() - N days) as a typed
  predicate. This IS Delta-pushdown-eligible for TIMESTAMP columns with file-level statistics.

SEVERITY-WARN RULE:
  QAMV carries TOLERANZOB (upper spec limit) and TOLERANZUN (lower spec limit) for the main
  spec window. SAP also defines TOLERANZOB_W (upper warning limit) and TOLERANZUN_W (lower
  warning limit) on QAMV — these are the "warn band" boundaries. If those columns exist in
  the bronze source, the gold layer uses them to classify 'warn' (within warning band) vs
  'fail' (outside spec). If they are absent (not yet replicated), gold falls back to
  'fail'-only with a NULL warn_lower/warn_upper. The gold table documents this fallback.
  See: gold/quality_lab.py — _severity() rule comments.
"""

import dlt
from pyspark.sql import functions as F

from silver._plant_gate import apply_plant_gate
from silver.helpers import BRONZE, bronze_columns_exist, get_spark, sap_date, strip_zeros

# Columns required on QAMR for the result table to be run-eligible.
# Same QAMR required columns as quality.py + PRUEFDATUV/PRUEFDATUB for the result timestamp.
_QAMR_LAB_REQUIRED = [
    "PRUEFLOS", "VORGLFNR", "MERKNR", "MANDANT", "MITTELWERT", "CODE1",
    "MBEWERTG", "PRUEFDATUV", "PRUEFDATUB", "PRUEFER", "AEDATTM",
]

# Columns required on QAMV for the spec table to be run-eligible.
# Subset of quality.py _QAMV_REQUIRED; warning limit columns are OPTIONAL (col_or_null pattern).
_QAMV_LAB_REQUIRED = [
    "PRUEFLOS", "VORGLFNR", "MERKNR", "MANDANT", "SOLLWERT", "TOLERANZOB",
    "TOLERANZUN", "KURZTEXT", "MASSEINHSW", "AEDATTM",
]

# QALS required for the gate-via-parent join (same as quality.py).
_QALS_LAB_REQUIRED = [
    "PRUEFLOS", "MANDANT", "WERK", "HERKUNFT", "MATNR", "CHARG", "AUFNR",
    "ENSTEHDAT", "AEDATTM",
]


def _lab_board_lookback_days(spark) -> int:
    """Short rolling lookback window for the lab board (default 30 days).

    Set via the `lab_board_lookback_days` pipeline conf in
    resources/silver_quality_pipeline.pipeline.yml. Keeps the lab-board silver tables
    tiny — a wallboard only needs recent failures, not multi-year history (that is the
    SPC domain). Snapshot MV self-corrects when the window changes (no manual full refresh)."""
    raw = spark.conf.get("lab_board_lookback_days", "30")
    days = int(str(raw).strip())
    if days <= 0:
        raise ValueError(f"lab_board_lookback_days must be a positive integer, got {raw!r}")
    return days


def _gated_qals_for_lab(spark):
    """Plant- and time-gated QALS set for lab-board tables.

    Uses the QUALITY gate (qm_enabled_flag only — not the spc two-tier gate) and the
    SHORT lab_board_lookback_days window. Pre-gate pushdown on the same axis as the
    output gate (same pattern as quality.py _gated_qals).

    The AEDATTM column is a TIMESTAMP, so a typed comparison is Delta-pushdown-eligible
    (file-level min/max statistics on TIMESTAMP columns propagate to the planner).
    ENSTEHDAT (lot creation date) is a SAP date string — using sap_date() here is fine
    for the QALS scan (the lot table is the smaller filtered set, ~505k rows in UAT).
    """
    spark_session = spark
    days = _lab_board_lookback_days(spark_session)
    qals = spark_session.read.table(f"{BRONZE}.inspection_qals")
    # Time-gate: keep only lots created within the lookback window.
    # determinism-exempt: rolling lab-board window is intentionally evaluated at refresh time.
    cutoff = F.date_sub(F.current_date(), days)  # determinism-exempt: rolling lab-board window
    qals = qals.filter(sap_date("ENSTEHDAT") >= cutoff)
    return apply_plant_gate(qals, "WERK", "quality", spark=spark_session)


if (
    bronze_columns_exist("inspection_qals", _QALS_LAB_REQUIRED)
    and bronze_columns_exist("inspection_qamr", _QAMR_LAB_REQUIRED)
):

    @dlt.table(
        name="quality_lab_inspection_result",
        comment=(
            "Lab-board MIC-level inspection results (QAMR) — one row per "
            "PRUEFLOS+VORGLFNR+MERKNR. Short rolling window (lab_board_lookback_days, default "
            "30d) on lot creation date; quality gate (qm_enabled_flag only). Designed for the "
            "lab-board wallboard gold layer (gold_qm_lab_result_signal). DO NOT merge with the "
            "SPC result-grain family (quality_inspection_result, spc gate, qm_lookback_years) — "
            "they serve different product areas; this table reconciles with that one within the "
            "shared window once SPC Phase 1 merges. Current-state snapshot (AEDATTM only)."
        ),
        table_properties={
            "delta.enableChangeDataFeed": "true",
            "delta.autoOptimize.optimizeWrite": "true",
            "delta.autoOptimize.autoCompact": "true",
        },
        cluster_by=["plant_code", "inspection_lot_number"],
    )
    @dlt.expect_all_or_drop({
        "inspection_lot_number present": "inspection_lot_number IS NOT NULL",
        "plant_code present": "plant_code IS NOT NULL",
    })
    @dlt.expect_all({
        "operation_id present": "operation_id IS NOT NULL",
        "mic_id present": "mic_id IS NOT NULL",
    })
    def quality_lab_inspection_result():
        spark = get_spark()
        # Gate-via-parent: PRUEFLOS inner join to quality-gated + lab-window lot set to
        # filter (plant + time window) and derive plant_code. QAMR carries no WERK.
        lot_keys = _gated_qals_for_lab(spark).select(
            F.col("PRUEFLOS").alias("_lot_prueflos"),
            F.col("MANDANT").alias("_lot_client"),
            F.col("WERK").alias("_lot_plant"),
            # Carry lot-level fields needed by the gold join (order number, batch, lot origin).
            strip_zeros("AUFNR").alias("_lot_order_number"),
            F.col("CHARG").alias("_lot_batch"),
            F.col("HERKUNFT").alias("_lot_origin_code"),
            strip_zeros("MATNR").alias("_lot_material_code"),
        )
        qamr = spark.read.table(f"{BRONZE}.inspection_qamr")
        gated = qamr.join(
            lot_keys,
            (qamr["PRUEFLOS"] == F.col("_lot_prueflos"))
            & (qamr["MANDANT"] == F.col("_lot_client")),
            "inner",
        )
        out = gated.select(
            F.col("MANDANT").alias("client"),
            F.col("PRUEFLOS").alias("inspection_lot_number"),
            F.col("VORGLFNR").alias("operation_id"),
            F.col("MERKNR").alias("mic_id"),
            # Quantitative result value (mean over the lot for this MIC).
            F.col("MITTELWERT").alias("quantitative_result"),
            F.col("CODE1").alias("qualitative_result"),
            # MBEWERTG: valuation code — 'A' accepted, 'R' rejected, blank/other.
            # Gold layer uses this + spec limits to derive severity (fail/warn).
            F.col("MBEWERTG").alias("inspection_result_valuation"),
            F.when(F.col("MBEWERTG") == "A", "Accepted")
             .when(F.col("MBEWERTG") == "R", "Rejected")
             .when(F.trim(F.col("MBEWERTG")) != "", "Other Decision")
             .otherwise(None).alias("inspection_result"),
            # Result recording dates (when the inspector entered results).
            sap_date("PRUEFDATUV").alias("result_recording_start_date"),
            sap_date("PRUEFDATUB").alias("result_recording_end_date"),
            F.col("PRUEFER").alias("inspector"),
            # Lot-level fields carried for the gold join (avoids a second lot join in gold).
            F.col("_lot_plant").alias("plant_code"),
            F.col("_lot_order_number").alias("lot_order_number"),
            F.col("_lot_batch").alias("batch_number"),
            F.col("_lot_origin_code").alias("lot_origin_code"),
            F.col("_lot_material_code").alias("material_code"),
            # Extraction timestamp — NOT an event-ordering column.
            F.col("AEDATTM").cast("timestamp").alias("_replicated_at"),
        )
        # Authoritative output gate (pre-gated via lot keys on the same quality axis).
        return apply_plant_gate(out, "plant_code", "quality", spark=spark)


if (
    bronze_columns_exist("inspection_qals", _QALS_LAB_REQUIRED)
    and bronze_columns_exist("inspection_qamv", _QAMV_LAB_REQUIRED)
):

    @dlt.table(
        name="quality_lab_characteristic_spec",
        comment=(
            "Lab-board MIC spec limits (QAMV) — one row per PRUEFLOS+VORGLFNR+MERKNR. "
            "Supplies spec limits (lsl_spec/usl_spec) and, when replicated, warning limits "
            "(lsl_warn/usl_warn) for the lab-board severity rule (fail = outside spec, "
            "warn = within warning band). Short rolling window (lab_board_lookback_days) and "
            "quality gate matching quality_lab_inspection_result. Current-state snapshot."
        ),
        table_properties={
            "delta.enableChangeDataFeed": "true",
            "delta.autoOptimize.optimizeWrite": "true",
            "delta.autoOptimize.autoCompact": "true",
        },
        cluster_by=["plant_code", "inspection_lot_number"],
    )
    @dlt.expect_all_or_drop({
        "inspection_lot_number present": "inspection_lot_number IS NOT NULL",
        "plant_code present": "plant_code IS NOT NULL",
    })
    @dlt.expect_all({
        "operation_id present": "operation_id IS NOT NULL",
        "mic_id present": "mic_id IS NOT NULL",
    })
    def quality_lab_characteristic_spec():
        spark = get_spark()
        lot_keys = _gated_qals_for_lab(spark).select(
            F.col("PRUEFLOS").alias("_lot_prueflos"),
            F.col("MANDANT").alias("_lot_client"),
            F.col("WERK").alias("_lot_plant"),
        )
        qamv = spark.read.table(f"{BRONZE}.inspection_qamv")
        gated = qamv.join(
            lot_keys,
            (qamv["PRUEFLOS"] == F.col("_lot_prueflos"))
            & (qamv["MANDANT"] == F.col("_lot_client")),
            "inner",
        )
        # Warning limit columns (TOLERANZOB_W / TOLERANZUN_W) are OPTIONAL — they may not
        # be replicated in all environments. col_or_null degrades gracefully to NULL when absent,
        # so the table schema is stable and the gold severity rule handles the NULL case.
        # SAP field reference: QAMV-TOLERANZOB_W (upper warning limit) / TOLERANZUN_W (lower).
        # DD03L verification: SELECT TRIM(TABNAME), TRIM(FIELDNAME) FROM
        #   published_dev.central_services.datadictionaryfields_dd03l
        #   WHERE TRIM(TABNAME)='QAMV' AND TRIM(FIELDNAME) IN ('TOLERANZOB_W','TOLERANZUN_W')
        # These fields exist in standard SAP QM schema (SAP note 178162). If absent from the
        # replicated bronze they degrade to NULL via col_or_null — the gold sev rule handles it.
        from silver.helpers import col_or_null
        out = gated.select(
            F.col("MANDANT").alias("client"),
            F.col("PRUEFLOS").alias("inspection_lot_number"),
            F.col("VORGLFNR").alias("operation_id"),
            F.col("MERKNR").alias("mic_id"),
            F.col("SOLLWERT").alias("nominal_target"),
            # Primary spec limits (confirmed present in quality.py _QAMV_REQUIRED).
            F.col("TOLERANZOB").alias("usl_spec"),
            F.col("TOLERANZUN").alias("lsl_spec"),
            # Warning limits (optional — SAP QAMV-TOLERANZOB_W / TOLERANZUN_W).
            # If not replicated, degrade to NULL; gold severity rule uses 5%-of-span fallback.
            col_or_null(gated, "TOLERANZOB_W", "double").alias("usl_warn"),
            col_or_null(gated, "TOLERANZUN_W", "double").alias("lsl_warn"),
            F.col("KURZTEXT").alias("mic_name"),
            F.col("MASSEINHSW").alias("uom"),
            F.col("_lot_plant").alias("plant_code"),
            F.col("AEDATTM").cast("timestamp").alias("_replicated_at"),
        )
        return apply_plant_gate(out, "plant_code", "quality", spark=spark)
