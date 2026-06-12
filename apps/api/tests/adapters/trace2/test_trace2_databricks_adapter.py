"""Tests for Trace Investigation Databricks adapter — QuerySpec factories and row mapping."""
import pytest
from adapters.trace2.trace2_databricks_adapter import (
    Trace2BatchHeaderRequest,
    Trace2BatchQualityPassportRequest,
    Trace2BatchSearchRequest,
    Trace2CustomerDeliveryRequest,
    Trace2CustomerExposureRequest,
    Trace2MassBalanceRequest,
    Trace2ProductionHistoryRequest,
    Trace2SupplierExposureRequest,
    TraceGraphRequest,
    get_batch_header_summary_spec,
    get_batch_quality_passport_partial_spec,
    get_batch_search_spec,
    get_customer_delivery_spec,
    get_customer_exposure_spec,
    get_mass_balance_spec,
    get_production_history_spec,
    get_supplier_exposure_spec,
    get_trace_graph_recursive_spec,
    map_batch_header_rows,
    map_batch_quality_passport_partial,
    map_customer_delivery_rows,
    map_customer_exposure_rows,
    map_mass_balance_rows,
    map_production_history_rows,
    map_supplier_exposure_rows,
    map_trace_graph,
)
from shared.query_service.cache_policy import CacheTier
from shared.query_service.errors import DatabricksConfigError

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

# NOTE: batch_status and process_order_id are included here to test the mapper's handling
# when those keys are present (e.g. passed from a different source or future schema change).
# The live SQL query no longer selects them from gold_batch_summary_v — they were not found
# in that view during live validation (2026-05-19, connected_plant_uat).
_FULL_BATCH_HEADER_ROW = {
    "material_id": "0000020582002",
    "batch_id": "BATCH001",
    "unrestricted": 100.0,
    "blocked": 0.0,
    "quality_inspection": 0.0,
    "restricted": 0.0,
    "transit": 0.0,
    "total_stock": 100.0,
    "material_name": "Full Cream Milk Powder",
    "plant_id": "IE01",
    "plant_name": "Listowel",
    "batch_status": "RELEASED",
    "uom": "KG",
    "manufacture_date": "2024-03-01T00:00:00Z",
    "expiry_date": "2025-03-01T00:00:00Z",
    "process_order_id": "PO100001",
}

_LINEAGE_ROW_A_TO_B = {
    "parent_material_id": "000000000020052009",
    "parent_batch_id": "0008602411",
    "parent_plant_id": "C061",
    "parent_material_name": "Full Cream Milk Powder",
    "child_material_id": "MAT_B",
    "child_batch_id": "BATCH_B",
    "child_plant_id": "C061",
    "child_material_name": "Whole Milk Powder",
    "link_type": "PRODUCTION",
    "process_order_id": "PO-100001",
    "material_document_number": "4900012345",
    "purchase_order_id": None,
    "supplier_id": None,
    "customer_id": None,
    "delivery_id": None,
    "sales_order_id": None,
    "quantity": 500.0,
    "base_unit_of_measure": "KG",
    "posting_date": "2026-01-15",
    "movement_type": "261",
}

_ANCHOR_MATERIAL_ID = "000000000020052009"
_ANCHOR_BATCH_ID = "0008602411"
_ANCHOR_PLANT_ID = "C061"
_ANCHOR_KEY = f"{_ANCHOR_MATERIAL_ID}:{_ANCHOR_BATCH_ID}:{_ANCHOR_PLANT_ID}"


# ---------------------------------------------------------------------------
# TestGetBatchHeaderSummarySpec
# ---------------------------------------------------------------------------

class TestGetBatchHeaderSummarySpec:
    @pytest.fixture(autouse=True)
    def _set_trace_catalog(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    def _req(self) -> Trace2BatchHeaderRequest:
        return Trace2BatchHeaderRequest("0000020582002", "BATCH001")

    def test_name(self) -> None:
        assert get_batch_header_summary_spec(self._req()).name == "trace2.get_batch_header_summary"

    def test_module(self) -> None:
        assert get_batch_header_summary_spec(self._req()).module == "trace2"

    def test_endpoint(self) -> None:
        assert get_batch_header_summary_spec(self._req()).endpoint == "/api/trace2/batch-header"

    def test_cache_policy_is_per_user(self) -> None:
        assert get_batch_header_summary_spec(self._req()).cache_policy == CacheTier.PER_USER_60S

    def test_source_badge_is_gold_batch_summary_v(self) -> None:
        assert get_batch_header_summary_spec(self._req()).source_badge == "view:gold_batch_summary_v"

    def test_tags(self) -> None:
        spec = get_batch_header_summary_spec(self._req())
        assert "trace2" in spec.tags
        assert "batch-header" in spec.tags
        assert "summary" in spec.tags

    def test_params_contain_material_and_batch_id(self) -> None:
        spec = get_batch_header_summary_spec(self._req())
        assert spec.params["material_id"] == "0000020582002"
        assert spec.params["batch_id"] == "BATCH001"

    def test_sql_references_gold_batch_stock_v(self) -> None:
        assert "gold_batch_stock_v" in get_batch_header_summary_spec(self._req()).sql

    def test_sql_references_gold_batch_summary_v(self) -> None:
        assert "gold_batch_summary_v" in get_batch_header_summary_spec(self._req()).sql

    def test_sql_uses_trace_catalog(self) -> None:
        assert "`connected_plant_uat`" in get_batch_header_summary_spec(self._req()).sql

    def test_sql_uses_gold_schema(self) -> None:
        assert "`gold`" in get_batch_header_summary_spec(self._req()).sql

    def test_sql_has_no_unqualified_from_gold_batch_stock_v(self) -> None:
        spec = get_batch_header_summary_spec(self._req())
        assert "FROM gold_batch_stock_v" not in spec.sql

    def test_sql_has_limit(self) -> None:
        assert "LIMIT :max_rows" in get_batch_header_summary_spec(self._req()).sql

    def test_sql_has_no_unverified_column_assumptions(self) -> None:
        """Column names verified 2026-05-19 against connected_plant_uat — SQL must not carry TODO markers."""
        assert "TODO" not in get_batch_header_summary_spec(self._req()).sql

    def test_sql_uses_shelf_life_expiration_date_not_expiry_date(self) -> None:
        """gold_batch_summary_v has SHELF_LIFE_EXPIRATION_DATE, not expiry_date."""
        sql = get_batch_header_summary_spec(self._req()).sql
        assert "SHELF_LIFE_EXPIRATION_DATE" in sql
        assert "b.expiry_date" not in sql

    def test_sql_sources_plant_id_from_stock_v_not_summary_v(self) -> None:
        """PLANT_ID not in gold_batch_summary_v — must be sourced from gold_batch_stock_v."""
        sql = get_batch_header_summary_spec(self._req()).sql
        assert "s.PLANT_ID" in sql
        assert "b.plant_id" not in sql

    def test_sql_sources_uom_from_material_not_summary_v(self) -> None:
        """UOM not in gold_batch_summary_v — must be sourced from gold_material.BASE_UNIT_OF_MEASURE."""
        sql = get_batch_header_summary_spec(self._req()).sql
        assert "BASE_UNIT_OF_MEASURE" in sql
        assert "b.uom" not in sql

    def test_sql_uses_language_id_e_not_en(self) -> None:
        """gold_material uses LANGUAGE_ID = 'E' for English — confirmed 2026-05-19."""
        sql = get_batch_header_summary_spec(self._req()).sql
        assert "LANGUAGE_ID = 'E'" in sql
        assert "'EN'" not in sql

    def test_sql_does_not_select_batch_status(self) -> None:
        """batch_status not present in gold_batch_summary_v — must not be selected."""
        sql = get_batch_header_summary_spec(self._req()).sql
        assert "b.batch_status" not in sql

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_batch_header_summary_spec(self._req())

    def test_params_include_plant_id_empty_string_by_default(self) -> None:
        spec = get_batch_header_summary_spec(Trace2BatchHeaderRequest("MAT1", "B1"))
        assert spec.params["plant_id"] == ""

    def test_params_include_plant_id_when_provided(self) -> None:
        req = Trace2BatchHeaderRequest("MAT1", "B1", plant_id="IE01")
        spec = get_batch_header_summary_spec(req)
        assert spec.params["plant_id"] == "IE01"

    def test_sql_contains_plant_id_filter(self) -> None:
        """SQL must include the optional plant filter so multi-plant ambiguity is resolved."""
        sql = get_batch_header_summary_spec(Trace2BatchHeaderRequest("MAT1", "B1")).sql
        assert ":plant_id" in sql
        assert "PLANT_ID" in sql

    def test_params_not_shared_between_requests(self) -> None:
        spec1 = get_batch_header_summary_spec(Trace2BatchHeaderRequest("MAT1", "B1"))
        spec2 = get_batch_header_summary_spec(Trace2BatchHeaderRequest("MAT2", "B2"))
        spec1.params["injected"] = "x"
        assert "injected" not in spec2.params


# ---------------------------------------------------------------------------
# TestMapBatchHeaderRows
# ---------------------------------------------------------------------------

class TestMapBatchHeaderRows:
    def test_full_row_maps_required_fields(self) -> None:
        result = map_batch_header_rows([_FULL_BATCH_HEADER_ROW])
        assert result is not None
        assert result["materialId"] == "0000020582002"
        assert result["materialDescription"] == "Full Cream Milk Powder"
        assert result["batchId"] == "BATCH001"
        assert result["plantId"] == "IE01"
        assert result["plantName"] == "Listowel"

    def test_leading_zeros_preserved_in_material_id(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "material_id": "0000020582002"}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["materialId"] == "0000020582002"

    def test_optional_fields_present_when_supplied(self) -> None:
        result = map_batch_header_rows([_FULL_BATCH_HEADER_ROW])
        assert result is not None
        assert result["quantity"] == 100.0
        assert result["uom"] == "KG"
        assert result["manufactureDate"] == "2024-03-01T00:00:00Z"
        assert result["expiryDate"] == "2025-03-01T00:00:00Z"
        assert result["processOrderId"] == "PO100001"

    def test_stock_bucket_quantities_surfaced(self) -> None:
        """Individual stock buckets now surfaced from gold_batch_stock_v (verified live 2026-05-19)."""
        row = {**_FULL_BATCH_HEADER_ROW, "unrestricted": 80.0, "blocked": 5.0,
               "quality_inspection": 15.0, "restricted": 2.0, "transit": 1.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["unrestricted"] == 80.0
        assert result["blocked"] == 5.0
        assert result["qualityInspection"] == 15.0
        assert result["restricted"] == 2.0
        assert result["transit"] == 1.0

    def test_stock_bucket_absent_when_null(self) -> None:
        """Null stock bucket → field absent from result, not zero (absence ≠ zero stock)."""
        row = {**_FULL_BATCH_HEADER_ROW, "unrestricted": None, "blocked": None,
               "quality_inspection": None, "restricted": None, "transit": None}
        result = map_batch_header_rows([row])
        assert result is not None
        assert "unrestricted" not in result
        assert "blocked" not in result
        assert "qualityInspection" not in result
        assert "restricted" not in result
        assert "transit" not in result

    def test_missing_expiry_date_absent_from_result(self) -> None:
        row = {k: v for k, v in _FULL_BATCH_HEADER_ROW.items() if k != "expiry_date"}
        result = map_batch_header_rows([row])
        assert result is not None
        assert "expiryDate" not in result

    def test_missing_process_order_id_absent_from_result(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "process_order_id": None}
        result = map_batch_header_rows([row])
        assert result is not None
        assert "processOrderId" not in result

    def test_empty_rows_returns_none(self) -> None:
        assert map_batch_header_rows([]) is None

    def test_stock_status_priority_blocked_wins(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "blocked": 10.0, "quality_inspection": 5.0,
               "restricted": 3.0, "transit": 2.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["stockStatus"] == "blocked"

    def test_stock_status_quality_inspection_over_returns_and_transit(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "blocked": 0.0, "quality_inspection": 5.0,
               "restricted": 3.0, "transit": 2.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["stockStatus"] == "quality-inspection"

    def test_stock_status_restricted_over_transit(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "blocked": 0.0, "quality_inspection": 0.0,
               "restricted": 3.0, "transit": 2.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["stockStatus"] == "restricted"

    def test_stock_status_transit_when_only_transit_nonzero(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "blocked": 0.0, "quality_inspection": 0.0,
               "restricted": 0.0, "transit": 2.0, "unrestricted": 0.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["stockStatus"] == "transit"

    def test_stock_status_unrestricted_when_all_zero(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "blocked": 0.0, "quality_inspection": 0.0,
               "restricted": 0.0, "transit": 0.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["stockStatus"] == "unrestricted"

    def test_quality_status_pending_when_qi_stock_nonzero(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "quality_inspection": 5.0}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["qualityStatus"] == "pending"

    def test_quality_status_unknown_when_no_qi_stock(self) -> None:
        """No QI stock and no QM decision field → 'unknown', not 'not-applicable'.

        'not-applicable' would imply quality inspection does not apply to this batch.
        Without a verified QM usage decision field in the query, 'unknown' is correct.
        See _derive_quality_status docstring for full reasoning.
        """
        result = map_batch_header_rows([_FULL_BATCH_HEADER_ROW])
        assert result is not None
        assert result["qualityStatus"] == "unknown"

    def test_quality_status_unknown_when_qi_is_null(self) -> None:
        """Null quality_inspection (missing column) → 'unknown', not 'not-applicable'.

        The adapter must not interpret a missing QI field as confirmed quality acceptance.
        """
        row = {**_FULL_BATCH_HEADER_ROW, "quality_inspection": None}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["qualityStatus"] == "unknown"

    def test_quality_status_never_returns_accepted_or_rejected(self) -> None:
        """Prove accepted/rejected/conditional cannot be reached without QM decision evidence.

        _derive_quality_status is conservative by design: it reads QI stock quantity only,
        not a QM usage decision field. Until gold_qm_usage_decision_v (or equivalent) is
        verified in UAT and wired into the query, these values must not appear.
        """
        from adapters.trace2.trace2_databricks_adapter import _derive_quality_status
        blocked_values = {"accepted", "rejected", "conditional"}
        for qi_value in [0.0, None, 0, ""]:
            result = _derive_quality_status({**_FULL_BATCH_HEADER_ROW, "quality_inspection": qi_value})
            assert result not in blocked_values, (
                f"_derive_quality_status returned '{result}' for quality_inspection={qi_value!r} "
                "without a verified QM usage decision field — conservative mapping violated"
            )

    def test_batch_status_maps_released_to_active(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "batch_status": "RELEASED"}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["batchStatus"] == "active"

    def test_batch_status_maps_blocked(self) -> None:
        row = {**_FULL_BATCH_HEADER_ROW, "batch_status": "BLOCKED"}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["batchStatus"] == "blocked"

    def test_batch_status_maps_numeric_two_to_blocked(self) -> None:
        """SAP batch status code '2' = blocked."""
        row = {**_FULL_BATCH_HEADER_ROW, "batch_status": "2"}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["batchStatus"] == "blocked"

    def test_batch_status_none_returns_unknown(self) -> None:
        """batch_status absent from gold_batch_summary_v — must return 'unknown', not 'active'.

        Returning 'active' for an unknown status would falsely signal release for blocked batches.
        'unknown' is the honest fallback; 'active' is a semantic regression (violates Gate 1.3).
        """
        row = {**_FULL_BATCH_HEADER_ROW, "batch_status": None}
        result = map_batch_header_rows([row])
        assert result is not None
        assert result["batchStatus"] == "unknown"


# ---------------------------------------------------------------------------
# TestGetTraceGraphRecursiveSpec
# ---------------------------------------------------------------------------

class TestGetTraceGraphRecursiveSpec:
    @pytest.fixture(autouse=True)
    def _set_trace_catalog(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    def _req(self, direction: str = "both", max_depth: int = 3) -> TraceGraphRequest:
        return TraceGraphRequest(
            _ANCHOR_MATERIAL_ID, _ANCHOR_BATCH_ID, _ANCHOR_PLANT_ID,
            direction=direction, max_depth=max_depth,
        )

    def test_name(self) -> None:
        assert get_trace_graph_recursive_spec(self._req()).name == "trace2.get_trace_graph"

    def test_module(self) -> None:
        assert get_trace_graph_recursive_spec(self._req()).module == "trace2"

    def test_endpoint(self) -> None:
        assert get_trace_graph_recursive_spec(self._req()).endpoint == "/api/trace2/trace-graph"

    def test_cache_policy_is_per_user(self) -> None:
        assert get_trace_graph_recursive_spec(self._req()).cache_policy == CacheTier.PER_USER_60S

    def test_source_badge_is_gold_batch_lineage(self) -> None:
        assert get_trace_graph_recursive_spec(self._req()).source_badge == "view:gold_batch_lineage"

    def test_tags(self) -> None:
        spec = get_trace_graph_recursive_spec(self._req())
        assert "trace2" in spec.tags
        assert "trace-graph" in spec.tags
        assert "lineage" in spec.tags

    def test_params_contain_material_batch_max_depth_max_rows_no_plant(self) -> None:
        spec = get_trace_graph_recursive_spec(self._req(max_depth=5))
        assert spec.params["material_id"] == _ANCHOR_MATERIAL_ID
        assert spec.params["batch_id"] == _ANCHOR_BATCH_ID
        assert spec.params["max_depth"] == 5
        assert "max_rows" in spec.params
        assert "plant_id" not in spec.params

    def test_params_max_rows_equals_request_max_edges(self) -> None:
        req = TraceGraphRequest(
            _ANCHOR_MATERIAL_ID, _ANCHOR_BATCH_ID, _ANCHOR_PLANT_ID,
            direction="both", max_depth=3, max_edges=500,
        )
        spec = get_trace_graph_recursive_spec(req)
        assert spec.params["max_rows"] == 500

    def test_sql_has_limit_max_rows(self) -> None:
        """P0-4: SQL-level row cap must be present to bound recursive query output."""
        assert "LIMIT :max_rows" in get_trace_graph_recursive_spec(self._req()).sql

    def test_sql_has_limit_in_downstream_direction(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("downstream")).sql
        assert "LIMIT :max_rows" in sql

    def test_sql_has_limit_in_upstream_direction(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("upstream")).sql
        assert "LIMIT :max_rows" in sql

    def test_sql_contains_with_recursive(self) -> None:
        assert "WITH RECURSIVE" in get_trace_graph_recursive_spec(self._req()).sql

    def test_sql_references_gold_batch_lineage(self) -> None:
        assert "gold_batch_lineage" in get_trace_graph_recursive_spec(self._req()).sql

    def test_sql_uses_fully_qualified_table(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req()).sql
        assert "`connected_plant_uat`" in sql
        assert "`gold`" in sql
        assert "FROM gold_batch_lineage" not in sql

    def test_sql_has_no_todo_markers(self) -> None:
        assert "TODO" not in get_trace_graph_recursive_spec(self._req()).sql

    def test_sql_includes_all_18_confirmed_columns(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req()).sql
        for col in [
            "PARENT_MATERIAL_ID", "PARENT_BATCH_ID", "PARENT_PLANT_ID",
            "CHILD_MATERIAL_ID", "CHILD_BATCH_ID", "CHILD_PLANT_ID",
            "LINK_TYPE", "PROCESS_ORDER_ID", "MATERIAL_DOCUMENT_NUMBER",
            "PURCHASE_ORDER_ID", "SUPPLIER_ID", "CUSTOMER_ID", "DELIVERY_ID",
            "SALES_ORDER_ID", "QUANTITY", "BASE_UNIT_OF_MEASURE",
            "POSTING_DATE", "MOVEMENT_TYPE",
        ]:
            assert col in sql, f"Column {col} missing from recursive spec SQL"

    def test_sql_includes_hop_depth_and_traversal_dir(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req()).sql
        assert "hop_depth" in sql
        assert "traversal_dir" in sql

    def test_downstream_sql_has_parent_anchor_where(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("downstream")).sql
        assert "PARENT_MATERIAL_ID = :material_id" in sql
        assert "PARENT_BATCH_ID = :batch_id" in sql

    def test_downstream_sql_does_not_have_child_anchor_where(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("downstream")).sql
        assert "CHILD_MATERIAL_ID = :material_id" not in sql

    def test_upstream_sql_has_child_anchor_where(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("upstream")).sql
        assert "CHILD_MATERIAL_ID = :material_id" in sql
        assert "CHILD_BATCH_ID = :batch_id" in sql

    def test_upstream_sql_does_not_have_parent_anchor_where(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("upstream")).sql
        assert "PARENT_MATERIAL_ID = :material_id" not in sql

    def test_both_sql_has_ds_and_us_ctes(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("both")).sql
        assert " ds " in sql or "\n  ds AS" in sql
        assert " us " in sql or "\n  us AS" in sql

    def test_both_sql_has_union_all(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req("both")).sql
        assert "UNION ALL" in sql

    def test_sql_has_instr_cycle_guard(self) -> None:
        assert "INSTR" in get_trace_graph_recursive_spec(self._req()).sql

    def test_sql_joins_gold_material_for_material_names(self) -> None:
        sql = get_trace_graph_recursive_spec(self._req()).sql
        assert "gold_material" in sql
        assert "parent_material_name" in sql
        assert "child_material_name" in sql

    def test_sql_uses_language_id_param_not_hardcoded(self) -> None:
        spec = get_trace_graph_recursive_spec(self._req())
        assert "LANGUAGE_ID = :language_id" in spec.sql
        assert spec.params["language_id"] == "E"

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_trace_graph_recursive_spec(self._req())

    def test_gold_batch_lineage_resolves_to_governed_schema_by_default(self) -> None:
        """T2 cutover: gold_batch_lineage must resolve to TRACE_GOVERNED_SCHEMA
        (default "gold_io_reporting"), not TRACE_SCHEMA ("gold").  The legacy TRACE_SCHEMA
        setting in app.yaml would resolve to connected_plant_uat.gold.gold_batch_lineage
        which does not exist in the governed io-reporting schema."""
        sql = get_trace_graph_recursive_spec(self._req()).sql
        assert "`gold_io_reporting`" in sql
        # gold_batch_lineage must NOT resolve to the legacy gold schema.
        assert "`connected_plant_uat`.`gold`.`gold_batch_lineage`" not in sql

    def test_gold_batch_lineage_governed_schema_overridable_via_env(self, monkeypatch) -> None:
        """TRACE_GOVERNED_SCHEMA env var must allow overriding the governed schema."""
        monkeypatch.setenv("TRACE_GOVERNED_SCHEMA", "custom_governed")
        sql = get_trace_graph_recursive_spec(self._req()).sql
        assert "`custom_governed`" in sql
        assert "`gold_io_reporting`" not in sql

    def test_gold_material_stays_on_legacy_trace_schema(self) -> None:
        """gold_material enrichment join must remain on legacy TRACE_SCHEMA — no governed
        equivalent exists yet.  The legacy gold schema must still appear in the SQL."""
        sql = get_trace_graph_recursive_spec(self._req()).sql
        assert "`connected_plant_uat`.`gold`.`gold_material`" in sql


# ---------------------------------------------------------------------------
# TestMapTraceGraph
# ---------------------------------------------------------------------------

def _make_req(**kwargs) -> TraceGraphRequest:
    defaults = dict(
        material_id=_ANCHOR_MATERIAL_ID,
        batch_id=_ANCHOR_BATCH_ID,
        plant_id=_ANCHOR_PLANT_ID,
        direction="both",
        max_depth=6,
        max_edges=1000,
    )
    defaults.update(kwargs)
    return TraceGraphRequest(**defaults)


class TestMapTraceGraph:
    def test_empty_rows_returns_anchor_only_and_warning(self) -> None:
        result = map_trace_graph([], _make_req(), depth_reached=0, truncated=False)
        assert result["rootBatch"] == f"{_ANCHOR_MATERIAL_ID}/{_ANCHOR_BATCH_ID}"
        assert len(result["nodes"]) == 1
        anchor = result["nodes"][0]
        assert anchor["isAnchor"] is True
        assert anchor["materialId"] == _ANCHOR_MATERIAL_ID
        assert anchor["batchId"] == _ANCHOR_BATCH_ID
        assert anchor["id"] == _ANCHOR_KEY
        assert result["edges"] == []
        assert "no_edges_found" in result["warnings"]

    def test_single_downstream_row_gives_anchor_plus_child_plus_one_edge(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        assert len(result["nodes"]) == 2
        assert len(result["edges"]) == 1

    def test_anchor_node_is_marked_is_anchor(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        anchor_nodes = [n for n in result["nodes"] if n["isAnchor"]]
        assert len(anchor_nodes) == 1
        assert anchor_nodes[0]["id"] == _ANCHOR_KEY

    def test_anchor_directions_is_anchor_label(self) -> None:
        result = map_trace_graph([], _make_req(), depth_reached=0, truncated=False)
        assert result["nodes"][0]["directions"] == ["anchor"]

    def test_downstream_child_node_direction(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        child_node = next(n for n in result["nodes"] if not n["isAnchor"])
        assert child_node["directions"] == ["downstream"]

    def test_upstream_row_maps_parent_as_upstream(self) -> None:
        upstream_row = {
            **_LINEAGE_ROW_A_TO_B,
            "parent_material_id": "MAT_PARENT",
            "parent_batch_id": "BATCH_PARENT",
            "parent_plant_id": "C061",
            "child_material_id": _ANCHOR_MATERIAL_ID,
            "child_batch_id": _ANCHOR_BATCH_ID,
            "child_plant_id": _ANCHOR_PLANT_ID,
        }
        tagged = [(upstream_row, 0, "upstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        non_anchor = [n for n in result["nodes"] if not n["isAnchor"]]
        assert len(non_anchor) == 1
        assert non_anchor[0]["directions"] == ["upstream"]

    def test_node_key_includes_plant_suffix(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        child = next(n for n in result["nodes"] if not n["isAnchor"])
        assert child["id"] == "MAT_B:BATCH_B:C061"
        assert child["plantId"] == "C061"

    def test_duplicate_rows_produce_single_edge(self) -> None:
        tagged = [
            (_LINEAGE_ROW_A_TO_B, 0, "downstream"),
            (_LINEAGE_ROW_A_TO_B, 0, "downstream"),
        ]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        assert len(result["edges"]) == 1

    def test_leading_zeros_preserved_in_node_keys(self) -> None:
        result = map_trace_graph([], _make_req(), depth_reached=0, truncated=False)
        anchor_node = result["nodes"][0]
        assert anchor_node["materialId"] == "000000000020052009"
        assert anchor_node["batchId"] == "0008602411"

    def test_edge_preserves_quantity_and_uom(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        edge = result["edges"][0]
        assert edge["quantity"] == 500.0
        assert edge["uom"] == "KG"

    def test_edge_preserves_posting_date_and_movement_type(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        edge = result["edges"][0]
        assert edge["postingDate"] == "2026-01-15"
        assert edge["movementType"] == "261"

    def test_edge_preserves_process_order_and_doc_number(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        edge = result["edges"][0]
        assert edge["processOrderId"] == "PO-100001"
        assert edge["materialDocumentNumber"] == "4900012345"

    def test_null_optional_fields_handled_safely(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        edge = result["edges"][0]
        assert edge["supplierId"] is None
        assert edge["customerId"] is None
        assert edge["deliveryId"] is None
        assert edge["salesOrderId"] is None
        assert edge["purchaseOrderId"] is None

    def test_null_quantity_becomes_none_not_zero(self) -> None:
        row = {**_LINEAGE_ROW_A_TO_B, "quantity": None}
        tagged = [(row, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        assert result["edges"][0]["quantity"] is None

    def test_edge_has_source_and_target_keys(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        edge = result["edges"][0]
        assert edge["source"] == _ANCHOR_KEY
        assert edge["target"] == "MAT_B:BATCH_B:C061"

    def test_truncated_true_adds_max_edges_warning(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=True)
        assert "max_edges_reached" in result["warnings"]
        assert result["truncated"] is True

    def test_depth_reached_equals_max_depth_adds_warning(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(
            tagged, _make_req(max_depth=1), depth_reached=1, truncated=False
        )
        assert "max_depth_reached" in result["warnings"]

    def test_depth_not_reached_no_warning(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(
            tagged, _make_req(max_depth=6), depth_reached=1, truncated=False
        )
        assert "max_depth_reached" not in result["warnings"]

    def test_depth_reached_in_response(self) -> None:
        result = map_trace_graph([], _make_req(), depth_reached=3, truncated=False)
        assert result["depth"] == 3

    def test_response_has_required_top_level_keys(self) -> None:
        result = map_trace_graph([], _make_req(), depth_reached=0, truncated=False)
        for key in ("nodes", "edges", "depth", "rootBatch", "upstreamCount", "downstreamCount",
                    "unresolvedNodeCount", "truncated", "warnings"):
            assert key in result, f"Missing key: {key}"

    def test_material_description_on_child_node(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        child = next(n for n in result["nodes"] if not n["isAnchor"])
        assert child["materialDescription"] == "Whole Milk Powder"

    def test_material_description_enriched_on_anchor_when_it_appears_as_parent(self) -> None:
        tagged = [(_LINEAGE_ROW_A_TO_B, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        anchor = next(n for n in result["nodes"] if n["isAnchor"])
        assert anchor["materialDescription"] == "Full Cream Milk Powder"

    def test_material_description_absent_when_null_in_row(self) -> None:
        row = {**_LINEAGE_ROW_A_TO_B, "child_material_name": None}
        tagged = [(row, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        child = next(n for n in result["nodes"] if not n["isAnchor"])
        assert child["materialDescription"] == ""

    def test_vendor_supplier_fields_preserved_on_edge(self) -> None:
        row = {
            **_LINEAGE_ROW_A_TO_B,
            "supplier_id": "SUPP-001",
            "customer_id": "CUST-001",
            "delivery_id": "DEL-001",
            "sales_order_id": "SO-001",
            "purchase_order_id": "PO-EXT-001",
        }
        tagged = [(row, 0, "downstream")]
        result = map_trace_graph(tagged, _make_req(), depth_reached=1, truncated=False)
        edge = result["edges"][0]
        assert edge["supplierId"] == "SUPP-001"
        assert edge["customerId"] == "CUST-001"
        assert edge["deliveryId"] == "DEL-001"
        assert edge["salesOrderId"] == "SO-001"
        assert edge["purchaseOrderId"] == "PO-EXT-001"


# ---------------------------------------------------------------------------
# TestGetMassBalanceSpec
# ---------------------------------------------------------------------------

class TestGetMassBalanceSpec:
    @pytest.fixture(autouse=True)
    def _set_trace_catalog(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    def _req(self) -> Trace2MassBalanceRequest:
        return Trace2MassBalanceRequest("MAT001", "BATCH001")

    def test_name(self) -> None:
        assert get_mass_balance_spec(self._req()).name == "trace2.get_mass_balance"

    def test_module(self) -> None:
        assert get_mass_balance_spec(self._req()).module == "trace2"

    def test_endpoint(self) -> None:
        assert get_mass_balance_spec(self._req()).endpoint == "/api/trace2/mass-balance"

    def test_cache_policy_is_per_user(self) -> None:
        assert get_mass_balance_spec(self._req()).cache_policy == CacheTier.PER_USER_60S

    def test_source_badge_is_gold_batch_mass_balance_v(self) -> None:
        assert get_mass_balance_spec(self._req()).source_badge == "view:gold_batch_mass_balance_v"

    def test_tags(self) -> None:
        spec = get_mass_balance_spec(self._req())
        assert "trace2" in spec.tags
        assert "mass-balance" in spec.tags

    def test_sql_references_gold_batch_mass_balance_v(self) -> None:
        assert "gold_batch_mass_balance_v" in get_mass_balance_spec(self._req()).sql

    def test_sql_uses_trace_catalog(self) -> None:
        assert "`connected_plant_uat`" in get_mass_balance_spec(self._req()).sql

    def test_sql_has_no_unqualified_from_gold_batch_mass_balance_v(self) -> None:
        spec = get_mass_balance_spec(self._req())
        assert "FROM gold_batch_mass_balance_v" not in spec.sql

    def test_sql_has_order_by_posting_date(self) -> None:
        assert "ORDER BY posting_date" in get_mass_balance_spec(self._req()).sql

    def test_sql_has_limit(self) -> None:
        assert "LIMIT :max_rows" in get_mass_balance_spec(self._req()).sql

    def test_sql_no_todo_markers_after_live_verification(self) -> None:
        """WHERE column names verified live 2026-05-20 — TODO markers removed."""
        assert "TODO" not in get_mass_balance_spec(self._req()).sql

    def test_params_contain_material_batch_max_rows(self) -> None:
        """max_rows must be in params — SQL has LIMIT :max_rows and would fail without it."""
        spec = get_mass_balance_spec(Trace2MassBalanceRequest("MAT001", "BATCH001", max_rows=2500))
        assert spec.params["material_id"] == "MAT001"
        assert spec.params["batch_id"] == "BATCH001"
        assert spec.params["max_rows"] == 2500

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_mass_balance_spec(self._req())


# ---------------------------------------------------------------------------
# TestMapMassBalanceRows
# ---------------------------------------------------------------------------

class TestMapMassBalanceRows:
    def _production_row(self, abs_qty: float = 500.0, balance: float = 500.0) -> dict:
        return {
            "posting_date": "2024-03-01",
            "movement_type": "101",
            "movement_category": "PRODUCTION",
            "abs_quantity": abs_qty,
            "uom": "KG",
            "balance_qty": balance,
        }

    def _shipment_row(self, abs_qty: float = 200.0, balance: float = 300.0) -> dict:
        return {
            "posting_date": "2024-03-02",
            "movement_type": "601",
            "movement_category": "SHIPMENT",
            "abs_quantity": abs_qty,
            "uom": "KG",
            "balance_qty": balance,
        }

    def test_empty_rows_returns_zero_totals(self) -> None:
        result = map_mass_balance_rows([])
        assert result["inputQuantity"] == 0.0
        assert result["outputQuantity"] == 0.0
        assert result["varianceQuantity"] == 0.0
        assert result["variancePercent"] == 0.0
        assert result["uom"] == ""
        assert result["unresolvedMovements"] == 0
        assert result["movements"] == []

    def test_input_quantity_sums_production_rows(self) -> None:
        rows = [self._production_row(500.0, 500.0), self._production_row(100.0, 600.0)]
        result = map_mass_balance_rows(rows)
        assert result["inputQuantity"] == 600.0

    def test_output_quantity_sums_shipment_and_consumption(self) -> None:
        rows = [
            self._production_row(500.0, 500.0),
            self._shipment_row(200.0, 300.0),
            {"posting_date": "2024-03-03", "movement_type": "261",
             "movement_category": "CONSUMPTION", "abs_quantity": 50.0,
             "uom": "KG", "balance_qty": 250.0},
        ]
        result = map_mass_balance_rows(rows)
        assert result["outputQuantity"] == 250.0

    def test_variance_quantity_is_input_minus_output(self) -> None:
        rows = [self._production_row(500.0, 500.0), self._shipment_row(200.0, 300.0)]
        result = map_mass_balance_rows(rows)
        assert result["varianceQuantity"] == pytest.approx(300.0)

    def test_variance_percent_computed_correctly(self) -> None:
        rows = [self._production_row(500.0, 500.0), self._shipment_row(400.0, 100.0)]
        result = map_mass_balance_rows(rows)
        assert result["variancePercent"] == pytest.approx(20.0)

    def test_variance_percent_zero_when_no_input(self) -> None:
        rows = [self._shipment_row(200.0, 0.0)]
        result = map_mass_balance_rows(rows)
        assert result["variancePercent"] == 0.0

    def test_balance_qty_passes_through_to_running_balance(self) -> None:
        """balance_qty is passed through. Live data shows BALANCE_QTY is not a
        per-batch running tally (TRACE-P1-011); panel disclaimer reflects this."""
        rows = [self._production_row(500.0, 500.0), self._shipment_row(200.0, 300.0)]
        result = map_mass_balance_rows(rows)
        assert result["movements"][0]["runningBalance"] == 500.0
        assert result["movements"][1]["runningBalance"] == 300.0

    def test_abs_quantity_maps_to_quantity(self) -> None:
        rows = [self._production_row(500.0, 500.0)]
        result = map_mass_balance_rows(rows)
        assert result["movements"][0]["quantity"] == 500.0

    def test_production_delta_is_positive(self) -> None:
        rows = [self._production_row(500.0, 500.0)]
        result = map_mass_balance_rows(rows)
        assert result["movements"][0]["delta"] == pytest.approx(500.0)

    def test_shipment_delta_is_negative(self) -> None:
        rows = [self._shipment_row(200.0, 300.0)]
        result = map_mass_balance_rows(rows)
        assert result["movements"][0]["delta"] == pytest.approx(-200.0)

    def test_uom_taken_from_first_row(self) -> None:
        rows = [self._production_row(), self._shipment_row()]
        result = map_mass_balance_rows(rows)
        assert result["uom"] == "KG"

    def test_confidence_is_one(self) -> None:
        assert map_mass_balance_rows([self._production_row()])["confidence"] == 1.0

    def test_null_balance_qty_increments_unresolved(self) -> None:
        row = {**self._production_row(), "balance_qty": None}
        result = map_mass_balance_rows([row])
        assert result["unresolvedMovements"] == 1

    def test_null_balance_qty_defaults_running_balance_to_zero(self) -> None:
        row = {**self._production_row(), "balance_qty": None}
        result = map_mass_balance_rows([row])
        assert result["movements"][0]["runningBalance"] == 0.0

    def test_movement_category_mapping(self) -> None:
        categories = [
            ("PRODUCTION", "production"),
            ("SHIPMENT", "shipment"),
            ("CONSUMPTION", "consumption"),
            ("ADJUSTMENT", "adjustment"),
            ("UNKNOWN_CAT", "adjustment"),
        ]
        for raw, expected in categories:
            row = {**self._production_row(), "movement_category": raw}
            result = map_mass_balance_rows([row])
            assert result["movements"][0]["category"] == expected, f"Failed for {raw!r}"

    def test_movements_array_length_matches_row_count(self) -> None:
        rows = [self._production_row(), self._shipment_row(), self._production_row()]
        result = map_mass_balance_rows(rows)
        assert len(result["movements"]) == 3

    def test_confidence_empty_rows_is_one(self) -> None:
        # Vacuous case — no movements to assess, so confidence is 1.0.
        assert map_mass_balance_rows([])["confidence"] == 1.0

    def test_confidence_no_unresolved_is_one(self) -> None:
        rows = [self._production_row(), self._shipment_row()]
        assert map_mass_balance_rows(rows)["confidence"] == 1.0

    def test_confidence_partial_unresolved(self) -> None:
        # 1 of 4 rows has null balance_qty → confidence = 1 - 1/4 = 0.75
        rows = [
            {**self._production_row(), "balance_qty": None},
            self._production_row(),
            self._shipment_row(),
            self._production_row(),
        ]
        result = map_mass_balance_rows(rows)
        assert result["confidence"] == pytest.approx(0.75)
        assert result["unresolvedMovements"] == 1

    def test_confidence_all_unresolved_is_zero(self) -> None:
        rows = [
            {**self._production_row(), "balance_qty": None},
            {**self._shipment_row(), "balance_qty": None},
        ]
        result = map_mass_balance_rows(rows)
        assert result["confidence"] == 0.0

    def test_unmapped_live_movement_category_counts_as_unresolved(self) -> None:
        """TRACE-P1-010: live MOVEMENT_CATEGORY values like 'STO Receipt',
        'STO Transfer', 'Other (261)', 'Write-Off' are not in _MOVEMENT_CATEGORY_MAP
        and fall through to 'adjustment'. The mapper must count these as unresolved
        so the panel banner reflects truth."""
        rows = [
            self._production_row(),                                                  # mapped → not unresolved
            {**self._production_row(), "movement_category": "STO Receipt"},          # unmapped
            {**self._production_row(), "movement_category": "STO Transfer"},         # unmapped
            {**self._production_row(), "movement_category": "Other (261)"},          # unmapped
            {**self._production_row(), "movement_category": "Write-Off"},            # unmapped
        ]
        result = map_mass_balance_rows(rows)
        assert result["unresolvedMovements"] == 4

    def test_mapped_categories_do_not_count_as_unresolved(self) -> None:
        rows = [
            {**self._production_row(), "movement_category": "Production"},
            {**self._production_row(), "movement_category": "Shipment"},
            {**self._production_row(), "movement_category": "Consumption"},
            {**self._production_row(), "movement_category": "Adjustment"},
        ]
        result = map_mass_balance_rows(rows)
        assert result["unresolvedMovements"] == 0

    def test_null_movement_category_does_not_count_as_unresolved(self) -> None:
        """Null/empty category is a different (rarer) condition than unmapped."""
        rows = [
            {**self._production_row(), "movement_category": None},
            {**self._production_row(), "movement_category": ""},
        ]
        result = map_mass_balance_rows(rows)
        assert result["unresolvedMovements"] == 0

    def test_unmapped_category_and_null_balance_count_once(self) -> None:
        """A row that fails both unresolved tests counts once, not twice."""
        rows = [
            {**self._production_row(), "movement_category": "STO Receipt", "balance_qty": None},
        ]
        result = map_mass_balance_rows(rows)
        assert result["unresolvedMovements"] == 1


# ---------------------------------------------------------------------------
# TestGetCustomerExposureSpec
# ---------------------------------------------------------------------------

class TestGetCustomerExposureSpec:
    @pytest.fixture(autouse=True)
    def _set_trace_catalog(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    def _req(self, max_depth: int = 5, max_rows: int = 5000, plant_id: str = "") -> Trace2CustomerExposureRequest:
        return Trace2CustomerExposureRequest("MAT001", "BATCH001", plant_id=plant_id, max_depth=max_depth, max_rows=max_rows)

    def test_name(self) -> None:
        assert get_customer_exposure_spec(self._req()).name == "trace2.get_customer_exposure"

    def test_module(self) -> None:
        assert get_customer_exposure_spec(self._req()).module == "trace2"

    def test_endpoint(self) -> None:
        assert get_customer_exposure_spec(self._req()).endpoint == "/api/trace2/customer-exposure"

    def test_cache_policy_is_per_user(self) -> None:
        assert get_customer_exposure_spec(self._req()).cache_policy == CacheTier.PER_USER_60S

    def test_source_badge_is_gold_batch_lineage(self) -> None:
        assert get_customer_exposure_spec(self._req()).source_badge == "view:gold_batch_lineage"

    def test_tags(self) -> None:
        spec = get_customer_exposure_spec(self._req())
        assert "trace2" in spec.tags
        assert "customer-exposure" in spec.tags
        assert "lineage" in spec.tags

    def test_params_contain_material_batch_depth_rows(self) -> None:
        spec = get_customer_exposure_spec(self._req(max_depth=7, max_rows=1000))
        assert spec.params["material_id"] == "MAT001"
        assert spec.params["batch_id"] == "BATCH001"
        assert spec.params["max_depth"] == 7
        assert spec.params["max_rows"] == 1000

    def test_params_contain_plant_id(self) -> None:
        spec = get_customer_exposure_spec(self._req(plant_id="C061"))
        assert spec.params["plant_id"] == "C061"

    def test_params_plant_id_defaults_to_empty_string(self) -> None:
        spec = get_customer_exposure_spec(self._req())
        assert spec.params["plant_id"] == ""

    def test_sql_has_optional_plant_filter(self) -> None:
        sql = get_customer_exposure_spec(self._req()).sql
        assert ":plant_id" in sql
        assert "PARENT_PLANT_ID" in sql

    def test_sql_references_gold_batch_lineage(self) -> None:
        assert "gold_batch_lineage" in get_customer_exposure_spec(self._req()).sql

    def test_sql_uses_fully_qualified_table(self) -> None:
        sql = get_customer_exposure_spec(self._req()).sql
        assert "`connected_plant_uat`" in sql
        assert "`gold`" in sql
        assert "FROM gold_batch_lineage" not in sql

    def test_sql_has_with_recursive(self) -> None:
        assert "WITH RECURSIVE" in get_customer_exposure_spec(self._req()).sql

    def test_sql_filters_delivery_link_type(self) -> None:
        assert "LINK_TYPE = 'DELIVERY'" in get_customer_exposure_spec(self._req()).sql

    def test_sql_filters_null_customer_id(self) -> None:
        assert "CUSTOMER_ID IS NOT NULL" in get_customer_exposure_spec(self._req()).sql

    def test_sql_has_limit_max_rows(self) -> None:
        assert "LIMIT :max_rows" in get_customer_exposure_spec(self._req()).sql

    def test_sql_has_hop_depth(self) -> None:
        assert "hop_depth" in get_customer_exposure_spec(self._req()).sql

    def test_sql_has_instr_cycle_guard(self) -> None:
        assert "INSTR" in get_customer_exposure_spec(self._req()).sql

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_customer_exposure_spec(self._req())

    def test_params_not_shared_between_requests(self) -> None:
        spec1 = get_customer_exposure_spec(Trace2CustomerExposureRequest("MAT1", "B1"))
        spec2 = get_customer_exposure_spec(Trace2CustomerExposureRequest("MAT2", "B2"))
        spec1.params["injected"] = "x"
        assert "injected" not in spec2.params


# ---------------------------------------------------------------------------
# TestMapCustomerExposureRows
# ---------------------------------------------------------------------------

def _delivery_row(
    customer_id: str = "CUST-001",
    delivery_id: str = "DEL-001",
    quantity: float = 100.0,
    hop_depth: int = 1,
) -> dict:
    return {
        "customer_id": customer_id,
        "delivery_id": delivery_id,
        "sales_order_id": "SO-001",
        "quantity": quantity,
        "base_unit_of_measure": "KG",
        "posting_date": "2026-01-15",
        "hop_depth": hop_depth,
    }


class TestMapCustomerExposureRows:
    def test_empty_rows_returns_none(self) -> None:
        """Zero rows → None. Caller must return 404; must not be treated as zero exposure."""
        assert map_customer_exposure_rows([]) is None

    def test_single_delivery_maps_counts(self) -> None:
        result = map_customer_exposure_rows([_delivery_row()])
        assert result is not None
        assert result["affectedCustomers"] == 1
        assert result["affectedDeliveries"] == 1

    def test_shipped_quantity_sums_rows(self) -> None:
        rows = [_delivery_row(quantity=200.0), _delivery_row(delivery_id="DEL-002", quantity=300.0)]
        result = map_customer_exposure_rows(rows)
        assert result is not None
        assert result["shippedQuantity"] == pytest.approx(500.0)

    def test_duplicate_customers_counted_once(self) -> None:
        rows = [
            _delivery_row(customer_id="CUST-001", delivery_id="DEL-001"),
            _delivery_row(customer_id="CUST-001", delivery_id="DEL-002"),
        ]
        result = map_customer_exposure_rows(rows)
        assert result is not None
        assert result["affectedCustomers"] == 1
        assert result["affectedDeliveries"] == 2

    def test_multiple_distinct_customers(self) -> None:
        rows = [
            _delivery_row(customer_id="CUST-001", delivery_id="DEL-001"),
            _delivery_row(customer_id="CUST-002", delivery_id="DEL-002"),
            _delivery_row(customer_id="CUST-003", delivery_id="DEL-003"),
        ]
        result = map_customer_exposure_rows(rows)
        assert result is not None
        assert result["affectedCustomers"] == 3
        assert result["affectedDeliveries"] == 3

    def test_max_exposure_depth_is_minimum_hop_depth(self) -> None:
        rows = [
            _delivery_row(hop_depth=3),
            _delivery_row(delivery_id="DEL-002", hop_depth=1),
            _delivery_row(delivery_id="DEL-003", hop_depth=2),
        ]
        result = map_customer_exposure_rows(rows)
        assert result is not None
        assert result["maxExposureDepth"] == 1

    def test_null_quantity_excluded_from_total(self) -> None:
        rows = [
            {**_delivery_row(quantity=200.0), "quantity": None},
            _delivery_row(quantity=300.0, delivery_id="DEL-002"),
        ]
        result = map_customer_exposure_rows(rows)
        assert result is not None
        assert result["shippedQuantity"] == pytest.approx(300.0)

    def test_countries_always_empty_list(self) -> None:
        """gold_batch_lineage has no country column — countries must be []."""
        result = map_customer_exposure_rows([_delivery_row()])
        assert result is not None
        assert result["countries"] == []

    def test_blocked_deliveries_always_zero(self) -> None:
        """Blocked delivery status requires gold_batch_delivery_v — must be 0 in this slice."""
        result = map_customer_exposure_rows([_delivery_row()])
        assert result is not None
        assert result["blockedDeliveries"] == 0

    def test_recall_recommended_is_null_governance_pending(self) -> None:
        """Recall rules not yet defined — mapper emits None (no governed
        recommendation). The contract was relaxed to nullable so the mapper
        can stop emitting `False` (which would read as "recall not required").
        """
        result = map_customer_exposure_rows([_delivery_row()])
        assert result is not None
        assert result["recallRecommended"] is None
        assert result["recallRecommended"] is not False
        assert result["recallRecommended"] is not True

    def test_highest_severity_is_medium_preliminary(self) -> None:
        """Preliminary — business severity rules not yet defined."""
        result = map_customer_exposure_rows([_delivery_row()])
        assert result is not None
        assert result["highestSeverity"] == "medium"

    def test_customer_id_leading_zeros_preserved(self) -> None:
        """SAP customer IDs must remain strings — no numeric casting."""
        rows = [_delivery_row(customer_id="0000012345")]
        result = map_customer_exposure_rows(rows)
        assert result is not None
        assert result["affectedCustomers"] == 1

    def test_max_exposure_depth_absent_when_no_hop_depth(self) -> None:
        rows = [{**_delivery_row(), "hop_depth": None}]
        result = map_customer_exposure_rows(rows)
        assert result is not None
        assert "maxExposureDepth" not in result

    def test_delivery_evidence_source_is_lineage(self) -> None:
        """Lineage-only slice must tag deliveryEvidenceSource as 'lineage'."""
        result = map_customer_exposure_rows([_delivery_row()])
        assert result is not None
        assert result["deliveryEvidenceSource"] == "lineage"


# ---------------------------------------------------------------------------
# TestGetCustomerDeliverySpec
# ---------------------------------------------------------------------------

class TestGetCustomerDeliverySpec:
    @pytest.fixture(autouse=True)
    def _set_trace_catalog(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    def _req(self, max_rows: int = 5000) -> Trace2CustomerDeliveryRequest:
        return Trace2CustomerDeliveryRequest("MAT001", "BATCH001", max_rows=max_rows)

    def test_name(self) -> None:
        assert get_customer_delivery_spec(self._req()).name == "trace2.get_customer_deliveries"

    def test_module(self) -> None:
        assert get_customer_delivery_spec(self._req()).module == "trace2"

    def test_endpoint(self) -> None:
        assert get_customer_delivery_spec(self._req()).endpoint == "/api/trace2/customer-deliveries"

    def test_cache_policy_is_per_user(self) -> None:
        assert get_customer_delivery_spec(self._req()).cache_policy == CacheTier.PER_USER_60S

    def test_source_badge_is_gold_batch_delivery_v(self) -> None:
        assert get_customer_delivery_spec(self._req()).source_badge == "view:gold_batch_delivery_v"

    def test_tags(self) -> None:
        spec = get_customer_delivery_spec(self._req())
        assert "trace2" in spec.tags
        assert "customer-deliveries" in spec.tags
        assert "delivery-view" in spec.tags

    def test_params_contain_material_batch_rows(self) -> None:
        spec = get_customer_delivery_spec(self._req(max_rows=1000))
        assert spec.params["material_id"] == "MAT001"
        assert spec.params["batch_id"] == "BATCH001"
        assert spec.params["max_rows"] == 1000

    def test_no_plant_id_in_params(self) -> None:
        """No plant filter — recall requires all plants."""
        spec = get_customer_delivery_spec(self._req())
        assert "plant_id" not in spec.params

    def test_sql_references_gold_batch_delivery_v(self) -> None:
        assert "gold_batch_delivery_v" in get_customer_delivery_spec(self._req()).sql

    def test_sql_uses_fully_qualified_table(self) -> None:
        sql = get_customer_delivery_spec(self._req()).sql
        assert "`connected_plant_uat`" in sql
        assert "`gold`" in sql

    def test_sql_selects_confirmed_columns(self) -> None:
        """All columns verified live 2026-05-20 via DESCRIBE TABLE."""
        sql = get_customer_delivery_spec(self._req()).sql
        assert "DELIVERY" in sql
        assert "CUSTOMER_ID" in sql
        assert "CUSTOMER_NAME" in sql
        assert "COUNTRY_ID" in sql
        assert "COUNTRY_NAME" in sql
        assert "CITY" in sql
        assert "ABS_QUANTITY" in sql
        assert "UOM" in sql
        assert "POSTING_DATE" in sql

    def test_sql_filters_null_delivery_and_customer(self) -> None:
        sql = get_customer_delivery_spec(self._req()).sql
        assert "DELIVERY IS NOT NULL" in sql
        assert "CUSTOMER_ID IS NOT NULL" in sql

    def test_sql_has_limit_max_rows(self) -> None:
        assert "LIMIT :max_rows" in get_customer_delivery_spec(self._req()).sql

    def test_no_plant_filter_in_sql(self) -> None:
        """User confirmed: no plant filter for recall coverage."""
        sql = get_customer_delivery_spec(self._req()).sql
        assert ":plant_id" not in sql

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_customer_delivery_spec(self._req())


# ---------------------------------------------------------------------------
# TestMapCustomerDeliveryRows
# ---------------------------------------------------------------------------

def _delivery_view_row(
    delivery: str = "DEL-001",
    customer_id: str = "CUST-001",
    customer_name: str = "Kerry Ingredients",
    country_id: str = "IE",
    country_name: str = "Ireland",
    city: str = "Dublin",
    abs_quantity: float = 100.0,
    uom: str | None = "KG",
    posting_date: str = "2026-01-15",
) -> dict:
    return {
        "delivery": delivery,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "country_id": country_id,
        "country_name": country_name,
        "city": city,
        "abs_quantity": abs_quantity,
        "uom": uom,
        "posting_date": posting_date,
    }


class TestMapCustomerDeliveryRows:
    def test_empty_rows_returns_none(self) -> None:
        """Zero rows → None. Caller must return 404; must not be treated as zero exposure."""
        assert map_customer_delivery_rows([]) is None

    def test_single_row_maps_counts(self) -> None:
        result = map_customer_delivery_rows([_delivery_view_row()])
        assert result is not None
        assert result["affectedCustomers"] == 1
        assert result["affectedDeliveries"] == 1

    def test_shipped_quantity_sum(self) -> None:
        rows = [_delivery_view_row(abs_quantity=100.0), _delivery_view_row(delivery="DEL-002", abs_quantity=250.0)]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        assert result["shippedQuantity"] == pytest.approx(350.0)

    def test_countries_populated_from_country_id(self) -> None:
        """gold_batch_delivery_v has COUNTRY_ID — countries must be non-empty."""
        rows = [
            _delivery_view_row(delivery="DEL-001", country_id="IE"),
            _delivery_view_row(delivery="DEL-002", country_id="DE"),
            _delivery_view_row(delivery="DEL-003", country_id="IE"),
        ]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        assert sorted(result["countries"]) == ["DE", "IE"]

    def test_null_country_id_excluded_from_countries(self) -> None:
        row = {**_delivery_view_row(), "country_id": None}
        result = map_customer_delivery_rows([row])
        assert result is not None
        assert result["countries"] == []

    def test_distinct_customers(self) -> None:
        rows = [
            _delivery_view_row(customer_id="CUST-001"),
            _delivery_view_row(delivery="DEL-002", customer_id="CUST-001"),
            _delivery_view_row(delivery="DEL-003", customer_id="CUST-002"),
        ]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        assert result["affectedCustomers"] == 2

    def test_distinct_deliveries(self) -> None:
        rows = [
            _delivery_view_row(delivery="DEL-001"),
            _delivery_view_row(delivery="DEL-001"),
            _delivery_view_row(delivery="DEL-002"),
        ]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        assert result["affectedDeliveries"] == 2

    def test_delivery_evidence_source_is_inventory_movements(self) -> None:
        """V1-parity delivery view slice must tag deliveryEvidenceSource correctly."""
        result = map_customer_delivery_rows([_delivery_view_row()])
        assert result is not None
        assert result["deliveryEvidenceSource"] == "inventory-movements"

    def test_blocked_deliveries_is_zero(self) -> None:
        """No confirmed blocked-status column — must be 0 until verified."""
        result = map_customer_delivery_rows([_delivery_view_row()])
        assert result is not None
        assert result["blockedDeliveries"] == 0

    def test_recall_recommended_is_null_governance_pending(self) -> None:
        """No governed recall-rule source — mapper emits None. Contract
        was relaxed to nullable so the mapper stops emitting `False`
        (which would read as "recall not required" — a positive safety
        claim the system cannot make without governance)."""
        result = map_customer_delivery_rows([_delivery_view_row()])
        assert result is not None
        assert result["recallRecommended"] is None

    def test_highest_severity_is_medium_preliminary(self) -> None:
        result = map_customer_delivery_rows([_delivery_view_row()])
        assert result is not None
        assert result["highestSeverity"] == "medium"

    def test_no_max_exposure_depth(self) -> None:
        """gold_batch_delivery_v is direct delivery records — no hop depth."""
        result = map_customer_delivery_rows([_delivery_view_row()])
        assert result is not None
        assert "maxExposureDepth" not in result

    def test_leading_zeros_in_ids_preserved(self) -> None:
        row = _delivery_view_row(delivery="0000000010", customer_id="0000012345")
        result = map_customer_delivery_rows([row])
        assert result is not None
        assert result["affectedDeliveries"] == 1
        assert result["affectedCustomers"] == 1

    def test_null_abs_quantity_excluded_from_sum(self) -> None:
        row = {**_delivery_view_row(), "abs_quantity": None}
        result = map_customer_delivery_rows([row])
        assert result is not None
        assert result["shippedQuantity"] == pytest.approx(0.0)

    def test_uom_taken_from_first_non_null_row(self) -> None:
        """UOM confirmed as string column in gold_batch_delivery_v (DESCRIBE TABLE 2026-05-20)."""
        rows = [_delivery_view_row(uom="KG"), _delivery_view_row(delivery="DEL-002", uom="KG")]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        assert result["uom"] == "KG"

    def test_uom_absent_when_all_null(self) -> None:
        row = {**_delivery_view_row(), "uom": None}
        result = map_customer_delivery_rows([row])
        assert result is not None
        assert "uom" not in result

    def test_uom_absent_when_column_not_present(self) -> None:
        row = {k: v for k, v in _delivery_view_row().items() if k != "uom"}
        result = map_customer_delivery_rows([row])
        assert result is not None
        assert "uom" not in result


# ---------------------------------------------------------------------------
# TestGetSupplierExposureSpec
# ---------------------------------------------------------------------------

class TestGetSupplierExposureSpec:
    @pytest.fixture(autouse=True)
    def _set_trace_catalog(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    def _req(self, max_rows: int = 1000) -> Trace2SupplierExposureRequest:
        return Trace2SupplierExposureRequest("MAT001", "BATCH001", max_rows=max_rows)

    def test_name(self) -> None:
        assert get_supplier_exposure_spec(self._req()).name == "trace2.get_supplier_exposure"

    def test_endpoint(self) -> None:
        assert get_supplier_exposure_spec(self._req()).endpoint == "/api/trace2/supplier-exposure"

    def test_source_badge(self) -> None:
        badge = get_supplier_exposure_spec(self._req()).source_badge
        assert "gold_batch_lineage" in badge
        assert "gold_supplier" in badge

    def test_cache_policy_is_per_user(self) -> None:
        assert get_supplier_exposure_spec(self._req()).cache_policy == CacheTier.PER_USER_60S

    def test_sql_references_both_tables(self) -> None:
        sql = get_supplier_exposure_spec(self._req()).sql
        assert "gold_batch_lineage" in sql
        assert "gold_supplier" in sql

    def test_sql_filters_vendor_receipt_only(self) -> None:
        assert "VENDOR_RECEIPT" in get_supplier_exposure_spec(self._req()).sql

    def test_sql_filters_empty_supplier_id(self) -> None:
        """Live data has SUPPLIER_ID='' for unattributed inputs. Must be excluded."""
        sql = get_supplier_exposure_spec(self._req()).sql
        assert "SUPPLIER_ID IS NOT NULL" in sql
        assert "SUPPLIER_ID <> ''" in sql

    def test_sql_groups_by_supplier(self) -> None:
        sql = get_supplier_exposure_spec(self._req()).sql
        assert "GROUP BY" in sql

    def test_sql_has_limit(self) -> None:
        assert "LIMIT :max_rows" in get_supplier_exposure_spec(self._req()).sql

    def test_params(self) -> None:
        spec = get_supplier_exposure_spec(Trace2SupplierExposureRequest("MAT001", "BATCH001", max_rows=500))
        assert spec.params["material_id"] == "MAT001"
        assert spec.params["batch_id"] == "BATCH001"
        assert spec.params["max_rows"] == 500

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_supplier_exposure_spec(self._req())


# ---------------------------------------------------------------------------
# TestMapSupplierExposureRows
# ---------------------------------------------------------------------------

def _supplier_row(
    supplier_id: str = "0005002928",
    supplier_name: str = "PQ Silicas UK",
    country_id: str = "GB",
    country_name: str = "United Kingdom",
    received_quantity: float = 201300.0,
    receipt_count: int = 20,
    upstream_material_count: int = 1,
    last_receipt_date: str = "2025-06-04",
    uom: str = "KG",
) -> dict:
    return {
        "supplier_id": supplier_id,
        "supplier_name": supplier_name,
        "country_id": country_id,
        "country_name": country_name,
        "received_quantity": received_quantity,
        "receipt_count": receipt_count,
        "upstream_material_count": upstream_material_count,
        "last_receipt_date": last_receipt_date,
        "uom": uom,
    }


class TestMapSupplierExposureRows:
    def test_empty_rows_returns_zero_supplier_summary(self) -> None:
        """Empty result is 200-valid: a batch may have no purchased inputs."""
        result = map_supplier_exposure_rows([])
        assert result["supplierCount"] == 0
        assert result["supplierLots"] == 0
        assert result["upstreamMaterials"] == 0
        assert result["openSupplierActions"] == 0
        assert result["suppliers"] == []

    def test_single_supplier_uat_candidate(self) -> None:
        result = map_supplier_exposure_rows([_supplier_row()])
        assert result["supplierCount"] == 1
        assert result["supplierLots"] == 20
        assert result["upstreamMaterials"] == 1
        assert len(result["suppliers"]) == 1
        s = result["suppliers"][0]
        assert s["supplierId"] == "0005002928"
        assert s["supplierName"] == "PQ Silicas UK"
        assert s["countryId"] == "GB"
        assert s["countryName"] == "United Kingdom"
        assert s["receivedQuantity"] == 201300.0
        assert s["batchCount"] == 20
        assert s["uom"] == "KG"
        assert s["lastReceiptDate"] == "2025-06-04"

    def test_multi_supplier_aggregates(self) -> None:
        rows = [
            _supplier_row(),
            _supplier_row(supplier_id="0005033449", supplier_name="Agropur MSI, LLC",
                          country_id="US", country_name="United States",
                          received_quantity=1886976.0, receipt_count=144, upstream_material_count=1),
        ]
        result = map_supplier_exposure_rows(rows)
        assert result["supplierCount"] == 2
        assert result["supplierLots"] == 164  # 20 + 144
        assert result["upstreamMaterials"] == 2  # 1 + 1
        assert len(result["suppliers"]) == 2

    def test_open_supplier_actions_always_zero(self) -> None:
        """TRACE-P1-012: no verified QM source. openSupplierActions must remain 0."""
        result = map_supplier_exposure_rows([_supplier_row()])
        assert result["openSupplierActions"] == 0

    def test_highest_risk_supplier_absent(self) -> None:
        """TRACE-P1-012: no verified QM source. highestRiskSupplier must not appear."""
        result = map_supplier_exposure_rows([_supplier_row()])
        assert "highestRiskSupplier" not in result

    def test_empty_supplier_id_excluded(self) -> None:
        """SQL filter should exclude these but the mapper double-checks."""
        rows = [_supplier_row(supplier_id=""), _supplier_row()]
        result = map_supplier_exposure_rows(rows)
        assert result["supplierCount"] == 1

    def test_optional_fields_absent_when_null(self) -> None:
        row = _supplier_row()
        for k in ("supplier_name", "country_id", "country_name", "uom", "last_receipt_date"):
            row[k] = None
        result = map_supplier_exposure_rows([row])
        s = result["suppliers"][0]
        for k in ("supplierName", "countryId", "countryName", "uom", "lastReceiptDate"):
            assert k not in s

    def test_supplier_id_leading_zeros_preserved(self) -> None:
        result = map_supplier_exposure_rows([_supplier_row(supplier_id="0000012345")])
        assert result["suppliers"][0]["supplierId"] == "0000012345"


# ---------------------------------------------------------------------------
# TestGetProductionHistorySpec
# ---------------------------------------------------------------------------

class TestGetProductionHistorySpec:
    @pytest.fixture(autouse=True)
    def _set_trace_catalog(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    def _req(self, max_rows: int = 24) -> Trace2ProductionHistoryRequest:
        return Trace2ProductionHistoryRequest("MAT001", max_rows=max_rows)

    def test_name(self) -> None:
        assert get_production_history_spec(self._req()).name == "trace2.get_production_history"

    def test_endpoint(self) -> None:
        assert get_production_history_spec(self._req()).endpoint == "/api/trace2/production-history"

    def test_source_badge(self) -> None:
        assert get_production_history_spec(self._req()).source_badge == "view:gold_batch_production_history_v"

    def test_cache_policy_is_per_user(self) -> None:
        assert get_production_history_spec(self._req()).cache_policy == CacheTier.PER_USER_60S

    def test_sql_references_view(self) -> None:
        assert "gold_batch_production_history_v" in get_production_history_spec(self._req()).sql

    def test_sql_filters_material_only_no_plant(self) -> None:
        """V1 parity: material-only filter — no plant filter."""
        sql = get_production_history_spec(self._req()).sql
        assert "MATERIAL_ID = :material_id" in sql
        assert ":plant_id" not in sql
        assert "PLANT_ID =" not in sql

    def test_sql_orders_by_posting_date_desc(self) -> None:
        assert "ORDER BY POSTING_DATE DESC" in get_production_history_spec(self._req()).sql

    def test_sql_has_limit(self) -> None:
        assert "LIMIT :max_rows" in get_production_history_spec(self._req()).sql

    def test_params(self) -> None:
        spec = get_production_history_spec(Trace2ProductionHistoryRequest("MAT001", max_rows=50))
        assert spec.params["material_id"] == "MAT001"
        assert spec.params["max_rows"] == 50

    def test_default_max_rows_is_24(self) -> None:
        """V1 parity: most-recent 24 batches by default."""
        req = Trace2ProductionHistoryRequest("MAT001")
        assert req.max_rows == 24

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_production_history_spec(self._req())


# ---------------------------------------------------------------------------
# TestMapProductionHistoryRows
# ---------------------------------------------------------------------------

def _ph_row(
    process_order_id: str = "PO-001",
    batch_id: str = "B-001",
    plant_id: str = "P648",
    material_id: str = "70948010",
    posting_date: str = "2025-09-28",
    batch_qty: float = 31335.789,
    uom: str = "KG",
    quality_status: str = "Pass",
) -> dict:
    return {
        "process_order_id": process_order_id,
        "batch_id": batch_id,
        "plant_id": plant_id,
        "material_id": material_id,
        "posting_date": posting_date,
        "batch_qty": batch_qty,
        "uom": uom,
        "quality_status": quality_status,
    }


class TestMapProductionHistoryRows:
    def test_empty_rows_returns_zero_summary_with_material_id(self) -> None:
        """Empty result is 200-valid: a material may not be manufactured on-site."""
        result = map_production_history_rows([], "70948010")
        assert result["materialId"] == "70948010"
        assert result["totalBatches"] == 0
        assert result["passCount"] == 0
        assert result["failCount"] == 0
        assert result["unknownCount"] == 0
        assert result["rows"] == []

    def test_single_pass_row(self) -> None:
        result = map_production_history_rows([_ph_row()], "70948010")
        assert result["totalBatches"] == 1
        assert result["passCount"] == 1
        assert result["failCount"] == 0
        assert len(result["rows"]) == 1
        r = result["rows"][0]
        assert r["batchId"] == "B-001"
        assert r["processOrderId"] == "PO-001"
        assert r["plantId"] == "P648"
        assert r["materialId"] == "70948010"
        assert r["postingDate"] == "2025-09-28"
        assert r["quantity"] == 31335.789
        assert r["uom"] == "KG"
        assert r["qualityStatus"] == "pass"

    def test_quality_status_pass_fail_unknown(self) -> None:
        rows = [
            _ph_row(quality_status="Pass"),
            _ph_row(batch_id="B-002", quality_status="Fail"),
            _ph_row(batch_id="B-003", quality_status="UnexpectedValue"),
            _ph_row(batch_id="B-004", quality_status=None),
        ]
        result = map_production_history_rows(rows, "70948010")
        assert result["passCount"] == 1
        assert result["failCount"] == 1
        assert result["unknownCount"] == 2
        assert [r["qualityStatus"] for r in result["rows"]] == ["pass", "fail", "unknown", "unknown"]

    def test_quality_status_case_insensitive(self) -> None:
        rows = [_ph_row(quality_status="pass"), _ph_row(batch_id="B-2", quality_status="FAIL")]
        result = map_production_history_rows(rows, "70948010")
        assert result["passCount"] == 1
        assert result["failCount"] == 1

    def test_material_id_from_argument_when_row_has_none(self) -> None:
        row = _ph_row()
        row["material_id"] = None
        result = map_production_history_rows([row], "FALLBACK_MAT")
        assert result["materialId"] == "FALLBACK_MAT"
        assert result["rows"][0]["materialId"] == "FALLBACK_MAT"

    def test_optional_fields_absent_when_null(self) -> None:
        row = _ph_row()
        for k in ("process_order_id", "plant_id", "posting_date", "uom"):
            row[k] = None
        result = map_production_history_rows([row], "70948010")
        r = result["rows"][0]
        for k in ("processOrderId", "plantId", "postingDate", "uom"):
            assert k not in r

    def test_null_batch_qty_defaults_to_zero(self) -> None:
        row = _ph_row()
        row["batch_qty"] = None
        result = map_production_history_rows([row], "70948010")
        assert result["rows"][0]["quantity"] == 0.0

    def test_batch_id_leading_zeros_preserved(self) -> None:
        row = _ph_row(batch_id="0000123456")
        result = map_production_history_rows([row], "70948010")
        assert result["rows"][0]["batchId"] == "0000123456"


# ---------------------------------------------------------------------------
# TestGetBatchQualityPassportPartialSpec
#
# Source-truthful guardrails for the post-audit (2026-05-25) rewrite of
# ``get_batch_quality_passport_partial_spec``. Finding #2 of the Databricks
# repository compatibility audit removed seven non-existent columns; these
# tests pin the SQL so a future change cannot silently reintroduce them.
# ---------------------------------------------------------------------------


def _passport_request(
    material_id: str = "0000020582002",
    batch_id: str = "BATCH001",
    plant_id: str = "",
) -> Trace2BatchQualityPassportRequest:
    return Trace2BatchQualityPassportRequest(
        material_id=material_id,
        batch_id=batch_id,
        plant_id=plant_id,
    )


@pytest.fixture(autouse=False)
def _passport_catalog(monkeypatch):
    monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
    monkeypatch.setenv("TRACE_SCHEMA", "gold")


class TestGetBatchQualityPassportPartialSpec:
    def test_spec_properties(self, _passport_catalog) -> None:
        spec = get_batch_quality_passport_partial_spec(_passport_request())
        assert spec.name == "trace2.get_batch_quality_passport_partial"
        assert spec.module == "trace2"
        assert spec.endpoint == "/api/trace2/batch-quality-passport"
        assert spec.cache_policy == CacheTier.PER_USER_60S
        assert spec.params == {
            "material_id": "0000020582002",
            "batch_id": "BATCH001",
            "plant_id": "",
        }
        # All five live views referenced.
        for view in (
            "gold_batch_stock_v",
            "gold_batch_summary_v",
            "gold_material",
            "gold_plant",
            "gold_batch_production_history_v",
        ):
            assert view in spec.sql, f"missing view reference {view!r}"

    def test_spec_drops_columns_absent_from_live_ddl(self, _passport_catalog) -> None:
        """Audit Finding #2: columns absent from live DDL must NOT be
        reintroduced. b.PROCESS_ORDER_ID is gone (PROCESS_ORDER_ID lives
        on ph, not b); the six ph.* fabricated columns are gone too."""
        spec = get_batch_quality_passport_partial_spec(_passport_request())
        for absent in (
            "b.PROCESS_ORDER_ID",
            "ph.START_DATE",
            "ph.CONFIRMED_DATE",
            "ph.PLANNED_QTY",
            "ph.ACTUAL_QTY",
            "ph.PRODUCTION_LINE",
            "ph.OPERATOR",
        ):
            assert absent not in spec.sql, f"removed column {absent!r} leaked back into SQL"

    def test_spec_uses_live_production_history_columns(self, _passport_catalog) -> None:
        """The post-audit SQL must source process_order_id, started_at, and
        actual_qty from the live production-history view."""
        spec = get_batch_quality_passport_partial_spec(_passport_request())
        for expected in (
            "ph.PROCESS_ORDER_ID          AS process_order_id",
            "ph.POSTING_DATE              AS production_started_at",
            "ph.BATCH_QTY                 AS production_actual_qty",
        ):
            assert expected in spec.sql, f"missing expected projection: {expected!r}"

    def test_spec_placeholders_bound_symmetrically(self, _passport_catalog) -> None:
        """Every :placeholder must have a matching params key — no unbound
        placeholders, no orphan params."""
        spec = get_batch_quality_passport_partial_spec(_passport_request(plant_id="C351"))
        for key in ("material_id", "batch_id", "plant_id"):
            assert f":{key}" in spec.sql, f"missing placeholder :{key}"
            assert key in spec.params, f"missing param {key!r}"
        # No stale placeholders left over from removed columns.
        for absent in (":start_date", ":confirmed_date", ":planned_qty", ":actual_qty"):
            assert absent not in spec.sql, f"unexpected placeholder {absent} in SQL"


class TestMapBatchQualityPassportPartial:
    def test_maps_live_production_history_fields(self) -> None:
        """Given the post-audit row shape, the mapper surfaces
        processOrderId, startedAt, and actualQty from the live source."""
        row = {
            "material_id": "20582002",
            "batch_id": "B1",
            "plant_id": "C351",
            "material_name": "Mat",
            "plant_name": "Plant",
            "manufacture_date": "2026-05-01",
            "expiry_date": "2026-11-01",
            "uom": "KG",
            "unrestricted": 100,
            "blocked": 0,
            "quality_inspection": 0,
            "restricted": 0,
            "transit": 0,
            "process_order_id": "1000123456",
            "production_started_at": "2026-05-10",
            "production_actual_qty": 1200.5,
        }
        result = map_batch_quality_passport_partial([row])
        assert result is not None
        assert result["identity"]["processOrderId"] == "1000123456"
        assert result["production"]["orderId"] == "1000123456"
        assert result["production"]["startedAt"] == "2026-05-10"
        assert result["production"]["actualQty"] == 1200.5

    def test_unavailable_production_fields_emit_null(self) -> None:
        """gold_batch_production_history_v has no PRODUCTION_LINE, OPERATOR,
        CONFIRMED_DATE, PLANNED_QTY, ORIGINATING_CUSTOMER, or NOTES
        columns. The Zod source schema was relaxed to nullable+optional in
        this PR so the mapper can emit ``None`` source-truthfully rather
        than reassuring contract defaults (``""`` / ``0.0``)."""
        row = {
            "material_id": "M1",
            "batch_id": "B1",
            "plant_id": "P1",
            "material_name": "Mat",
            "plant_name": "Plant",
            "manufacture_date": "2026-05-01",
            "expiry_date": "2026-11-01",
            "uom": "KG",
            "unrestricted": 0,
            "blocked": 0,
            "quality_inspection": 0,
            "restricted": 0,
            "transit": 0,
            "process_order_id": "PO1",
            "production_started_at": "2026-05-10",
            "production_actual_qty": 100.0,
        }
        result = map_batch_quality_passport_partial([row])
        assert result is not None
        production = result["production"]
        assert production["line"] is None
        assert production["operator"] is None
        assert production["confirmedAt"] is None
        assert production["plannedQty"] is None
        assert production["yield"] is None
        assert production["originatingCustomer"] is None
        assert production["notes"] is None

    def test_unverified_sections_uses_current_contract_field_names(self) -> None:
        """The intermediate _unverifiedSections marker must reference the
        current wire-contract field names. ``signoff`` was renamed to
        ``usageDecisionEvidence`` long before this PR; the marker now
        reflects that. ``production`` is included because the post-audit
        SQL surfaces only three of the section's fields from live UAT."""
        row = {
            "material_id": "M1",
            "batch_id": "B1",
            "plant_id": "P1",
            "material_name": "Mat",
            "plant_name": "Plant",
            "manufacture_date": "2026-05-01",
            "expiry_date": "2026-11-01",
            "uom": "KG",
            "unrestricted": 0,
            "blocked": 0,
            "quality_inspection": 0,
            "restricted": 0,
            "transit": 0,
        }
        result = map_batch_quality_passport_partial([row])
        assert result is not None
        markers = result["_unverifiedSections"]
        assert "production" in markers
        assert "usageDecisionEvidence" in markers
        assert "signoff" not in markers, (
            "`signoff` was renamed to `usageDecisionEvidence` — the marker "
            "must reflect the current wire-contract field name."
        )

    def test_empty_rows_returns_none(self) -> None:
        """No batch in primary sources → caller must surface 404."""
        assert map_batch_quality_passport_partial([]) is None


# ---------------------------------------------------------------------------
# TestGetBatchSearchSpec — governed schema resolution
# ---------------------------------------------------------------------------

class TestGetBatchSearchSpec:
    """Pin the governed-schema resolution for batch-search (Slice 1a — Trace Consumer).

    gold_trace_anchor_secured and gold_batch_lineage must resolve to
    TRACE_GOVERNED_SCHEMA (default "gold_io_reporting"), not TRACE_SCHEMA ("gold").
    gold_material and gold_plant must remain on legacy TRACE_SCHEMA.
    """

    @pytest.fixture(autouse=True)
    def _set_env(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")
        # TRACE_GOVERNED_SCHEMA not set → must default to "gold_io_reporting"

    def _req(self, query: str = "cheese") -> Trace2BatchSearchRequest:
        return Trace2BatchSearchRequest(query=query)

    def test_anchor_resolves_to_governed_schema_by_default(self) -> None:
        """gold_trace_anchor_secured must resolve to TRACE_GOVERNED_SCHEMA
        (default "gold_io_reporting"), not the legacy TRACE_SCHEMA ("gold").
        The deployed app.yaml sets TRACE_SCHEMA: gold which would make this object
        resolve to connected_plant_uat.gold.gold_trace_anchor_secured — that object
        does not exist; the gap is exactly what this change fixes."""
        sql = get_batch_search_spec(self._req()).sql
        assert "`gold_io_reporting`" in sql
        assert "`connected_plant_uat`.`gold`.`gold_trace_anchor_secured`" not in sql

    def test_lineage_po_match_resolves_to_governed_schema_by_default(self) -> None:
        """gold_batch_lineage in the po_match CTE must resolve to TRACE_GOVERNED_SCHEMA.
        Anchor search and po_match must use the same edge universe as trace-graph."""
        sql = get_batch_search_spec(self._req()).sql
        assert "`connected_plant_uat`.`gold_io_reporting`.`gold_batch_lineage`" in sql

    def test_governed_schema_overridable_via_env(self, monkeypatch) -> None:
        """TRACE_GOVERNED_SCHEMA env var must override the default governed schema."""
        monkeypatch.setenv("TRACE_GOVERNED_SCHEMA", "custom_governed")
        sql = get_batch_search_spec(self._req()).sql
        assert "`custom_governed`" in sql
        assert "`gold_io_reporting`" not in sql

    def test_gold_material_stays_on_legacy_trace_schema(self) -> None:
        """gold_material enrichment join must remain on legacy TRACE_SCHEMA ("gold") —
        no governed equivalent exists yet."""
        sql = get_batch_search_spec(self._req()).sql
        assert "`connected_plant_uat`.`gold`.`gold_material`" in sql

    def test_gold_plant_stays_on_legacy_trace_schema(self) -> None:
        """gold_plant enrichment join must remain on legacy TRACE_SCHEMA ("gold") —
        no governed equivalent exists yet."""
        sql = get_batch_search_spec(self._req()).sql
        assert "`connected_plant_uat`.`gold`.`gold_plant`" in sql

    def test_sql_references_anchor_secured_not_stock_view(self) -> None:
        """Primary source must be the T3 anchor MV, not the legacy stock view."""
        sql = get_batch_search_spec(self._req()).sql
        assert "gold_trace_anchor_secured" in sql
        assert "gold_batch_stock_v" not in sql

    def test_po_match_cte_uses_row_number_not_select_distinct(self) -> None:
        """PR #110 accept: if a batch links to multiple matching process orders,
        SELECT DISTINCT cannot deduplicate them (different PROCESS_ORDER_ID values
        produce distinct rows, fanning out the anchor LEFT JOIN).  The fix wraps the
        CTE in a ROW_NUMBER() OVER (PARTITION BY child batch key ORDER BY
        POSTING_DATE DESC NULLS LAST, PROCESS_ORDER_ID DESC) = 1 sub-select so each
        batch keeps at most one process-order row — the most recent."""
        sql = get_batch_search_spec(self._req()).sql
        assert "ROW_NUMBER()" in sql
        assert "PARTITION BY" in sql
        assert "POSTING_DATE DESC NULLS LAST" in sql
        assert "PROCESS_ORDER_ID DESC" in sql
        assert "rn = 1" in sql
        # SELECT DISTINCT must be gone from the po_match CTE — it cannot deduplicate
        # rows that differ only in PROCESS_ORDER_ID.
        assert "SELECT DISTINCT" not in sql

    def test_po_match_plant_join_uses_equality_not_null_safe(self) -> None:
        """PR #110 decline: the null-safe <=> operator was proposed for the anchor
        plant join but must NOT be used.  gold_trace_anchor_secured excludes null
        PLANT_ID rows by design (anchors require a non-null plant for RLS), so
        lineage rows with NULL CHILD_PLANT_ID correctly cannot match an anchor.
        Using <=> would imply null-matching semantics that do not apply and would
        change nothing in practice — the explicit = join is the correct form."""
        sql = get_batch_search_spec(self._req()).sql
        assert "<=>" not in sql
        # The explicit equality join must still be present.
        assert "CHILD_PLANT_ID    = a.PLANT_ID" in sql

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_batch_search_spec(self._req())
