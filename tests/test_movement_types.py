"""
Tests for conformed SAP movement-type semantics.
"""

from silver.movement_types import (
    MOVEMENT_TYPE_MAPPING,
    T156_REVERSAL_MAPPING,
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
    assert get_movement_event_category("201") == "GOODS_ISSUE"
    assert get_movement_event_category("311") == "TRANSFER"
    assert get_movement_event_category("701") == "STOCK_WRITE_ON"
    assert get_movement_event_category("702") == "STOCK_WRITE_OFF"
    assert get_movement_event_category("561") == "INITIAL_ENTRY"
    assert get_movement_event_category("999") == "OTHER"


def test_movement_direction_uses_transfer_and_signed_quantity_rules():
    assert get_movement_direction("311", signed_quantity=-10.0) == "INTERNAL"
    assert get_movement_direction("101", signed_quantity=10.0) == "INBOUND"
    assert get_movement_direction("102", signed_quantity=-10.0) == "OUTBOUND"
    assert get_movement_direction("999") == "UNKNOWN"


def test_movement_type_classification_schema_and_backcompat_columns():
    rows = {
        row["movement_type_code"]: row
        for row in all_rows(movement_type_classification())
    }

    assert rows["101"]["movement_label"] == "GOODS_RECEIPT_PRODUCTION"
    assert rows["101"]["event_category"] == "GOODS_RECEIPT"
    assert rows["101"]["is_goods_receipt"] is True
    assert rows["101"]["is_production_receipt"] is True
    assert rows["102"]["is_reversal"] is True
    assert rows["102"]["is_receipt_reversal"] is True
    assert rows["551"]["is_goods_issue"] is True
    assert rows["551"]["is_scrap"] is True
    assert rows["552"]["is_scrap_reversal"] is True
    assert rows["311"]["is_transfer"] is True
    assert rows["701"]["is_stock_write_on"] is True
    assert rows["702"]["is_stock_write_off"] is True
