"""
Lakeflow Spark Declarative Pipeline — SPC Gold.

Governed replacement for the legacy connected_plant_uat.gold.spc_quality_metric_subgroup_mv
(73M rows, 138 plants — DECOMMISSIONED, no users, no cutover).

This module produces gold_spc_quality_metric_subgroup: a sample-grain MV over the
io-reporting result-grain silver (quality_inspection_sample_result, quality_inspection_lot,
quality_inspection_characteristic), plus material and plant name enrichment from silver
reference tables.

The SPC adapter (apps/api/adapters/spc/) reads the adapter-facing serving view
`spc_quality_metric_subgroup_mv` defined in resources/sql/spc_serving_views_{env}.sql,
which is a SELECT * pass-through of this MV's *_secured view.

Grain: one row per QASR sample — PRUEFLOS × VORGLFNR × MERKNR × PROBENR
       (= inspection_lot_number × operation_id × mic_id × sample_number).

Deterministic base (no current_date / current_timestamp — CI guard). Date-relative columns
(age, recency bands) would live in a _live view; there are none required by the adapter.

Subgroup key: plant_id × material_id × mic_id × operation_id × batch_id.
All subgroup window aggregates are computed with Window.partitionBy on this key.

The adapter's lsl/usl 0.0 sentinel (both zero → both NULL) is NOT applied here.
The base MV carries the raw spec limits from silver (0.0 when unpopulated in SAP). The
adapter applies the sentinel mapping in Python before returning to the client. This keeps
the MV data faithful to the source and allows a future UI or SQL consumer to apply its own
sentinel logic.

Source tables (all live, plant- and time-gated via silver quality pipeline, spc gate):
  quality_inspection_lot              — QALS: lot context (plant, material, batch, dates)
  quality_inspection_characteristic   — QAMV: spec limits, MIC metadata
  quality_inspection_result           — QAMR: MIC-level valuation (fallback for any_acceptance/rejection)
  quality_inspection_sample_result    — QASR: per-sample result and valuation (primary grain)
  silver.material                     — material name enrichment
  silver.site_config_plant            — plant name enrichment
"""

import dlt
from pyspark.sql import DataFrame, Window
from pyspark.sql import functions as F

from gold._shared import get_silver_schema, get_spark_session, gold_table_args


def _material_lookup(spark, silver_schema: str) -> DataFrame:
    """(plant_code, material_code) -> material_description, deduplicated.

    Copied from wm_operations_gold._material_lookup: groupBy + first(non-null)
    rather than distinct(), so historical description churn doesn't fan out joins."""
    return (
        spark.read.table(f"{silver_schema}.material")
        .groupBy("plant_code", "material_code")
        .agg(F.first("material_description", ignorenulls=True).alias("material_description"))
    )


def _plant_name_lookup(spark, silver_schema: str) -> DataFrame:
    """(plant_code) -> plant_name from site_config_plant."""
    return (
        spark.read.table(f"{silver_schema}.site_config_plant")
        .select("plant_code", "plant_name")
        .distinct()
    )


# ─────────────────────────────────────────────────────────────────────────────
# gold_spc_quality_metric_subgroup
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "SPC subgroup MV — sample-grain rows from the quality result-grain silver "
        "(QASR per-sample means), enriched with lot context (QALS), spec limits / MIC "
        "metadata (QAMV), and material/plant names. Governed replacement for the legacy "
        "connected_plant_uat.gold.spc_quality_metric_subgroup_mv (decommissioned). "
        "Adapter-facing view: spc_quality_metric_subgroup_mv (see spc_serving_views_*.sql). "
        "Grain: one row per QASR sample (lot × operation × mic × sample_number). "
        "Subgroup key: plant_id × material_id × mic_id × operation_id × batch_id."
    ),
    cluster_by=["plant_id", "material_id"],
))
@dlt.expect_all_or_drop({
    "plant_id present":     "plant_id IS NOT NULL",
    "material_id present":  "material_id IS NOT NULL",
    "batch_id present":     "batch_id IS NOT NULL",
    "mic_id present":       "mic_id IS NOT NULL",
    "operation_id present": "operation_id IS NOT NULL",
})
@dlt.expect_all({
    "value is numeric or null": "value IS NULL OR (value = value)",  # IS NOT NaN guard
    "batch_n non-negative":     "batch_n IS NULL OR batch_n >= 0",
})
def gold_spc_quality_metric_subgroup():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    # ── Source reads ────────────────────────────────────────────────────────
    samples = spark.read.table(f"{silver_schema}.quality_inspection_sample_result")
    lots = spark.read.table(f"{silver_schema}.quality_inspection_lot")
    chars = spark.read.table(f"{silver_schema}.quality_inspection_characteristic")
    # QAMR (MIC-level result) for valuation: QASR.inspection_result_valuation is the
    # primary source. QAMR is joined as a fallback enrichment for any_acceptance /
    # any_rejection, consistent with the legacy MV's logic. If QASR valuation is sparse
    # the QAMR valuation supplements; when QASR valuation is present (UAT: 'A'/'R'/blank
    # confirmed on QASR.MBEWERTG — quality.py §8 note) QAMR's row adds nothing extra.
    results = spark.read.table(f"{silver_schema}.quality_inspection_result")

    material = _material_lookup(spark, silver_schema)
    plant_names = _plant_name_lookup(spark, silver_schema)

    # ── Join lot context onto sample results ────────────────────────────────
    # lot keys: inspection_lot_number, plant_code, material_code (strip_zeros applied in silver),
    # batch_number, lot_created_date. Inner join: samples without a lot are out-of-gate and excluded.
    lot_context = lots.select(
        "inspection_lot_number",
        F.col("plant_code").alias("lot_plant_code"),
        F.col("material_code").alias("lot_material_code"),
        F.col("batch_number").alias("lot_batch_number"),
        F.col("lot_created_date").alias("lot_created_date"),
    )

    samples_with_lot = samples.join(
        lot_context,
        samples["inspection_lot_number"] == lot_context["inspection_lot_number"],
        "inner",
    ).select(
        # Sample identity
        samples["inspection_lot_number"],
        samples["operation_id"],
        samples["mic_id"],
        samples["sample_number"],
        # Value: QASR.MITTELWERT = per-sample mean (aggregate over sample's individual readings)
        samples["quantitative_result"].cast("double").alias("value"),
        # QASR valuation — primary source for any_acceptance/any_rejection per sample
        samples["inspection_result_valuation"].alias("sample_valuation"),
        # Lot-derived identifiers
        F.col("lot_plant_code").alias("plant_id"),
        F.col("lot_material_code").alias("material_id"),
        F.col("lot_batch_number").alias("batch_id"),
        F.col("lot_created_date").alias("lot_created_date"),
    )

    # ── Join spec limits and MIC metadata (QAMV → quality_inspection_characteristic) ─
    # Key: inspection_lot_number × operation_id × mic_id (PRUEFLOS+VORGLFNR+MERKNR in SAP).
    char_context = chars.select(
        "inspection_lot_number",
        "operation_id",
        "mic_id",
        "mic_name",
        "inspection_method",
        F.col("nominal_target").cast("double").alias("nominal_target_raw"),
        F.col("usl_spec").cast("double").alias("usl_spec_raw"),
        F.col("lsl_spec").cast("double").alias("lsl_spec_raw"),
        "mic_code",
        "mic_version",
        "decimal_places",
    )

    samples_enriched = samples_with_lot.join(
        char_context,
        ["inspection_lot_number", "operation_id", "mic_id"],
        "left",
    )

    # ── Join QAMR valuation for any_acceptance/any_rejection fallback ───────
    # QAMR grain: lot × operation × mic (one row per characteristic, no sample dimension).
    # QASR valuation (UAT confirmed: 'A'/'R'/blank/small 'F') is the primary source.
    # QAMR is coalesced in as a fallback when QASR valuation is blank/null — reproduces
    # the legacy MV's any_acceptance/any_rejection semantics without a data query.
    result_valuation = results.select(
        "inspection_lot_number",
        "operation_id",
        "mic_id",
        results["inspection_result_valuation"].alias("mic_valuation"),
    )

    samples_final = samples_enriched.join(
        result_valuation,
        ["inspection_lot_number", "operation_id", "mic_id"],
        "left",
    )

    # ── Derived spec columns ─────────────────────────────────────────────────
    # NOTE: the 0.0/0.0 sentinel (both zero = not populated) is NOT applied here.
    # The adapter (spc_databricks_adapter.py, spc_databricks_chart_adapter.py) maps
    # both-zero to null in Python before returning to the client. The base MV carries
    # the raw silver values (faithful to source) so SQL consumers can apply their own rule.
    usl = F.col("usl_spec_raw")
    lsl = F.col("lsl_spec_raw")

    # raw_tolerance = usl − lsl (null when either limit is null)
    raw_tolerance = (usl - lsl).alias("raw_tolerance")

    # tolerance_half_width = (usl − lsl) / 2 (null when either limit is null)
    tolerance_half_width = ((usl - lsl) / F.lit(2.0)).alias("tolerance_half_width")

    # spec_type: classification of the spec limit configuration per row
    spec_type = (
        F.when(usl.isNotNull() & lsl.isNotNull(), F.lit("TWO_SIDED"))
        .when(usl.isNotNull() & lsl.isNull(), F.lit("UPPER_ONLY"))
        .when(usl.isNull() & lsl.isNotNull(), F.lit("LOWER_ONLY"))
        .otherwise(F.lit("NONE"))
    ).alias("spec_type")

    # spec_signature: pipe-delimited fingerprint of the spec shape (for change detection
    # and cache-busting on the client). Format: "<lsl_spec>|<usl_spec>|<nominal_target>".
    spec_signature = F.concat_ws(
        "|",
        F.coalesce(F.col("lsl_spec_raw").cast("string"), F.lit("")),
        F.coalesce(F.col("usl_spec_raw").cast("string"), F.lit("")),
        F.coalesce(F.col("nominal_target_raw").cast("string"), F.lit("")),
    ).alias("spec_signature")

    # unified_mic_key: governed reconstruction from mic_code (QAMV.VERWMERKM) with
    # mic_name fallback. UPPER(TRIM(COALESCE(mic_code, mic_name))). Used by the chart
    # adapter for cross-plant MIC alignment (normality_type/method/signature reference it).
    # NOTE: SPCKRIT (QAMV.SPCKRIT) is 100% blank in Kerry's config (UAT 2026-06-11) and
    # is deliberately excluded from unified_mic_key — nothing in the pipeline may filter on it.
    unified_mic_key = F.upper(
        F.trim(F.coalesce(F.col("mic_code"), F.col("mic_name")))
    ).alias("unified_mic_key")

    # ── Effective valuation: QASR primary, QAMR fallback ─────────────────────
    # Uses the sample's own MBEWERTG if present; falls back to the MIC-level QAMR valuation
    # when QASR valuation is blank or null. This mirrors the legacy MV's any_acceptance /
    # any_rejection semantics and is equivalent to a COALESCE on the non-blank value.
    effective_valuation = F.coalesce(
        F.when(F.trim(F.col("sample_valuation")) != "", F.col("sample_valuation")),
        F.col("mic_valuation"),
    ).alias("effective_valuation")

    base = samples_final.select(
        # ── Identity columns ─────────────────────────────────────────────────
        "plant_id",
        "material_id",
        "batch_id",
        "mic_id",
        "operation_id",
        "inspection_lot_number",
        "sample_number",
        # ── Value (QASR per-sample mean) ──────────────────────────────────────
        "value",
        # ── Lot date (used for subgroup date derivation) ──────────────────────
        "lot_created_date",
        # ── Spec-limit raw values ─────────────────────────────────────────────
        F.col("lsl_spec_raw").alias("lsl_spec"),
        F.col("usl_spec_raw").alias("usl_spec"),
        F.col("nominal_target_raw").alias("nominal_target"),
        raw_tolerance,
        tolerance_half_width,
        spec_type,
        spec_signature,
        # ── MIC metadata ─────────────────────────────────────────────────────
        "mic_name",
        "inspection_method",
        unified_mic_key,
        # ── Normality columns: not available in SAP result-grain silver; emitted as
        # typed NULLs to maintain backward-compatible schema with the legacy MV.
        # The SPC adapter reads these from the first subgroup row for the specLimits
        # contract object (map_spc_chart_response); NULLs are handled gracefully.
        F.lit(None).cast("string").alias("normality_type"),
        F.lit(None).cast("string").alias("normality_method"),
        F.lit(None).cast("string").alias("normality_signature"),
        # ── Effective valuation for subgroup aggregation ──────────────────────
        effective_valuation,
    )

    # ── Subgroup window aggregates ──────────────────────────────────────────
    # Subgroup key: plant_id × material_id × mic_id × operation_id × batch_id.
    # All measures are computed as deterministic window functions over this key.
    sg_win = Window.partitionBy("plant_id", "material_id", "mic_id", "operation_id", "batch_id")

    # batch_date: the earliest lot_created_date across all lots contributing to the
    # subgroup. Approximation: lot_created_date is the date the inspection lot was opened
    # (QALS.ENSTEHDAT), not the result recording date (QAMR.PRUEFDATUV — not on QASR).
    # This is the best available date at the QASR grain without a QAMR join per sample.
    # The comment and column name match the legacy MV's semantics exactly.
    batch_date_col = F.min("lot_created_date").over(sg_win).alias("batch_date")

    # batch_week / batch_month: calendar truncations of batch_date.
    # date_trunc returns a TIMESTAMP in Spark; cast to DATE for a clean type.
    batch_week_col = F.to_date(
        F.date_trunc("week", F.min("lot_created_date").over(sg_win))
    ).alias("batch_week")
    batch_month_col = F.to_date(
        F.date_trunc("month", F.min("lot_created_date").over(sg_win))
    ).alias("batch_month")

    # batch_range: the date range (in days) spanned by the subgroup's lots.
    # Approximation: uses lot_created_date min/max. Matches legacy MV convention.
    batch_range_col = (
        F.datediff(
            F.max("lot_created_date").over(sg_win),
            F.min("lot_created_date").over(sg_win),
        )
    ).alias("batch_range")

    # first_posting_date / last_posting_date: approximated as min/max of lot_created_date
    # within the subgroup. QASR carries no result-recording date (PRUEFDATUV is on QAMR),
    # and joining QAMR per sample would duplicate rows. This approximation matches the best
    # available date at this grain. The adapter uses these as display-only date labels.
    first_posting_date_col = F.min("lot_created_date").over(sg_win).alias("first_posting_date")
    last_posting_date_col = F.max("lot_created_date").over(sg_win).alias("last_posting_date")

    # batch_n: count of non-null value rows within the subgroup.
    batch_n_col = F.count(F.col("value")).over(sg_win).cast("long").alias("batch_n")

    # sum_value: sum of per-sample means within the subgroup.
    sum_value_col = F.sum("value").over(sg_win).alias("sum_value")

    # sum_squares: sum of value*value within the subgroup (for std-dev calculation).
    sum_squares_col = F.sum(F.col("value") * F.col("value")).over(sg_win).alias("sum_squares")

    # min_value / max_value: extremes within the subgroup.
    min_value_col = F.min("value").over(sg_win).alias("min_value")
    max_value_col = F.max("value").over(sg_win).alias("max_value")

    # any_acceptance / any_rejection: 1 if any sample in the subgroup has valuation A/R.
    # Uses QASR.inspection_result_valuation (effective_valuation after QAMR fallback).
    any_acceptance_col = F.max(
        F.when(F.col("effective_valuation") == "A", F.lit(1)).otherwise(F.lit(0))
    ).over(sg_win).cast("boolean").alias("any_acceptance")
    any_rejection_col = F.max(
        F.when(F.col("effective_valuation") == "R", F.lit(1)).otherwise(F.lit(0))
    ).over(sg_win).cast("boolean").alias("any_rejection")

    # subgroup_rep: flag for the first row in the subgroup, ordered by sample_number.
    # The adapter's chart-data query reads per-subgroup spec columns from the first row
    # (subgroup_rows[0]); this flag is carried in the MV but not filtered on by the adapter —
    # the adapter's GROUP BY reduces the per-subgroup rows to a single aggregated result.
    sg_win_ordered = Window.partitionBy(
        "plant_id", "material_id", "mic_id", "operation_id", "batch_id"
    ).orderBy("sample_number")
    subgroup_rep_col = (F.row_number().over(sg_win_ordered) == 1).alias("subgroup_rep")

    enriched = base.select(
        "plant_id",
        "material_id",
        "batch_id",
        "mic_id",
        "operation_id",
        "inspection_lot_number",
        "sample_number",
        "value",
        # Subgroup window aggregates
        batch_date_col,
        batch_week_col,
        batch_month_col,
        batch_range_col,
        first_posting_date_col,
        last_posting_date_col,
        batch_n_col,
        sum_value_col,
        sum_squares_col,
        min_value_col,
        max_value_col,
        any_acceptance_col,
        any_rejection_col,
        subgroup_rep_col,
        # Spec limits and derived columns (per row, from char join)
        "lsl_spec",
        "usl_spec",
        "nominal_target",
        "raw_tolerance",
        "tolerance_half_width",
        "spec_type",
        "spec_signature",
        # MIC metadata
        "mic_name",
        "inspection_method",
        "unified_mic_key",
        # Normality (typed NULLs — not in SAP result-grain silver)
        "normality_type",
        "normality_method",
        "normality_signature",
    )

    # ── Material name enrichment ────────────────────────────────────────────
    # Left join: material silver keyed by (plant_code, material_code).
    material_enriched = enriched.join(
        F.broadcast(material),
        (enriched["plant_id"] == material["plant_code"])
        & (enriched["material_id"] == material["material_code"]),
        "left",
    ).select(
        enriched["*"],
        material["material_description"].alias("material_name"),
    )

    # ── Plant name enrichment ────────────────────────────────────────────────
    # Left join: site_config_plant keyed by plant_code.
    result = material_enriched.join(
        F.broadcast(plant_names),
        material_enriched["plant_id"] == plant_names["plant_code"],
        "left",
    ).select(
        material_enriched["*"],
        plant_names["plant_name"],
    )

    return result
