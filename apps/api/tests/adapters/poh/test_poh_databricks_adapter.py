"""Tests for the POH Databricks adapter — QuerySpec factories and row mappers.

Column names verified against live DDL (connected_plant_uat, 2026-05-17):
  vw_gold_process_order, vw_gold_process_order_phase, vw_gold_confirmation,
  vw_gold_adp_movement.
"""
import pytest
from adapters.poh.poh_databricks_adapter import (
    OrderConfirmationsRequest,
    OrderGoodsMovementsRequest,
    OrderOperationsRequest,
    ProcessOrderHeaderRequest,
    _format_datetime,
    _map_movement_direction,
    _map_order_status,
    get_order_confirmations_spec,
    get_order_goods_movements_spec,
    get_order_operations_spec,
    get_process_order_header_spec,
    map_order_confirmations_rows,
    map_order_goods_movements_rows,
    map_order_operations_rows,
    map_process_order_header_rows,
)
from shared.query_service.cache_policy import CacheTier
from shared.query_service.errors import DatabricksConfigError

# ---------------------------------------------------------------------------
# get_process_order_header_spec
# ---------------------------------------------------------------------------

class TestGetProcessOrderHeaderSpec:
    @pytest.fixture(autouse=True)
    def _set_poh_catalog(self, monkeypatch):
        monkeypatch.setenv("POH_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("POH_SCHEMA", "csm_process_order_history")

    def test_name(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert spec.name == "poh.get_process_order_header"

    def test_module(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert spec.module == "poh"

    def test_endpoint(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert spec.endpoint == "/api/por/order-header"

    def test_cache_policy_is_per_user(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert spec.cache_policy == CacheTier.PER_USER_60S

    def test_source_badge(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert spec.source_badge == "databricks-api"

    def test_tags(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "poh" in spec.tags
        assert "process-order" in spec.tags
        assert "header" in spec.tags

    def test_process_order_id_in_params(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert spec.params["process_order_id"] == "100001"

    def test_no_plant_id_param_when_not_provided(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "plant_id" not in spec.params

    def test_no_plant_filter_in_sql_when_not_provided(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert ":plant_id" not in spec.sql

    def test_plant_id_included_in_params_when_provided(self) -> None:
        spec = get_process_order_header_spec(
            ProcessOrderHeaderRequest("100001", plant_id="IE01")
        )
        assert spec.params["plant_id"] == "IE01"

    def test_plant_filter_in_sql_when_plant_id_provided(self) -> None:
        spec = get_process_order_header_spec(
            ProcessOrderHeaderRequest("100001", plant_id="IE01")
        )
        assert "PLANT_ID = :plant_id" in spec.sql

    def test_sql_references_vw_gold_process_order(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "vw_gold_process_order" in spec.sql

    def test_sql_uses_poh_catalog(self) -> None:
        """SQL must include catalog from POH_CATALOG env var."""
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "`connected_plant_uat`" in spec.sql

    def test_sql_uses_poh_schema(self) -> None:
        """SQL must include schema from POH_SCHEMA env var."""
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "`csm_process_order_history`" in spec.sql

    def test_sql_has_no_unqualified_from_vw(self) -> None:
        """SQL must not have bare unqualified FROM vw_gold_process_order."""
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "FROM vw_gold_process_order" not in spec.sql

    def test_sql_has_where_clause_for_order_id(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "PROCESS_ORDER_ID = :process_order_id" in spec.sql

    def test_sql_has_limit(self) -> None:
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "LIMIT :max_rows" in spec.sql

    def test_sql_uses_confirmed_column_names(self) -> None:
        """SQL must use columns confirmed from live DDL (2026-05-17)."""
        spec = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        assert "PROCESS_ORDER_ID" in spec.sql
        assert "STATUS" in spec.sql
        assert "MATERIAL_ID" in spec.sql
        assert "MATERIAL_DESCRIPTION" in spec.sql
        assert "PLANT_ID" in spec.sql

    def test_missing_poh_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("POH_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))


# ---------------------------------------------------------------------------
# get_order_operations_spec
# ---------------------------------------------------------------------------

class TestGetOrderOperationsSpec:
    @pytest.fixture(autouse=True)
    def _set_poh_catalog(self, monkeypatch):
        monkeypatch.setenv("POH_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("POH_SCHEMA", "csm_process_order_history")

    def test_name(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert spec.name == "poh.get_order_operations"

    def test_module(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert spec.module == "poh"

    def test_endpoint(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert spec.endpoint == "/api/por/order-operations"

    def test_cache_policy_is_per_user(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert spec.cache_policy == CacheTier.PER_USER_60S

    def test_tags(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "poh" in spec.tags
        assert "operations" in spec.tags

    def test_process_order_id_in_params(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert spec.params["process_order_id"] == "100001"

    def test_sql_references_vw_gold_process_order_phase(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "vw_gold_process_order_phase" in spec.sql

    def test_sql_uses_poh_catalog(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "`connected_plant_uat`" in spec.sql

    def test_sql_has_no_unqualified_from_vw(self) -> None:
        """SQL must not have bare unqualified FROM vw_gold_process_order_phase."""
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "FROM vw_gold_process_order_phase" not in spec.sql

    def test_sql_has_where_clause_for_order_id(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "PROCESS_ORDER_ID = :process_order_id" in spec.sql

    def test_sql_has_order_by_sort_number(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "ORDER BY SORT_NUMBER" in spec.sql

    def test_sql_has_limit(self) -> None:
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "LIMIT :max_rows" in spec.sql

    def test_sql_uses_confirmed_column_names(self) -> None:
        """SQL must use columns confirmed from live DDL (2026-05-17)."""
        spec = get_order_operations_spec(OrderOperationsRequest("100001"))
        assert "PROCESS_ORDER_PHASE_ID" in spec.sql
        assert "PHASE_ID" in spec.sql
        assert "PHASE_DESCRIPTION" in spec.sql
        assert "OPERATION_QUANTITY" in spec.sql
        assert "SORT_NUMBER" in spec.sql

    def test_missing_poh_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("POH_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_order_operations_spec(OrderOperationsRequest("100001"))

    def test_two_requests_produce_independent_params(self) -> None:
        spec1 = get_process_order_header_spec(ProcessOrderHeaderRequest("100001"))
        spec2 = get_process_order_header_spec(ProcessOrderHeaderRequest("200002"))
        assert spec1.params["process_order_id"] != spec2.params["process_order_id"]


# ---------------------------------------------------------------------------
# map_process_order_header_rows
# ---------------------------------------------------------------------------

class TestMapProcessOrderHeaderRows:
    def _full_row(self) -> dict:
        """Row using confirmed column names from vw_gold_process_order (2026-05-17)."""
        return {
            "process_order_id": "000000100001",
            "order_status_raw": "IN PROGRESS",
            "material_id": "000000000000001234",
            "material_description": "Test Product A",
            "plant_id": "IE01",
            "inspection_lot_id": "LOT001",
        }

    def test_returns_none_for_empty_rows(self) -> None:
        assert map_process_order_header_rows([]) is None

    def test_returns_dict_for_single_row(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert isinstance(result, dict)

    def test_uses_first_row_only(self) -> None:
        row1 = {**self._full_row(), "process_order_id": "111"}
        row2 = {**self._full_row(), "process_order_id": "222"}
        result = map_process_order_header_rows([row1, row2])
        assert result is not None
        assert result["processOrderId"] == "111"

    def test_process_order_id_mapped(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["processOrderId"] == "000000100001"

    def test_leading_zeros_preserved(self) -> None:
        row = {**self._full_row(), "material_id": "000000000000001234"}
        result = map_process_order_header_rows([row])
        assert result is not None
        assert result["materialId"] == "000000000000001234"

    def test_plant_id_mapped(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["plantId"] == "IE01"

    def test_material_description_mapped(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["materialDescription"] == "Test Product A"

    def test_order_status_mapped(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["orderStatus"] == "in-process"

    def test_order_type_defaults_to_process_order(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["orderType"] == "process-order"

    def test_planned_start_defaults_to_none(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["plannedStart"] is None

    def test_planned_finish_defaults_to_none(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["plannedFinish"] is None

    def test_planned_quantity_is_none_when_not_in_view(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["plannedQuantity"] is None

    def test_confirmed_quantity_is_none_when_not_in_view(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["confirmedQuantity"] is None

    def test_uom_is_none_when_not_in_view(self) -> None:
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert result["uom"] is None

    def test_inspection_lot_id_not_in_process_order_header_output(self) -> None:
        """inspection_lot_id is fetched by the SQL but MUST NOT appear in the
        ProcessOrderHeader contract output. Inspection-lot evidence belongs
        to the OrderQualityContext contract (see process-order-review.ts),
        not here. Emitting it would fail response_model validation
        (ProcessOrderHeader has extra='forbid').
        """
        result = map_process_order_header_rows([self._full_row()])
        assert result is not None
        assert "inspectionLotId" not in result

    def test_inspection_lot_id_absent_regardless_of_source_value(self) -> None:
        for raw in ("LOT001", None, ""):
            row = {**self._full_row(), "inspection_lot_id": raw}
            result = map_process_order_header_rows([row])
            assert result is not None
            assert "inspectionLotId" not in result, (
                f"inspectionLotId leaked into ProcessOrderHeader output for inspection_lot_id={raw!r}"
            )


# ---------------------------------------------------------------------------
# _map_order_status
# ---------------------------------------------------------------------------

class TestMapOrderStatus:
    def test_in_progress_maps_to_in_process(self) -> None:
        assert _map_order_status("IN PROGRESS") == "in-process"

    def test_not_started_maps_to_created(self) -> None:
        assert _map_order_status("NOT STARTED") == "created"

    def test_released_maps_to_released(self) -> None:
        assert _map_order_status("RELEASED") == "released"

    def test_completed_maps_to_confirmed(self) -> None:
        assert _map_order_status("COMPLETED") == "confirmed"

    def test_closed_maps_to_closed(self) -> None:
        assert _map_order_status("CLOSED") == "closed"

    def test_cancelled_maps_to_cancelled(self) -> None:
        assert _map_order_status("CANCELLED") == "cancelled"

    # SAP technical code fallbacks (in case view exposes AUOBJ codes)
    def test_rel_maps_to_released(self) -> None:
        assert _map_order_status("REL") == "released"

    def test_crtd_maps_to_created(self) -> None:
        assert _map_order_status("CRTD") == "created"

    def test_teco_maps_to_closed(self) -> None:
        assert _map_order_status("TECO") == "closed"

    def test_none_returns_unknown(self) -> None:
        """Empty/null SAP STATUS surfaces as 'unknown' (source-truthful) —
        not as 'created'. The orderStatus enum was extended to include
        'unknown' so the mapper does not have to invent a process-order
        state when the source is silent."""
        assert _map_order_status(None) == "unknown"

    def test_empty_string_returns_unknown(self) -> None:
        assert _map_order_status("") == "unknown"

    def test_unrecognised_status_returns_unknown(self) -> None:
        """SAP STATUS that does not match any known token surfaces as
        'unknown', not 'created'."""
        assert _map_order_status("UNKNOWN_STATUS") == "unknown"
        assert _map_order_status("MYSTERY") == "unknown"


class TestFormatDatetime:
    def test_iso_datetime_unchanged(self) -> None:
        assert _format_datetime("2024-01-15T06:00:00") == "2024-01-15T06:00:00"

    def test_space_separator_converted_to_t(self) -> None:
        assert _format_datetime("2024-01-15 06:00:00") == "2024-01-15T06:00:00"

    def test_date_only_gets_midnight_appended(self) -> None:
        assert _format_datetime("2024-01-15") == "2024-01-15T00:00:00"

    def test_none_returns_none(self) -> None:
        assert _format_datetime(None) is None


# ---------------------------------------------------------------------------
# map_order_operations_rows
# ---------------------------------------------------------------------------

class TestMapOrderOperationsRows:
    def _full_row(self) -> dict:
        """Row using confirmed column names from vw_gold_process_order_phase (2026-05-17)."""
        return {
            "operation_id": "PHASE-001",
            "operation_number": "0010",
            "operation_text": "Milk Standardisation",
            "operation_detail": "Standardise milk fat content",
            "planned_quantity": 1000.0,
            "uom": "L",
            "sort_number": 10,
            "start_user": "USER01",
            "end_user": "USER01",
        }

    def _pending_row(self) -> dict:
        return {**self._full_row(), "start_user": None, "end_user": None}

    def _in_progress_row(self) -> dict:
        return {**self._full_row(), "end_user": None}

    def test_empty_rows_returns_empty_list(self) -> None:
        assert map_order_operations_rows([]) == []

    def test_returns_list_for_multiple_rows(self) -> None:
        result = map_order_operations_rows([self._full_row(), self._pending_row()])
        assert len(result) == 2

    def test_operation_id_mapped(self) -> None:
        result = map_order_operations_rows([self._full_row()])
        assert result[0]["operationId"] == "PHASE-001"

    def test_operation_number_mapped(self) -> None:
        result = map_order_operations_rows([self._full_row()])
        assert result[0]["operationNumber"] == "0010"

    def test_operation_text_mapped(self) -> None:
        result = map_order_operations_rows([self._full_row()])
        assert result[0]["operationText"] == "Milk Standardisation"

    def test_leading_zeros_preserved_in_operation_id(self) -> None:
        row = {**self._full_row(), "operation_id": "000000000001"}
        result = map_order_operations_rows([row])
        assert result[0]["operationId"] == "000000000001"

    def test_work_centre_is_none_when_not_in_view(self) -> None:
        result = map_order_operations_rows([self._full_row()])
        assert result[0]["workCentre"] is None

    def test_planned_start_defaults_to_none(self) -> None:
        result = map_order_operations_rows([self._full_row()])
        assert result[0]["plannedStart"] is None

    def test_planned_finish_defaults_to_none(self) -> None:
        result = map_order_operations_rows([self._full_row()])
        assert result[0]["plannedFinish"] is None

    def test_planned_duration_is_none_when_not_in_view(self) -> None:
        result = map_order_operations_rows([self._full_row()])
        assert result[0]["plannedDurationMinutes"] is None

    def test_has_exception_defaults_to_false(self) -> None:
        result = map_order_operations_rows([self._full_row()])
        assert result[0]["hasException"] is False

    def test_status_confirmed_when_end_user_set(self) -> None:
        result = map_order_operations_rows([self._full_row()])
        assert result[0]["status"] == "confirmed"

    def test_status_in_progress_when_only_start_user_set(self) -> None:
        result = map_order_operations_rows([self._in_progress_row()])
        assert result[0]["status"] == "in-progress"

    def test_status_pending_when_no_users(self) -> None:
        result = map_order_operations_rows([self._pending_row()])
        assert result[0]["status"] == "pending"

    def test_confirmation_status_final_when_end_user_set(self) -> None:
        result = map_order_operations_rows([self._full_row()])
        assert result[0]["confirmationStatus"] == "final-confirmed"

    def test_confirmation_status_partial_when_only_start_user(self) -> None:
        result = map_order_operations_rows([self._in_progress_row()])
        assert result[0]["confirmationStatus"] == "partially-confirmed"

    def test_confirmation_status_unconfirmed_when_no_users(self) -> None:
        result = map_order_operations_rows([self._pending_row()])
        assert result[0]["confirmationStatus"] == "unconfirmed"

    def test_confirmed_true_when_end_user_set(self) -> None:
        result = map_order_operations_rows([self._full_row()])
        assert result[0]["confirmed"] is True

    def test_confirmed_false_when_in_progress(self) -> None:
        result = map_order_operations_rows([self._in_progress_row()])
        assert result[0]["confirmed"] is False

    def test_confirmed_false_when_pending(self) -> None:
        result = map_order_operations_rows([self._pending_row()])
        assert result[0]["confirmed"] is False

    def test_missing_operation_id_returns_empty_string(self) -> None:
        row = {**self._full_row(), "operation_id": None}
        result = map_order_operations_rows([row])
        assert result[0]["operationId"] == ""

    def test_sort_preserved_across_multiple_rows(self) -> None:
        row1 = {**self._full_row(), "operation_id": "PHASE-001", "sort_number": 10}
        row2 = {**self._full_row(), "operation_id": "PHASE-002", "sort_number": 20, "end_user": None}
        result = map_order_operations_rows([row1, row2])
        assert result[0]["operationId"] == "PHASE-001"
        assert result[1]["operationId"] == "PHASE-002"
        assert result[1]["status"] == "in-progress"

    def test_null_operation_number_returns_empty_string(self) -> None:
        row = {**self._full_row(), "operation_number": None}
        result = map_order_operations_rows([row])
        assert result[0]["operationNumber"] == ""

    def test_null_operation_text_returns_empty_string(self) -> None:
        row = {**self._full_row(), "operation_text": None}
        result = map_order_operations_rows([row])
        assert result[0]["operationText"] == ""

    def test_empty_string_end_user_not_treated_as_confirmed(self) -> None:
        """SAP may return '' rather than None for END_USER on an in-progress operation.
        An empty string must not trigger the 'confirmed' branch."""
        row = {**self._full_row(), "end_user": "", "start_user": "USER01"}
        result = map_order_operations_rows([row])
        assert result[0]["status"] == "in-progress"
        assert result[0]["confirmed"] is False
        assert result[0]["confirmationStatus"] == "partially-confirmed"


# ---------------------------------------------------------------------------
# get_order_confirmations_spec
# ---------------------------------------------------------------------------

class TestGetOrderConfirmationsSpec:
    @pytest.fixture(autouse=True)
    def _set_poh_catalog(self, monkeypatch):
        monkeypatch.setenv("POH_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("POH_SCHEMA", "csm_process_order_history")

    def test_name(self) -> None:
        spec = get_order_confirmations_spec(OrderConfirmationsRequest("100001"))
        assert spec.name == "poh.get_order_confirmations"

    def test_module(self) -> None:
        spec = get_order_confirmations_spec(OrderConfirmationsRequest("100001"))
        assert spec.module == "poh"

    def test_endpoint(self) -> None:
        spec = get_order_confirmations_spec(OrderConfirmationsRequest("100001"))
        assert spec.endpoint == "/api/por/order-confirmations"

    def test_cache_policy_is_per_user(self) -> None:
        spec = get_order_confirmations_spec(OrderConfirmationsRequest("100001"))
        assert spec.cache_policy == CacheTier.PER_USER_60S

    def test_tags(self) -> None:
        spec = get_order_confirmations_spec(OrderConfirmationsRequest("100001"))
        assert "poh" in spec.tags
        assert "confirmations" in spec.tags

    def test_process_order_id_in_params(self) -> None:
        spec = get_order_confirmations_spec(OrderConfirmationsRequest("100001"))
        assert spec.params["process_order_id"] == "100001"

    def test_sql_references_vw_gold_confirmation(self) -> None:
        spec = get_order_confirmations_spec(OrderConfirmationsRequest("100001"))
        assert "vw_gold_confirmation" in spec.sql

    def test_sql_uses_poh_catalog(self) -> None:
        spec = get_order_confirmations_spec(OrderConfirmationsRequest("100001"))
        assert "`connected_plant_uat`" in spec.sql

    def test_sql_has_no_unqualified_from_vw(self) -> None:
        spec = get_order_confirmations_spec(OrderConfirmationsRequest("100001"))
        assert "FROM vw_gold_confirmation" not in spec.sql

    def test_sql_has_where_clause_for_order_id(self) -> None:
        spec = get_order_confirmations_spec(OrderConfirmationsRequest("100001"))
        assert "PROCESS_ORDER_ID = :process_order_id" in spec.sql

    def test_sql_has_limit(self) -> None:
        spec = get_order_confirmations_spec(OrderConfirmationsRequest("100001"))
        assert "LIMIT :max_rows" in spec.sql

    def test_sql_uses_confirmed_column_names(self) -> None:
        """SQL must use columns confirmed from live DDL (2026-05-17)."""
        spec = get_order_confirmations_spec(OrderConfirmationsRequest("100001"))
        assert "CONFIRMATION_ID" in spec.sql
        assert "PROCESS_ORDER_PHASE_ID" in spec.sql
        assert "CONFIRMED_QUANTITY" in spec.sql
        assert "CONFIRMED_QUANTITY_UOM" in spec.sql
        assert "END_TIMESTAMP" in spec.sql

    def test_sql_coalesces_timestamp_columns(self) -> None:
        """confirmedAt must coalesce END_TIMESTAMP, START_TIMESTAMP, __CREATED_ON."""
        spec = get_order_confirmations_spec(OrderConfirmationsRequest("100001"))
        assert "COALESCE" in spec.sql
        assert "START_TIMESTAMP" in spec.sql
        assert "__CREATED_ON" in spec.sql

    def test_sql_selects_duration_columns(self) -> None:
        spec = get_order_confirmations_spec(OrderConfirmationsRequest("100001"))
        assert "SET_UP_DURATION_S" in spec.sql
        assert "MACHINE_DURATION_S" in spec.sql
        assert "CLEANING_DURATION_S" in spec.sql

    def test_missing_poh_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("POH_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_order_confirmations_spec(OrderConfirmationsRequest("100001"))


# ---------------------------------------------------------------------------
# map_order_confirmations_rows
# ---------------------------------------------------------------------------

class TestMapOrderConfirmationsRows:
    def _full_row(self) -> dict:
        """Row using confirmed column names from vw_gold_confirmation (2026-05-17)."""
        return {
            "confirmation_id": "CONF-001",
            "operation_id": "PHASE-PHASE-001",
            "confirmed_yield": 25000.0,
            "uom": "L",
            "confirmed_at": "2024-03-08T03:05:00",
            "setup_duration_s": 600,
            "machine_duration_s": 9000,
            "cleaning_duration_s": 600,
        }

    def test_empty_rows_returns_empty_list(self) -> None:
        assert map_order_confirmations_rows([]) == []

    def test_returns_list_for_multiple_rows(self) -> None:
        result = map_order_confirmations_rows([self._full_row(), self._full_row()])
        assert len(result) == 2

    def test_confirmation_id_mapped(self) -> None:
        result = map_order_confirmations_rows([self._full_row()])
        assert result[0]["confirmationId"] == "CONF-001"

    def test_operation_id_mapped_from_process_order_phase_id(self) -> None:
        result = map_order_confirmations_rows([self._full_row()])
        assert result[0]["operationId"] == "PHASE-PHASE-001"

    def test_confirmed_yield_mapped(self) -> None:
        result = map_order_confirmations_rows([self._full_row()])
        assert result[0]["confirmedYield"] == 25000.0

    def test_uom_mapped(self) -> None:
        result = map_order_confirmations_rows([self._full_row()])
        assert result[0]["uom"] == "L"

    def test_confirmed_at_mapped(self) -> None:
        result = map_order_confirmations_rows([self._full_row()])
        assert result[0]["confirmedAt"] == "2024-03-08T03:05:00"

    def test_setup_duration_converted_from_seconds_to_minutes(self) -> None:
        result = map_order_confirmations_rows([self._full_row()])
        assert result[0]["setupDurationMinutes"] == pytest.approx(10.0)

    def test_machine_duration_converted_from_seconds_to_minutes(self) -> None:
        result = map_order_confirmations_rows([self._full_row()])
        assert result[0]["machineDurationMinutes"] == pytest.approx(150.0)

    def test_cleaning_duration_converted_from_seconds_to_minutes(self) -> None:
        result = map_order_confirmations_rows([self._full_row()])
        assert result[0]["cleaningDurationMinutes"] == pytest.approx(10.0)

    def test_duration_absent_when_null_in_row(self) -> None:
        row = {**self._full_row(), "setup_duration_s": None}
        result = map_order_confirmations_rows([row])
        assert "setupDurationMinutes" not in result[0]

    def test_operation_text_not_in_result(self) -> None:
        """vw_gold_confirmation has no description column — must not be invented."""
        result = map_order_confirmations_rows([self._full_row()])
        assert "operationText" not in result[0]

    def test_is_final_confirmation_not_in_result(self) -> None:
        """vw_gold_confirmation has no final-confirmation flag — must not be invented."""
        result = map_order_confirmations_rows([self._full_row()])
        assert "isFinalConfirmation" not in result[0]

    def test_missing_confirmation_id_returns_empty_string(self) -> None:
        row = {**self._full_row(), "confirmation_id": None}
        result = map_order_confirmations_rows([row])
        assert result[0]["confirmationId"] == ""

    def test_null_uom_returns_none(self) -> None:
        """Null UOM must not default to a fabricated unit like 'KG' or ''."""
        row = {**self._full_row(), "uom": None}
        result = map_order_confirmations_rows([row])
        assert result[0]["uom"] is None

    def test_null_confirmed_yield_returns_none(self) -> None:
        """Null confirmed yield must not appear as real zero."""
        row = {**self._full_row(), "confirmed_yield": None}
        result = map_order_confirmations_rows([row])
        assert result[0]["confirmedYield"] is None

    def test_null_confirmed_at_returns_none(self) -> None:
        row = {**self._full_row(), "confirmed_at": None}
        result = map_order_confirmations_rows([row])
        assert result[0]["confirmedAt"] is None


# ---------------------------------------------------------------------------
# get_order_goods_movements_spec
# ---------------------------------------------------------------------------

class TestGetOrderGoodsMovementsSpec:
    @pytest.fixture(autouse=True)
    def _set_poh_catalog(self, monkeypatch):
        monkeypatch.setenv("POH_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("POH_SCHEMA", "csm_process_order_history")

    def test_name(self) -> None:
        spec = get_order_goods_movements_spec(OrderGoodsMovementsRequest("100001"))
        assert spec.name == "poh.get_order_goods_movements"

    def test_module(self) -> None:
        spec = get_order_goods_movements_spec(OrderGoodsMovementsRequest("100001"))
        assert spec.module == "poh"

    def test_endpoint(self) -> None:
        spec = get_order_goods_movements_spec(OrderGoodsMovementsRequest("100001"))
        assert spec.endpoint == "/api/por/order-goods-movements"

    def test_cache_policy_is_per_user(self) -> None:
        spec = get_order_goods_movements_spec(OrderGoodsMovementsRequest("100001"))
        assert spec.cache_policy == CacheTier.PER_USER_60S

    def test_tags(self) -> None:
        spec = get_order_goods_movements_spec(OrderGoodsMovementsRequest("100001"))
        assert "poh" in spec.tags
        assert "goods-movements" in spec.tags

    def test_process_order_id_in_params(self) -> None:
        spec = get_order_goods_movements_spec(OrderGoodsMovementsRequest("100001"))
        assert spec.params["process_order_id"] == "100001"

    def test_sql_references_vw_gold_adp_movement(self) -> None:
        spec = get_order_goods_movements_spec(OrderGoodsMovementsRequest("100001"))
        assert "vw_gold_adp_movement" in spec.sql

    def test_sql_uses_poh_catalog(self) -> None:
        spec = get_order_goods_movements_spec(OrderGoodsMovementsRequest("100001"))
        assert "`connected_plant_uat`" in spec.sql

    def test_sql_has_no_unqualified_from_vw(self) -> None:
        spec = get_order_goods_movements_spec(OrderGoodsMovementsRequest("100001"))
        assert "FROM vw_gold_adp_movement" not in spec.sql

    def test_sql_has_where_clause_for_order_id(self) -> None:
        spec = get_order_goods_movements_spec(OrderGoodsMovementsRequest("100001"))
        assert "PROCESS_ORDER_ID = :process_order_id" in spec.sql

    def test_sql_has_limit(self) -> None:
        spec = get_order_goods_movements_spec(OrderGoodsMovementsRequest("100001"))
        assert "LIMIT :max_rows" in spec.sql

    def test_sql_uses_confirmed_column_names(self) -> None:
        """SQL must use columns confirmed from live DDL (2026-05-17)."""
        spec = get_order_goods_movements_spec(OrderGoodsMovementsRequest("100001"))
        assert "ID" in spec.sql
        assert "MOVEMENT_TYPE" in spec.sql
        assert "MATERIAL_ID" in spec.sql
        assert "QUANTITY" in spec.sql
        assert "DATE_TIME_OF_ENTRY" in spec.sql

    def test_missing_poh_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("POH_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_order_goods_movements_spec(OrderGoodsMovementsRequest("100001"))


# ---------------------------------------------------------------------------
# _map_movement_direction
# ---------------------------------------------------------------------------

class TestMapMovementDirection:
    # Confirmed ADP (Tulip) movement types from live DDL (2026-05-17)
    def test_101_maps_to_output(self) -> None:
        assert _map_movement_direction("101") == "output"

    def test_261_maps_to_input(self) -> None:
        assert _map_movement_direction("261") == "input"

    def test_262_maps_to_input(self) -> None:
        assert _map_movement_direction("262") == "input"

    def test_531_maps_to_output(self) -> None:
        assert _map_movement_direction("531") == "output"

    def test_711_returns_unknown(self) -> None:
        assert _map_movement_direction("711") == "unknown"

    def test_712_returns_unknown(self) -> None:
        assert _map_movement_direction("712") == "unknown"

    def test_999_returns_unknown(self) -> None:
        assert _map_movement_direction("999") == "unknown"

    def test_none_returns_unknown(self) -> None:
        assert _map_movement_direction(None) == "unknown"

    def test_whitespace_stripped(self) -> None:
        assert _map_movement_direction(" 261 ") == "input"


# ---------------------------------------------------------------------------
# map_order_goods_movements_rows
# ---------------------------------------------------------------------------

class TestMapOrderGoodsMovementsRows:
    def _full_row(self) -> dict:
        """Row using confirmed column names from vw_gold_adp_movement (2026-05-17)."""
        return {
            "movement_id": "GM-001",
            "movement_type": "261",
            "material_id": "000000000001234",
            "quantity": 500.0,
            "uom": "KG",
            "posted_at": "2024-03-08T01:30:00",
            "batch_id": "BATCH-001",
            "posted_by": "user@kerry.com",
            "reference_document": "MAT-DOC-001",
            "storage_location": "SL-001",
        }

    def test_empty_rows_returns_empty_list(self) -> None:
        assert map_order_goods_movements_rows([]) == []

    def test_returns_list_for_multiple_rows(self) -> None:
        result = map_order_goods_movements_rows([self._full_row(), self._full_row()])
        assert len(result) == 2

    def test_movement_id_mapped(self) -> None:
        result = map_order_goods_movements_rows([self._full_row()])
        assert result[0]["movementId"] == "GM-001"

    def test_movement_type_mapped(self) -> None:
        result = map_order_goods_movements_rows([self._full_row()])
        assert result[0]["movementType"] == "261"

    def test_direction_input_for_261(self) -> None:
        result = map_order_goods_movements_rows([self._full_row()])
        assert result[0]["direction"] == "input"

    def test_direction_output_for_101(self) -> None:
        row = {**self._full_row(), "movement_type": "101"}
        result = map_order_goods_movements_rows([row])
        assert result[0]["direction"] == "output"

    def test_direction_unknown_for_unmapped_movement_type(self) -> None:
        row = {**self._full_row(), "movement_type": "999"}
        result = map_order_goods_movements_rows([row])
        assert result[0]["direction"] == "unknown"

    def test_material_id_mapped_preserving_leading_zeros(self) -> None:
        result = map_order_goods_movements_rows([self._full_row()])
        assert result[0]["materialId"] == "000000000001234"

    def test_quantity_mapped(self) -> None:
        result = map_order_goods_movements_rows([self._full_row()])
        assert result[0]["quantity"] == 500.0

    def test_uom_mapped(self) -> None:
        result = map_order_goods_movements_rows([self._full_row()])
        assert result[0]["uom"] == "KG"

    def test_posted_at_mapped(self) -> None:
        result = map_order_goods_movements_rows([self._full_row()])
        assert result[0]["postedAt"] == "2024-03-08T01:30:00"

    def test_batch_id_mapped_when_present(self) -> None:
        result = map_order_goods_movements_rows([self._full_row()])
        assert result[0]["batchId"] == "BATCH-001"

    def test_batch_id_absent_when_null(self) -> None:
        row = {**self._full_row(), "batch_id": None}
        result = map_order_goods_movements_rows([row])
        assert "batchId" not in result[0]

    def test_posted_by_mapped_when_present(self) -> None:
        result = map_order_goods_movements_rows([self._full_row()])
        assert result[0]["postedBy"] == "user@kerry.com"

    def test_reference_document_mapped_when_present(self) -> None:
        result = map_order_goods_movements_rows([self._full_row()])
        assert result[0]["referenceDocument"] == "MAT-DOC-001"

    def test_storage_location_mapped_when_present(self) -> None:
        result = map_order_goods_movements_rows([self._full_row()])
        assert result[0]["storageLocation"] == "SL-001"

    def test_material_description_not_in_result(self) -> None:
        """vw_gold_adp_movement has no material master join — must not be invented."""
        result = map_order_goods_movements_rows([self._full_row()])
        assert "materialDescription" not in result[0]

    def test_null_uom_returns_none(self) -> None:
        """Null UOM must not default to a fabricated unit like 'KG' or ''."""
        row = {**self._full_row(), "uom": None}
        result = map_order_goods_movements_rows([row])
        assert result[0]["uom"] is None

    def test_negative_quantity_preserved(self) -> None:
        """Reversal movements carry negative quantities — must not be zeroed."""
        row = {**self._full_row(), "quantity": -250.0}
        result = map_order_goods_movements_rows([row])
        assert result[0]["quantity"] == -250.0

    def test_null_quantity_returns_none(self) -> None:
        """Null quantity must not appear as real zero."""
        row = {**self._full_row(), "quantity": None}
        result = map_order_goods_movements_rows([row])
        assert result[0]["quantity"] is None

    def test_null_movement_type_produces_empty_string_and_unknown_direction(self) -> None:
        """Null MOVEMENT_TYPE from the view must yield movementType='' and direction='unknown'."""
        row = {**self._full_row(), "movement_type": None}
        result = map_order_goods_movements_rows([row])
        assert result[0]["movementType"] == ""
        assert result[0]["direction"] == "unknown"

    def test_null_posted_at_returns_none(self) -> None:
        row = {**self._full_row(), "posted_at": None}
        result = map_order_goods_movements_rows([row])
        assert result[0]["postedAt"] is None
