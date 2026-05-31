"""
Quality domain tables.
"""

import dlt
from pyspark.sql import functions as F
from silver.helpers import get_spark, BRONZE, strip_zeros, sap_date, sap_flag

spark = get_spark()

# ── 1. QUALITY INSPECTION LOT ────────────────────────────────────────────────

@dlt.view(name="stg_quality_inspection_lot")
@dlt.expect_all_or_drop({
    "inspection_lot_number present": "inspection_lot_number IS NOT NULL",
    "plant_code present": "plant_code IS NOT NULL"
})
@dlt.expect_all({
    "material_code present": "material_code IS NOT NULL",
    "inspection dates ordered": "inspection_start_date <= inspection_end_date OR inspection_start_date IS NULL OR inspection_end_date IS NULL"
})
def stg_quality_inspection_lot():
    qals = spark.readStream.table(f"{BRONZE}.inspection_qals")
    qmih = spark.read.table(f"{BRONZE}.qualitymessage_qmih").select(
        "PRUEFLOS", "MANDT", "QMNUM", "AUFNR"
    )
    return (
        qals.alias("l")
        .join(qmih.alias("m"), (F.col("l.PRUEFLOS") == F.col("m.PRUEFLOS")) & (F.col("l.MANDT") == F.col("m.MANDT")), "left")
        .select(
            F.col("l.PRUEFLOS").alias("inspection_lot_number"),
            F.col("l.WERKS").alias("plant_code"),
            strip_zeros("l.MATNR").alias("material_code"),
            strip_zeros("l.CHARG").alias("batch_number"),
            strip_zeros("m.AUFNR").alias("order_number"),
            F.col("m.QMNUM").alias("quality_notification_number"),

            F.col("l.LOTORIGIN").alias("inspection_lot_origin_code"),
            F.col("l.MENGE").alias("inspection_lot_quantity"),
            F.col("l.MEINH").alias("inspection_lot_uom"),

            sap_date("l.ENSTDE").alias("inspection_start_date"),
            sap_date("l.EENDDE").alias("inspection_end_date"),

            F.col("l.VCODE").alias("usage_decision_code"),
            F.col("l.VENDAT").alias("usage_decision_date"),
            F.when(F.col("l.VCODE").isin("A", "AA"), "Accepted")
             .when(F.col("l.VCODE").isin("R", "RA"), "Rejected")
             .when(F.col("l.VCODE").isNotNull(),      "Other Decision")
             .otherwise("Pending").alias("usage_decision"),

            sap_flag("l.KZLOESCH").alias("is_deletion_flagged"),

            F.col("l.AEDATTM").alias("_replicated_at"),
            F.col("l.AERUNID").alias("_run_id"),
        )
    )

dlt.apply_changes(
    target="quality_inspection_lot",
    source="stg_quality_inspection_lot",
    keys=["inspection_lot_number"],
    sequence_by=F.col("_replicated_at"),
    stored_as_scd_type=1,
    cluster_by=["plant_code", "inspection_start_date"],
)
