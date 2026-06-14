"""
Lakeflow Spark Declarative Pipeline — Operational Risk Foundation (Spec 16).

Tables:
  gold_risk_reason_taxonomy      — Reference table seeded from resources/config/risk_reason_taxonomy.csv.
                                   One row per reason code with domain, label, responsible function,
                                   and default severity hint.

  gold_operational_risk_item     — Deterministic UNION MV over 5 domain arms (production, warehouse,
                                   quality, logistics, data_trust). Risk ID = SHA-256 of key fields.
                                   No current_date() / current_timestamp() — base severity is derived
                                   from evidence only. Time-relative columns (effective_severity,
                                   time_remaining) are computed in the consumption view at query time.

Canonical risk schema (per arm):
  risk_id, risk_domain, plant_code, process_line, order_number, material_code, batch_number,
  delivery_number, customer_id, planned_event_at, current_status, primary_reason_code,
  secondary_reason_codes, responsible_function, evidence_confidence, base_severity,
  stock_qty_affected, orders_affected, deliveries_affected, customer_impact_flag, food_safety_flag.

Deterministic: no wall-clock expressions in any @dlt.table function here. ADR 012.
"""

import csv
import pathlib

import dlt
from pyspark.sql import functions as F
from pyspark.sql.types import (
    ArrayType,
    BooleanType,
    DoubleType,
    LongType,
    StringType,
    StructField,
    StructType,
    TimestampType,
)

from gold._shared import gold_table_args, table_exists, get_spark_session
from gold.risk_common import REASON_CODES, base_severity_from_evidence, evidence_confidence

# ---------------------------------------------------------------------------
# CSV taxonomy seed
# ---------------------------------------------------------------------------
_CSV = pathlib.Path(__file__).parent.parent / "resources" / "config" / "risk_reason_taxonomy.csv"

_TAXONOMY_SCHEMA = StructType([
    StructField("reason_code", StringType()),
    StructField("domain", StringType()),
    StructField("label", StringType()),
    StructField("default_responsible_function", StringType()),
    StructField("default_severity_hint", StringType()),
])


def _taxonomy_rows() -> list[tuple]:
    with open(_CSV, encoding="utf-8") as fh:
        return [
            (r["reason_code"], r["domain"], r["label"],
             r["default_responsible_function"], r["default_severity_hint"])
            for r in csv.DictReader(fh)
        ]


# ---------------------------------------------------------------------------
# Canonical output schema helper
# ---------------------------------------------------------------------------

def _canonical_schema():
    return StructType([
        StructField("risk_id", StringType()),
        StructField("risk_domain", StringType()),
        StructField("plant_code", StringType()),
        StructField("process_line", StringType()),
        StructField("order_number", StringType()),
        StructField("material_code", StringType()),
        StructField("batch_number", StringType()),
        StructField("delivery_number", StringType()),
        StructField("customer_id", StringType()),
        StructField("planned_event_at", TimestampType()),
        StructField("current_status", StringType()),
        StructField("primary_reason_code", StringType()),
        StructField("secondary_reason_codes", ArrayType(StringType())),
        StructField("responsible_function", StringType()),
        StructField("evidence_confidence", StringType()),
        StructField("base_severity", StringType()),
        StructField("stock_qty_affected", DoubleType()),
        StructField("orders_affected", LongType()),
        StructField("deliveries_affected", LongType()),
        StructField("customer_impact_flag", BooleanType()),
        StructField("food_safety_flag", BooleanType()),
    ])


def _null(spark_type):
    return F.lit(None).cast(spark_type)


# ---------------------------------------------------------------------------
# Reference table
# ---------------------------------------------------------------------------

@dlt.table(
    name="gold_risk_reason_taxonomy",
    comment="Operational risk reason-code taxonomy seeded from resources/config/risk_reason_taxonomy.csv.",
    table_properties={"delta.enableChangeDataFeed": "false"},
    cluster_by=["reason_code"],
)
def gold_risk_reason_taxonomy():
    spark = get_spark_session()
    return spark.createDataFrame(_taxonomy_rows(), _TAXONOMY_SCHEMA)


# ---------------------------------------------------------------------------
# Domain arm helpers
# ---------------------------------------------------------------------------

def _risk_id(*key_cols) -> F.Column:
    """SHA-256 hash of pipe-delimited key fields. Deterministic."""
    return F.sha2(F.concat_ws("|", *key_cols), 256)


def _build_production_arm() -> F.DataFrame:
    """Production arm: MATERIAL_SHORTFALL / ORDER_NOT_STARTED / STAGING_INCOMPLETE.

    Sources: gold_wm_adherence_root_cause + gold_wm_order_shortage_projection.
    """
    taxonomy = dlt.read("gold_risk_reason_taxonomy")

    # -- Adherence root-cause: orders that were late-release or material-short
    arc = dlt.read("gold_wm_adherence_root_cause")

    def _arc_arm(reason_code: str, filter_col: str, severity_hint: str):
        filtered = arc.filter(F.col(filter_col))
        conf = evidence_confidence({
            "order_number_required": F.col("order_number"),
            "plant_code_required": F.col("plant_code"),
        })
        sev = base_severity_from_evidence(F.lit(severity_hint), conf)
        return (
            filtered.select(
                _risk_id(F.lit(reason_code), F.col("plant_code"), F.col("order_number")).alias("risk_id"),
                F.lit("production").alias("risk_domain"),
                F.col("plant_code"),
                F.col("production_line").alias("process_line"),
                F.col("order_number"),
                F.col("material_code"),
                _null(StringType()).alias("batch_number"),
                _null(StringType()).alias("delivery_number"),
                _null(StringType()).alias("customer_id"),
                F.col("scheduled_start_date").cast(TimestampType()).alias("planned_event_at"),
                F.lit("OPEN").alias("current_status"),
                F.lit(reason_code).alias("primary_reason_code"),
                F.array().cast(ArrayType(StringType())).alias("secondary_reason_codes"),
                F.lit(REASON_CODES.get(reason_code, {}).get("default_responsible_function", "Unknown")).alias("responsible_function"),
                conf.alias("evidence_confidence"),
                sev.alias("base_severity"),
                F.col("min_variance_qty").cast(DoubleType()).alias("stock_qty_affected"),
                F.lit(1).cast(LongType()).alias("orders_affected"),
                _null(LongType()).alias("deliveries_affected"),
                F.lit(False).cast(BooleanType()).alias("customer_impact_flag"),
                F.lit(False).cast(BooleanType()).alias("food_safety_flag"),
            )
        )

    arc_late = _arc_arm("ORDER_NOT_STARTED", "is_late_release", "High")
    arc_short = _arc_arm("MATERIAL_SHORTFALL", "has_material_short", "High")

    # -- Shortage projection: open orders with projected shortfall
    shortage = dlt.read("gold_wm_order_shortage_projection")
    short_conf = evidence_confidence({
        "order_number_required": F.col("order_number"),
        "plant_code_required": F.col("plant_code"),
        "projected_balance_advisory": F.col("is_projected_short"),
    })
    short_sev = base_severity_from_evidence(F.lit("High"), short_conf)
    shortage_arm = (
        shortage.filter(F.col("is_projected_short"))
        .select(
            _risk_id(F.lit("MATERIAL_SHORTFALL"), F.col("plant_code"), F.col("order_number"), F.col("material_code")).alias("risk_id"),
            F.lit("production").alias("risk_domain"),
            F.col("plant_code"),
            F.col("production_line").alias("process_line"),
            F.col("order_number"),
            F.col("material_code"),
            _null(StringType()).alias("batch_number"),
            _null(StringType()).alias("delivery_number"),
            _null(StringType()).alias("customer_id"),
            F.col("scheduled_start_date").cast(TimestampType()).alias("planned_event_at"),
            F.lit("OPEN").alias("current_status"),
            F.lit("MATERIAL_SHORTFALL").alias("primary_reason_code"),
            F.array().cast(ArrayType(StringType())).alias("secondary_reason_codes"),
            F.lit("Warehouse").alias("responsible_function"),
            short_conf.alias("evidence_confidence"),
            short_sev.alias("base_severity"),
            F.col("projected_balance_at_demand").cast(DoubleType()).alias("stock_qty_affected"),
            F.lit(1).cast(LongType()).alias("orders_affected"),
            _null(LongType()).alias("deliveries_affected"),
            F.lit(False).cast(BooleanType()).alias("customer_impact_flag"),
            F.lit(False).cast(BooleanType()).alias("food_safety_flag"),
        )
    )

    return arc_late.unionByName(arc_short).unionByName(shortage_arm)


def _build_warehouse_arm() -> F.DataFrame:
    """Warehouse arm: TR_AGEING / TO_UNCONFIRMED (from gold_wm_order_readiness).

    Orders with no TR coverage or with open TR qty signal warehouse staging risk.
    """
    readiness = dlt.read("gold_wm_order_readiness")

    conf = evidence_confidence({
        "order_number_required": F.col("order_number"),
        "plant_code_required": F.col("plant_code"),
        "tr_exists_advisory": (F.col("tr_count") > F.lit(0)),
    })
    sev = base_severity_from_evidence(F.lit("Medium"), conf)

    return (
        readiness
        .filter(
            (F.col("tr_count").isNull() | (F.col("tr_count") == 0))
            | (F.col("tr_open_qty") > F.lit(0))
        )
        .select(
            _risk_id(F.lit("TR_AGEING"), F.col("plant_code"), F.col("order_number")).alias("risk_id"),
            F.lit("warehouse").alias("risk_domain"),
            F.col("plant_code"),
            F.col("production_line").alias("process_line"),
            F.col("order_number"),
            F.col("material_code"),
            _null(StringType()).alias("batch_number"),
            _null(StringType()).alias("delivery_number"),
            _null(StringType()).alias("customer_id"),
            F.col("scheduled_start_date").cast(TimestampType()).alias("planned_event_at"),
            F.lit("OPEN").alias("current_status"),
            F.when(
                F.col("tr_count").isNull() | (F.col("tr_count") == 0),
                F.lit("TR_AGEING"),
            ).otherwise(F.lit("TO_UNCONFIRMED")).alias("primary_reason_code"),
            F.array().cast(ArrayType(StringType())).alias("secondary_reason_codes"),
            F.lit("Warehouse").alias("responsible_function"),
            conf.alias("evidence_confidence"),
            sev.alias("base_severity"),
            F.col("tr_open_qty").cast(DoubleType()).alias("stock_qty_affected"),
            F.lit(1).cast(LongType()).alias("orders_affected"),
            _null(LongType()).alias("deliveries_affected"),
            F.lit(False).cast(BooleanType()).alias("customer_impact_flag"),
            F.lit(False).cast(BooleanType()).alias("food_safety_flag"),
        )
    )


def _build_quality_arm() -> F.DataFrame:
    """Quality arm: QUALITY_HOLD / INSPECTION_LOT_OPEN / UD_MISSING.

    Source: gold_wm_qm_lot_status.
    """
    lots = dlt.read("gold_wm_qm_lot_status")

    conf = evidence_confidence({
        "lot_number_required": F.col("inspection_lot_number"),
        "plant_code_required": F.col("plant_code"),
        "ud_present_advisory": F.col("has_usage_decision"),
    })
    sev = base_severity_from_evidence(
        F.when(~F.col("has_usage_decision"), F.lit("High")).otherwise(F.lit("Medium")),
        conf,
    )

    return (
        lots
        .filter(~F.coalesce(F.col("has_usage_decision"), F.lit(False)))
        .select(
            _risk_id(F.lit("quality"), F.col("plant_code"), F.col("inspection_lot_number")).alias("risk_id"),
            F.lit("quality").alias("risk_domain"),
            F.col("plant_code"),
            _null(StringType()).alias("process_line"),
            F.col("order_number"),
            F.col("material_code"),
            F.col("batch_number"),
            _null(StringType()).alias("delivery_number"),
            _null(StringType()).alias("customer_id"),
            F.col("lot_created_date").cast(TimestampType()).alias("planned_event_at"),
            F.lit("OPEN").alias("current_status"),
            F.when(
                ~F.coalesce(F.col("has_usage_decision"), F.lit(False)),
                F.lit("UD_MISSING"),
            ).otherwise(F.lit("INSPECTION_LOT_OPEN")).alias("primary_reason_code"),
            F.array().cast(ArrayType(StringType())).alias("secondary_reason_codes"),
            F.lit("Quality").alias("responsible_function"),
            conf.alias("evidence_confidence"),
            sev.alias("base_severity"),
            F.col("inspection_lot_quantity").cast(DoubleType()).alias("stock_qty_affected"),
            F.lit(None).cast(LongType()).alias("orders_affected"),
            _null(LongType()).alias("deliveries_affected"),
            F.lit(False).cast(BooleanType()).alias("customer_impact_flag"),
            F.lit(True).cast(BooleanType()).alias("food_safety_flag"),
        )
    )


def _build_logistics_arm() -> F.DataFrame:
    """Logistics arm: OUTBOUND_PICK_INCOMPLETE / DELIVERY_PAST_GI.

    Source: gold_delivery_pick_status.
    """
    picks = dlt.read("gold_delivery_pick_status")

    conf = evidence_confidence({
        "delivery_number_required": F.col("delivery_number"),
        "plant_code_required": F.col("plant_code"),
        "picking_started_advisory": (F.col("pick_fraction") > F.lit(0.0)),
    })
    sev = base_severity_from_evidence(
        F.when(
            F.col("planned_goods_issue_date").isNotNull(),
            F.lit("High"),
        ).otherwise(F.lit("Medium")),
        conf,
    )

    return (
        picks
        .filter(~F.coalesce(F.col("is_shipped"), F.lit(False)))
        .filter(
            (F.col("pick_fraction") < F.lit(1.0))
            | F.col("pick_fraction").isNull()
        )
        .select(
            _risk_id(F.lit("logistics"), F.col("plant_code"), F.col("delivery_number")).alias("risk_id"),
            F.lit("logistics").alias("risk_domain"),
            F.col("plant_code"),
            _null(StringType()).alias("process_line"),
            _null(StringType()).alias("order_number"),
            _null(StringType()).alias("material_code"),
            _null(StringType()).alias("batch_number"),
            F.col("delivery_number"),
            F.col("ship_to_customer").alias("customer_id"),
            F.col("planned_goods_issue_date").cast(TimestampType()).alias("planned_event_at"),
            F.lit("OPEN").alias("current_status"),
            F.lit("OUTBOUND_PICK_INCOMPLETE").alias("primary_reason_code"),
            F.array().cast(ArrayType(StringType())).alias("secondary_reason_codes"),
            F.lit("Warehouse").alias("responsible_function"),
            conf.alias("evidence_confidence"),
            sev.alias("base_severity"),
            _null(DoubleType()).alias("stock_qty_affected"),
            _null(LongType()).alias("orders_affected"),
            F.lit(1).cast(LongType()).alias("deliveries_affected"),
            F.lit(True).cast(BooleanType()).alias("customer_impact_flag"),
            F.lit(False).cast(BooleanType()).alias("food_safety_flag"),
        )
    )


def _build_data_trust_arm() -> F.DataFrame:
    """Data-trust arm: STALE_SOURCE rows from gold_domain_freshness_watermark.

    Emits one risk item per domain that has exceeded the critical freshness threshold.
    Note: threshold comparison is done against the watermark age stored in the MV
    (critical_minutes from the domain thresholds). Since the watermark stores the
    last_refresh_at timestamp, we cannot do a query-time age comparison here (that
    would require current_timestamp — a determinism violation).  Instead, we emit ALL
    domains as potential risk items; the consumption view filters to status='critical'.
    """
    watermarks = dlt.read("gold_domain_freshness_watermark")

    conf = evidence_confidence({
        "domain_required": F.col("domain"),
    })
    sev = base_severity_from_evidence(F.lit("High"), conf)

    return (
        watermarks
        .select(
            _risk_id(F.lit("data_trust"), F.col("domain"), F.lit("STALE_SOURCE")).alias("risk_id"),
            F.lit("data_trust").alias("risk_domain"),
            _null(StringType()).alias("plant_code"),
            _null(StringType()).alias("process_line"),
            _null(StringType()).alias("order_number"),
            _null(StringType()).alias("material_code"),
            _null(StringType()).alias("batch_number"),
            _null(StringType()).alias("delivery_number"),
            _null(StringType()).alias("customer_id"),
            F.col("last_refresh_at").cast(TimestampType()).alias("planned_event_at"),
            F.lit("OPEN").alias("current_status"),
            F.lit("STALE_SOURCE").alias("primary_reason_code"),
            F.array(F.col("domain")).cast(ArrayType(StringType())).alias("secondary_reason_codes"),
            F.lit("Data Engineering").alias("responsible_function"),
            conf.alias("evidence_confidence"),
            sev.alias("base_severity"),
            _null(DoubleType()).alias("stock_qty_affected"),
            _null(LongType()).alias("orders_affected"),
            _null(LongType()).alias("deliveries_affected"),
            F.lit(False).cast(BooleanType()).alias("customer_impact_flag"),
            F.lit(False).cast(BooleanType()).alias("food_safety_flag"),
        )
    )


# ---------------------------------------------------------------------------
# Gold UNION MV
# ---------------------------------------------------------------------------

@dlt.table(
    **gold_table_args(
        comment=(
            "Operational risk items — deterministic UNION over 5 domain arms "
            "(production, warehouse, quality, logistics, data_trust). "
            "SHA-256 risk_id. No wall-clock; time-relative columns are in the consumption view."
        ),
        cluster_by=["risk_domain", "plant_code"],
    )
)
def gold_operational_risk_item():
    """UNION of all 5 domain arms. Deterministic — no current_date() / current_timestamp()."""
    production = _build_production_arm()
    warehouse = _build_warehouse_arm()
    quality = _build_quality_arm()
    logistics = _build_logistics_arm()
    data_trust = _build_data_trust_arm()

    return (
        production
        .unionByName(warehouse)
        .unionByName(quality)
        .unionByName(logistics)
        .unionByName(data_trust)
    )
