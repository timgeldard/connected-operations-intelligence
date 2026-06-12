"""
Gold — QM Lab Result Signal (quality_lab_board view, quality-batch-release workspace).

Table: gold_qm_lab_result_signal

One row per failed-or-warning recent inspection result, enriched with material description,
production line (via lot→order→process_order), spec limits, and severity classification.

Sources (silver, quality gate, lab_board_lookback_days window):
  quality_lab_inspection_result     — QAMR grain (plant + lot + op + MIC)
  quality_lab_characteristic_spec   — QAMV spec limits for the same grain
  quality_inspection_lot            — lot-level metadata (lot origin for lotType)
  process_order                     — production_line (left join via order_number, nullable)

Material description:
  Sourced from the silver material master. The governed silver does not yet have a standalone
  material-description table; use process_order.material_code + a left join on lot order
  number. If no match, material_code is surfaced as the fallback description.

SEVERITY RULE:
  V1 FailSpec.sev ('fail' | 'warn') was NEVER fully implemented in the V1 CQ Databricks path
  (cq_databricks_adapter.py line 109 hardcodes sev='fail' with comment "warn not yet
  distinguishable from available views"). The preservation doc defines the intent but not the
  exact rule. This gold table implements the following authoritative rule:

  Given result value R, spec limits [LSL, USL]:
    'fail' : R < LSL  OR  R > USL   (outside spec)
    'warn' : R is within spec AND within the warning band
             Warning band = within 5% of span [(USL-LSL) * 0.05] from either limit,
             i.e.  LSL <= R < LSL + 0.05*(USL-LSL)
                OR USL - 0.05*(USL-LSL) < R <= USL
    (Only results that are outside-spec or in-warning-band are included in this table.)

  If warning limits TOLERANZOB_W / TOLERANZUN_W are present in silver (replicated from SAP
  QAMV), the silver table carries lsl_warn / usl_warn and those are used in place of the
  5%-of-span approximation:
    'warn' : lsl_warn <= R <= usl_warn  AND  LSL <= R <= USL

  DESIGN DEVIATION: V1's severity 'warn' rule was absent from the V1 Databricks path
  (always 'fail'). The 5%-of-span rule is a new approximation for parity with SAP's
  standard warning-limit concept. FLAG: if plant QA teams configure explicit QAMV warning
  limits (TOLERANZOB_W/TOLERANZUN_W), those take precedence automatically once replicated.

  Results with MBEWERTG='A' (accepted, inside spec, outside warning band) are EXCLUDED.
  Results with no spec limits are included with sev='fail' if MBEWERTG IN ('R', non-A/blank).

TABLE-EXISTS GUARD:
  Both silver source tables are QM-enabled-only (quality gate). In dev environments without
  QM data the silver tables may not exist. Uses the table_exists guard pattern from
  dlt_gold_pipeline.py (_read_or_empty / table_exists).
"""

import dlt
from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from gold._shared import get_silver_schema, get_spark_session, gold_table_args, table_exists

_MATERIAL_SCHEMA = (
    "plant_code string, material_code string, material_description string"
)

_QUALITY_LAB_RESULT_SCHEMA = (
    "plant_code string, inspection_lot_number string, operation_id string, mic_id string, "
    "quantitative_result double, inspection_result_valuation string, "
    "result_recording_start_date date, result_recording_end_date date, "
    "lot_order_number string, batch_number string, lot_origin_code string, material_code string, "
    "client string, _replicated_at timestamp"
)

_QUALITY_LAB_SPEC_SCHEMA = (
    "plant_code string, inspection_lot_number string, operation_id string, mic_id string, "
    "nominal_target double, usl_spec double, lsl_spec double, "
    "usl_warn double, lsl_warn double, mic_name string, uom string, "
    "client string, _replicated_at timestamp"
)

_QUALITY_INSPECTION_LOT_SCHEMA = (
    "inspection_lot_number string, plant_code string, inspection_lot_origin_code string, "
    "material_code string, batch_number string, order_number string, client string"
)

_PROCESS_ORDER_SCHEMA = (
    "order_number string, plant_code string, material_code string, production_line string, "
    "production_line_description string"
)


def _read_or_empty(spark, fq_table: str, ddl_schema: str) -> DataFrame:
    """Read table if it exists; else return an empty DataFrame with the given schema.

    Used to guard QM silver tables that may be absent in dev environments without QM data
    (same pattern as dlt_gold_pipeline.py _read_or_empty for PP/PI inputs)."""
    if table_exists(spark, fq_table):
        return spark.read.table(fq_table)
    return spark.createDataFrame([], ddl_schema)


def _material_lookup(spark, silver_schema: str) -> DataFrame:
    """(plant_code, material_code) -> material_description, deduplicated.

    Follows the same pattern as wm_operations_gold._material_lookup and
    spc_gold._material_lookup: groupBy + first(non-null) so historical description
    churn does not fan out joins. Falls back to an empty DataFrame when the silver
    material table is absent (dev environments without reference data)."""
    fq_table = f"{silver_schema}.material"
    if not table_exists(spark, fq_table):
        return spark.createDataFrame([], _MATERIAL_SCHEMA)
    return (
        spark.read.table(fq_table)
        .groupBy("plant_code", "material_code")
        .agg(F.first("material_description", ignorenulls=True).alias("material_description"))
    )


@dlt.table(**gold_table_args(
    comment=(
        "Lab Board result signal: one row per failed-or-warning QM inspection result in "
        "the recent window (lab_board_lookback_days, default 30d). Feeds the Connected "
        "Quality Lab Board wallboard (quality-batch-release workspace, lab-board view). "
        "Severity: 'fail'=outside spec; 'warn'=within warning band (explicit QAMV warning "
        "limits when available; 5%-of-span approximation otherwise). Only non-accepted "
        "results are included. Production line is left-joined via lot order number — nullable."
    ),
    cluster_by=["plant_code", "result_recording_start_date"],
))
@dlt.expect("plant_code present", "plant_code IS NOT NULL")
@dlt.expect("inspection_lot_number present", "inspection_lot_number IS NOT NULL")
@dlt.expect("severity valid", "severity IN ('fail', 'warn')")
def gold_qm_lab_result_signal():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    results = _read_or_empty(
        spark,
        f"{silver_schema}.quality_lab_inspection_result",
        _QUALITY_LAB_RESULT_SCHEMA,
    )
    specs = _read_or_empty(
        spark,
        f"{silver_schema}.quality_lab_characteristic_spec",
        _QUALITY_LAB_SPEC_SCHEMA,
    )
    # quality_inspection_lot: lot_origin_code and other lot fields are already carried in the
    # quality_lab_inspection_result silver table (via _gated_qals_for_lab carry-through).
    # No additional join to the lots table is required for the current output columns.
    process_orders = _read_or_empty(
        spark,
        f"{silver_schema}.process_order",
        _PROCESS_ORDER_SCHEMA,
    ).select("order_number", "production_line", "production_line_description",
             F.col("material_code").alias("po_material_code")).distinct()

    # Material description: left-joined from silver.material on (plant_code, material_code).
    # Follows wm_operations_gold / spc_gold pattern: groupBy+first(non-null) deduplicates
    # historical description churn without fanning out joins.
    # Fallback: COALESCE(material_description, material_code) so the field is never NULL
    # even in dev environments or for materials not yet in the silver master.
    material = _material_lookup(spark, silver_schema)

    # Join spec onto result (left — results without spec still surface as 'fail').
    joined = results.join(
        specs,
        on=["inspection_lot_number", "operation_id", "mic_id", "plant_code"],
        how="left",
    )

    # Join lot metadata for lot_origin_code (lot type 89/04 = QALS.HERKUNFT).
    # Results already carry lot_origin_code from the silver table (carried via _gated_qals_for_lab).
    # Use what's in the result; only join lots table if we need additional lot-level fields.
    # (Currently result carries: lot_origin_code, batch_number, lot_order_number, material_code)

    # Left join process_order for production_line via lot_order_number.
    joined = joined.join(
        process_orders,
        joined["lot_order_number"] == process_orders["order_number"],
        "left",
    )

    # Left join material for description; alias material columns before the join to avoid
    # ambiguity with the result material_code column (same name, different table).
    material_slim = material.select(
        F.col("plant_code").alias("_mat_plant"),
        F.col("material_code").alias("_mat_code"),
        F.col("material_description"),
    )
    joined = joined.join(
        material_slim,
        (F.col("plant_code") == F.col("_mat_plant"))
        & (F.col("material_code") == F.col("_mat_code")),
        "left",
    ).drop("_mat_plant", "_mat_code")

    # ── Severity rule ─────────────────────────────────────────────────────────────────────
    # R = quantitative_result, LSL/USL = spec limits, lsl_warn/usl_warn = optional warn limits.
    r = F.col("quantitative_result")
    lsl = F.col("lsl_spec")
    usl = F.col("usl_spec")
    lsl_warn = F.col("lsl_warn")
    usl_warn = F.col("usl_warn")

    # Span-based 5%-of-span warn band (fallback when explicit warning limits are NULL).
    # Approximates SAP's standard "warn = within 5% of span from either limit" concept.
    span = usl - lsl
    warn_band = span * 0.05
    lsl_warn_fallback = lsl + warn_band
    usl_warn_fallback = usl - warn_band

    # Effective warning limits: use explicit QAMV warn limits when present, else 5%-of-span.
    eff_lsl_warn = F.when(lsl_warn.isNotNull(), lsl_warn).otherwise(lsl_warn_fallback)
    eff_usl_warn = F.when(usl_warn.isNotNull(), usl_warn).otherwise(usl_warn_fallback)

    # Spec limits present?
    has_spec = lsl.isNotNull() & usl.isNotNull()

    # Outside spec = FAIL (regardless of valuation code)
    is_outside_spec = has_spec & ((r < lsl) | (r > usl))

    # Within warning band (only meaningful when within spec)
    # 'warn': within spec AND (R < lsl_warn_eff OR R > usl_warn_eff)
    is_in_warn_band = (
        has_spec
        & r.isNotNull()
        & ~is_outside_spec
        & ((r < eff_lsl_warn) | (r > eff_usl_warn))
    )

    # Non-accepted result without spec limits → fail (valuation-based)
    is_non_accepted_no_spec = (
        ~has_spec
        & (
            (F.trim(F.col("inspection_result_valuation")) != "A")
            | F.col("inspection_result_valuation").isNull()
        )
    )

    severity = (
        F.when(is_outside_spec | is_non_accepted_no_spec, F.lit("fail"))
        .when(is_in_warn_band, F.lit("warn"))
        .otherwise(F.lit(None))
    )

    # Keep only rows with a non-NULL severity (i.e. failed or warned results).
    filtered = joined.withColumn("_severity", severity).filter(
        F.col("_severity").isNotNull()
    )

    return filtered.select(
        F.col("plant_code"),
        # Material code (from lot — strip_zeros applied in silver via _gated_qals_for_lab).
        F.col("material_code"),
        # Material description from silver.material; falls back to material_code when absent.
        # V1 FailSpec.mat = material description (not the code); consumption view maps this
        # column to `mat` and material_code to `mat_no` for the FailSpec contract.
        F.coalesce(F.col("material_description"), F.col("material_code")).alias("material_description"),
        F.col("inspection_lot_number"),
        # Batch from lot-level carry-through (QALS.CHARG).
        F.col("batch_number"),
        # Production line: left-joined via lot_order_number → process_order.
        # NULL when the lot has no linked process order (RM lots, or order not in silver window).
        F.col("production_line"),
        F.col("production_line_description"),
        # Characteristic (MIC) identity.
        F.col("mic_id").alias("characteristic_id"),
        F.coalesce(F.col("mic_name"), F.col("mic_id")).alias("characteristic_text"),
        # Result value.
        F.col("quantitative_result").alias("result_value"),
        # Spec limits (nullable — not all characteristics have numeric spec).
        F.col("lsl_spec").alias("lower_limit"),
        F.col("usl_spec").alias("upper_limit"),
        # Effective warning limits (for transparency — consumers can verify warn classification).
        F.when(F.col("lsl_warn").isNotNull(), F.col("lsl_warn"))
         .when(has_spec, lsl_warn_fallback)
         .otherwise(F.lit(None)).alias("lower_warn_limit"),
        F.when(F.col("usl_warn").isNotNull(), F.col("usl_warn"))
         .when(has_spec, usl_warn_fallback)
         .otherwise(F.lit(None)).alias("upper_warn_limit"),
        F.col("uom").alias("unit"),
        # Severity: 'fail' | 'warn' (see module docstring for the full rule).
        F.col("_severity").alias("severity"),
        # Result timestamp: use result_recording_start_date (the date the inspector entered
        # results — QAMR.PRUEFDATUV). Mapped to ISO date string for the FailSpec.ts field.
        F.col("result_recording_start_date"),
        # Lot type: QALS.HERKUNFT (lot origin code). V1 FailSpec.lotType = '89' (FP) / '04' (RM).
        # SAP HERKUNFT is the lot origin code — '89' = inspection lot from GR (finished product),
        # '04' = goods receipt from purchase order (raw material). Other codes exist.
        F.col("lot_origin_code").alias("lot_type"),
        # QAMR result valuation (raw, for audit transparency).
        F.col("inspection_result_valuation"),
    )
