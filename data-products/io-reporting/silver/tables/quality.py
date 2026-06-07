"""
Quality domain tables.
"""

import dlt
from pyspark.sql import functions as F

from silver.helpers import BRONZE, bronze_columns_exist, get_spark, sap_date, sap_flag, strip_zeros

# ── 1. QUALITY INSPECTION LOT ────────────────────────────────────────────────

# Source-guard (QM). quality_inspection_lot does NOT materialise: the replicated inspection_qals lacks
# the AERUNID/AERECNO CDC sequencing metadata required for deterministic SCD1 (only AEDATTM is present),
# AND its field contract mismatches this transform — plant is WERK not WERKS, client is MANDANT (fixed in
# #27), several fields are renamed (LOTORIGIN/MENGE/MEINH) or live on a different table (VCODE/VENDAT are
# usage-decision/QAVE, not QALS). So the flow is gated off until a QM field-contract + CDC reconciliation
# lands (see source-contracts/sap/sap_unresolved_sources.yml + validation/quality_qm_field_contract_check.sql).
# NOT a Warehouse360 feeder; no gold module reads quality_inspection_lot. This unblocks silver_quality
# (it COMPLETES with the flow not materialised, instead of failing analysis). Self-heals when CDC + the
# field contract are reconciled; the plant gate (apply_plant_gate on plant_code) is to be added THEN, not
# now — fixing fields piecemeal while the contract is broken gives no runtime benefit.
if bronze_columns_exist("inspection_qals", ["AERUNID", "AERECNO"]):
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
        spark = get_spark()
        # Replicated QM inspection client field is MANDANT on inspection_qals — NOT MANDT. This is a
        # replicated-source naming convention for QM inspection objects, NOT a global SAP rule:
        # qualitymessage_qmih still uses MANDT. Verified live (DEV information_schema, 2026-06-07). Both
        # change-streams are standardised to `client` so the union and key logic stay name-agnostic.
        qals_changes = spark.readStream.table(f"{BRONZE}.inspection_qals").select(
            "PRUEFLOS", F.col("MANDANT").alias("client"), "AEDATTM", "AERUNID", "AERECNO"
        )
        qmih_changes = spark.readStream.table(f"{BRONZE}.qualitymessage_qmih").select(
            "PRUEFLOS", F.col("MANDT").alias("client"), "AEDATTM", "AERUNID", "AERECNO"
        )

        changed_keys = qals_changes.unionByName(qmih_changes)
        qals = spark.read.table(f"{BRONZE}.inspection_qals")
        qmih = spark.read.table(f"{BRONZE}.qualitymessage_qmih").select(
            "PRUEFLOS", "MANDT", "QMNUM", "AUFNR"
        )
        lots_to_refresh = (
            changed_keys.alias("c")
            # qals client field is MANDANT; join the standardised changed-keys client to it.
            .join(
                qals.alias("l"),
                (F.col("c.PRUEFLOS") == F.col("l.PRUEFLOS")) & (F.col("c.client") == F.col("l.MANDANT")),
                "left",
            )
            .select(
                "l.*",
                F.col("c.AEDATTM").alias("_change_replicated_at"),
                F.col("c.AERUNID").alias("_change_run_id"),
                F.col("c.AERECNO").alias("_change_record_seq"),
            )
        )
        return (
            lots_to_refresh.alias("l")
            # Cross-naming client join: qals.MANDANT = qmih.MANDT (inspection uses MANDANT, QM message uses MANDT).
            .join(qmih.alias("m"), (F.col("l.PRUEFLOS") == F.col("m.PRUEFLOS")) & (F.col("l.MANDANT") == F.col("m.MANDT")), "left")
            .select(
                F.col("l.MANDANT").alias("client"),
                F.col("l.PRUEFLOS").alias("inspection_lot_number"),
                F.col("l.WERKS").alias("plant_code"),
                strip_zeros("l.MATNR").alias("material_code"),
                F.col("l.MATNR").alias("material_code_raw"),
                # CHARG is an exact SAP identifier — preserve as replicated (no strip/trim/normalise).
                F.col("l.CHARG").alias("batch_number"),
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
        table_properties={
            "delta.enableChangeDataFeed": "true",
            "delta.autoOptimize.optimizeWrite": "true",
            "delta.autoOptimize.autoCompact": "true",
        },
        cluster_by=["plant_code", "inspection_start_date"],
    )

    dlt.apply_changes(
        target="quality_inspection_lot",
        source="stg_quality_inspection_lot",
        keys=["inspection_lot_number"],
        sequence_by=F.struct("_replicated_at", "_run_id", "_record_seq"),
        stored_as_scd_type=1,
    )
