"""Tests for the EnvMon Databricks adapter — QuerySpec factory and row mapper.

Column names are confirmed-ddl (DESCRIBE TABLE run in connected_plant_uat, 2026-05-17).
All three Group A SAP QM views verified: gold_inspection_lot, gold_inspection_point,
gold_batch_quality_result_v.

Mapper output matches EnvMonSiteSummarySchema (packages/data-contracts/src/schemas/
environmental-monitoring.ts). Placeholder fields are documented in adapter module docstring.

Route wired: apps/api/routes/envmon.py (n.txt and p.txt, 2026-05-17).
"""
import pytest
from adapters.envmon.envmon_databricks_adapter import (
    SiteSummaryRequest,
    SwabResultsRequest,
    _default_site_summary,
    _map_status,
    get_site_summary_spec,
    get_swab_results_spec,
    map_site_summary_rows,
    map_swab_result_rows,
)
from shared.query_service.cache_policy import CacheTier
from shared.query_service.errors import DatabricksConfigError

# ---------------------------------------------------------------------------
# get_site_summary_spec
# ---------------------------------------------------------------------------

class TestGetSiteSummarySpec:
    @pytest.fixture(autouse=True)
    def _set_trace_catalog(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    def _request(self) -> SiteSummaryRequest:
        return SiteSummaryRequest(
            plant_id="C061",
            period_start="2026-01-01",
            period_end="2026-05-17",
        )

    def test_name(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.name == "envmon.get_site_summary"

    def test_module(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.module == "envmon"

    def test_endpoint(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.endpoint == "/api/envmon/site-summary"

    def test_cache_policy_is_per_user(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.cache_policy == CacheTier.PER_USER_60S

    def test_source_badge(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.source_badge == "databricks-api"

    def test_tags(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "envmon" in spec.tags
        assert "site-summary" in spec.tags
        assert "kpi" in spec.tags

    def test_plant_id_in_params(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.params["plant_id"] == "C061"

    def test_period_start_in_params(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.params["period_start"] == "2026-01-01"

    def test_period_end_in_params(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert spec.params["period_end"] == "2026-05-17"

    def test_max_rows_not_in_params(self) -> None:
        """Aggregate query uses LIMIT 1 literal — max_rows must not be in params."""
        spec = get_site_summary_spec(self._request())
        assert "max_rows" not in spec.params

    def test_sql_uses_limit_1_not_param(self) -> None:
        """LIMIT must be literal 1, not :max_rows — aggregate returns one row by design."""
        spec = get_site_summary_spec(self._request())
        assert "LIMIT 1" in spec.sql
        assert "LIMIT :max_rows" not in spec.sql

    def test_sql_references_gold_inspection_lot(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "gold_inspection_lot" in spec.sql

    def test_sql_references_gold_inspection_point(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "gold_inspection_point" in spec.sql

    def test_sql_references_gold_batch_quality_result_v(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "gold_batch_quality_result_v" in spec.sql

    def test_sql_uses_trace_catalog(self) -> None:
        """SQL must use catalog from TRACE_CATALOG env var."""
        spec = get_site_summary_spec(self._request())
        assert "`connected_plant_uat`" in spec.sql

    def test_sql_uses_trace_schema(self) -> None:
        """SQL must use schema from TRACE_SCHEMA env var."""
        spec = get_site_summary_spec(self._request())
        assert "`gold`" in spec.sql

    def test_sql_has_no_unqualified_from_gold_inspection_lot(self) -> None:
        """gold_inspection_lot must always be fully qualified — never bare FROM."""
        spec = get_site_summary_spec(self._request())
        assert "FROM gold_inspection_lot" not in spec.sql

    def test_sql_has_no_unqualified_from_gold_inspection_point(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "FROM gold_inspection_point" not in spec.sql

    def test_sql_has_no_unqualified_from_result_v(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "FROM gold_batch_quality_result_v" not in spec.sql

    def test_sql_has_inspection_type_filter(self) -> None:
        """EnvMon domain boundary filter must be present — confirmed-v1+ddl from em_config.py."""
        spec = get_site_summary_spec(self._request())
        assert "INSPECTION_TYPE" in spec.sql
        assert "IN" in spec.sql

    def test_sql_includes_14_inspection_type(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "'14'" in spec.sql

    def test_sql_includes_z14_inspection_type(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert "'Z14'" in spec.sql

    def test_sql_has_plant_id_param_binding(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert ":plant_id" in spec.sql

    def test_sql_has_period_start_param_binding(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert ":period_start" in spec.sql

    def test_sql_has_period_end_param_binding(self) -> None:
        spec = get_site_summary_spec(self._request())
        assert ":period_end" in spec.sql

    def test_sql_uses_functional_location_column(self) -> None:
        """FUNCTIONAL_LOCATION is the grouping key — confirmed-v1+ddl."""
        spec = get_site_summary_spec(self._request())
        assert "FUNCTIONAL_LOCATION" in spec.sql

    def test_sql_uses_inspection_result_valuation_column(self) -> None:
        """INSPECTION_RESULT_VALUATION drives fail/warn/pass classification."""
        spec = get_site_summary_spec(self._request())
        assert "INSPECTION_RESULT_VALUATION" in spec.sql

    def test_sql_uses_fail_valuations(self) -> None:
        """R, REJ, REJECT must all be in the fail classification CASE — confirmed-v1+ddl."""
        spec = get_site_summary_spec(self._request())
        assert "'R'" in spec.sql
        assert "'REJ'" in spec.sql
        assert "'REJECT'" in spec.sql

    def test_sql_uses_warn_valuations(self) -> None:
        """W and WARN must both be in the warning classification CASE — confirmed-v1+ddl."""
        spec = get_site_summary_spec(self._request())
        assert "'W'" in spec.sql
        assert "'WARN'" in spec.sql

    def test_two_requests_produce_independent_params(self) -> None:
        req1 = SiteSummaryRequest("C061", "2026-01-01", "2026-05-17")
        req2 = SiteSummaryRequest("IE01", "2025-01-01", "2025-12-31")
        spec1 = get_site_summary_spec(req1)
        spec2 = get_site_summary_spec(req2)
        assert spec1.params["plant_id"] != spec2.params["plant_id"]
        assert spec1.params["period_start"] != spec2.params["period_start"]

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_site_summary_spec(self._request())


# ---------------------------------------------------------------------------
# map_site_summary_rows
# ---------------------------------------------------------------------------

class TestMapSiteSummaryRows:
    def _full_row(self) -> dict:
        """Aggregate row from get_site_summary_spec SQL (confirmed-ddl column aliases)."""
        return {
            "total_locs": 50,
            "active_fails": 3,
            "warnings": 2,
            "pending": 1,
            "pass_locs": 44,
            "lots_tested": 142,
        }

    def _warn_only_row(self) -> dict:
        """Row with warnings but no fails — riskStatus=elevated."""
        return {
            "total_locs": 20,
            "active_fails": 0,
            "warnings": 5,
            "pending": 0,
            "pass_locs": 15,
            "lots_tested": 40,
        }

    def _all_pass_row(self) -> dict:
        """Row with all locations passing — riskStatus=compliant."""
        return {
            "total_locs": 30,
            "active_fails": 0,
            "warnings": 0,
            "pending": 0,
            "pass_locs": 30,
            "lots_tested": 60,
        }

    def _zero_locs_row(self) -> dict:
        """Aggregate row where total_locs=0 — no data in period."""
        return {
            "total_locs": 0,
            "active_fails": 0,
            "warnings": 0,
            "pending": 0,
            "pass_locs": 0,
            "lots_tested": 0,
        }

    # --- empty rows delegates to _default_site_summary ---

    def test_empty_rows_returns_default(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert isinstance(result, dict)
        assert result["plantId"] == "C061"

    # --- plantId ---

    def test_representative_row_maps_plant_id(self) -> None:
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["plantId"] == "C061"

    # --- plantName is placeholder ---

    def test_plant_name_is_empty_string(self) -> None:
        """plantName is '' — PLACEHOLDER; requires gold_plant JOIN not yet in SQL."""
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["plantName"] == ""

    def test_default_plant_name_is_empty_string(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["plantName"] == ""

    # --- zonesMonitored ← total_locs ---

    def test_zones_monitored_maps_to_total_locs(self) -> None:
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["zonesMonitored"] == 50

    def test_default_zones_monitored_zero(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["zonesMonitored"] == 0

    # --- zonesWithAlerts ← active_fails ---

    def test_zones_with_alerts_maps_to_active_fails(self) -> None:
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["zonesWithAlerts"] == 3

    def test_default_zones_with_alerts_zero(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["zonesWithAlerts"] == 0

    # --- positiveCount ← active_fails ---

    def test_positive_count_maps_to_active_fails(self) -> None:
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["positiveCount"] == 3

    def test_default_positive_count_zero(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["positiveCount"] == 0

    # --- positiveRate (0–100 percentage) ---

    def test_positive_rate_is_percentage(self) -> None:
        """positiveRate = active_fails / total_locs × 100, not a 0–1 fraction."""
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["positiveRate"] == pytest.approx(6.0, rel=1e-4)

    def test_positive_rate_bounded_0_to_100(self) -> None:
        result = map_site_summary_rows([self._full_row()], "C061")
        assert 0.0 <= result["positiveRate"] <= 100.0

    def test_positive_rate_rounded_to_2_decimal_places(self) -> None:
        row = {**self._full_row(), "total_locs": 3, "active_fails": 1}
        result = map_site_summary_rows([row], "C061")
        assert result["positiveRate"] == pytest.approx(round(1 / 3 * 100, 2), abs=1e-4)

    def test_zero_total_locs_gives_zero_positive_rate(self) -> None:
        result = map_site_summary_rows([self._zero_locs_row()], "C061")
        assert result["positiveRate"] == 0.0

    def test_default_positive_rate_zero(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["positiveRate"] == 0.0

    # --- complianceRate (0–100 percentage) ---

    def test_compliance_rate_is_percentage_of_pass_locs(self) -> None:
        """complianceRate = pass_locs / total_locs × 100."""
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["complianceRate"] == pytest.approx(88.0, rel=1e-4)

    def test_compliance_rate_bounded_0_to_100(self) -> None:
        result = map_site_summary_rows([self._full_row()], "C061")
        assert 0.0 <= result["complianceRate"] <= 100.0

    def test_zero_total_locs_gives_zero_compliance_rate(self) -> None:
        result = map_site_summary_rows([self._zero_locs_row()], "C061")
        assert result["complianceRate"] == 0.0

    def test_all_pass_gives_100_compliance_rate(self) -> None:
        result = map_site_summary_rows([self._all_pass_row()], "C061")
        assert result["complianceRate"] == pytest.approx(100.0, rel=1e-4)

    def test_default_compliance_rate_zero(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["complianceRate"] == 0.0

    # --- riskStatus derivation ---

    def test_risk_status_non_compliant_when_fails(self) -> None:
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["riskStatus"] == "non-compliant"

    def test_risk_status_elevated_when_warns_no_fails(self) -> None:
        result = map_site_summary_rows([self._warn_only_row()], "C061")
        assert result["riskStatus"] == "elevated"

    def test_risk_status_compliant_when_all_pass(self) -> None:
        result = map_site_summary_rows([self._all_pass_row()], "C061")
        assert result["riskStatus"] == "compliant"

    def test_risk_status_unknown_when_zero_locs(self) -> None:
        """No data in period → unknown, not compliant."""
        result = map_site_summary_rows([self._zero_locs_row()], "C061")
        assert result["riskStatus"] == "unknown"

    def test_default_risk_status_is_unknown(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["riskStatus"] == "unknown"

    # --- highestSeverity derivation ---

    def test_highest_severity_high_when_fails(self) -> None:
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["highestSeverity"] == "high"

    def test_highest_severity_medium_when_warns_no_fails(self) -> None:
        result = map_site_summary_rows([self._warn_only_row()], "C061")
        assert result["highestSeverity"] == "medium"

    def test_highest_severity_low_when_all_pass(self) -> None:
        result = map_site_summary_rows([self._all_pass_row()], "C061")
        assert result["highestSeverity"] == "low"

    def test_highest_severity_low_when_zero_locs(self) -> None:
        result = map_site_summary_rows([self._zero_locs_row()], "C061")
        assert result["highestSeverity"] == "low"

    def test_default_highest_severity_is_low(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["highestSeverity"] == "low"

    # --- confidence ---

    def test_confidence_one_when_data_present(self) -> None:
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["confidence"] == 1.0

    def test_confidence_zero_when_no_locs(self) -> None:
        result = map_site_summary_rows([self._zero_locs_row()], "C061")
        assert result["confidence"] == 0.0

    def test_default_confidence_is_zero(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["confidence"] == 0.0

    # --- contract compatibility fixed-zero fields (CAPA out of scope) ---

    def test_open_corrective_actions_is_contract_compat_zero(self) -> None:
        """openCorrectiveActions is 0 — contract compatibility fixed zero; CAPA is out of scope for EnvMon V2 parity."""
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["openCorrectiveActions"] == 0

    def test_overdue_actions_is_contract_compat_zero(self) -> None:
        """overdueActions is 0 — contract compatibility fixed zero; CAPA is out of scope for EnvMon V2 parity."""
        result = map_site_summary_rows([self._full_row()], "C061")
        assert result["overdueActions"] == 0

    def test_default_open_corrective_actions_is_placeholder_zero(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["openCorrectiveActions"] == 0

    def test_default_overdue_actions_is_placeholder_zero(self) -> None:
        result = map_site_summary_rows([], "C061")
        assert result["overdueActions"] == 0

    # --- misc ---

    def test_uses_first_row_only(self) -> None:
        row1 = {**self._full_row(), "total_locs": 10, "active_fails": 1, "pass_locs": 9}
        row2 = {**self._full_row(), "total_locs": 20, "active_fails": 2, "pass_locs": 18}
        result = map_site_summary_rows([row1, row2], "C061")
        assert result["zonesMonitored"] == 10

    def test_none_values_in_row_coerced_to_zero(self) -> None:
        row = {**self._full_row(), "total_locs": None, "active_fails": None, "warnings": None, "pass_locs": None}
        result = map_site_summary_rows([row], "C061")
        assert result["zonesMonitored"] == 0
        assert result["positiveCount"] == 0
        assert result["positiveRate"] == 0.0
        assert result["complianceRate"] == 0.0

    def test_plant_id_propagated_to_default(self) -> None:
        result = map_site_summary_rows([], "IE01")
        assert result["plantId"] == "IE01"


# ---------------------------------------------------------------------------
# _default_site_summary
# ---------------------------------------------------------------------------

class TestDefaultSiteSummary:
    def test_returns_dict(self) -> None:
        result = _default_site_summary("C061")
        assert isinstance(result, dict)

    def test_plant_id(self) -> None:
        result = _default_site_summary("C061")
        assert result["plantId"] == "C061"

    def test_plant_name_empty(self) -> None:
        result = _default_site_summary("C061")
        assert result["plantName"] == ""

    def test_zones_monitored_zero(self) -> None:
        result = _default_site_summary("C061")
        assert result["zonesMonitored"] == 0

    def test_positive_count_zero(self) -> None:
        result = _default_site_summary("C061")
        assert result["positiveCount"] == 0

    def test_positive_rate_zero(self) -> None:
        result = _default_site_summary("C061")
        assert result["positiveRate"] == 0.0

    def test_risk_status_unknown(self) -> None:
        result = _default_site_summary("C061")
        assert result["riskStatus"] == "unknown"

    def test_confidence_zero(self) -> None:
        result = _default_site_summary("C061")
        assert result["confidence"] == 0.0

    def test_placeholder_fields_match_map_rows_default(self) -> None:
        """_default_site_summary and map_site_summary_rows([]) must produce identical shapes."""
        from_default = _default_site_summary("C061")
        from_mapper = map_site_summary_rows([], "C061")
        assert from_default == from_mapper


# ---------------------------------------------------------------------------
# get_swab_results_spec
# ---------------------------------------------------------------------------

class TestGetSwabResultsSpec:
    @pytest.fixture(autouse=True)
    def _set_trace_catalog(self, monkeypatch):
        monkeypatch.setenv("TRACE_CATALOG", "connected_plant_uat")
        monkeypatch.setenv("TRACE_SCHEMA", "gold")

    def _request(self) -> SwabResultsRequest:
        return SwabResultsRequest(
            plant_id="C061",
            period_start="2026-01-01",
            period_end="2026-05-17",
            limit=100,
        )

    def test_name(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert spec.name == "envmon.get_swab_results"

    def test_module(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert spec.module == "envmon"

    def test_endpoint(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert spec.endpoint == "/api/envmon/swab-results"

    def test_cache_policy_is_per_user(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert spec.cache_policy == CacheTier.PER_USER_60S

    def test_source_badge(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert spec.source_badge == "databricks-api"

    def test_plant_id_in_params(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert spec.params["plant_id"] == "C061"

    def test_period_start_in_params(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert spec.params["period_start"] == "2026-01-01"

    def test_period_end_in_params(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert spec.params["period_end"] == "2026-05-17"

    def test_limit_not_in_params(self) -> None:
        """Limit is embedded as a literal — must not be a bound parameter."""
        spec = get_swab_results_spec(self._request())
        assert "limit" not in spec.params

    def test_limit_embedded_as_literal_in_sql(self) -> None:
        req = SwabResultsRequest("C061", "2026-01-01", "2026-05-17", limit=50)
        spec = get_swab_results_spec(req)
        assert "LIMIT 50" in spec.sql

    def test_sql_references_gold_inspection_lot(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert "gold_inspection_lot" in spec.sql

    def test_sql_references_gold_inspection_point(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert "gold_inspection_point" in spec.sql

    def test_sql_references_gold_batch_quality_result_v(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert "gold_batch_quality_result_v" in spec.sql

    def test_sql_uses_trace_catalog(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert "`connected_plant_uat`" in spec.sql

    def test_sql_uses_trace_schema(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert "`gold`" in spec.sql

    def test_sql_has_no_unqualified_from_gold_inspection_lot(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert "FROM gold_inspection_lot" not in spec.sql

    def test_sql_has_no_unqualified_from_gold_inspection_point(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert "FROM gold_inspection_point" not in spec.sql

    def test_sql_has_no_unqualified_from_result_v(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert "FROM gold_batch_quality_result_v" not in spec.sql

    def test_sql_has_inspection_type_filter(self) -> None:
        """EnvMon domain boundary filter must be present — confirmed-v1+ddl."""
        spec = get_swab_results_spec(self._request())
        assert "INSPECTION_TYPE" in spec.sql
        assert "'14'" in spec.sql
        assert "'Z14'" in spec.sql

    def test_sql_has_plant_id_param_binding(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert ":plant_id" in spec.sql

    def test_sql_has_period_start_param_binding(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert ":period_start" in spec.sql

    def test_sql_has_period_end_param_binding(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert ":period_end" in spec.sql

    def test_sql_has_date_filter_using_created_date(self) -> None:
        spec = get_swab_results_spec(self._request())
        assert "CREATED_DATE" in spec.sql

    def test_missing_trace_catalog_raises_config_error(self, monkeypatch) -> None:
        monkeypatch.delenv("TRACE_CATALOG", raising=False)
        with pytest.raises(DatabricksConfigError):
            get_swab_results_spec(self._request())


# ---------------------------------------------------------------------------
# map_swab_result_rows
# ---------------------------------------------------------------------------

class TestMapSwabResultRows:
    def _fail_row(self) -> dict:
        return {
            "inspection_lot_id": "00001234",
            "inspection_point_id": "00005678",
            "sample_id": "S001",
            "operation_id": "0010",
            "functional_location": "LOC-001",
            "sample_summary": "Surface swab",
            "sample_hour": 8,
            "plant_id": "C061",
            "inspection_type": "14",
            "created_date": "2026-01-15",
            "inspection_end_date": "2026-01-16",
            "process_order_id": "7006965038",
            "material_id": "00001234",
            "batch_id": "BATCH001",
            "mic_id": "MIC001",
            "mic_name": "TVC",
            "mic_code": "MIC001",
            "result": "REJECT",
            "quantitative_result": 450.0,
            "qualitative_result": None,
            "target_value": 100.0,
            "upper_tolerance": 200.0,
            "lower_tolerance": None,
            "unit_of_measure": "CFU/mL",
            "valuation": "R",
            "inspector": "USER001",
            "inspection_method": "METHOD-001",
        }

    def _pass_row(self) -> dict:
        return {**self._fail_row(), "valuation": "A", "result": "OK", "quantitative_result": 10.0}

    def _warn_row(self) -> dict:
        return {**self._fail_row(), "valuation": "W", "quantitative_result": 180.0}

    def _pending_row(self) -> dict:
        return {**self._fail_row(), "valuation": None, "result": None, "quantitative_result": None}

    def _empty_string_valuation_row(self) -> dict:
        return {**self._fail_row(), "valuation": "", "result": ""}

    # --- empty rows ---

    def test_empty_rows_returns_empty_list(self) -> None:
        assert map_swab_result_rows([]) == []

    # --- status mapping ---

    def test_fail_valuation_r_maps_to_fail(self) -> None:
        result = map_swab_result_rows([self._fail_row()])
        assert result[0]["status"] == "fail"

    def test_fail_valuation_rej_maps_to_fail(self) -> None:
        row = {**self._fail_row(), "valuation": "REJ"}
        result = map_swab_result_rows([row])
        assert result[0]["status"] == "fail"

    def test_fail_valuation_reject_maps_to_fail(self) -> None:
        row = {**self._fail_row(), "valuation": "REJECT"}
        result = map_swab_result_rows([row])
        assert result[0]["status"] == "fail"

    def test_warn_valuation_w_maps_to_warning(self) -> None:
        result = map_swab_result_rows([self._warn_row()])
        assert result[0]["status"] == "warning"

    def test_warn_valuation_warn_maps_to_warning(self) -> None:
        row = {**self._warn_row(), "valuation": "WARN"}
        result = map_swab_result_rows([row])
        assert result[0]["status"] == "warning"

    def test_null_valuation_maps_to_pending(self) -> None:
        result = map_swab_result_rows([self._pending_row()])
        assert result[0]["status"] == "pending"

    def test_accepted_valuation_a_maps_to_pass(self) -> None:
        result = map_swab_result_rows([self._pass_row()])
        assert result[0]["status"] == "pass"

    def test_empty_string_valuation_maps_to_pending(self) -> None:
        """Empty valuation is incomplete SAP QM result state — map to pending."""
        result = map_swab_result_rows([self._empty_string_valuation_row()])
        assert result[0]["status"] == "pending"

    def test_whitespace_valuation_maps_to_pending(self) -> None:
        row = {**self._fail_row(), "valuation": "   "}
        result = map_swab_result_rows([row])
        assert result[0]["status"] == "pending"

    def test_warning_valuation_maps_to_warning(self) -> None:
        row = {**self._warn_row(), "valuation": "WARNING"}
        result = map_swab_result_rows([row])
        assert result[0]["status"] == "warning"

    # --- field mapping ---

    def test_leading_zeros_preserved_in_lot_id(self) -> None:
        result = map_swab_result_rows([self._fail_row()])
        assert result[0]["inspectionLotId"] == "00001234"

    def test_numeric_quantitative_result_preserved(self) -> None:
        result = map_swab_result_rows([self._fail_row()])
        assert result[0]["quantitativeResult"] == pytest.approx(450.0, rel=1e-4)

    def test_valuation_included_in_output_raw(self) -> None:
        result = map_swab_result_rows([self._fail_row()])
        assert result[0]["valuation"] == "R"

    def test_optional_fields_return_none_when_absent(self) -> None:
        result = map_swab_result_rows([self._pending_row()])
        assert result[0]["quantitativeResult"] is None
        assert result[0]["result"] is None

    def test_multiple_rows_all_mapped(self) -> None:
        rows = [self._fail_row(), self._pass_row(), self._pending_row()]
        result = map_swab_result_rows(rows)
        assert len(result) == 3
        assert [r["status"] for r in result] == ["fail", "pass", "pending"]

    def test_field_mapping_preserves_source_backed_fields(self) -> None:
        result = map_swab_result_rows([self._fail_row()])
        row = result[0]
        assert row["targetValue"] == pytest.approx(100.0, rel=1e-4)
        assert row["upperTolerance"] == pytest.approx(200.0, rel=1e-4)
        assert row["lowerTolerance"] is None
        assert row["functionalLocation"] == "LOC-001"
        assert row["micId"] == "MIC001"
        assert row["micName"] == "TVC"
        assert row["micCode"] == "MIC001"
        assert row["inspector"] == "USER001"
        assert row["inspectionMethod"] == "METHOD-001"

    def test_required_identifiers_preserved(self) -> None:
        """sampleId, inspectionPointId, operationId, plantId must all be mapped from source."""
        result = map_swab_result_rows([self._fail_row()])
        row = result[0]
        assert row["sampleId"] == "S001"
        assert row["inspectionPointId"] == "00005678"
        assert row["operationId"] == "0010"
        assert row["plantId"] == "C061"
        assert row["inspectionType"] == "14"
        assert row["createdDate"] == "2026-01-15"

    def test_null_unit_of_measure_returns_none(self) -> None:
        """UOM must not be defaulted to KG or EA — null source value must remain null."""
        row = {**self._fail_row(), "unit_of_measure": None}
        result = map_swab_result_rows([row])
        assert result[0]["unitOfMeasure"] is None

    def test_null_inspection_end_date_returns_none(self) -> None:
        """Ongoing inspection lots have no end date — must not be fabricated."""
        row = {**self._fail_row(), "inspection_end_date": None}
        result = map_swab_result_rows([row])
        assert result[0]["inspectionEndDate"] is None

    def test_null_process_order_id_and_batch_id_return_none(self) -> None:
        """Standalone environmental lots are not linked to a process order or batch."""
        row = {**self._fail_row(), "process_order_id": None, "batch_id": None}
        result = map_swab_result_rows([row])
        assert result[0]["processOrderId"] is None
        assert result[0]["batchId"] is None

    def test_null_mic_fields_when_left_join_returns_no_match(self) -> None:
        """LEFT JOIN: inspection points with no result row produce all-null MIC/result fields.
        Status must be 'pending' — not 'pass' or 'ok' — and no UOM default is invented."""
        row = {
            **self._fail_row(),
            "mic_id": None,
            "mic_name": None,
            "mic_code": None,
            "result": None,
            "quantitative_result": None,
            "qualitative_result": None,
            "target_value": None,
            "upper_tolerance": None,
            "lower_tolerance": None,
            "unit_of_measure": None,
            "valuation": None,
            "inspector": None,
            "inspection_method": None,
        }
        result = map_swab_result_rows([row])
        item = result[0]
        assert item["status"] == "pending"
        assert item["micId"] is None
        assert item["micName"] is None
        assert item["unitOfMeasure"] is None
        assert item["quantitativeResult"] is None

    def test_no_root_cause_or_safety_claim_in_output(self) -> None:
        """Mapper must not invent root cause, sanitation, or area safety conclusions."""
        result = map_swab_result_rows([self._fail_row()])
        item = result[0]
        forbidden = {"rootCause", "sanitationRequired", "sanitationComplete", "areaSafe", "areaUnsafe", "cleaningRequired"}
        assert not forbidden.intersection(item.keys())


# ---------------------------------------------------------------------------
# _map_status (direct unit tests)
# ---------------------------------------------------------------------------

class TestMapStatus:
    """Direct tests for _map_status valuation → category mapping (confirmed-v1+ddl)."""

    def test_none_returns_pending(self) -> None:
        assert _map_status(None) == "pending"

    def test_empty_string_returns_pending(self) -> None:
        assert _map_status("") == "pending"

    def test_whitespace_returns_pending(self) -> None:
        assert _map_status("   ") == "pending"

    def test_r_returns_fail(self) -> None:
        assert _map_status("R") == "fail"

    def test_rej_returns_fail(self) -> None:
        assert _map_status("REJ") == "fail"

    def test_reject_returns_fail(self) -> None:
        assert _map_status("REJECT") == "fail"

    def test_lowercase_r_returns_fail(self) -> None:
        """_map_status applies .upper() so lowercase variants still map correctly."""
        assert _map_status("r") == "fail"

    def test_w_returns_warning(self) -> None:
        assert _map_status("W") == "warning"

    def test_warn_returns_warning(self) -> None:
        assert _map_status("WARN") == "warning"

    def test_warning_returns_warning(self) -> None:
        assert _map_status("WARNING") == "warning"

    def test_accepted_a_returns_pass(self) -> None:
        assert _map_status("A") == "pass"

    def test_unrecognised_valuation_returns_pass(self) -> None:
        """Any non-empty, non-fail, non-warn valuation is treated as pass — V1-confirmed."""
        assert _map_status("X") == "pass"
        assert _map_status("Z") == "pass"
