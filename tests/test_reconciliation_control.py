"""
Tests for the SAP->Silver->Gold reconciliation control job
(gold/recon/reconciliation_job.py).

Pattern follows the other gold tests: build fake bronze/silver/gold tables in the
local spark_catalog, call the pure functions directly, assert on the control output.
"""

import pytest
import os
import shutil
from datetime import datetime

from pyspark.sql import Row, SparkSession

from gold.recon.reconciliation_job import check_gold_grain, reconcile_entity
from tests.conftest import create_df

_T1 = datetime(2026, 1, 1)   # older version of key 1
_T2 = datetime(2026, 2, 1)   # latest ingested watermark
_TF = datetime(2026, 12, 1)  # future bronze row silver has NOT ingested yet


@pytest.fixture(scope="module", autouse=True)
def setup_database(spark: SparkSession):
    tables = [
        "recon_resb_bronze", "recon_resb_silver", "recon_loss_bronze", "recon_loss_silver",
        "recon_lips_bronze", "recon_lips_silver", "recon_nullmeas_bronze", "recon_nullmeas_silver",
        "recon_gold_clean", "recon_gold_dup"
    ]
    for t in tables:
        spark.sql(f"DROP TABLE IF EXISTS {t}")
    
    # Physically remove delta directories from spark-warehouse to prevent LOCATION_ALREADY_EXISTS conflicts
    warehouse_dir = os.path.abspath("spark-warehouse")
    if os.path.exists(warehouse_dir):
        for t in tables:
            path = os.path.join(warehouse_dir, t)
            if os.path.exists(path):
                shutil.rmtree(path)
                
    yield
    
    for t in tables:
        spark.sql(f"DROP TABLE IF EXISTS {t}")
        
    if os.path.exists(warehouse_dir):
        for t in tables:
            path = os.path.join(warehouse_dir, t)
            if os.path.exists(path):
                shutil.rmtree(path)


def _save(spark, rows, table):
    create_df(spark, rows).write.mode("overwrite").saveAsTable(table)


# ── Bronze (SAP) -> silver exact tie-out ──────────────────────────────────────

def test_reconcile_entity_exact_ties_with_dq_drop_delete_and_watermark(spark: SparkSession):
    # RESB-shaped bronze with: a superseded version, a delete, a null-key (DQ-dropped)
    # row, and a future row beyond the silver watermark.
    _save(spark, [
        Row(RSNUM="1", RSPOS="1", BDMNG=100.0, AEDATTM=_T1, AERUNID="r1", AERECNO="1", RecordActivity=None),
        Row(RSNUM="1", RSPOS="1", BDMNG=120.0, AEDATTM=_T2, AERUNID="r2", AERECNO="1", RecordActivity=None),
        Row(RSNUM="2", RSPOS="1", BDMNG=50.0,  AEDATTM=_T2, AERUNID="r2", AERECNO="2", RecordActivity=None),
        Row(RSNUM="3", RSPOS="1", BDMNG=10.0,  AEDATTM=_T2, AERUNID="r2", AERECNO="3", RecordActivity="D"),
        Row(RSNUM=None, RSPOS="1", BDMNG=10.0, AEDATTM=_T2, AERUNID="r2", AERECNO="4", RecordActivity=None),
        Row(RSNUM="4", RSPOS="1", BDMNG=999.0, AEDATTM=_TF, AERUNID="r9", AERECNO="1", RecordActivity=None),
    ], "recon_resb_bronze")
    _save(spark, [
        Row(reservation_number="1", reservation_item="1", required_quantity=120.0, _replicated_at=_T2),
        Row(reservation_number="2", reservation_item="1", required_quantity=50.0, _replicated_at=_T2),
    ], "recon_resb_silver")

    cfg = {
        "entity": "reservation_requirement", "bronze_table": "reservationrequirement_resb",
        "keys": ["RSNUM", "RSPOS"], "tie_mode": "exact", "has_delete": True,
        "dq_drop": "RSNUM IS NULL OR RSPOS IS NULL",
        "bronze_measure": "BDMNG", "silver_measure": "required_quantity",
    }
    r = reconcile_entity(spark, "recon_resb_bronze", "recon_resb_silver", cfg)

    assert r["watermark"] == _T2
    assert r["bronze_active_keys"] == 3        # keys 1, 2, null (key 3 deleted, key 4 future-excluded)
    assert r["dropped_by_dq"] == 1             # the null-key row
    assert r["silver_row_count"] == 2
    assert r["unexplained_delta"] == 0
    assert r["bronze_measure_sum"] == 170.0    # 120 + 50 (dropped/deleted/future excluded)
    assert r["silver_measure_sum"] == 170.0
    assert r["passed"] == "PASS"


def test_reconcile_entity_exact_detects_unexplained_loss(spark: SparkSession):
    # Two active bronze keys, but silver only has one -> unexplained loss -> FAIL.
    _save(spark, [
        Row(RSNUM="1", RSPOS="1", BDMNG=100.0, AEDATTM=_T2, AERUNID="r1", AERECNO="1", RecordActivity=None),
        Row(RSNUM="2", RSPOS="1", BDMNG=50.0,  AEDATTM=_T2, AERUNID="r1", AERECNO="2", RecordActivity=None),
    ], "recon_loss_bronze")
    _save(spark, [
        Row(reservation_number="1", reservation_item="1", required_quantity=100.0, _replicated_at=_T2),
    ], "recon_loss_silver")

    cfg = {
        "entity": "reservation_requirement", "bronze_table": "x",
        "keys": ["RSNUM", "RSPOS"], "tie_mode": "exact", "has_delete": True,
        "dq_drop": "RSNUM IS NULL OR RSPOS IS NULL",
        "bronze_measure": "BDMNG", "silver_measure": "required_quantity",
    }
    r = reconcile_entity(spark, "recon_loss_bronze", "recon_loss_silver", cfg)
    assert r["unexplained_delta"] == 1
    assert r["passed"] == "FAIL"


def test_reconcile_entity_monitored_records_but_does_not_fail(spark: SparkSession):
    # A monitored (multi-source) entity with a count mismatch is recorded, not failed.
    _save(spark, [
        Row(VBELN="80001", POSNR="10", LFIMG=60.0, AEDATTM=_T2, AERUNID="r1", AERECNO="1", RecordActivity=None),
        Row(VBELN="80001", POSNR="20", LFIMG=40.0, AEDATTM=_T2, AERUNID="r1", AERECNO="2", RecordActivity=None),
    ], "recon_lips_bronze")
    _save(spark, [
        Row(delivery_number="80001", item_number="10", delivery_quantity=60.0, _replicated_at=_T2),
    ], "recon_lips_silver")

    cfg = {
        "entity": "outbound_delivery", "bronze_table": "x",
        "keys": ["VBELN", "POSNR"], "tie_mode": "monitored", "has_delete": False,
        "dq_drop": "VBELN IS NULL OR POSNR IS NULL",
        "bronze_measure": "LFIMG", "silver_measure": "delivery_quantity",
    }
    r = reconcile_entity(spark, "recon_lips_bronze", "recon_lips_silver", cfg)
    assert r["unexplained_delta"] == 1   # surfaced
    assert r["passed"] == "PASS"          # but does not fail the gate


def test_reconcile_entity_exact_measure_mismatch_with_null_silver_sum(spark: SparkSession):
    # Counts tie, but the silver measure is all-null (sum -> None). A one-sided null must NOT
    # bypass the measure tolerance check: coalesce to 0.0 so the delta is real and it FAILs.
    _save(spark, [
        Row(RSNUM="1", RSPOS="1", BDMNG=100.0, AEDATTM=_T2, AERUNID="r1", AERECNO="1", RecordActivity=None),
    ], "recon_nullmeas_bronze")
    _save(spark, [
        Row(reservation_number="1", reservation_item="1", required_quantity=None, _replicated_at=_T2),
    ], "recon_nullmeas_silver")

    cfg = {
        "entity": "reservation_requirement", "bronze_table": "x",
        "keys": ["RSNUM", "RSPOS"], "tie_mode": "exact", "has_delete": True,
        "dq_drop": "RSNUM IS NULL OR RSPOS IS NULL",
        "bronze_measure": "BDMNG", "silver_measure": "required_quantity",
    }
    r = reconcile_entity(spark, "recon_nullmeas_bronze", "recon_nullmeas_silver", cfg)
    assert r["unexplained_delta"] == 0       # counts tie
    assert r["measure_delta"] == 100.0       # null silver sum coalesced to 0.0
    assert r["passed"] == "FAIL"             # measure mismatch is not silently bypassed


# ── Gold grain / duplication ──────────────────────────────────────────────────

def test_check_gold_grain_clean(spark: SparkSession):
    _save(spark, [
        Row(plant_code="C061", material_code="M1", im_total_qty=10.0),
        Row(plant_code="C061", material_code="M2", im_total_qty=20.0),
    ], "recon_gold_clean")
    r = check_gold_grain(spark, "recon_gold_clean", ["plant_code", "material_code"])
    assert r["row_count"] == 2
    assert r["distinct_grain_keys"] == 2
    assert r["duplicate_rows"] == 0
    assert r["passed"] == "PASS"


def test_check_gold_grain_detects_fanout(spark: SparkSession):
    # Same (plant, material) twice -> a join fanned out -> FAIL.
    _save(spark, [
        Row(plant_code="C061", material_code="M1", im_total_qty=10.0),
        Row(plant_code="C061", material_code="M1", im_total_qty=10.0),
    ], "recon_gold_dup")
    r = check_gold_grain(spark, "recon_gold_dup", ["plant_code", "material_code"])
    assert r["row_count"] == 2
    assert r["distinct_grain_keys"] == 1
    assert r["duplicate_rows"] == 1
    assert r["passed"] == "FAIL"
