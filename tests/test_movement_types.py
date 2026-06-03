"""
Tests for conformed SAP movement-type semantics.
"""

from pyspark.sql import Row

from silver.movement_types import (
    MOVEMENT_TYPE_MAPPING,
    T156_REVERSAL_MAPPING,
    build_movement_type_classification_records,
    get_movement_category,
    get_movement_direction,
    get_movement_event_category,
    is_reversal,
)
from silver.tables.reference import movement_type_classification
from tests.conftest import all_rows


def test_reversal_mapping_is_derived_from_labels():
    expected = {
        code
        for code, label in MOVEMENT_TYPE_MAPPING.items()
        if "REVERSAL" in label
    }

    assert T156_REVERSAL_MAPPING == expected
    assert is_reversal("102") is True
    assert is_reversal("101") is False


def test_event_categories_cover_warehouse_kpi_families():
    assert get_movement_event_category("101") == "GOODS_RECEIPT"
    assert get_movement_event_category("103") == "GOODS_RECEIPT"
    assert get_movement_event_category("201") == "GOODS_ISSUE"
    assert get_movement_event_category("261") == "GOODS_ISSUE"
    assert get_movement_event_category("311") == "TRANSFER"
    assert get_movement_event_category("701") == "STOCK_WRITE_ON"
    assert get_movement_event_category("702") == "STOCK_WRITE_OFF"
    assert get_movement_event_category("Z01") == "GOODS_ISSUE"
    assert get_movement_event_category("561") == "INITIAL_ENTRY"
    assert get_movement_event_category("999") == "OTHER"


def test_movement_categories_cover_pp_pi_and_wm_splits():
    assert get_movement_category("101") == "PRODUCTION"
    assert get_movement_category("103") == "PROCUREMENT"
    assert get_movement_category("261") == "PRODUCTION"
    assert get_movement_category("Z01") == "CONSUMPTION"
    assert get_movement_category("999") == "OTHER"


def test_movement_direction_uses_transfer_and_signed_quantity_rules():
    assert get_movement_direction("311", signed_quantity=-10.0) == "INTERNAL"
    assert get_movement_direction("101", signed_quantity=10.0) == "INBOUND"
    assert get_movement_direction("102", signed_quantity=-10.0) == "OUTBOUND"
    assert get_movement_direction("101") == "INBOUND"
    assert get_movement_direction("102") == "OUTBOUND"
    assert get_movement_direction("261") == "OUTBOUND"
    assert get_movement_direction("262") == "INBOUND"
    assert get_movement_direction("561") == "INBOUND"
    assert get_movement_direction("562") == "OUTBOUND"
    assert get_movement_direction("999") == "UNKNOWN"


def test_movement_type_classification_schema_and_backcompat_columns():
    rows = {
        row["movement_type_code"]: row
        for row in all_rows(movement_type_classification())
    }

    assert rows["101"]["movement_label"] == "GOODS_RECEIPT_PRODUCTION"
    assert rows["101"]["movement_category"] == "PRODUCTION"
    assert rows["101"]["event_category"] == "GOODS_RECEIPT"
    assert rows["101"]["is_goods_receipt"] is True
    assert rows["101"]["is_production_receipt"] is True
    assert rows["103"]["movement_category"] == "PROCUREMENT"
    assert rows["103"]["is_po_receipt"] is True
    assert rows["103"]["is_production_receipt"] is False
    assert rows["102"]["is_reversal"] is True
    assert rows["102"]["is_receipt_reversal"] is True
    assert rows["261"]["is_production_consumption"] is True
    assert rows["262"]["is_production_consumption_reversal"] is True
    assert rows["Z01"]["is_custom_bulk_drop"] is True
    assert rows["Z01"]["is_goods_issue"] is True
    assert rows["551"]["is_goods_issue"] is True
    assert rows["551"]["is_scrap"] is True
    assert rows["552"]["is_scrap_reversal"] is True
    assert rows["311"]["is_transfer"] is True
    assert rows["701"]["is_stock_write_on"] is True
    assert rows["702"]["is_stock_write_off"] is True
    assert rows["561"]["event_category"] == "INITIAL_ENTRY"
    assert rows["562"]["is_reversal"] is True
    assert rows["101"]["classification_source"] == "OVERLAY_ONLY"


def test_movement_type_classification_reads_t156_and_preserves_overlay(spark):
    old_published_catalog = spark.conf.get("published_catalog", None)
    old_published_schema = spark.conf.get("published_schema", None)
    spark.sql("CREATE DATABASE IF NOT EXISTS movement_type_source_test")
    try:
        spark.conf.set("published_catalog", "spark_catalog")
        spark.conf.set("published_schema", "movement_type_source_test")

        spark.createDataFrame([
            Row(MANDT="100", BWART="101", SHKZG="S", XSTBW=""),
            Row(MANDT="200", BWART="101", SHKZG="H", XSTBW="X"),
            Row(MANDT="100", BWART="999", SHKZG="S", XSTBW=""),
            Row(MANDT="200", BWART="999", SHKZG="H", XSTBW="X"),
        ]).write.mode("overwrite").saveAsTable("movement_type_source_test.movementtype_t156")
        spark.createDataFrame([
            Row(MANDT="100", BWART="101", SPRAS="E", SOBKZ="", KZBEW="", KZZUG="", KZVBR="", BTEXT="GR goods receipt"),
            Row(MANDT="200", BWART="101", SPRAS="E", SOBKZ="", KZBEW="", KZZUG="", KZVBR="", BTEXT="Wrong client text"),
            Row(MANDT="100", BWART="999", SPRAS="E", SOBKZ="", KZBEW="", KZZUG="", KZVBR="", BTEXT="Custom movement"),
            Row(MANDT="100", BWART="999", SPRAS="D", SOBKZ="", KZBEW="", KZZUG="", KZVBR="", BTEXT="German text ignored"),
            Row(MANDT="200", BWART="999", SPRAS="E", SOBKZ="", KZBEW="", KZZUG="", KZVBR="", BTEXT="Wrong client custom text"),
        ]).write.mode("overwrite").saveAsTable("movement_type_source_test.movementtypetext2_t156t")

        rows = {row["movement_type_code"]: row for row in all_rows(movement_type_classification())}

        assert rows["101"]["movement_label"] == "GOODS_RECEIPT_PRODUCTION"
        assert rows["101"]["event_category"] == "GOODS_RECEIPT"
        assert rows["101"]["sap_movement_description"] == "GR goods receipt"
        assert rows["101"]["sap_debit_credit_indicator"] == "S"
        assert rows["101"]["sap_reversal_indicator"] == ""
        assert rows["101"]["classification_source"] == "T156_WITH_OVERLAY"

        assert rows["999"]["movement_label"] == "UNCLASSIFIED_MOVEMENT_TYPE"
        assert rows["999"]["event_category"] == "OTHER"
        assert rows["999"]["is_goods_receipt"] is False
        assert rows["999"]["sap_movement_description"] == "Custom movement"
        assert rows["999"]["sap_debit_credit_indicator"] == "S"
        assert rows["999"]["classification_source"] == "T156_UNCLASSIFIED"
    finally:
        if old_published_catalog is not None:
            spark.conf.set("published_catalog", old_published_catalog)
        if old_published_schema is not None:
            spark.conf.set("published_schema", old_published_schema)
        spark.sql("DROP DATABASE IF EXISTS movement_type_source_test CASCADE")


def test_shared_builder_keeps_fixture_rows_aligned():
    rows = {
        row["movement_type_code"]: row
        for row in build_movement_type_classification_records(["101", "999"])
    }

    assert rows["101"]["movement_label"] == "GOODS_RECEIPT_PRODUCTION"
    assert rows["999"]["movement_label"] == "UNCLASSIFIED_MOVEMENT_TYPE"
    assert rows["999"]["event_category"] == "OTHER"


def test_shared_builder_respects_empty_movement_type_list():
    assert build_movement_type_classification_records([]) == []
