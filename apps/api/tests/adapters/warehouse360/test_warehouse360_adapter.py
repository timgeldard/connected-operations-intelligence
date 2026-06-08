"""Tests for the Warehouse360 Databricks adapter."""
import pytest
from adapters.warehouse360.warehouse360_databricks_adapter import (
    WarehouseExceptionRequest,
    WarehouseInboundRequest,
    WarehouseOutboundRequest,
    WarehouseOverviewRequest,
    WarehouseStagingRequest,
    _format_datetime,
    _get_source_mode,
    _map_exception_severity,
    _safe_float,
    _safe_int,
    get_warehouse_exceptions_spec,
    get_warehouse_inbound_spec,
    get_warehouse_outbound_spec,
    get_warehouse_overview_spec,
    get_warehouse_staging_spec,
    map_warehouse_exceptions_rows,
    map_warehouse_inbound_rows,
    map_warehouse_outbound_rows,
    map_warehouse_overview_rows,
    map_warehouse_staging_rows,
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
]

ACTIVE_LEGACY_SPECS = [
    (get_warehouse_overview_spec, WarehouseOverviewRequest("WH01"), "wh360_kpi_snapshot_v"),
    (get_warehouse_inbound_spec, WarehouseInboundRequest("WH01"), "wh360_inbound_v"),
    (get_warehouse_outbound_spec, WarehouseOutboundRequest("WH01"), "wh360_deliveries_v"),
    (get_warehouse_staging_spec, WarehouseStagingRequest("WH01"), "wh360_process_orders_v"),
    (get_warehouse_exceptions_spec, WarehouseExceptionRequest("WH01"), "imwm_exceptions_v"),
]

# ---------------------------------------------------------------------------
# Fixtures & Shared Context
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _set_wh360_catalog(monkeypatch):
    monkeypatch.setenv("WH360_CATALOG", "wh360_uat_catalog")
    monkeypatch.setenv("WH360_SCHEMA", "wh360_uat_schema")
    monkeypatch.setenv("WAREHOUSE360_SOURCE_MODE", "legacy_wh360")


class TestWarehouse360SourceMode:
    @pytest.mark.parametrize(
        "contract_id,spec_factory,warehouse_request,source_view",
        ACTIVE_GOVERNED_SPECS,
    )
    def test_governed_contract_mode_sets_contract_id(
        self,
        monkeypatch,
        contract_id,
        spec_factory,
        warehouse_request,
        source_view,
    ) -> None:
        monkeypatch.setenv("WAREHOUSE360_SOURCE_MODE", "governed_contracts")

        spec = spec_factory(warehouse_request)

        assert spec.contract_id == contract_id
        assert source_view in spec.sql
        for _, _, legacy_view in ACTIVE_LEGACY_SPECS:
            assert legacy_view not in spec.sql

    @pytest.mark.parametrize(
        "spec_factory,warehouse_request,legacy_view",
        ACTIVE_LEGACY_SPECS,
    )
    def test_legacy_mode_resolves_legacy_views(self, spec_factory, warehouse_request, legacy_view) -> None:
        spec = spec_factory(warehouse_request)

        assert spec.contract_id is None
        assert legacy_view in spec.sql
        assert "`wh360_uat_catalog`.`wh360_uat_schema`" in spec.sql

    def test_missing_source_mode_fails_clearly(self, monkeypatch) -> None:
        monkeypatch.delenv("WAREHOUSE360_SOURCE_MODE", raising=False)

        with pytest.raises(DatabricksConfigError, match="WAREHOUSE360_SOURCE_MODE"):
            _get_source_mode()

    def test_invalid_source_mode_fails_clearly(self, monkeypatch) -> None:
        monkeypatch.setenv("WAREHOUSE360_SOURCE_MODE", "mock")

        with pytest.raises(DatabricksConfigError, match="legacy_wh360.*governed_contracts"):
            _get_source_mode()


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
        assert "wh360_kpi_snapshot_v" in spec.sql
        assert "`wh360_uat_catalog`.`wh360_uat_schema`.`wh360_kpi_snapshot_v`" in spec.sql
        assert "WHERE" not in spec.sql

    def test_missing_catalog_raises_error(self, monkeypatch) -> None:
        monkeypatch.delenv("WH360_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_warehouse_overview_spec(WarehouseOverviewRequest("WH01"))


class TestWarehouseInboundSpec:
    def test_spec_properties(self) -> None:
        spec = get_warehouse_inbound_spec(WarehouseInboundRequest("WH01"))
        assert spec.name == "warehouse360.get_inbound"
        assert spec.module == "wh360"
        assert spec.endpoint == "/api/warehouse360/inbound"
        assert spec.cache_policy == CacheTier.PER_USER_60S
        # The view does not expose LGNUM — warehouse_id is accepted but the
        # SQL no longer filters on it (documented in the source-verification doc).
        assert "warehouse_id" not in spec.params
        assert "wh360_inbound_v" in spec.sql
        assert "`wh360_uat_catalog`.`wh360_uat_schema`.`wh360_inbound_v`" in spec.sql

    def test_spec_uses_actual_wh360_inbound_v_columns(self) -> None:
        """Pin the source-verified column names so a regression cannot
        silently revert to the broken upper-case identifiers."""
        spec = get_warehouse_inbound_spec(WarehouseInboundRequest("WH01"))
        for actual_col in ("po_id", "po_item", "doc_type", "vendor_id",
                           "plant_id", "storage_loc", "material_id", "material_name",
                           "ordered_qty", "gr_qty", "open_qty", "uom",
                           "delivery_date", "delivery_complete", "qa_lot_id", "qa_status"):
            assert actual_col in spec.sql, f"missing source column {actual_col!r}"
        # Old broken UPPER_CASE identifiers must NOT come back.
        for broken_col in ("DOCUMENT_TYPE", "PURCHASE_ORDER_ID", "WAREHOUSE_NUMBER",
                           "EXPECTED_DATE", "QUANTITY", "UNIT_OF_MEASURE",
                           "EXCEPTION_REASON"):
            assert broken_col not in spec.sql, f"broken column {broken_col!r} leaked back into SQL"


class TestWarehouseOutboundSpec:
    def test_spec_properties(self) -> None:
        spec = get_warehouse_outbound_spec(WarehouseOutboundRequest("WH01"))
        assert spec.name == "warehouse360.get_outbound"
        assert spec.module == "wh360"
        assert spec.endpoint == "/api/warehouse360/outbound"
        assert spec.cache_policy == CacheTier.PER_USER_60S
        # warehouse_id is bound symmetrically — present in params iff supplied.
        assert spec.params["warehouse_id"] == "WH01"
        assert "lgnum = :warehouse_id" in spec.sql
        assert "wh360_deliveries_v" in spec.sql
        assert "`wh360_uat_catalog`.`wh360_uat_schema`.`wh360_deliveries_v`" in spec.sql

    def test_spec_uses_actual_wh360_deliveries_v_columns(self) -> None:
        """Pin the source-verified column names so a regression cannot
        silently revert to the broken upper-case identifiers."""
        spec = get_warehouse_outbound_spec(WarehouseOutboundRequest("WH01"))
        for actual_col in ("delivery_id", "delivery_type", "plant_id",
                           "customer_id", "customer_name", "carrier",
                           "lgnum", "planned_gi_date", "actual_gi_date",
                           "loading_date", "delivery_date", "gross_weight",
                           "weight_uom", "packages", "wm_status",
                           "mins_to_cutoff", "pick_pct", "line_count",
                           "risk", "shipped"):
            assert actual_col in spec.sql, f"missing source column {actual_col!r}"
        # Old broken UPPER_CASE identifiers must NOT come back.
        for broken_col in ("DELIVERY_ITEM_ID", "SALES_ORDER_ID",
                           "MATERIAL_ID", "MATERIAL_DESCRIPTION", "BATCH_ID",
                           "STORAGE_LOCATION", "WAREHOUSE_NUMBER",
                           "PLANNED_GOODS_ISSUE_DATE",
                           "ACTUAL_GOODS_ISSUE_DATE",
                           "UNIT_OF_MEASURE", "EXCEPTION_REASON"):
            assert broken_col not in spec.sql, f"broken column {broken_col!r} leaked back into SQL"

    def test_spec_optional_filters_bound_symmetrically(self) -> None:
        """Every :placeholder must have a matching params key (and vice versa)
        across the supplied/absent combinations."""
        # No optional filters supplied — only warehouse_id is bound.
        spec = get_warehouse_outbound_spec(WarehouseOutboundRequest("WH01"))
        assert set(spec.params) == {"warehouse_id"}
        for absent in (":plant_id", ":date_from", ":date_to"):
            assert absent not in spec.sql, f"unbound placeholder {absent} present"
        # All optional filters supplied — every placeholder is bound.
        spec = get_warehouse_outbound_spec(WarehouseOutboundRequest(
            "WH01", plant_id="PL10", date_from="2026-05-01", date_to="2026-05-31",
        ))
        for key in ("warehouse_id", "plant_id", "date_from", "date_to"):
            assert key in spec.params, f"missing param {key!r}"
            assert f":{key}" in spec.sql, f"missing placeholder :{key}"


class TestWarehouseStagingSpec:
    def test_spec_properties(self) -> None:
        spec = get_warehouse_staging_spec(WarehouseStagingRequest("WH01"))
        assert spec.name == "warehouse360.get_staging"
        assert spec.module == "wh360"
        assert spec.endpoint == "/api/warehouse360/staging"
        assert spec.cache_policy == CacheTier.PER_USER_60S
        # The view does not expose LGNUM — warehouse_id is accepted but not filtered.
        assert "warehouse_id" not in spec.params
        # Source-verification §3 — target view is wh360_process_orders_v.
        assert "wh360_process_orders_v" in spec.sql
        assert "`wh360_uat_catalog`.`wh360_uat_schema`.`wh360_process_orders_v`" in spec.sql
        # Stale non-existent view name MUST NOT come back.
        assert "staging_orders_v" not in spec.sql

    def test_spec_uses_actual_wh360_process_orders_v_columns(self) -> None:
        spec = get_warehouse_staging_spec(WarehouseStagingRequest("WH01"))
        for actual_col in ("order_id", "sap_order", "reservation_no", "material_id",
                           "material_name", "batch_id", "plant_id", "uom", "order_qty",
                           "sched_start", "sched_finish", "staging_pct",
                           "to_items_total", "to_items_done", "mins_to_start", "risk"):
            assert actual_col in spec.sql, f"missing source column {actual_col!r}"
        # Old broken UPPER_CASE identifiers must NOT regress.
        for broken_col in ("PROCESS_ORDER_ID", "RESERVATION_ID", "RESERVATION_ITEM_ID",
                           "WAREHOUSE_NUMBER", "REQUIREMENT_DATE", "REQUIRED_QUANTITY",
                           "STAGED_QUANTITY", "OPEN_QUANTITY", "STAGING_STATUS",
                           "EXCEPTION_REASON"):
            assert broken_col not in spec.sql, f"broken column {broken_col!r} leaked back"


class TestWarehouseExceptionsSpec:
    def test_spec_properties(self) -> None:
        spec = get_warehouse_exceptions_spec(WarehouseExceptionRequest("WH01"))
        assert spec.name == "warehouse360.get_exceptions"
        assert spec.module == "wh360"
        assert spec.endpoint == "/api/warehouse360/exceptions"
        assert spec.cache_policy == CacheTier.PER_USER_60S
        # The view does not expose LGNUM — warehouse_id is accepted but not filtered.
        assert "warehouse_id" not in spec.params
        # Source-verification §3 — target view is imwm_exceptions_v (no wh360_ prefix).
        assert "imwm_exceptions_v" in spec.sql
        assert "`wh360_uat_catalog`.`wh360_uat_schema`.`imwm_exceptions_v`" in spec.sql
        # Stale non-existent view name MUST NOT come back.
        assert "wh360_imwm_exceptions_v" not in spec.sql

    def test_spec_uses_actual_imwm_exceptions_v_columns(self) -> None:
        spec = get_warehouse_exceptions_spec(WarehouseExceptionRequest("WH01"))
        for actual_col in ("exception_type", "severity", "sla_hours", "material_id",
                           "material_name", "plant_id", "storage_loc", "storage_loc_name",
                           "qty", "batch_id", "bin_id", "detail_text", "detected_date"):
            assert actual_col in spec.sql, f"missing source column {actual_col!r}"
        # Old broken UPPER_CASE identifiers must NOT regress.
        for broken_col in ("EXCEPTION_TYPE", "EXPIRY_DATE", "DAYS_TO_EXPIRY",
                           "DOCUMENT_ID", "PROCESS_ORDER_ID", "DELIVERY_ID",
                           "PURCHASE_ORDER_ID", "RECOMMENDED_REVIEW_ACTION",
                           "WAREHOUSE_NUMBER"):
            assert broken_col not in spec.sql, f"broken column {broken_col!r} leaked back"


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
        # Lower-case actual column names from wh360_inbound_v.
        assert "plant_id = :plant_id" in spec.sql
        assert "delivery_date >= :date_from" in spec.sql
        assert "delivery_date <= :date_to" in spec.sql
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
        assert spec.params["warehouse_id"] == "WH01"
        assert spec.params["plant_id"] == "PL10"
        assert spec.params["date_from"] == "2026-05-01"
        assert spec.params["date_to"] == "2026-05-31"
        # Lower-case actual column names from wh360_deliveries_v.
        assert "lgnum = :warehouse_id" in spec.sql
        assert "plant_id = :plant_id" in spec.sql
        # Date filter targets planned_gi_date (the live ``string`` column).
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
        # Lower-case actual column names from wh360_process_orders_v.
        assert "plant_id = :plant_id" in spec.sql
        # Date filter targets sched_start (documented in source-verification §3.1).
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
        # Lower-case actual column names from imwm_exceptions_v.
        assert "plant_id = :plant_id" in spec.sql
        # Date filter targets detected_date (semantic shift from non-existent
        # EXPIRY_DATE — documented in source-verification §3.1).
        assert "detected_date >= :date_from" in spec.sql
        assert "detected_date <= :date_to" in spec.sql
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

    def test_map_exception_severity_by_days(self) -> None:
        # days < 0 (expired) -> critical
        assert _map_exception_severity("low", -3) == "critical"
        # days <= 7 -> high
        assert _map_exception_severity("low", 5) == "high"
        # days <= 30 -> medium
        assert _map_exception_severity("low", 25) == "medium"
        # else -> low
        assert _map_exception_severity("high", 45) == "low"

    def test_map_exception_severity_by_raw_string(self) -> None:
        assert _map_exception_severity("critical", None) == "critical"
        assert _map_exception_severity("high", None) == "high"
        assert _map_exception_severity("warning", None) == "medium"
        assert _map_exception_severity("caution", None) == "low"
        assert _map_exception_severity("unknown", None) == "low"


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

    def test_map_overview_near_expiry_count_not_in_output(self) -> None:
        """nearExpiryCount requires a governed near-expiry business rule (Gate 4).
        Must not be defaulted to zero — absent means governance-pending."""
        rows = [{
            "orders_total": 24, "orders_red": 0, "orders_amber": 0,
            "trs_open": 0, "tos_open": 0, "deliveries_today": 0,
            "deliveries_at_risk": 0, "inbound_open": 0,
            "bins_blocked": 0, "bins_total": 0, "bin_util_pct": 0.0,
        }]
        res = map_warehouse_overview_rows(rows, WarehouseOverviewRequest("WH01"))
        assert "nearExpiryCount" not in res

    def test_map_overview_reconciliation_exception_count_not_in_output(self) -> None:
        """reconciliationExceptionCount requires governed IM/WM reconciliation rules (Gate 5).
        Must not be defaulted to zero — absent means governance-pending."""
        rows = [{
            "orders_total": 24, "orders_red": 0, "orders_amber": 0,
            "trs_open": 0, "tos_open": 0, "deliveries_today": 0,
            "deliveries_at_risk": 0, "inbound_open": 0,
            "bins_blocked": 0, "bins_total": 0, "bin_util_pct": 0.0,
        }]
        res = map_warehouse_overview_rows(rows, WarehouseOverviewRequest("WH01"))
        assert "reconciliationExceptionCount" not in res

    def test_map_overview_empty_rows_near_expiry_count_not_defaulted_to_zero(self) -> None:
        """Even in the no-data default shape, nearExpiryCount must not appear as zero."""
        res = map_warehouse_overview_rows([], WarehouseOverviewRequest("WH01"))
        assert "nearExpiryCount" not in res

    def test_map_overview_empty_rows_reconciliation_exception_count_not_defaulted_to_zero(self) -> None:
        """Even in the no-data default shape, reconciliationExceptionCount must not appear as zero."""
        res = map_warehouse_overview_rows([], WarehouseOverviewRequest("WH01"))
        assert "reconciliationExceptionCount" not in res

    def test_map_inbound_rows_preserves_sap_ids(self) -> None:
        # Row shape matches actual wh360_inbound_v columns.
        rows = [{
            "po_id": "0045001234",
            "po_item": "00010",
            "doc_type": "PO",
            "doc_cat": "F",
            "vendor_id": "0008100123",
            "vendor_name": "Dairy Supplier Ltd",
            "plant_id": "IE10",
            "storage_loc": "SL01",
            "material_id": "000000000000821034",
            "material_name": "Raw Milk",
            "ordered_qty": 25000.0,
            "gr_qty": 0.0,
            "open_qty": 25000.0,
            "uom": "L",
            "delivery_date": "2026-05-18",
            "po_date": "2026-05-10",
            "delivery_complete": "N",
            "qa_lot_id": None,
            "qa_status": None,
        }]
        res = map_warehouse_inbound_rows(rows)
        assert len(res) == 1
        item = res[0]
        assert item["documentType"] == "PO"
        assert item["purchaseOrderId"] == "0045001234"
        assert item["materialId"] == "000000000000821034"
        # Inbound PO lines have no GR-batch until receipt — null is source-truthful.
        assert item["batchId"] is None
        assert item["expectedDate"] == "2026-05-18T00:00:00"

    # ------------------------------------------------------------------
    # Source-truthful inbound mapper guardrails (Gate 1 implementation).
    # ------------------------------------------------------------------

    def test_inbound_status_open_when_delivery_incomplete(self) -> None:
        rows = [{
            "po_id": "P1", "doc_type": "PO", "material_id": "M1",
            "delivery_complete": "N", "open_qty": 100.0, "uom": "KG",
        }]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["status"] == "open"
        # Not received → no received date.
        assert res[0]["receivedDate"] is None

    def test_inbound_status_received_when_delivery_complete(self) -> None:
        rows = [{
            "po_id": "P1", "doc_type": "PO", "material_id": "M1",
            "delivery_complete": "Y", "open_qty": 0.0, "uom": "KG",
            "delivery_date": "2026-05-18",
        }]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["status"] == "received"
        # Received → receivedDate echoes delivery_date.
        assert res[0]["receivedDate"] is not None
        assert "2026-05-18" in res[0]["receivedDate"]

    def test_inbound_status_none_when_neither_open_nor_received(self) -> None:
        """delivery_complete='' and open_qty=0 means the lifecycle isn't
        meaningful here. Source-truthful: return None rather than guess."""
        rows = [{
            "po_id": "P1", "doc_type": "PO", "material_id": "M1",
            "delivery_complete": "", "open_qty": 0.0, "uom": "KG",
        }]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["status"] is None

    def test_inbound_warehouse_number_is_null_not_invented(self) -> None:
        """wh360_inbound_v has no LGNUM/warehouse_number column. Mapper
        must emit None, not the request's warehouse_id or an empty string."""
        rows = [{"po_id": "P1", "doc_type": "PO", "material_id": "M1"}]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["warehouseNumber"] is None

    def test_inbound_sto_fields_are_null(self) -> None:
        """STO identifier and supplying plant are absent in this view."""
        rows = [{"po_id": "P1", "doc_type": "PO", "material_id": "M1"}]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["stockTransportOrderId"] is None
        assert res[0]["supplyingPlantId"] is None

    def test_inbound_exception_reason_is_null(self) -> None:
        """Exceptions live in imwm_exceptions_v — never invent one here."""
        rows = [{"po_id": "P1", "doc_type": "PO", "material_id": "M1"}]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["exceptionReason"] is None

    def test_inbound_unit_of_measure_not_defaulted(self) -> None:
        """No UOM in source → null. Mapper MUST NOT default to 'KG'."""
        rows = [{"po_id": "P1", "doc_type": "PO", "material_id": "M1", "uom": None}]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["unitOfMeasure"] is None
        rows = [{"po_id": "P1", "doc_type": "PO", "material_id": "M1", "uom": ""}]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["unitOfMeasure"] is None

    def test_inbound_document_type_unknown_for_unrecognised_codes(self) -> None:
        for raw in (None, "", "MYSTERY", "XYZ"):
            rows = [{"po_id": "P1", "doc_type": raw, "material_id": "M1"}]
            res = map_warehouse_inbound_rows(rows)
            assert res[0]["documentType"] == "unknown", f"doc_type={raw!r} leaked"

    def test_inbound_document_type_sto_when_source_says_sto(self) -> None:
        rows = [{"po_id": "P1", "doc_type": "STO", "material_id": "M1"}]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["documentType"] == "STO"

    def test_inbound_quantity_maps_to_open_qty(self) -> None:
        """The contract has a single `quantity` field. We map it to
        `open_qty` (still-due quantity) — the most useful value for the
        inbound cockpit panel. The decision is documented in the
        source-verification doc."""
        rows = [{
            "po_id": "P1", "doc_type": "PO", "material_id": "M1",
            "ordered_qty": 1000.0, "gr_qty": 300.0, "open_qty": 700.0,
        }]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["quantity"] == 700.0

    def test_inbound_quantity_null_when_open_qty_absent(self) -> None:
        rows = [{"po_id": "P1", "doc_type": "PO", "material_id": "M1", "open_qty": None}]
        res = map_warehouse_inbound_rows(rows)
        assert res[0]["quantity"] is None

    def test_inbound_does_not_emit_invented_business_fields(self) -> None:
        """No 'safe' / 'approved' / 'released' / 'cleared' / 'overdue' /
        'due' fields invented on the wire."""
        rows = [{"po_id": "P1", "doc_type": "PO", "material_id": "M1", "delivery_complete": "Y"}]
        res = map_warehouse_inbound_rows(rows)
        for forbidden in ("safe", "approved", "released", "cleared", "overdue", "due", "recallRecommended"):
            assert forbidden not in res[0]

    def test_map_outbound_rows_preserves_sap_ids(self) -> None:
        # Row shape matches actual wh360_deliveries_v columns.
        rows = [{
            "delivery_id": "0080047212",
            "delivery_type": "LF",
            "plant_id": "IE10",
            "customer_id": "0003829100",
            "customer_name": "Acme Foods Ltd",
            "carrier": "DHL",
            "lgnum": "WH01",
            "planned_gi_date": "2026-05-18 15:00:00",
            "actual_gi_date": None,
            "loading_date": "2026-05-18 14:00:00",
            "delivery_date": "2026-05-19",
            "gross_weight": 960.0,
            "weight_uom": "KG",
            "packages": "12",
            "wm_status": "OPEN",
            "mins_to_cutoff": 90.0,
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
        assert item["plantId"] == "IE10"
        assert item["warehouseNumber"] == "WH01"
        # planned_gi_date is `string`-typed in the source; _format_datetime
        # normalises the space separator into ISO 8601.
        assert item["plannedGoodsIssueDate"] == "2026-05-18T15:00:00"
        # quantity ← gross_weight; unitOfMeasure ← weight_uom (documented
        # in source-verification doc §4).
        assert item["quantity"] == 960.0
        assert item["unitOfMeasure"] == "KG"
        # status echoes wm_status verbatim.
        assert item["status"] == "OPEN"

    # ------------------------------------------------------------------
    # Source-truthful outbound mapper guardrails (parity with inbound /
    # staging gates — Databricks compatibility audit follow-up
    # 2026-05-25).
    # ------------------------------------------------------------------

    def test_outbound_line_grain_fields_are_null_not_invented(self) -> None:
        """wh360_deliveries_v is delivery-header grain. Line-item /
        material / batch identifiers are absent — the mapper must emit
        None, not empty strings or invented values."""
        rows = [{"delivery_id": "D1", "plant_id": "PL10"}]
        res = map_warehouse_outbound_rows(rows)
        assert res[0]["deliveryItemId"] is None
        assert res[0]["salesOrderId"] is None
        assert res[0]["materialDescription"] is None
        assert res[0]["batchId"] is None
        assert res[0]["storageLocation"] is None
        assert res[0]["exceptionReason"] is None

    def test_outbound_material_id_is_contract_required_empty_string(self) -> None:
        """The generated Warehouse360OutboundItem.materialId is a required
        string. The header-grain source has no material identifier, so
        the mapper emits "" to keep the response body shape stable.
        Relaxing the contract is tracked as a follow-up in the
        source-verification doc §5."""
        rows = [{"delivery_id": "D1"}]
        res = map_warehouse_outbound_rows(rows)
        assert res[0]["materialId"] == ""

    def test_outbound_warehouse_number_maps_to_lgnum(self) -> None:
        rows = [{"delivery_id": "D1", "lgnum": "WH42"}]
        res = map_warehouse_outbound_rows(rows)
        assert res[0]["warehouseNumber"] == "WH42"

    def test_outbound_warehouse_number_null_when_lgnum_missing(self) -> None:
        """lgnum may be null in some rows — the mapper must NOT fall back
        to the request's warehouse_id or any invented value."""
        for raw in (None, ""):
            rows = [{"delivery_id": "D1", "lgnum": raw}]
            res = map_warehouse_outbound_rows(rows)
            assert res[0]["warehouseNumber"] is None

    def test_outbound_planned_gi_date_null_when_source_missing(self) -> None:
        rows = [{"delivery_id": "D1", "planned_gi_date": None}]
        res = map_warehouse_outbound_rows(rows)
        assert res[0]["plannedGoodsIssueDate"] is None

    def test_outbound_actual_gi_date_null_when_source_missing(self) -> None:
        rows = [{"delivery_id": "D1", "actual_gi_date": None}]
        res = map_warehouse_outbound_rows(rows)
        assert res[0]["actualGoodsIssueDate"] is None

    def test_outbound_quantity_maps_to_gross_weight(self) -> None:
        """quantity ← gross_weight (application-derived — see
        source-verification doc §4). unitOfMeasure ← weight_uom so the
        unit is explicit on the wire."""
        rows = [{"delivery_id": "D1", "gross_weight": 1250.5, "weight_uom": "KG"}]
        res = map_warehouse_outbound_rows(rows)
        assert res[0]["quantity"] == 1250.5
        assert res[0]["unitOfMeasure"] == "KG"

    def test_outbound_quantity_null_when_gross_weight_missing(self) -> None:
        rows = [{"delivery_id": "D1", "gross_weight": None}]
        res = map_warehouse_outbound_rows(rows)
        assert res[0]["quantity"] is None

    def test_outbound_unit_of_measure_null_when_weight_uom_missing(self) -> None:
        """No UOM in source → null. Mapper MUST NOT default to 'KG'."""
        for raw in (None, ""):
            rows = [{"delivery_id": "D1", "weight_uom": raw}]
            res = map_warehouse_outbound_rows(rows)
            assert res[0]["unitOfMeasure"] is None

    def test_outbound_status_echoes_wm_status_verbatim(self) -> None:
        """wm_status is the source-truthful status — not coerced into a
        governed enum here."""
        for raw in ("OPEN", "PICKED", "PACKED", "SHIPPED"):
            rows = [{"delivery_id": "D1", "wm_status": raw}]
            res = map_warehouse_outbound_rows(rows)
            assert res[0]["status"] == raw

    def test_outbound_status_null_when_wm_status_missing(self) -> None:
        for raw in (None, ""):
            rows = [{"delivery_id": "D1", "wm_status": raw}]
            res = map_warehouse_outbound_rows(rows)
            assert res[0]["status"] is None

    def test_outbound_does_not_emit_invented_business_fields(self) -> None:
        """No 'safe' / 'approved' / 'released' / 'cleared' / 'recallRecommended'
        / 'shipped' / 'risk' fields invented on the wire — the contract
        does not surface them, so they must not appear."""
        rows = [{"delivery_id": "D1", "risk": "amber", "shipped": False}]
        res = map_warehouse_outbound_rows(rows)
        for forbidden in ("safe", "approved", "released", "cleared",
                          "overdue", "due", "recallRecommended", "risk",
                          "shipped", "onTime"):
            assert forbidden not in res[0]

    def test_map_staging_rows_preserves_sap_ids(self) -> None:
        # Row shape matches actual wh360_process_orders_v columns.
        rows = [{
            "order_id": "000700123456",
            "sap_order": "PROD-700123456",
            "reservation_no": "0000123456",
            "material_id": "000000000000840123",
            "material_name": "Starter Culture B10",
            "batch_id": "0000987654",
            "plant_id": "IE10",
            "uom": "KG",
            "order_qty": 2.5,
            "planned_start": "2026-05-18 08:30:00",
            "planned_finish": "2026-05-18 18:30:00",
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
        # sap_order is preferred over order_id (source-verification §3.1).
        assert item["processOrderId"] == "PROD-700123456"
        assert item["materialId"] == "000000000000840123"
        # Derived from order_qty * (1 - staging_pct): 2.5 * 0.2 = 0.5
        assert item["openQuantity"] == 0.5

    # ------------------------------------------------------------------
    # Source-truthful staging mapper guardrails (Gate 2 implementation).
    # ------------------------------------------------------------------

    def test_staging_process_order_id_prefers_sap_order(self) -> None:
        rows = [{"order_id": "INT-1", "sap_order": "PROD-1", "material_id": "M1"}]
        res = map_warehouse_staging_rows(rows)
        assert res[0]["processOrderId"] == "PROD-1"

    def test_staging_process_order_id_falls_back_to_order_id(self) -> None:
        rows = [{"order_id": "INT-1", "sap_order": None, "material_id": "M1"}]
        res = map_warehouse_staging_rows(rows)
        assert res[0]["processOrderId"] == "INT-1"

    def test_staging_reservation_item_id_is_null_not_invented(self) -> None:
        """wh360_process_orders_v has no per-line reservation field —
        unresolved-pending-source per the verification doc."""
        rows = [{"material_id": "M1", "reservation_no": "R1"}]
        res = map_warehouse_staging_rows(rows)
        assert res[0]["reservationItemId"] is None

    def test_staging_storage_location_is_null_not_invented(self) -> None:
        rows = [{"material_id": "M1"}]
        res = map_warehouse_staging_rows(rows)
        assert res[0]["storageLocation"] is None

    def test_staging_warehouse_number_is_null_not_invented(self) -> None:
        rows = [{"material_id": "M1"}]
        res = map_warehouse_staging_rows(rows)
        assert res[0]["warehouseNumber"] is None

    def test_staging_exception_reason_is_null_not_invented(self) -> None:
        """Exceptions belong to imwm_exceptions_v, not here."""
        rows = [{"material_id": "M1"}]
        res = map_warehouse_staging_rows(rows)
        assert res[0]["exceptionReason"] is None

    def test_staging_unit_of_measure_not_defaulted(self) -> None:
        """No UOM in source → null. Mapper MUST NOT default to 'KG'."""
        for raw in (None, "", 0):
            rows = [{"material_id": "M1", "uom": raw}]
            res = map_warehouse_staging_rows(rows)
            assert res[0]["unitOfMeasure"] is None

    def test_staging_status_derived_from_staging_pct(self) -> None:
        # staging_pct >= 1 → 'staged'; 0 <= staging_pct < 1 → 'open'.
        cases = [
            ({"material_id": "M1", "staging_pct": 0.0}, "open"),
            ({"material_id": "M1", "staging_pct": 0.5}, "open"),
            ({"material_id": "M1", "staging_pct": 0.999}, "open"),
            ({"material_id": "M1", "staging_pct": 1.0}, "staged"),
            ({"material_id": "M1", "staging_pct": 1.5}, "staged"),
        ]
        for row, expected in cases:
            res = map_warehouse_staging_rows([row])
            assert res[0]["stagingStatus"] == expected, f"row={row} expected={expected}"

    def test_staging_status_null_when_staging_pct_absent(self) -> None:
        rows = [{"material_id": "M1", "staging_pct": None}]
        res = map_warehouse_staging_rows(rows)
        assert res[0]["stagingStatus"] is None

    def test_staging_quantities_derived_or_null(self) -> None:
        # Both order_qty and staging_pct present → derived values.
        rows = [{"material_id": "M1", "order_qty": 100.0, "staging_pct": 0.3}]
        res = map_warehouse_staging_rows(rows)
        assert res[0]["requiredQuantity"] == 100.0
        assert res[0]["stagedQuantity"] == 30.0
        assert res[0]["openQuantity"] == 70.0

    def test_staging_quantities_null_when_order_qty_absent(self) -> None:
        rows = [{"material_id": "M1", "order_qty": None, "staging_pct": 0.5}]
        res = map_warehouse_staging_rows(rows)
        assert res[0]["requiredQuantity"] is None
        assert res[0]["stagedQuantity"] is None
        assert res[0]["openQuantity"] is None

    def test_staging_does_not_emit_invented_business_fields(self) -> None:
        rows = [{"material_id": "M1", "staging_pct": 0.5}]
        res = map_warehouse_staging_rows(rows)
        for forbidden in ("safe", "approved", "released", "cleared", "overdue",
                          "due", "recallRecommended", "risk", "onTime"):
            assert forbidden not in res[0]

    def test_map_exceptions_rows_severity(self) -> None:
        """Source severity is an integer with no governed int→enum mapping.
        Mapper emits null rather than inventing a mapping (e.g. 2='high')."""
        # Row shape matches actual imwm_exceptions_v columns.
        rows = [
            {
                "exception_type": "EXPIRED_BATCH_WITH_STOCK",
                "severity": 2,
                "material_id": "MAT01",
                "batch_id": "B01",
                "plant_id": "IE10",
                "storage_loc": "SL01",
                "qty": 20.0,
                "detail_text": "Stock recorded",
                "detected_date": "2026-05-22",
            },
            {
                "exception_type": "QUANTITY_MISMATCH",
                "severity": 1,
                "material_id": "MAT02",
                "batch_id": "B02",
                "plant_id": "IE10",
                "storage_loc": "SL01",
                "qty": 10.0,
                "detail_text": "Mismatch",
                "detected_date": "2026-05-21",
            }
        ]
        res = map_warehouse_exceptions_rows(rows)
        assert len(res) == 2
        # Both severities are integers — no governed int→enum mapping exists.
        # Mapper MUST emit null rather than guess 2='high' or 1='critical'.
        assert res[0]["severity"] is None
        assert res[1]["severity"] is None

    # ------------------------------------------------------------------
    # Source-truthful exceptions mapper guardrails (Gate 3 implementation).
    # ------------------------------------------------------------------

    def test_exceptions_severity_governed_string_passes_through(self) -> None:
        """If the source later provides a governed string severity
        (e.g. after a future int→enum migration), the mapper accepts it."""
        for raw, expected in (("critical", "critical"), ("HIGH", "high"),
                              (" medium ", "medium"), ("low", "low")):
            rows = [{"material_id": "M1", "severity": raw}]
            res = map_warehouse_exceptions_rows(rows)
            assert res[0]["severity"] == expected

    def test_exceptions_unknown_severity_string_yields_null(self) -> None:
        """A string severity outside the contract enum (e.g. 'urgent')
        must NOT be accepted as a governance-safe value."""
        rows = [{"material_id": "M1", "severity": "URGENT"}]
        res = map_warehouse_exceptions_rows(rows)
        assert res[0]["severity"] is None

    def test_exceptions_severity_never_defaults_to_low(self) -> None:
        """The previous _map_exception_severity helper defaulted to 'low'
        as final fallback. The new mapper MUST emit null for any
        ungoverned input."""
        for raw in (None, "", 0, 1, 2, 3, 4, 5, "mystery"):
            rows = [{"material_id": "M1", "severity": raw}]
            res = map_warehouse_exceptions_rows(rows)
            assert res[0]["severity"] != "low", f"severity={raw!r} defaulted to 'low'"

    def test_exceptions_reason_maps_to_detail_text(self) -> None:
        rows = [{"material_id": "M1", "detail_text": "Stock recorded for expired batch"}]
        res = map_warehouse_exceptions_rows(rows)
        assert res[0]["reason"] == "Stock recorded for expired batch"

    def test_exceptions_recommended_review_action_is_null(self) -> None:
        """application-heuristic — leave null until a governed rule engine exists."""
        rows = [{"material_id": "M1", "exception_type": "EXPIRED_BATCH_WITH_STOCK"}]
        res = map_warehouse_exceptions_rows(rows)
        assert res[0]["recommendedReviewAction"] is None

    def test_exceptions_expiry_fields_null_not_invented(self) -> None:
        """imwm_exceptions_v has no expiry_date / days_to_expiry —
        detected_date is when the exception was detected, not when the
        batch expires."""
        rows = [{"material_id": "M1", "detected_date": "2026-05-22"}]
        res = map_warehouse_exceptions_rows(rows)
        assert res[0]["expiryDate"] is None
        assert res[0]["daysToExpiry"] is None

    def test_exceptions_document_linkage_fields_null_not_invented(self) -> None:
        """No PO/SO/process order/delivery linkage in imwm_exceptions_v."""
        rows = [{"material_id": "M1"}]
        res = map_warehouse_exceptions_rows(rows)
        assert res[0]["documentId"] is None
        assert res[0]["processOrderId"] is None
        assert res[0]["deliveryId"] is None
        assert res[0]["purchaseOrderId"] is None

    def test_exceptions_warehouse_number_is_null_not_invented(self) -> None:
        rows = [{"material_id": "M1"}]
        res = map_warehouse_exceptions_rows(rows)
        assert res[0]["warehouseNumber"] is None

    def test_exceptions_unit_of_measure_is_null(self) -> None:
        """No UOM column on imwm_exceptions_v — null, not 'KG'."""
        rows = [{"material_id": "M1", "qty": 20.0}]
        res = map_warehouse_exceptions_rows(rows)
        assert res[0]["unitOfMeasure"] is None

    def test_exceptions_does_not_emit_invented_business_fields(self) -> None:
        rows = [{"material_id": "M1", "exception_type": "EXPIRED_BATCH_WITH_STOCK"}]
        res = map_warehouse_exceptions_rows(rows)
        for forbidden in ("safe", "approved", "released", "cleared", "recallRecommended",
                          "rootCause", "healthy", "unhealthy"):
            assert forbidden not in res[0]


# ---------------------------------------------------------------------------
# Governed Contracts Mode Tests
# ---------------------------------------------------------------------------

class TestWarehouseGovernedSpecs:
    @pytest.fixture(autouse=True)
    def _set_governed_mode(self, monkeypatch):
        monkeypatch.setenv("WAREHOUSE360_SOURCE_MODE", "governed_contracts")

    def test_overview_governed_spec(self) -> None:
        spec = get_warehouse_overview_spec(WarehouseOverviewRequest("WH01"))
        assert spec.contract_id == "warehouse360.overview"
        assert "vw_consumption_warehouse360_overview" in spec.sql
        assert "`wh360_uat_catalog`.`wh360_uat_schema`.`vw_consumption_warehouse360_overview`" in spec.sql

    def test_inbound_governed_spec(self) -> None:
        spec = get_warehouse_inbound_spec(WarehouseInboundRequest("WH01"))
        assert spec.contract_id == "warehouse360.inbound_backlog"
        assert "vw_consumption_warehouse360_inbound_backlog" in spec.sql
        # Check that ONLY governed columns are selected, and no legacy ones like doc_cat, delivery_complete, qa_lot_id
        assert "doc_cat" not in spec.sql
        assert "delivery_complete" not in spec.sql
        assert "qa_lot_id" not in spec.sql
        assert "inbound_backlog_risk_band" in spec.sql

    def test_outbound_governed_spec(self) -> None:
        spec = get_warehouse_outbound_spec(WarehouseOutboundRequest("WH01"))
        assert spec.contract_id == "warehouse360.outbound_backlog"
        assert "vw_consumption_warehouse360_outbound_backlog" in spec.sql
        assert "loading_date" not in spec.sql
        assert "pick_pct" in spec.sql

    def test_staging_governed_spec(self) -> None:
        spec = get_warehouse_staging_spec(WarehouseStagingRequest("WH01"))
        assert spec.contract_id == "warehouse360.staging_workload"
        assert "vw_consumption_warehouse360_staging_workload" in spec.sql
        assert "planned_start" not in spec.sql
        assert "sched_start" in spec.sql

    def test_exceptions_governed_spec(self) -> None:
        spec = get_warehouse_exceptions_spec(WarehouseExceptionRequest("WH01"))
        assert spec.contract_id == "warehouse360.im_wm_reconciliation"
        assert "vw_consumption_warehouse360_im_wm_reconciliation" in spec.sql
        assert "material_name" not in spec.sql
        assert "storage_loc_name" not in spec.sql
        # First-wave aggregate re-grain (ADR-0004 D6): storage_loc/bin_id removed from the governed
        # SELECT; pin the reduction so a future edit cannot silently re-add them.
        assert "storage_loc" not in spec.sql
        assert "bin_id" not in spec.sql
