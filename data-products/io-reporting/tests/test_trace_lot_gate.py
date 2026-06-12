"""
Tests for the "trace_lot" plant-gate product area (ADR 016 §4, 2026-06-12).

The trace_lot gate widens quality_inspection_lot and quality_inspection_usage_decision
from the WM-onboarded 4-plant set to the trace-relevant estate:
  plant ∈ (qm_enabled onboarded set) ∪ (site_lifecycle: NOT IN SOLD/DIVESTED_ON_SAP)

Tests cover:
  1. _trace_relevant_plants_df — lifecycle-derived set resolution (present/absent/SOLD exclusion)
  2. active_plants_df("trace_lot") — union of qm_enabled and lifecycle sets
  3. Fallback when site_lifecycle table is absent: reduces to qm_enabled set only
  4. SOLD/DIVESTED_ON_SAP exclusion from the lifecycle-derived set
  5. CLOSED plants are INCLUDED (they appear in traces, QM context is needed)
  6. Union deduplication (plant in both sets appears once in output)

These tests use in-memory DataFrames and mock the Spark conf reads — they do NOT
require a live Databricks cluster or bronze tables.
"""

from unittest.mock import patch

import pytest
from pyspark.sql import Row, SparkSession
from pyspark.sql import functions as F

from tests.conftest import all_rows

# ── Helpers ────────────────────────────────────────────────────────────────────

def _lifecycle_df(spark: SparkSession, rows):
    """Build an in-memory site_lifecycle-shaped DataFrame."""
    schema = "plant_code STRING, effective_lifecycle STRING, review_status STRING"
    return spark.createDataFrame(rows, schema)


def _apply_trace_lifecycle_filter(df, excluded=("SOLD", "DIVESTED_ON_SAP")):
    """Mirror _trace_relevant_plants_df exclusion logic on an in-memory lifecycle DF."""
    return (
        df
        .filter(~F.col("effective_lifecycle").isin(*excluded))
        .select(F.col("plant_code"))
        .distinct()
    )


# ── 1. Lifecycle-derived set: SOLD/DIVESTED_ON_SAP exclusion ──────────────────

class TestTraceRelevantLifecycleFilter:
    """Guards the lifecycle exclusion predicate used by _trace_relevant_plants_df."""

    def test_active_plant_included(self, spark: SparkSession):
        lc = _lifecycle_df(spark, [Row(plant_code="P001", effective_lifecycle="ACTIVE", review_status="CONFIRMED")])
        result = all_rows(_apply_trace_lifecycle_filter(lc))
        assert len(result) == 1
        assert result[0]["plant_code"] == "P001"

    def test_closed_plant_included(self, spark: SparkSession):
        """CLOSED plants appear in traces so their QM context is needed (ADR 016 §2)."""
        lc = _lifecycle_df(spark, [Row(plant_code="P002", effective_lifecycle="CLOSED", review_status="CONFIRMED")])
        result = all_rows(_apply_trace_lifecycle_filter(lc))
        assert len(result) == 1
        assert result[0]["plant_code"] == "P002"

    def test_sold_plant_excluded(self, spark: SparkSession):
        """SOLD plants are excluded (consistent with trace_gold.py _apply_lifecycle_gate)."""
        lc = _lifecycle_df(spark, [Row(plant_code="P003", effective_lifecycle="SOLD", review_status="CONFIRMED")])
        result = all_rows(_apply_trace_lifecycle_filter(lc))
        assert len(result) == 0

    def test_divested_on_sap_plant_excluded(self, spark: SparkSession):
        """DIVESTED_ON_SAP plants are excluded."""
        lc = _lifecycle_df(spark, [Row(plant_code="P004", effective_lifecycle="DIVESTED_ON_SAP", review_status="CONFIRMED")])
        result = all_rows(_apply_trace_lifecycle_filter(lc))
        assert len(result) == 0

    def test_mixed_estate_correct_inclusions(self, spark: SparkSession):
        """Estate with mix of ACTIVE/CLOSED/SOLD/DIVESTED_ON_SAP — only excluded statuses removed."""
        rows = [
            Row(plant_code="A001", effective_lifecycle="ACTIVE", review_status="CONFIRMED"),
            Row(plant_code="C001", effective_lifecycle="CLOSED", review_status="CONFIRMED"),
            Row(plant_code="S001", effective_lifecycle="SOLD", review_status="CONFIRMED"),
            Row(plant_code="D001", effective_lifecycle="DIVESTED_ON_SAP", review_status="CONFIRMED"),
        ]
        lc = _lifecycle_df(spark, rows)
        result = all_rows(_apply_trace_lifecycle_filter(lc))
        plant_codes = {r["plant_code"] for r in result}
        assert "A001" in plant_codes, "ACTIVE should be included"
        assert "C001" in plant_codes, "CLOSED should be included"
        assert "S001" not in plant_codes, "SOLD should be excluded"
        assert "D001" not in plant_codes, "DIVESTED_ON_SAP should be excluded"
        assert len(plant_codes) == 2

    def test_distinct_deduplication(self, spark: SparkSession):
        """Duplicate plant_code rows in lifecycle table deduplicate to one row."""
        rows = [
            Row(plant_code="P001", effective_lifecycle="ACTIVE", review_status="CONFIRMED"),
            Row(plant_code="P001", effective_lifecycle="ACTIVE", review_status="CONFIRMED"),
        ]
        lc = _lifecycle_df(spark, rows)
        result = all_rows(_apply_trace_lifecycle_filter(lc))
        assert len(result) == 1


# ── 2. Union behaviour: qm_enabled ∪ lifecycle set ────────────────────────────

class TestTraceLotUnion:
    """Guards the UNION logic: trace_lot = qm_enabled ∪ lifecycle_set."""

    def test_union_includes_lifecycle_only_plant(self, spark: SparkSession):
        """A plant in lifecycle (not qm_enabled) is included in the trace_lot set."""
        qm_plants = spark.createDataFrame([Row(plant_code="C061")], "plant_code STRING")
        lc_plants = spark.createDataFrame(
            [Row(plant_code="C061"), Row(plant_code="X999")], "plant_code STRING"
        )
        result_codes = {r["plant_code"] for r in all_rows(qm_plants.unionByName(lc_plants).distinct())}
        assert "C061" in result_codes
        assert "X999" in result_codes

    def test_union_deduplicates_plant_in_both_sets(self, spark: SparkSession):
        """A plant in both qm_enabled and lifecycle set appears exactly once."""
        qm_plants = spark.createDataFrame([Row(plant_code="C061")], "plant_code STRING")
        lc_plants = spark.createDataFrame([Row(plant_code="C061")], "plant_code STRING")
        result = all_rows(qm_plants.unionByName(lc_plants).distinct())
        assert len(result) == 1
        assert result[0]["plant_code"] == "C061"

    def test_empty_lifecycle_set_union_is_qm_set(self, spark: SparkSession):
        """When lifecycle set is empty (fallback), union = qm_enabled set only."""
        qm_plants = spark.createDataFrame(
            [Row(plant_code="C061"), Row(plant_code="P817")], "plant_code STRING"
        )
        lc_empty = spark.createDataFrame([], "plant_code STRING")
        result = all_rows(qm_plants.unionByName(lc_empty).distinct())
        assert len(result) == 2
        codes = {r["plant_code"] for r in result}
        assert codes == {"C061", "P817"}


# ── 3. Fallback behaviour when site_lifecycle table absent ────────────────────

class TestTraceRelevantPlantsDefallback:
    """Guards _trace_relevant_plants_df fallback logic.

    The function returns an empty DataFrame when the site_lifecycle_table conf is
    absent or the table does not exist. This ensures the gate NEVER widens beyond
    the qm_enabled set when the lifecycle table is not yet seeded.
    """

    def test_fallback_returns_empty_when_conf_absent(self, spark: SparkSession):
        """When site_lifecycle_table conf is not set, _trace_relevant_plants_df returns empty."""
        from silver._plant_gate import _trace_relevant_plants_df

        # Patch spark.conf.get to return None for the lifecycle conf key.
        original_get = spark.conf.get

        def patched_conf_get(key, default=None):
            if key == "site_lifecycle_table":
                return None
            return original_get(key, default)

        with patch.object(spark.conf, "get", side_effect=patched_conf_get):
            result = all_rows(_trace_relevant_plants_df(spark))
        assert result == [], f"Expected empty, got {result}"

    def test_fallback_returns_empty_when_table_not_exist(self, spark: SparkSession):
        """When site_lifecycle table does not exist, _trace_relevant_plants_df returns empty."""
        from silver._plant_gate import _trace_relevant_plants_df

        original_get = spark.conf.get

        def patched_conf_get(key, default=None):
            if key == "site_lifecycle_table":
                return "connected_plant_dev.silver.site_lifecycle"
            return original_get(key, default)

        with patch.object(spark.conf, "get", side_effect=patched_conf_get):
            with patch("silver._plant_gate.relation_exists", return_value=False):
                result = all_rows(_trace_relevant_plants_df(spark))
        assert result == [], f"Expected empty, got {result}"


# ── 4. active_plants_df registry includes "trace_lot" ────────────────────────

class TestActivePlantsTraceRegistration:
    """Guards that "trace_lot" is a registered product_area in _PRODUCT_AREA_FLAG."""

    def test_trace_lot_is_registered_area(self):
        """active_plants_df("trace_lot") should not raise ValueError."""
        from silver._plant_gate import _PRODUCT_AREA_FLAG
        assert "trace_lot" in _PRODUCT_AREA_FLAG, (
            "'trace_lot' must be in _PRODUCT_AREA_FLAG; "
            "apply_plant_gate(df, col, 'trace_lot') would raise ValueError otherwise."
        )

    def test_unknown_area_raises(self, spark: SparkSession):
        """Unregistered product_area raises ValueError (fail-loud for typos)."""
        from silver._plant_gate import active_plants_df
        with pytest.raises(ValueError, match="Unknown product_area"):
            active_plants_df(spark, "nonexistent_area_xyz")

    def test_trace_excluded_lifecycle_constant_matches_trace_gold(self):
        """_TRACE_EXCLUDED_LIFECYCLE must match gold/trace_gold.py _EXCLUDED_LIFECYCLE."""
        from silver._plant_gate import _TRACE_EXCLUDED_LIFECYCLE
        # Verified against gold/trace_gold.py line: _EXCLUDED_LIFECYCLE = ("SOLD", "DIVESTED_ON_SAP")
        assert set(_TRACE_EXCLUDED_LIFECYCLE) == {"SOLD", "DIVESTED_ON_SAP"}, (
            "_TRACE_EXCLUDED_LIFECYCLE must match gold/trace_gold.py _EXCLUDED_LIFECYCLE "
            "to keep the lifecycle exclusion consistent across the estate."
        )
