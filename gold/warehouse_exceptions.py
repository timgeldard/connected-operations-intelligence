"""
Lakeflow Spark Declarative Pipeline — Warehouse Exceptions Gold.

gold_warehouse_exceptions: a uniform-schema UNION of warehouse data-integrity and
aging exceptions, each tagged with a severity (1-4) and an SLA in hours. Mirrors
the prototype imwm_exceptions view, sourced from conformed silver tables.
"""

import dlt
from pyspark.sql import functions as F

from gold._shared import get_silver_schema, get_spark_session, gold_table_args

# Uniform output columns shared by every exception branch (order matters for unionByName).
_COLS = [
    "exception_type", "severity", "sla_hours", "plant_code", "warehouse_number",
    "material_code", "batch_number", "reference_id", "quantity", "age_days", "detail",
]


def _branch(df, exception_type, severity, sla_hours, *, warehouse_number=None,
            material_code=None, batch_number=None, reference_id=None,
            quantity=None, age_days=None, detail=None):
    """Project an arbitrary source df onto the uniform exception schema."""
    def col(value, cast):
        if value is None:
            return F.lit(None).cast(cast)
        return value.cast(cast) if hasattr(value, "cast") else F.lit(value).cast(cast)

    return df.select(
        F.lit(exception_type).alias("exception_type"),
        F.lit(severity).cast("int").alias("severity"),
        F.lit(sla_hours).cast("int").alias("sla_hours"),
        F.col("plant_code").cast("string").alias("plant_code"),
        col(warehouse_number, "string").alias("warehouse_number"),
        col(material_code, "string").alias("material_code"),
        col(batch_number, "string").alias("batch_number"),
        col(reference_id, "string").alias("reference_id"),
        col(quantity, "double").alias("quantity"),
        col(age_days, "int").alias("age_days"),
        col(detail, "string").alias("detail"),
    )


@dlt.table(**gold_table_args(
    comment="Warehouse data-integrity and aging exceptions with severity (1-4) and SLA hours.",
    cluster_by=["plant_code", "exception_type"],
))
@dlt.expect("severity in range", "severity BETWEEN 1 AND 4")
def gold_warehouse_exceptions():
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)
    mard = spark.read.table(f"{silver_schema}.stock_at_location")
    storage_bin = spark.read.table(f"{silver_schema}.storage_bin")
    transfer_orders = spark.read.table(f"{silver_schema}.warehouse_transfer_order")

    occupied = storage_bin.filter(F.col("quant_number").isNotNull())
    gr_age_days = F.datediff(F.current_date(), F.col("goods_receipt_date"))
    expiry_age_days = F.datediff(F.current_date(), F.col("expiry_date"))

    # 1. Negative IM book stock (MARD unrestricted < 0)
    neg_im = _branch(
        mard.filter(F.coalesce(F.col("unrestricted_quantity"), F.lit(0.0)) < 0),
        "NEGATIVE_IM_STOCK", 4, 2,
        material_code=F.col("material_code"),
        reference_id=F.col("storage_location_code"),
        quantity=F.col("unrestricted_quantity"),
        detail=F.lit("IM unrestricted stock is negative"),
    )

    # 2. Negative WM quant (LQUA total < 0)
    neg_wm = _branch(
        occupied.filter(F.coalesce(F.col("total_quantity"), F.lit(0.0)) < 0),
        "NEGATIVE_WM_QUANT", 4, 2,
        warehouse_number=F.col("warehouse_number"),
        material_code=F.col("material_code"),
        batch_number=F.col("batch_number"),
        reference_id=F.col("quant_number"),
        quantity=F.col("total_quantity"),
        detail=F.lit("WM quant quantity is negative"),
    )

    # 3. Expired batch still holding stock
    expired = _branch(
        occupied.filter(
            F.col("expiry_date").isNotNull()
            & (F.col("expiry_date") < F.current_date())
            & (F.coalesce(F.col("total_quantity"), F.lit(0.0)) > 0)
        ),
        "EXPIRED_BATCH_WITH_STOCK", 3, 8,
        warehouse_number=F.col("warehouse_number"),
        material_code=F.col("material_code"),
        batch_number=F.col("batch_number"),
        reference_id=F.col("quant_number"),
        quantity=F.col("total_quantity"),
        age_days=expiry_age_days,
        detail=F.lit("Stock held on an expired batch"),
    )

    # 4. Quality-inspection stock aged > 14 days
    qi_aged = _branch(
        occupied.filter(
            (F.col("stock_category_code") == "Q")
            & (F.coalesce(F.col("total_quantity"), F.lit(0.0)) > 0)
            & (gr_age_days > 14)
        ),
        "QI_STOCK_AGED_14D", 2, 0,
        warehouse_number=F.col("warehouse_number"),
        material_code=F.col("material_code"),
        batch_number=F.col("batch_number"),
        reference_id=F.col("quant_number"),
        quantity=F.col("total_quantity"),
        age_days=gr_age_days,
        detail=F.lit("Quality-inspection stock aged beyond 14 days"),
    )

    # 5. Blocked stock aged > 3 days
    blocked_aged = _branch(
        occupied.filter(
            (F.col("stock_category_code") == "S")
            & (F.coalesce(F.col("total_quantity"), F.lit(0.0)) > 0)
            & (gr_age_days > 3)
        ),
        "BLOCKED_STOCK_AGED_3D", 1, 0,
        warehouse_number=F.col("warehouse_number"),
        material_code=F.col("material_code"),
        batch_number=F.col("batch_number"),
        reference_id=F.col("quant_number"),
        quantity=F.col("total_quantity"),
        age_days=gr_age_days,
        detail=F.lit("Blocked stock aged beyond 3 days"),
    )

    # 6. Open transfer order aged > 24 hours
    to_age_hours = (
        F.unix_timestamp(F.current_timestamp()) - F.unix_timestamp(F.col("created_datetime"))
    ) / 3600.0
    open_to = _branch(
        transfer_orders.filter(
            (F.col("item_status") != "Fully Confirmed")
            & F.col("created_datetime").isNotNull()
            & (to_age_hours > 24)
        ),
        "OPEN_TO_AGED_24H", 2, 0,
        warehouse_number=F.col("warehouse_number"),
        material_code=F.col("material_code"),
        batch_number=F.col("batch_number"),
        reference_id=F.col("transfer_order_number"),
        quantity=F.col("requested_quantity"),
        age_days=F.datediff(F.current_date(), F.to_date(F.col("created_datetime"))),
        detail=F.lit("Transfer order open beyond 24 hours"),
    )

    # 7. IM vs WM true variance (per plant + material)
    im_agg = mard.groupBy("plant_code", "material_code").agg(
        F.coalesce(
            F.sum(
                F.coalesce(F.col("unrestricted_quantity"), F.lit(0.0))
                + F.coalesce(F.col("quality_inspection_quantity"), F.lit(0.0))
                + F.coalesce(F.col("blocked_quantity"), F.lit(0.0))
                + F.coalesce(F.col("restricted_use_quantity"), F.lit(0.0))
                + F.coalesce(F.col("in_transfer_quantity"), F.lit(0.0))
            ),
            F.lit(0.0),
        ).alias("im_total_qty"),
    )
    wm_agg = occupied.groupBy("plant_code", "material_code").agg(
        F.coalesce(F.sum("total_quantity"), F.lit(0.0)).alias("wm_total_qty")
    )
    variance = (
        im_agg.join(wm_agg, ["plant_code", "material_code"], "full")
        .withColumn("im_total_qty", F.coalesce(F.col("im_total_qty"), F.lit(0.0)))
        .withColumn("wm_total_qty", F.coalesce(F.col("wm_total_qty"), F.lit(0.0)))
        .withColumn("delta_qty", F.col("im_total_qty") - F.col("wm_total_qty"))
        .filter(
            (F.abs(F.col("delta_qty")) > F.lit(0.001))
            & (F.abs(F.col("delta_qty")) > F.abs(F.col("im_total_qty")) * 0.01)
        )
    )
    var_exc = _branch(
        variance,
        "IM_WM_TRUE_VARIANCE", 3, 24,
        material_code=F.col("material_code"),
        quantity=F.col("delta_qty"),
        detail=F.lit("IM vs WM stock variance exceeds tolerance"),
    )

    branches = [neg_im, neg_wm, expired, qi_aged, blocked_aged, open_to, var_exc]
    result = branches[0]
    for branch in branches[1:]:
        result = result.unionByName(branch)
    return result.withColumn("detected_date", F.current_date())
