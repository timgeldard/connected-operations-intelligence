"""
Unit tests for the Plant Readiness & Data Product Safety model.
Tests all validation check logic, thresholds, scoring rollup deductions, and override rules.
"""

import datetime
from datetime import date, datetime as dt, timedelta
import pytest
from pyspark.sql import Row, SparkSession
import dlt
from tests.conftest import create_df, all_rows, first_row

@pytest.fixture(scope="module", autouse=True)
def setup_readiness(spark: SparkSession):
    # Setup spark configuration for silver catalog/schema to match our test DB
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver")
    spark.sql("CREATE DATABASE IF NOT EXISTS gold")
    
    # Redirect dlt.read to query tables from gold schema
    import gold.readiness_validation
    old_read = dlt.read
    read_fn = lambda name: spark.read.table(f"gold.{name}")
    dlt.read = read_fn
    gold.readiness_validation.dlt.read = read_fn
    
    yield
    
    # Restore dlt.read and drop DBs
    dlt.read = old_read
    gold.readiness_validation.dlt.read = old_read
    spark.sql("DROP DATABASE IF EXISTS silver CASCADE")
    spark.sql("DROP DATABASE IF EXISTS gold CASCADE")

def _save(spark: SparkSession, rows, table_name: str):
    create_df(spark, rows).write.mode("overwrite").saveAsTable(f"silver.{table_name}")

def _save_gold(spark: SparkSession, rows, table_name: str):
    create_df(spark, rows).write.mode("overwrite").saveAsTable(f"gold.{table_name}")

def test_storage_type_role_coverage_status(spark: SparkSession):
    from gold.readiness_validation import gold_storage_type_role_coverage_status

    # 1. Test 100% Match -> READY
    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", storage_type="100"),
        Row(plant_code="C061", warehouse_number="208", storage_type="200"),
    ], "storage_bin")

    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", storage_type="100", storage_role="LINESIDE", role_confidence="CONFIRMED"),
        Row(plant_code="C061", warehouse_number="208", storage_type="200", storage_role="STAGING", role_confidence="CONFIRMED"),
    ], "site_config_storage_type_role")

    res = all_rows(gold_storage_type_role_coverage_status())
    assert len(res) == 1
    assert res[0]["validation_status"] == "READY"
    assert res[0]["severity"] == "INFO"

    # 2. Test Partial Match (66.7%) -> PILOT_ONLY
    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", storage_type="100"),
        Row(plant_code="C061", warehouse_number="208", storage_type="200"),
        Row(plant_code="C061", warehouse_number="208", storage_type="300"),
    ], "storage_bin")

    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", storage_type="100", storage_role="LINESIDE", role_confidence="CONFIRMED"),
        Row(plant_code="C061", warehouse_number="208", storage_type="200", storage_role="STAGING", role_confidence="CONFIRMED"),
        Row(plant_code="C061", warehouse_number="208", storage_type="300", storage_role="FALLBACK", role_confidence="FALLBACK"),
    ], "site_config_storage_type_role")

    res = all_rows(gold_storage_type_role_coverage_status())
    assert len(res) == 1
    assert res[0]["validation_status"] == "PILOT_ONLY"
    assert res[0]["severity"] == "MEDIUM"

def test_movement_type_classification_coverage(spark: SparkSession):
    from gold.readiness_validation import gold_movement_type_classification_coverage

    # 1. All Classified -> READY
    _save(spark, [
        Row(plant_code="C061", movement_type_code="101", posting_date=date.today()),
        Row(plant_code="C061", movement_type_code="261", posting_date=date.today()),
    ], "goods_movement")

    _save(spark, [
        Row(plant_code=None, movement_type_code="101", event_category="GOODS_RECEIPT"),
        Row(plant_code=None, movement_type_code="261", event_category="GOODS_ISSUE"),
    ], "site_config_movement_type_classification")

    res = all_rows(gold_movement_type_classification_coverage())
    assert len(res) == 1
    assert res[0]["validation_status"] == "READY"
    assert res[0]["severity"] == "INFO"

    # 2. Unclassified Z* Movement -> BLOCKED, CRITICAL
    _save(spark, [
        Row(plant_code="C061", movement_type_code="101", posting_date=date.today()),
        Row(plant_code="C061", movement_type_code="Z99", posting_date=date.today()),
    ], "goods_movement")

    res = all_rows(gold_movement_type_classification_coverage())
    assert len(res) == 1
    assert res[0]["validation_status"] == "BLOCKED"
    assert res[0]["severity"] == "CRITICAL"

def test_process_order_staging_validation(spark: SparkSession):
    from gold.readiness_validation import gold_process_order_staging_validation

    # 1. 100% Staging Matches -> READY
    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", source_reference_type="F", source_reference_number="ORD1"),
    ], "warehouse_transfer_order")

    _save(spark, [
        Row(order_number="ORD1", plant_code="C061"),
    ], "process_order")

    res = all_rows(gold_process_order_staging_validation())
    assert len(res) == 1
    assert res[0]["validation_status"] == "READY"

    # 2. Under 70% Match -> BLOCKED
    _save(spark, [
        Row(plant_code="C061", warehouse_number="208", source_reference_type="F", source_reference_number="ORD1"),
        Row(plant_code="C061", warehouse_number="208", source_reference_type="F", source_reference_number="ORD2"),
        Row(plant_code="C061", warehouse_number="208", source_reference_type="F", source_reference_number="ORD3"),
    ], "warehouse_transfer_order")

    res = all_rows(gold_process_order_staging_validation())
    assert len(res) == 1
    assert res[0]["validation_status"] == "BLOCKED"

def test_recipe_line_enrichment_coverage(spark: SparkSession):
    from gold.readiness_validation import gold_recipe_line_enrichment_coverage

    # 1. 100% Enriched -> READY
    _save(spark, [
        Row(plant_code="C061", scheduled_start_date=date.today(), production_line="LINE1"),
    ], "process_order")

    res = all_rows(gold_recipe_line_enrichment_coverage())
    assert len(res) == 1
    assert res[0]["validation_status"] == "READY"

    # 2. 50% Enriched -> BLOCKED
    _save(spark, [
        Row(plant_code="C061", scheduled_start_date=date.today(), production_line="LINE1"),
        Row(plant_code="C061", scheduled_start_date=date.today(), production_line=None),
    ], "process_order")

    res = all_rows(gold_recipe_line_enrichment_coverage())
    assert len(res) == 1
    assert res[0]["validation_status"] == "BLOCKED"

def test_delivery_pick_status_validation(spark: SparkSession):
    from gold.readiness_validation import gold_delivery_pick_status_validation

    # 1. 0% Mixed UoM -> READY
    _save(spark, [
        Row(plant_code="C061", delivery_number="DEL1", planned_goods_issue_date=date.today(), base_uom="KG"),
        Row(plant_code="C061", delivery_number="DEL2", planned_goods_issue_date=date.today(), base_uom="KG"),
    ], "outbound_delivery")

    res = all_rows(gold_delivery_pick_status_validation())
    assert len(res) == 1
    assert res[0]["validation_status"] == "READY"

    # 2. 50% Mixed UoM -> PILOT_ONLY
    _save(spark, [
        Row(plant_code="C061", delivery_number="DEL1", planned_goods_issue_date=date.today(), base_uom="KG"),
        Row(plant_code="C061", delivery_number="DEL1", planned_goods_issue_date=date.today(), base_uom="PC"),
        Row(plant_code="C061", delivery_number="DEL2", planned_goods_issue_date=date.today(), base_uom="KG"),
    ], "outbound_delivery")

    res = all_rows(gold_delivery_pick_status_validation())
    assert len(res) == 1
    assert res[0]["validation_status"] == "PILOT_ONLY"

def test_stock_reconciliation_readiness(spark: SparkSession):
    from gold.readiness_validation import gold_stock_reconciliation_readiness

    # Setup roles coverage mock
    _save_gold(spark, [
        Row(plant_code="C061", validation_status="READY")
    ], "gold_storage_type_role_coverage_status")

    _save(spark, [
        Row(plant_code="C061", storage_location_code="SL1", warehouse_number="208")
    ], "warehouse_storage_location_mapping")

    res = all_rows(gold_stock_reconciliation_readiness())
    assert len(res) == 1
    assert res[0]["validation_status"] == "READY"

def test_plant_freshness_readiness(spark: SparkSession):
    from gold.readiness_validation import gold_plant_freshness_readiness

    # 1. Fresh -> READY
    _save(spark, [Row(plant_code="C061", _replicated_at=dt.now())], "process_order")
    _save(spark, [Row(plant_code="C061", _replicated_at=dt.now(), source_reference_type="F")], "warehouse_transfer_order")

    res = all_rows(gold_plant_freshness_readiness())
    assert len(res) == 1
    assert res[0]["validation_status"] == "READY"

    # 2. Stale (2 days lag) -> BLOCKED, CRITICAL
    _save(spark, [Row(plant_code="C061", _replicated_at=dt.now() - timedelta(days=2))], "process_order")
    _save(spark, [Row(plant_code="C061", _replicated_at=dt.now() - timedelta(days=2), source_reference_type="F")], "warehouse_transfer_order")

    res = all_rows(gold_plant_freshness_readiness())
    assert len(res) == 1
    assert res[0]["validation_status"] == "BLOCKED"
    assert res[0]["severity"] == "CRITICAL"

def test_readiness_status_rollup_and_overrides(spark: SparkSession):
    from gold.readiness_validation import gold_plant_readiness_status

    # Seed the conformed KPI enablement overrides
    _save(spark, [
        Row(plant_code="C061", data_product_name="gold_lineside_stock", kpi_name="Lineside Stock", enablement_status="READY"),
    ], "site_config_kpi_enablement")

    # Seed mock validation failures in gold_validation_failure_detail
    # Plant C061: has a HIGH (-20) and a MEDIUM (-10) failure. Total deduction = 30. Score = 70.
    # Plant C062: has a CRITICAL (-40) failure.
    # Plant C063: has a stale freshness SLA.
    _save_gold(spark, [
        # Plant C061 (Score: 70 -> PILOT_ONLY)
        Row(plant_code="C061", data_product_name="gold_lineside_stock", validation_name="Check A", validation_status="WARNING", severity="HIGH", last_checked_at=dt.now()),
        Row(plant_code="C061", data_product_name="gold_lineside_stock", validation_name="Check B", validation_status="WARNING", severity="MEDIUM", last_checked_at=dt.now()),
        
        # Plant C062 (Critical failure override -> BLOCKED)
        Row(plant_code="C062", data_product_name="gold_lineside_stock", validation_name="Check A", validation_status="FAILED", severity="CRITICAL", last_checked_at=dt.now()),
        
        # Plant C063 (Freshness SLA failure -> BLOCKED)
        Row(plant_code="C063", data_product_name="all_products", validation_name="Plant Freshness SLA", validation_status="BLOCKED", severity="CRITICAL", last_checked_at=dt.now()),
    ], "gold_validation_failure_detail")

    # Run status rollup DLT table function
    res = all_rows(gold_plant_readiness_status())
    assert len(res) >= 3

    # Extract results for verification
    c061_res = [r for r in res if r["plant_code"] == "C061" and r["data_product_name"] == "gold_lineside_stock"][0]
    c062_res = [r for r in res if r["plant_code"] == "C062" and r["data_product_name"] == "gold_lineside_stock"][0]
    c063_res = [r for r in res if r["plant_code"] == "C063"][0]

    # Verify score logic and overrides
    assert c061_res["readiness_score"] == 70
    assert c061_res["readiness_status"] == "READY" # enablement_status override takes precedence over computed status (PILOT_ONLY)

    assert c062_res["readiness_score"] == 60
    assert c062_res["readiness_status"] == "BLOCKED" # Overridden due to has_critical = 1

    assert c063_res["readiness_status"] == "BLOCKED" # Overridden due to freshness SLA failure
