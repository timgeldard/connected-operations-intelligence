"""Tests for POH response model validation.
Ensures that the mappers return data that satisfies the generated Pydantic contracts.
"""
from adapters.poh.poh_databricks_adapter import (
    map_order_confirmations_rows,
    map_order_goods_movements_rows,
    map_order_operations_rows,
    map_process_order_header_rows,
)
from contracts.generated import (
    ProcessOrderConfirmation,
    ProcessOrderGoodsMovement,
    ProcessOrderHeader,
    ProcessOrderOperation,
)


def test_header_validation_with_missing_dates():
    """Header should validate even if planned dates are None."""
    rows = [{
        "process_order_id": "100001",
        "order_status_raw": "RELEASED",
        "material_id": "MAT01",
        "material_description": "Test",
        "plant_id": "IE01",
    }]
    result = map_process_order_header_rows(rows)
    # This will raise if validation fails
    validated = ProcessOrderHeader(**result)
    assert validated.planned_start is None
    assert validated.planned_finish is None

def test_operations_validation_with_missing_dates():
    """Operations should validate even if planned dates are None."""
    rows = [{
        "operation_id": "OPS01",
        "operation_number": "0010",
        "operation_text": "Op 1",
        "start_user": None,
        "end_user": None,
    }]
    results = map_order_operations_rows(rows)
    validated_list = [ProcessOrderOperation(**r) for r in results]
    assert len(validated_list) == 1
    assert validated_list[0].planned_start is None

def test_confirmations_validation_with_null_timestamp():
    """Confirmations should validate if confirmedAt is None."""
    rows = [{
        "confirmation_id": "CONF01",
        "operation_id": "OPS01",
        "confirmed_yield": 100.0,
        "uom": "KG",
        "confirmed_at": None,
    }]
    results = map_order_confirmations_rows(rows)
    validated_list = [ProcessOrderConfirmation(**r) for r in results]
    assert validated_list[0].confirmed_at is None

def test_goods_movements_validation_with_null_timestamp():
    """Goods movements should validate if postedAt is None."""
    rows = [{
        "movement_id": "MOV01",
        "movement_type": "261",
        "material_id": "MAT01",
        "quantity": 50.0,
        "uom": "KG",
        "posted_at": None,
    }]
    results = map_order_goods_movements_rows(rows)
    validated_list = [ProcessOrderGoodsMovement(**r) for r in results]
    assert validated_list[0].posted_at is None

def test_empty_lists_validate():
    """Empty lists should be accepted by list[T] response models."""
    assert map_order_operations_rows([]) == []
    assert map_order_confirmations_rows([]) == []
    assert map_order_goods_movements_rows([]) == []
