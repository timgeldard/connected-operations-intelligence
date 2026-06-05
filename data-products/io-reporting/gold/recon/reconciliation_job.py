"""
SAP -> Silver -> Gold reconciliation control job.

Closes the "no tie-out to SAP source totals" control gap: nothing in the platform
proved that what landed in Silver/Gold actually reconciles to the SAP source, so
silent loss / duplication would go undetected.

This is a STANDALONE job (not a DLT table) because the bronze SAP source config
(`source_catalog` / `source_schema`) lives in the Silver pipelines, not the Gold
pipeline — a Gold DLT table cannot reach back to bronze. It is deliberately placed
under gold/recon/ so the Gold pipeline glob (`../gold/*.py`, top-level only) does
not pick it up. Run as a triggered Databricks job (see resources/reconciliation.job.yml).

Two controls are produced and persisted (so variances stay queryable / alertable):

  gold_reconciliation_control — bronze (SAP) vs silver tie-out, per entity.
      Reuses silver's EXACT change-data semantics so the counts can tie by construction:
        * latest record per business key by sequence_by = (AEDATTM, AERUNID, AERECNO)
        * a key is "active" when its latest record is not a delete (RecordActivity='D')
        * everything is taken AS-OF the silver watermark (silver's max _replicated_at),
          so bronze rows silver has not yet ingested are excluded.
      bronze_active_keys - dropped_by_dq (silver's key-null expectations) should equal
      silver_row_count. The residual is `unexplained_delta` and must be 0 for `exact`
      entities. Multi-source (header+item) entities are `monitored` only: their grain is
      the item table but deletes/lag arrive on the header side, so an exact tie is not
      guaranteed — we still record the counts to surface drift.

  gold_grain_integrity — gold-table grain / duplication check.
      The real silent-duplication risk in this repo is gold JOIN fan-out (cf. the
      handling-unit gross-weight double-count that was fixed), NOT silver SCD1 keys
      (apply_changes guarantees one row per key). Each gold table is asserted to hold
      one row per its intended grain: duplicate_rows = row_count - distinct_grain_keys
      must be 0.

See docs/adr/011-reconciliation-control.md.
"""

import argparse
import datetime

from pyspark.sql import SparkSession, Window
from pyspark.sql import functions as F
from pyspark.sql.types import (
    DoubleType,
    LongType,
    StringType,
    StructField,
    StructType,
    TimestampType,
)

# ── Aecorsoft CDC metadata columns. MUST match the sequence_by tuple and delete rule
#    used by silver's dlt.apply_changes (see silver/tables/*.py) or counts cannot tie.
_CDC_REPLICATED_AT = "AEDATTM"
_CDC_RUN_ID = "AERUNID"
_CDC_RECORD_SEQ = "AERECNO"
_CDC_DELETE_COL = "RecordActivity"
_CDC_DELETE_VALUE = "D"


# ── Bronze (SAP) -> Silver tie-out registry ───────────────────────────────────
# keys           : SAP business-key columns silver keys the SCD1 target on (MANDT excluded —
#                  silver assumes a single client, matching its apply_changes keys).
# has_delete     : the bronze table itself carries delete records (RecordActivity='D').
# dq_drop        : predicate (over bronze columns) for rows silver drops via
#                  @dlt.expect_all_or_drop key-presence expectations.
# tie_mode       : 'exact'  -> unexplained_delta must be 0 (single bronze source).
#                  'monitored' -> recorded only (multi-source header+item; delete/lag on
#                  the header side means an exact tie is not guaranteed).
ENTITIES = [
    {
        "entity": "reservation_requirement",
        "bronze_table": "reservationrequirement_resb",
        "keys": ["RSNUM", "RSPOS"],
        "tie_mode": "exact",
        "has_delete": True,
        "dq_drop": "RSNUM IS NULL OR RSPOS IS NULL",
        "bronze_measure": "BDMNG",
        "silver_measure": "required_quantity",
        "note": "RESB single streaming source.",
    },
    {
        "entity": "batch_stock",
        "bronze_table": "batchstock_mchb",
        "keys": ["MATNR", "WERKS", "LGORT", "CHARG"],
        "tie_mode": "exact",
        "has_delete": False,
        "dq_drop": "MATNR IS NULL OR WERKS IS NULL",
        "bronze_measure": "CLABS",
        "silver_measure": "unrestricted_quantity",
        "note": "MCHB single streaming source (no delete applied in silver).",
    },
    {
        "entity": "goods_movement",
        "bronze_table": "inventorymovement_mseg",
        "keys": ["MBLNR", "MJAHR", "ZEILE"],
        "tie_mode": "monitored",
        "has_delete": True,
        "dq_drop": "MBLNR IS NULL OR WERKS IS NULL",
        "bronze_measure": "MENGE",
        "silver_measure": "quantity",
        "note": "Multi-source MSEG(item)+MKPF(header); header-side deletes not in MSEG bronze.",
    },
    {
        "entity": "outbound_delivery",
        "bronze_table": "deliveryobjects_lips",
        "keys": ["VBELN", "POSNR"],
        "tie_mode": "monitored",
        "has_delete": False,
        "dq_drop": "VBELN IS NULL OR POSNR IS NULL",
        "bronze_measure": "LFIMG",
        "silver_measure": "delivery_quantity",
        "note": "Multi-source LIKP(header)+LIPS(item); header-only deletes not in LIPS bronze.",
    },
    {
        "entity": "warehouse_transfer_order",
        "bronze_table": "transferorderobjects_ltap",
        "keys": ["LGNUM", "TANUM", "TAPOS"],
        "tie_mode": "monitored",
        "has_delete": False,
        "dq_drop": "LGNUM IS NULL OR TANUM IS NULL",
        "bronze_measure": None,
        "silver_measure": None,
        "note": "Multi-source LTAK(header)+LTAP(item); header-side delete on LTAK.",
    },
    {
        "entity": "warehouse_transfer_requirement",
        "bronze_table": "transferrequirementobjects_ltbp",
        "keys": ["LGNUM", "TBNUM", "TBPOS"],
        "tie_mode": "monitored",
        "has_delete": False,
        "dq_drop": "LGNUM IS NULL OR TBNUM IS NULL",
        "bronze_measure": None,
        "silver_measure": None,
        "note": "Multi-source LTBK(header)+LTBP(item); delete via LTBK OPFLAG.",
    },
]


# ── Gold grain / duplication registry ─────────────────────────────────────────
# Each gold table must hold exactly one row per its intended grain. A row_count above
# the distinct-grain count means a join fanned out — silent duplication.
GOLD_GRAINS = [
    ("gold_stock_reconciliation", ["plant_code", "material_code"]),
    ("gold_dispensary_backlog", ["plant_code", "production_supply_area", "warehouse_number"]),
    ("gold_lineside_stock",
     ["plant_code", "warehouse_number", "storage_type", "material_code", "batch_number", "base_uom"]),
    ("gold_delivery_pick_status", ["delivery_number"]),
    ("gold_process_order_staging", ["order_number"]),
    ("gold_process_order_schedule_adherence", ["order_number"]),
    ("gold_stock_reconciliation_v2",
     ["plant_code", "warehouse_number", "material_code",
     "batch_number", "stock_category", "base_uom"]),
    ("gold_stock_reconciliation_summary_v2",
     ["plant_code", "warehouse_number", "mismatch_reason", "mismatch_severity"]),
    ("gold_shift_output_summary", ["plant_code", "posting_date", "material_code", "base_uom"]),
    ("gold_plant_production_quality_summary", ["plant_code"]),
]


_CONTROL_SCHEMA = StructType([
    StructField("entity", StringType()),
    StructField("bronze_table", StringType()),
    StructField("tie_mode", StringType()),
    StructField("watermark", TimestampType()),
    StructField("bronze_active_keys", LongType()),
    StructField("dropped_by_dq", LongType()),
    StructField("silver_row_count", LongType()),
    StructField("unexplained_delta", LongType()),
    StructField("measure_name", StringType()),
    StructField("bronze_measure_sum", DoubleType()),
    StructField("silver_measure_sum", DoubleType()),
    StructField("measure_delta", DoubleType()),
    StructField("passed", StringType()),
    StructField("note", StringType()),
])

_GRAIN_SCHEMA = StructType([
    StructField("entity", StringType()),
    StructField("grain", StringType()),
    StructField("row_count", LongType()),
    StructField("distinct_grain_keys", LongType()),
    StructField("duplicate_rows", LongType()),
    StructField("passed", StringType()),
])


def _fq(catalog: str, schema: str, table: str) -> str:
    # Local Spark (spark_catalog) requires a single-part namespace.
    prefix = schema if catalog == "spark_catalog" else f"{catalog}.{schema}"
    return f"{prefix}.{table}"


def reconcile_entity(spark: SparkSession, bronze_fq: str, silver_fq: str, cfg: dict) -> dict:
    """Tie one silver entity back to its SAP bronze source. Returns a control row dict."""
    silver_df = spark.read.table(silver_fq)
    silver_count = silver_df.count()
    watermark = silver_df.agg(F.max("_replicated_at").alias("w")).first()["w"]

    bronze = spark.read.table(bronze_fq)
    if watermark is not None:
        # AS-OF the silver watermark: ignore bronze rows silver has not ingested yet.
        bronze = bronze.filter(F.col(_CDC_REPLICATED_AT) <= F.lit(watermark))

    # Latest record per business key, by silver's exact sequence_by tuple.
    order = Window.partitionBy(*cfg["keys"]).orderBy(
        F.col(_CDC_REPLICATED_AT).desc_nulls_last(),
        F.col(_CDC_RUN_ID).desc_nulls_last(),
        F.col(_CDC_RECORD_SEQ).desc_nulls_last(),
    )
    latest = bronze.withColumn("_rn", F.row_number().over(order)).filter(F.col("_rn") == 1).drop("_rn")

    # A key is active unless its latest record is a delete.
    if cfg["has_delete"]:
        latest = latest.filter(
            F.col(_CDC_DELETE_COL).isNull() | (F.col(_CDC_DELETE_COL) != F.lit(_CDC_DELETE_VALUE))
        )

    dq_drop = cfg.get("dq_drop")
    bronze_active = latest.count()
    dropped = latest.filter(F.expr(dq_drop)).count() if dq_drop else 0
    unexplained = (bronze_active - dropped) - silver_count

    measure_name = cfg.get("silver_measure")
    bronze_sum = silver_sum = measure_delta = None
    if cfg.get("bronze_measure"):
        reconcilable = latest.filter(~F.expr(dq_drop)) if dq_drop else latest
        bronze_sum = reconcilable.agg(
            F.sum(F.col(cfg["bronze_measure"]).cast("double")).alias("s")
        ).first()["s"]
        silver_sum = silver_df.agg(
            F.sum(F.col(cfg["silver_measure"]).cast("double")).alias("s")
        ).first()["s"]
        # Coalesce a missing sum (empty/all-null side) to 0.0 so a one-sided null still yields a
        # real delta and cannot bypass the tolerance check below.
        measure_delta = (float(bronze_sum) if bronze_sum is not None else 0.0) - \
                        (float(silver_sum) if silver_sum is not None else 0.0)

    # Pass rule: exact entities must tie on count (and measure, within float tolerance);
    # monitored entities always "pass" the gate (recorded for observability only).
    passed = True
    if cfg["tie_mode"] == "exact":
        passed = unexplained == 0
        if measure_delta is not None:
            passed = passed and abs(measure_delta) <= 0.01

    return {
        "entity": cfg["entity"],
        "bronze_table": cfg["bronze_table"],
        "tie_mode": cfg["tie_mode"],
        "watermark": watermark,
        "bronze_active_keys": int(bronze_active),
        "dropped_by_dq": int(dropped),
        "silver_row_count": int(silver_count),
        "unexplained_delta": int(unexplained),
        "measure_name": measure_name,
        "bronze_measure_sum": float(bronze_sum) if bronze_sum is not None else None,
        "silver_measure_sum": float(silver_sum) if silver_sum is not None else None,
        "measure_delta": measure_delta,
        "passed": "PASS" if passed else "FAIL",
        "note": cfg.get("note"),
    }


def check_gold_grain(spark: SparkSession, gold_fq: str, grain_keys: list) -> dict:
    """Assert a gold table holds one row per its intended grain (catches join fan-out)."""
    df = spark.read.table(gold_fq)
    row_count = df.count()
    distinct = df.select(*grain_keys).distinct().count()
    duplicate_rows = row_count - distinct
    return {
        "entity": gold_fq.split(".")[-1],
        "grain": ",".join(grain_keys),
        "row_count": int(row_count),
        "distinct_grain_keys": int(distinct),
        "duplicate_rows": int(duplicate_rows),
        "passed": "PASS" if duplicate_rows == 0 else "FAIL",
    }


def _write(spark, df, target, run_date):
    """Idempotently persist a control batch for run_date. Uses Delta's atomic replaceWhere
    partition overwrite (single transaction) so a partial failure cannot lose the day's data,
    and a single pre-evaluated run_date avoids the midnight DELETE/write race."""
    stamped = (
        df.withColumn("run_date", F.lit(run_date).cast("date"))
        .withColumn("run_timestamp", F.current_timestamp())
    )
    if spark.catalog.tableExists(target):
        (
            stamped.write.format("delta")
            .mode("overwrite")
            .option("replaceWhere", f"run_date = '{run_date}'")
            .option("mergeSchema", "true")
            .saveAsTable(target)
        )
    else:
        (
            stamped.write.format("delta")
            .mode("append")
            .option("mergeSchema", "true")
            .partitionBy("run_date")
            .saveAsTable(target)
        )


def run(spark, source_catalog, source_schema, silver_catalog, silver_schema,
        gold_catalog, gold_schema, fail_on_variance=True, run_date=None):
    # Evaluate the run date once so every control row in this run lands in the same partition
    # (and to support deterministic backfills via --run_date YYYY-MM-DD).
    if run_date is None:
        run_date_val = datetime.date.today()
    elif isinstance(run_date, str):
        run_date_val = datetime.datetime.strptime(run_date, "%Y-%m-%d").date()
    else:
        run_date_val = run_date

    control_rows = []
    for cfg in ENTITIES:
        bronze_fq = _fq(source_catalog, source_schema, cfg["bronze_table"])
        silver_fq = _fq(silver_catalog, silver_schema, cfg["entity"])
        if not spark.catalog.tableExists(bronze_fq) or not spark.catalog.tableExists(silver_fq):
            print(f"SKIP {cfg['entity']}: bronze or silver table missing.")
            continue
        row = reconcile_entity(spark, bronze_fq, silver_fq, cfg)
        control_rows.append(row)
        print(f"recon {cfg['entity']:32s} {row['tie_mode']:9s} "
              f"bronze_active={row['bronze_active_keys']} dropped_dq={row['dropped_by_dq']} "
              f"silver={row['silver_row_count']} unexplained={row['unexplained_delta']} -> {row['passed']}")

    grain_rows = []
    for table, keys in GOLD_GRAINS:
        gold_fq = _fq(gold_catalog, gold_schema, table)
        if not spark.catalog.tableExists(gold_fq):
            print(f"SKIP grain {table}: gold table missing.")
            continue
        row = check_gold_grain(spark, gold_fq, keys)
        grain_rows.append(row)
        print(f"grain {table:40s} rows={row['row_count']} distinct={row['distinct_grain_keys']} "
              f"dups={row['duplicate_rows']} -> {row['passed']}")

    control_target = _fq(gold_catalog, gold_schema, "gold_reconciliation_control")
    grain_target = _fq(gold_catalog, gold_schema, "gold_grain_integrity")
    if control_rows:
        _write(spark, spark.createDataFrame(control_rows, _CONTROL_SCHEMA),
               control_target, run_date_val)
    if grain_rows:
        _write(spark, spark.createDataFrame(grain_rows, _GRAIN_SCHEMA),
               grain_target, run_date_val)

    failures = [r for r in control_rows if r["passed"] == "FAIL"] + \
               [r for r in grain_rows if r["passed"] == "FAIL"]
    if failures:
        msg = f"Reconciliation found {len(failures)} failing control(s): " + \
              ", ".join(str(r.get("entity", r.get("table"))) for r in failures)
        print(msg)
        try:
            from gold.servicenow import create_servicenow_incident
            details = "\n".join(
                f"- Type: {r.get('entity') or r.get('table')} | "
                f"unexplained_delta={r.get('unexplained_delta', 'N/A')} | "
                f"duplicate_rows={r.get('duplicate_rows', 'N/A')}"
                for r in failures
            )
            create_servicenow_incident(
                summary=f"Connected Plant pipeline control failure: {len(failures)} mismatch(es)",
                details=f"{msg}\n\nFailure Details:\n{details}",
                severity=4
            )
        except Exception as e:
            print(f"Error calling ServiceNow integration: {e}")
        if fail_on_variance:
            raise SystemExit(msg)
    return control_rows, grain_rows


def main() -> None:
    parser = argparse.ArgumentParser(description="SAP->Silver->Gold reconciliation control.")
    parser.add_argument("--source_catalog", required=True)
    parser.add_argument("--source_schema", required=True)
    parser.add_argument("--silver_catalog", required=True)
    parser.add_argument("--silver_schema", required=True)
    parser.add_argument("--gold_catalog", required=True)
    parser.add_argument("--gold_schema", required=True)
    parser.add_argument("--fail_on_variance", default="true")
    parser.add_argument("--run_date", default=None,
                        help="Reconciliation date as YYYY-MM-DD (default: today). Use for backfills.")
    args = parser.parse_args()

    spark = SparkSession.builder.getOrCreate()
    run(
        spark,
        args.source_catalog, args.source_schema,
        args.silver_catalog, args.silver_schema,
        args.gold_catalog, args.gold_schema,
        fail_on_variance=str(args.fail_on_variance).lower() == "true",
        run_date=args.run_date,
    )


if __name__ == "__main__":
    main()
