"""Tests for the open-holds / pick-tasks / move-requests adapter specs and mappers.

These datasets read the Category C open-items consumption views
(vw_consumption_warehouse360_{open_holds,pick_tasks,move_requests}); the specs are
governed-contracts only (no legacy mode exists for them).
"""
import os

import pytest

os.environ.setdefault("WAREHOUSE360_SOURCE_MODE", "governed_contracts")
os.environ.setdefault("WH360_CATALOG", "test_catalog")
os.environ.setdefault("WH360_SCHEMA", "test_schema")

from adapters.warehouse360.warehouse360_databricks_adapter import (  # noqa: E402
    WarehouseMoveRequestsRequest,
    WarehouseOpenHoldsRequest,
    WarehousePickTasksRequest,
    get_warehouse_move_requests_spec,
    get_warehouse_open_holds_spec,
    get_warehouse_pick_tasks_spec,
    map_warehouse_move_requests_rows,
    map_warehouse_open_holds_rows,
    map_warehouse_pick_tasks_rows,
)


class TestOpenItemsSpecs:
    def test_open_holds_spec_targets_consumption_view(self) -> None:
        spec = get_warehouse_open_holds_spec(WarehouseOpenHoldsRequest(plant_id="IE10"))
        assert "vw_consumption_warehouse360_open_holds" in spec.sql
        assert spec.contract_id == "warehouse360.open_holds"
        assert spec.params == {"plant_id": "IE10"}
        assert "plant_id = :plant_id" in spec.sql
        assert "LIMIT 200" in spec.sql

    def test_open_holds_spec_no_filters(self) -> None:
        spec = get_warehouse_open_holds_spec(WarehouseOpenHoldsRequest())
        assert spec.params == {}
        assert "WHERE" not in spec.sql

    def test_pick_tasks_spec_filters_and_contract(self) -> None:
        spec = get_warehouse_pick_tasks_spec(
            WarehousePickTasksRequest(plant_id="IE10", warehouse_id="104", limit=50)
        )
        assert "vw_consumption_warehouse360_pick_tasks" in spec.sql
        assert spec.contract_id == "warehouse360.pick_tasks"
        assert spec.params == {"plant_id": "IE10", "warehouse_id": "104"}
        assert "warehouse_number = :warehouse_id" in spec.sql
        assert "LIMIT 50" in spec.sql

    def test_move_requests_spec_filters_and_contract(self) -> None:
        spec = get_warehouse_move_requests_spec(WarehouseMoveRequestsRequest(warehouse_id="104"))
        assert "vw_consumption_warehouse360_move_requests" in spec.sql
        assert spec.contract_id == "warehouse360.move_requests"
        assert spec.params == {"warehouse_id": "104"}

    @pytest.mark.parametrize("factory,req", [
        (get_warehouse_open_holds_spec, WarehouseOpenHoldsRequest()),
        (get_warehouse_pick_tasks_spec, WarehousePickTasksRequest()),
        (get_warehouse_move_requests_spec, WarehouseMoveRequestsRequest()),
    ])
    def test_specs_are_parameterised_not_interpolated(self, factory, req) -> None:
        spec = factory(req)
        # Filters must bind via :params; only the validated integer limit is interpolated.
        assert "'" not in spec.sql.replace("''", "")


class TestOpenItemsMappers:
    def test_map_open_holds_rows(self) -> None:
        rows = [{
            "plant_id": "IE10", "warehouse_number": "104", "storage_type": "100",
            "storage_bin": "BIN1", "quant_number": "Q1", "material_id": "MAT01",
            "batch_id": "B01", "hold_type": "quality", "quantity": 12.5, "uom": "KG",
            "goods_receipt_date": "2026-06-01", "age_hours": 48.0,
        }]
        res = map_warehouse_open_holds_rows(rows)
        assert len(res) == 1
        assert res[0]["holdType"] == "quality"
        assert res[0]["quantNumber"] == "Q1"
        assert res[0]["ageHours"] == 48.0
        # Hold provenance is a documented data gap — always null, never invented.
        assert res[0]["raisedBy"] is None

    def test_map_open_holds_rows_null_safety(self) -> None:
        res = map_warehouse_open_holds_rows([{
            "plant_id": "IE10", "warehouse_number": "104", "quant_number": "Q1",
            "material_id": "MAT01", "hold_type": "blocked",
        }])
        assert res[0]["batchId"] is None
        assert res[0]["quantity"] is None
        assert res[0]["goodsReceiptDate"] is None

    def test_map_pick_tasks_rows_assignee_from_confirmed_by(self) -> None:
        rows = [{
            "plant_id": "IE10", "warehouse_number": "104", "task_id": "TO1",
            "item_number": "1", "material_id": "MAT01", "item_status": "Partially Confirmed",
            "requested_quantity": 10.0, "confirmed_quantity": 4.0,
            "confirmed_by_user": "USER2", "age_hours": 3.5,
        }]
        res = map_warehouse_pick_tasks_rows(rows)
        assert res[0]["assignee"] == "USER2"
        assert res[0]["itemStatus"] == "Partially Confirmed"
        assert res[0]["confirmedQuantity"] == 4.0

    def test_map_pick_tasks_rows_unassigned(self) -> None:
        res = map_warehouse_pick_tasks_rows([{
            "plant_id": "IE10", "warehouse_number": "104", "task_id": "TO1",
            "item_number": "1", "item_status": "Open",
        }])
        assert res[0]["assignee"] is None

    def test_map_move_requests_rows(self) -> None:
        rows = [{
            "plant_id": "IE10", "warehouse_number": "104", "request_id": "TR1",
            "item_number": "1", "material_id": "MAT01", "required_quantity": 10.0,
            "open_quantity": 10.0, "queue": "REPL", "age_hours": 1.0,
        }]
        res = map_warehouse_move_requests_rows(rows)
        assert res[0]["requestId"] == "TR1"
        assert res[0]["openQuantity"] == 10.0
        assert res[0]["queue"] == "REPL"
        # Assignee is a documented data gap (LTBK carries none) — always null.
        assert res[0]["assignedTo"] is None
