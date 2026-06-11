"""Tests for the Warehouse360 Databricks adapter."""
import pytest
from adapters.warehouse360.warehouse360_databricks_adapter import (
    WarehouseBatchHoldStatusRequest,
    WarehouseExceptionRequest,
    WarehouseInboundRequest,
    WarehouseOutboundRequest,
    WarehouseOverviewRequest,
    WarehouseShortfallsRequest,
    WarehouseStagingReadinessRequest,
    WarehouseStagingRequest,
    WarehouseStockExceptionsRequest,
    WarehouseStockZonesRequest,
    _format_datetime,
    _safe_float,
    _safe_int,
    get_warehouse_batch_hold_status_spec,
    get_warehouse_exceptions_spec,
    get_warehouse_inbound_spec,
    get_warehouse_outbound_spec,
    get_warehouse_overview_spec,
    get_warehouse_shortfalls_spec,
    get_warehouse_staging_readiness_spec,
    get_warehouse_staging_spec,
    get_warehouse_stock_exceptions_spec,
    get_warehouse_stock_zones_spec,
    map_warehouse_batch_hold_status_rows,
    map_warehouse_exceptions_rows,
    map_warehouse_inbound_rows,
    map_warehouse_outbound_rows,
    map_warehouse_overview_rows,
    map_warehouse_shortfalls_rows,
    map_warehouse_staging_readiness_rows,
    map_warehouse_staging_rows,
    map_warehouse_stock_exceptions_rows,
    map_warehouse_stock_zones_rows,
)
from shared.query_service.cache_policy import CacheTier
from shared.query_service.errors import DatabricksConfigError

ACTIVE_GOVERNED_SPECS = [
    (
        "warehouse360.overview",
        get_warehouse_overview_spec,
        WarehouseOverviewRequest("WH01"),
        "vw_consumption_warehouse360_overview",
    ),
    (
        "warehouse360.inbound_backlog",
        get_warehouse_inbound_spec,
        WarehouseInboundRequest("WH01"),
        "vw_consumption_warehouse360_inbound_backlog",
    ),
    (
        "warehouse360.outbound_backlog",
        get_warehouse_outbound_spec,
        WarehouseOutboundRequest("WH01"),
        "vw_consumption_warehouse360_outbound_backlog",
    ),
    (
        "warehouse360.staging_workload",
        get_warehouse_staging_spec,
        WarehouseStagingRequest("WH01"),
        "vw_consumption_warehouse360_staging_workload",
    ),
    (
        "warehouse360.im_wm_reconciliation",
        get_warehouse_exceptions_spec,
        WarehouseExceptionRequest("WH01"),
        "vw_consumption_warehouse360_im_wm_reconciliation",
    ),
    (
        "warehouse360.stock_exceptions",
        get_warehouse_stock_exceptions_spec,
        WarehouseStockExceptionsRequest("WH01"),
        "vw_consumption_warehouse360_stock_exceptions",
    ),
    (
        "warehouse360.shortfalls",
        get_warehouse_shortfalls_spec,
        WarehouseShortfallsRequest("WH01"),
        "vw_consumption_warehouse360_shortfalls",
    ),
]

# ---------------------------------------------------------------------------
# Fixtures & Shared Context
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _set_wh360_catalog(monkeypatch):
    monkeypatch.setenv("WH360_CATALOG", "wh360_uat_catalog")
    monkeypatch.setenv("WH360_SCHEMA", "wh360_uat_schema")


class TestWarehouse360GovernedSpecs:
    @pytest.mark.parametrize(
        "contract_id,spec_factory,warehouse_request,source_view",
        ACTIVE_GOVERNED_SPECS,
    )
    def test_governed_contract_mode_sets_contract_id(
        self,
        contract_id,
        spec_factory,
        warehouse_request,
        source_view,
    ) -> None:
        spec = spec_factory(warehouse_request)
        assert spec.contract_id == contract_id
        assert source_view in spec.sql
        assert "`wh360_uat_catalog`.`wh360_uat_schema`" in spec.sql

    def test_missing_catalog_raises_error(self, monkeypatch) -> None:
        monkeypatch.delenv("WH360_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_warehouse_overview_spec(WarehouseOverviewRequest("WH01"))


# ---------------------------------------------------------------------------
# QuerySpec Factories Tests
# ---------------------------------------------------------------------------

class TestWarehouseOverviewSpec:
    def test_spec_properties(self) -> None:
        spec = get_warehouse_overview_spec(WarehouseOverviewRequest("WH01"))
        assert spec.name == "warehouse360.get_overview"
        assert spec.module == "wh360"
        assert spec.endpoint == "/api/warehouse360/overview"
        assert spec.cache_policy == CacheTier.GLOBAL_300S
        assert spec.params == {}
        assert "vw_consumption_warehouse360_overview" in spec.sql
        assert "WHERE" not in spec.sql


class TestWarehouseInboundSpec:
    def test_spec_properties(self) -> None:
        spec = get_warehouse_inbound_spec(WarehouseInboundRequest("WH01"))
        assert spec.name == "warehouse360.get_inbound"
        assert spec.module == "wh360"
        assert spec.endpoint == "/api/warehouse360/inbound"
        assert spec.cache_policy == CacheTier.PER_USER_60S
        assert "warehouse_id" not in spec.params
        assert "vw_consumption_warehouse360_inbound_backlog" in spec.sql

    def test_spec_uses_actual_governed_columns(self) -> None:
        spec = get_warehouse_inbound_spec(WarehouseInboundRequest("WH01"))
        for actual_col in ("po_id", "po_item", "doc_type", "vendor_id",
                           "plant_id", "storage_loc", "material_id", "material_name",
                           "ordered_qty", "uom", "po_date", "oldest_po_age_days",
                           "inbound_backlog_risk_band"):
            assert actual_col in spec.sql, f"missing source column {actual_col!r}"


class TestWarehouseOutboundSpec:
    def test_spec_properties(self) -> None:
        spec = get_warehouse_outbound_spec(WarehouseOutboundRequest("WH01"))
        assert spec.name == "warehouse360.get_outbound"
        assert spec.module == "wh360"
        assert spec.endpoint == "/api/warehouse360/outbound"
        assert spec.cache_policy == CacheTier.PER_USER_60S
        assert "warehouse_id" not in spec.params
        assert "vw_consumption_warehouse360_outbound_backlog" in spec.sql

    def test_spec_uses_actual_governed_columns(self) -> None:
        spec = get_warehouse_outbound_spec(WarehouseOutboundRequest("WH01"))
        for actual_col in ("delivery_id", "delivery_type", "plant_id",
                           "customer_id", "customer_name", "planned_gi_date",
                           "actual_gi_date", "delivery_date", "gross_weight",
                           "pick_pct", "line_count", "risk", "shipped"):
            assert actual_col in spec.sql, f"missing source column {actual_col!r}"


class TestWarehouseStagingSpec:
    def test_spec_properties(self) -> None:
        spec = get_warehouse_staging_spec(WarehouseStagingRequest("WH01"))
        assert spec.name == "warehouse360.get_staging"
        assert spec.module == "wh360"
        assert spec.endpoint == "/api/warehouse360/staging"
        assert spec.cache_policy == CacheTier.PER_USER_60S
        assert "warehouse_id" not in spec.params
        assert "vw_consumption_warehouse360_staging_workload" in spec.sql

    def test_spec_uses_actual_governed_columns(self) -> None:
        spec = get_warehouse_staging_spec(WarehouseStagingRequest("WH01"))
        for actual_col in ("order_id", "material_id", "material_name", "plant_id",
                           "uom", "order_qty", "sched_start", "sched_finish",
                           "staging_pct", "to_items_total", "to_items_done",
                           "mins_to_start", "risk"):
            assert actual_col in spec.sql, f"missing source column {actual_col!r}"


class TestWarehouseExceptionsSpec:
    def test_spec_properties(self) -> None:
        spec = get_warehouse_exceptions_spec(WarehouseExceptionRequest("WH01"))
        assert spec.name == "warehouse360.get_exceptions"
        assert spec.module == "wh360"
        assert spec.endpoint == "/api/warehouse360/exceptions"
        assert spec.cache_policy == CacheTier.PER_USER_60S
        assert "warehouse_id" not in spec.params
        assert "vw_consumption_warehouse360_im_wm_reconciliation" in spec.sql

    def test_spec_uses_actual_governed_columns(self) -> None:
        spec = get_warehouse_exceptions_spec(WarehouseExceptionRequest("WH01"))
        for actual_col in ("exception_type", "severity", "material_id", "plant_id",
                           "qty", "batch_id", "detail_text"):
            assert actual_col in spec.sql, f"missing source column {actual_col!r}"


class TestQuerySpecDynamicFiltering:
    def test_inbound_with_all_filters(self) -> None:
        req = WarehouseInboundRequest(
            warehouse_id="WH01",
            plant_id="PL10",
            date_from="2026-05-01",
            date_to="2026-05-31",
            limit=250,
        )
        spec = get_warehouse_inbound_spec(req)
        assert spec.params["plant_id"] == "PL10"
        assert spec.params["date_from"] == "2026-05-01"
        assert spec.params["date_to"] == "2026-05-31"
        assert "plant_id = :plant_id" in spec.sql
        assert "po_date >= :date_from" in spec.sql
        assert "po_date <= :date_to" in spec.sql
        assert "LIMIT 250" in spec.sql

    def test_outbound_with_all_filters(self) -> None:
        req = WarehouseOutboundRequest(
            warehouse_id="WH01",
            plant_id="PL10",
            date_from="2026-05-01",
            date_to="2026-05-31",
            limit=250,
        )
        spec = get_warehouse_outbound_spec(req)
        assert spec.params["plant_id"] == "PL10"
        assert spec.params["date_from"] == "2026-05-01"
        assert spec.params["date_to"] == "2026-05-31"
        assert "plant_id = :plant_id" in spec.sql
        assert "planned_gi_date >= :date_from" in spec.sql
        assert "planned_gi_date <= :date_to" in spec.sql
        assert "LIMIT 250" in spec.sql

    def test_staging_with_all_filters(self) -> None:
        req = WarehouseStagingRequest(
            warehouse_id="WH01",
            plant_id="PL10",
            date_from="2026-05-01",
            date_to="2026-05-31",
            limit=250,
        )
        spec = get_warehouse_staging_spec(req)
        assert spec.params["plant_id"] == "PL10"
        assert spec.params["date_from"] == "2026-05-01"
        assert spec.params["date_to"] == "2026-05-31"
        assert "plant_id = :plant_id" in spec.sql
        assert "sched_start >= :date_from" in spec.sql
        assert "sched_start <= :date_to" in spec.sql
        assert "LIMIT 250" in spec.sql

    def test_exceptions_with_all_filters(self) -> None:
        req = WarehouseExceptionRequest(
            warehouse_id="WH01",
            plant_id="PL10",
            date_from="2026-05-01",
            date_to="2026-05-31",
            limit=250,
        )
        spec = get_warehouse_exceptions_spec(req)
        assert spec.params["plant_id"] == "PL10"
        assert spec.params["date_from"] == "2026-05-01"
        assert spec.params["date_to"] == "2026-05-31"
        assert "plant_id = :plant_id" in spec.sql
        assert "latest_detected_date >= :date_from" in spec.sql
        assert "latest_detected_date <= :date_to" in spec.sql
        assert "LIMIT 250" in spec.sql


# ---------------------------------------------------------------------------
# Utility Mapping Helpers Tests
# ---------------------------------------------------------------------------

class TestUtilityHelpers:
    def test_safe_float(self) -> None:
        assert _safe_float("12.34") == 12.34
        assert _safe_float(45) == 45.0
        assert _safe_float(None) == 0.0
        assert _safe_float("invalid") == 0.0

    def test_safe_int(self) -> None:
        assert _safe_int("12") == 12
        assert _safe_int(45.6) == 45
        assert _safe_int(None) == 0
        assert _safe_int("invalid") == 0

    def test_format_datetime(self) -> None:
        assert _format_datetime("2024-03-08 14:30:00") == "2024-03-08T14:30:00"
        assert _format_datetime("2024-03-08T14:30:00") == "2024-03-08T14:30:00"
        assert _format_datetime("2024-03-08") == "2024-03-08T00:00:00"
        assert _format_datetime(None) == ""
        assert _format_datetime("None") == ""


# ---------------------------------------------------------------------------
# Row Mappers Tests
# ---------------------------------------------------------------------------

class TestWarehouseRowMappers:
    def test_map_overview_rows(self) -> None:
        rows = [{
            "orders_total": 24,
            "orders_red": 2,
            "orders_amber": 5,
            "trs_open": 9573882,
            "tos_open": 0,
            "deliveries_today": 12,
            "deliveries_at_risk": 3,
            "inbound_open": 18671,
            "bins_blocked": 16614,
            "bins_total": 352027,
            "bin_util_pct": "56.8",
        }]
        res = map_warehouse_overview_rows(rows, WarehouseOverviewRequest("104"))
        assert res["warehouseId"] == "104"
        assert res["ordersTotal"] == 24
        assert res["ordersRed"] == 2
        assert res["deliveriesToday"] == 12
        assert res["inboundOpen"] == 18671
        assert res["binsBlocked"] == 16614
        assert res["binUtilPct"] == 56.8

    def test_map_overview_empty_rows(self) -> None:
        res = map_warehouse_overview_rows([], WarehouseOverviewRequest("104"))
        assert res["warehouseId"] == "104"
        assert res["ordersTotal"] == 0
        assert res["binUtilPct"] == 0.0

    def test_map_inbound_rows(self) -> None:
        rows = [{
            "po_id": "0045001234",
            "po_item": "00010",
            "doc_type": "PO",
            "vendor_id": "0008100123",
            "plant_id": "IE10",
            "storage_loc": "SL01",
            "material_id": "000000000000821034",
            "material_name": "Raw Milk",
            "ordered_qty": 25000.0,
            "uom": "L",
            "po_date": "2026-05-10",
            "oldest_po_age_days": 10,
            "inbound_backlog_risk_band": "low"
        }]
        res = map_warehouse_inbound_rows(rows)
        assert len(res) == 1
        item = res[0]
        assert item["documentType"] == "PO"
        assert item["purchaseOrderId"] == "0045001234"
        assert item["materialId"] == "000000000000821034"
        assert item["batchId"] is None

    def test_map_outbound_rows(self) -> None:
        rows = [{
            "delivery_id": "0080047212",
            "delivery_type": "LF",
            "plant_id": "IE10",
            "customer_id": "0003829100",
            "customer_name": "Acme Foods Ltd",
            "planned_gi_date": "2026-05-18 15:00:00",
            "actual_gi_date": None,
            "delivery_date": "2026-05-19",
            "gross_weight": 960.0,
            "weight_uom": "KG",
            "pick_pct": 0.85,
            "line_count": 3,
            "risk": "amber",
            "shipped": False,
        }]
        res = map_warehouse_outbound_rows(rows)
        assert len(res) == 1
        item = res[0]
        assert item["deliveryId"] == "0080047212"
        assert item["customerId"] == "0003829100"
        assert item["quantity"] == 960.0
        assert item["unitOfMeasure"] == "KG"

    def test_map_staging_rows(self) -> None:
        rows = [{
            "order_id": "000700123456",
            "material_id": "000000000000840123",
            "material_name": "Starter Culture B10",
            "plant_id": "IE10",
            "uom": "KG",
            "order_qty": 2.5,
            "sched_start": "2026-05-18 08:30:00",
            "sched_finish": "2026-05-18 18:30:00",
            "staging_pct": 0.8,
            "to_items_total": 5,
            "to_items_done": 4,
            "mins_to_start": 120,
            "risk": "low",
        }]
        res = map_warehouse_staging_rows(rows)
        assert len(res) == 1
        item = res[0]
        assert item["processOrderId"] == "000700123456"
        assert item["materialId"] == "000000000000840123"
        assert item["openQuantity"] == 0.5

    def test_map_exceptions_rows(self) -> None:
        rows = [
            {
                "exception_type": "EXPIRED_BATCH_WITH_STOCK",
                "severity": "high",
                "material_id": "MAT01",
                "batch_id": "B01",
                "plant_id": "IE10",
                "qty": 20.0,
                "detail_text": "Stock recorded",
            }
        ]
        res = map_warehouse_exceptions_rows(rows)
        assert len(res) == 1
        assert res[0]["exceptionType"] == "EXPIRED_BATCH_WITH_STOCK"
        assert res[0]["severity"] == "high"

    def test_map_stock_exceptions_rows(self) -> None:
        rows = [{
            "plant_id": "IE10",
            "material_id": "MAT01",
            "batch_id": "B01",
            "exception_type": "EXPIRED",
            "qty": 10.5,
            "minimum_days_to_expiry": -5,
            "has_minimum_shelf_life_breach": True
        }]
        res = map_warehouse_stock_exceptions_rows(rows)
        assert len(res) == 1
        assert res[0]["plantId"] == "IE10"
        assert res[0]["materialId"] == "MAT01"
        assert res[0]["exceptionType"] == "EXPIRED"
        assert res[0]["qty"] == 10.5
        assert res[0]["minimumDaysToExpiry"] == -5
        assert res[0]["hasMinimumShelfLifeBreach"] is True

    def test_map_shortfalls_rows(self) -> None:
        rows = [{
            "plant_id": "IE10",
            "material_id": "MAT01",
            "shortfall_qty": 500.0,
            "open_items_count": 5,
            "oldest_tr_date": "2026-05-10"
        }]
        res = map_warehouse_shortfalls_rows(rows)
        assert len(res) == 1
        assert res[0]["plantId"] == "IE10"
        assert res[0]["materialId"] == "MAT01"
        assert res[0]["shortfallQty"] == 500.0
        assert res[0]["openItemsCount"] == 5
        assert res[0]["oldestTrDate"] == "2026-05-10"

    def test_map_stock_zones_rows(self) -> None:
        rows = [{
            "plant_id": "IE10",
            "warehouse_number": "WH01",
            "storage_type": "COLD",
            "bin_type": "PALLET",
            "bin_record_count": 100,
            "occupied_bin_count": 80,
            "empty_bin_count": 20,
            "blocked_bin_count": 5,
            "occupancy_rate": 0.8
        }]
        res = map_warehouse_stock_zones_rows(rows)
        assert len(res) == 1
        assert res[0]["plantId"] == "IE10"
        assert res[0]["warehouseNumber"] == "WH01"
        assert res[0]["storageType"] == "COLD"
        assert res[0]["binType"] == "PALLET"
        assert res[0]["binRecordCount"] == 100
        assert res[0]["occupiedBinCount"] == 80
        assert res[0]["emptyBinCount"] == 20
        assert res[0]["blockedBinCount"] == 5
        assert res[0]["occupancyRate"] == 0.8

    def test_map_batch_hold_status_rows(self) -> None:
        rows = [{
            "plant_id": "IE10",
            "storage_location_id": "SL01",
            "material_id": "MAT01",
            "batch_id": "B01",
            "uom": "KG",
            "unrestricted_quantity": 1000.0,
            "blocked_quantity": 100.0,
            "restricted_quantity": 0.0,
            "total_quantity": 1100.0,
            "stock_type": "blocked",
            "has_blocking_hold": True,
            "last_updated_at": "2026-06-10 00:00:00"
        }]
        res = map_warehouse_batch_hold_status_rows(rows)
        assert len(res) == 1
        assert res[0]["plantId"] == "IE10"
        assert res[0]["storageLocationId"] == "SL01"
        assert res[0]["materialId"] == "MAT01"
        assert res[0]["batchId"] == "B01"
        assert res[0]["uom"] == "KG"
        assert res[0]["unrestrictedQuantity"] == 1000.0
        assert res[0]["blockedQuantity"] == 100.0
        assert res[0]["restrictedQuantity"] == 0.0
        assert res[0]["totalQuantity"] == 1100.0
        assert res[0]["stockType"] == "blocked"
        assert res[0]["hasBlockingHold"] is True
        assert "2026-06-10T00:00:00" in res[0]["lastUpdatedAt"]

    def test_map_staging_readiness_rows(self) -> None:
        rows = [{
            "plant_id": "IE10",
            "plan_date": "2026-06-10",
            "total_orders": 10,
            "fully_staged": 6,
            "partially_staged": 3,
            "not_staged": 1,
            "blocked": 2
        }]
        res = map_warehouse_staging_readiness_rows(rows)
        assert len(res) == 1
        assert res[0]["plantId"] == "IE10"
        assert res[0]["planDate"] == "2026-06-10"
        assert res[0]["totalOrders"] == 10
        assert res[0]["fullyStaged"] == 6
        assert res[0]["partiallyStaged"] == 3
        assert res[0]["notStaged"] == 1
        assert res[0]["blocked"] == 2


class TestQuerySpecCategoryBFiltering:
    def test_stock_zones_with_filters(self) -> None:
        req = WarehouseStockZonesRequest(
            warehouse_id="WH01",
            plant_id="PL10",
            limit=250,
        )
        spec = get_warehouse_stock_zones_spec(req)
        assert spec.params["warehouse_id"] == "WH01"
        assert spec.params["plant_id"] == "PL10"
        assert "warehouse_number = :warehouse_id" in spec.sql
        assert "plant_id = :plant_id" in spec.sql
        assert "LIMIT 250" in spec.sql

    def test_batch_hold_status_with_filters(self) -> None:
        req = WarehouseBatchHoldStatusRequest(
            batch_id="B01",
            plant_id="PL10",
        )
        spec = get_warehouse_batch_hold_status_spec(req)
        assert spec.params["batch_id"] == "B01"
        assert spec.params["plant_id"] == "PL10"
        assert "batch_id = :batch_id" in spec.sql
        assert "plant_id = :plant_id" in spec.sql

    def test_staging_readiness_with_filters(self) -> None:
        req = WarehouseStagingReadinessRequest(
            plant_id="PL10",
            plan_date="2026-06-10",
        )
        spec = get_warehouse_staging_readiness_spec(req)
        assert spec.params["plant_id"] == "PL10"
        assert spec.params["plan_date"] == "2026-06-10"
        assert "plant_id = :plant_id" in spec.sql
        assert "plan_date = CAST(:plan_date AS DATE)" in spec.sql
