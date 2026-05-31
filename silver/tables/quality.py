"""
Quality domain tables.
"""

import dlt
from pyspark.sql import functions as F

from silver.helpers import BRONZE, get_spark, sap_date, sap_flag, strip_zeros

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
    qals_changes = spark.readStream.table(f"{BRONZE}.inspection_qals").select(
        "PRUEFLOS", "MANDT", "AEDATTM", "AERUNID", "AERECNO"
    )
    qmih_changes = spark.readStream.table(f"{BRONZE}.qualitymessage_qmih").select(
        "PRUEFLOS", "MANDT", "AEDATTM", "AERUNID", "AERECNO"
    )

    changed_keys = qals_changes.unionByName(qmih_changes)
    qals = spark.read.table(f"{BRONZE}.inspection_qals")
    qmih = spark.read.table(f"{BRONZE}.qualitymessage_qmih").select(
        "PRUEFLOS", "MANDT", "QMNUM", "AUFNR"
    )
    lots_to_refresh = (
        changed_keys.alias("c")
        .join(qals.alias("l"), ["PRUEFLOS", "MANDT"], "left")
        .select(
            "l.*",
            F.col("c.AEDATTM").alias("_change_replicated_at"),
            F.col("c.AERUNID").alias("_change_run_id"),
            F.col("c.AERECNO").alias("_change_record_seq"),
        )
    )
    return (
        lots_to_refresh.alias("l")
        .join(qmih.alias("m"), (F.col("l.PRUEFLOS") == F.col("m.PRUEFLOS")) & (F.col("l.MANDT") == F.col("m.MANDT")), "left")
        .select(
            F.col("l.PRUEFLOS").alias("inspection_lot_number"),
            F.col("l.WERKS").alias("plant_code"),
            strip_zeros("l.MATNR").alias("material_code"),
            F.col("l.MATNR").alias("material_code_raw"),
            strip_zeros("l.CHARG").alias("batch_number"),
            F.col("l.CHARG").alias("batch_number_raw"),
            strip_zeros("m.AUFNR").alias("order_number"),
            F.col("m.AUFNR").alias("order_number_raw"),
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

            F.col("l._change_replicated_at").alias("_replicated_at"),
            F.col("l._change_run_id").alias("_run_id"),
            F.col("l._change_record_seq").alias("_record_seq"),
        )
    )

dlt.create_streaming_table(
    name="quality_inspection_lot",
    table_properties={"delta.enableChangeDataFeed": "true"},
    cluster_by=["plant_code", "inspection_start_date"],
)

dlt.apply_changes(
    target="quality_inspection_lot",
    source="stg_quality_inspection_lot",
    keys=["inspection_lot_number"],
    sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
    stored_as_scd_type=1,
)
