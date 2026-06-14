"""
Unit tests for gold/risk_common.py — evidence_confidence and base_severity_from_evidence.

Critical invariant: Unknown means evidence is *missing* — NOT a synonym for Low.
A row with no required evidence fields must score Unknown/Unknown, never Low/anything.
"""
from __future__ import annotations

import pytest
from pyspark.sql import Row, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StringType, StructField, StructType

from gold.risk_common import REASON_CODES, base_severity_from_evidence, evidence_confidence


@pytest.fixture
def df_single(spark):
    """Return a DataFrame with one row containing controllable nullable boolean flags."""
    def _make(order_present: bool | None, advisory_flag: bool | None = True):
        order_col = F.lit(True) if order_present is True else (
            F.lit(None).cast(StringType()) if order_present is None else F.lit(False)
        )
        advisory_col = F.lit(True) if advisory_flag is True else (
            F.lit(None).cast(StringType()) if advisory_flag is None else F.lit(False)
        )
        return spark.range(1).select(
            order_col.alias("order_number"),
            advisory_col.alias("has_advisory"),
        )
    return _make


# ---------------------------------------------------------------------------
# evidence_confidence tests
# ---------------------------------------------------------------------------

class TestEvidenceConfidence:
    """evidence_confidence must classify all 4 levels correctly."""

    def test_high_when_all_present_and_advisory_true(self, spark):
        df = spark.range(1).select(
            F.lit("ORD001").alias("order_number"),
            F.lit("PLANT1").alias("plant_code"),
            F.lit(True).alias("has_tr"),
        )
        conf_col = evidence_confidence({
            "order_number_required": F.col("order_number"),
            "plant_code_required": F.col("plant_code"),
            "has_tr_advisory": F.col("has_tr"),
        })
        result = df.select(conf_col.alias("conf")).collect()[0]["conf"]
        assert result == "High"

    def test_medium_when_required_present_advisory_mixed(self, spark):
        df = spark.range(1).select(
            F.lit("ORD001").alias("order_number"),
            F.lit("PLANT1").alias("plant_code"),
            F.lit(True).alias("has_tr"),
            F.lit(False).alias("has_stock"),
        )
        conf_col = evidence_confidence({
            "order_number_required": F.col("order_number"),
            "plant_code_required": F.col("plant_code"),
            "has_tr_advisory": F.col("has_tr"),
            "has_stock_advisory": F.col("has_stock"),
        })
        result = df.select(conf_col.alias("conf")).collect()[0]["conf"]
        assert result == "Medium"

    def test_low_when_required_present_no_advisory(self, spark):
        df = spark.range(1).select(
            F.lit("ORD001").alias("order_number"),
            F.lit("PLANT1").alias("plant_code"),
            F.lit(False).alias("has_tr"),
        )
        conf_col = evidence_confidence({
            "order_number_required": F.col("order_number"),
            "plant_code_required": F.col("plant_code"),
            "has_tr_advisory": F.col("has_tr"),
        })
        result = df.select(conf_col.alias("conf")).collect()[0]["conf"]
        assert result == "Low"

    def test_unknown_when_required_field_null(self, spark):
        """CRITICAL: null required evidence → Unknown (NOT Low)."""
        df = spark.range(1).select(
            F.lit(None).cast(StringType()).alias("order_number"),
            F.lit("PLANT1").alias("plant_code"),
            F.lit(True).alias("has_tr"),
        )
        conf_col = evidence_confidence({
            "order_number_required": F.col("order_number"),
            "plant_code_required": F.col("plant_code"),
            "has_tr_advisory": F.col("has_tr"),
        })
        result = df.select(conf_col.alias("conf")).collect()[0]["conf"]
        assert result == "Unknown", (
            f"Expected Unknown but got '{result}' — null required evidence MUST be Unknown, not Low"
        )

    def test_unknown_when_all_required_fields_null(self, spark):
        """Row with NO evidence must score Unknown."""
        df = spark.range(1).select(
            F.lit(None).cast(StringType()).alias("order_number"),
            F.lit(None).cast(StringType()).alias("plant_code"),
        )
        conf_col = evidence_confidence({
            "order_number_required": F.col("order_number"),
            "plant_code_required": F.col("plant_code"),
        })
        result = df.select(conf_col.alias("conf")).collect()[0]["conf"]
        assert result == "Unknown"

    def test_no_advisory_keys_returns_high_when_required_present(self, spark):
        """When there are no advisory signals, High is the ceiling if required is present."""
        df = spark.range(1).select(F.lit("ORD001").alias("order_number"))
        conf_col = evidence_confidence({
            "order_number_required": F.col("order_number"),
        })
        result = df.select(conf_col.alias("conf")).collect()[0]["conf"]
        assert result == "High"


# ---------------------------------------------------------------------------
# base_severity_from_evidence tests
# ---------------------------------------------------------------------------

class TestBaseSeverityFromEvidence:
    """base_severity_from_evidence must propagate Unknown and downgrade on Low confidence."""

    def _eval(self, spark, hint: str | None, confidence: str | None) -> str:
        hint_col = F.lit(hint).cast(StringType())
        conf_col = F.lit(confidence).cast(StringType())
        sev_col = base_severity_from_evidence(hint_col, conf_col)
        return spark.range(1).select(sev_col.alias("sev")).collect()[0]["sev"]

    def test_unknown_confidence_yields_unknown_severity(self, spark):
        """CRITICAL: Unknown confidence → Unknown severity (never collapse to Low)."""
        result = self._eval(spark, "High", "Unknown")
        assert result == "Unknown", (
            f"Expected Unknown but got '{result}' — Unknown confidence MUST produce Unknown severity"
        )

    def test_null_confidence_yields_unknown_severity(self, spark):
        result = self._eval(spark, "High", None)
        assert result == "Unknown"

    def test_null_hint_yields_unknown_severity(self, spark):
        result = self._eval(spark, None, "High")
        assert result == "Unknown"

    def test_unknown_hint_yields_unknown_severity(self, spark):
        result = self._eval(spark, "Unknown", "High")
        assert result == "Unknown"

    def test_high_confidence_passes_hint_through(self, spark):
        for hint in ("Critical", "High", "Medium", "Low"):
            result = self._eval(spark, hint, "High")
            assert result == hint, f"hint={hint} confidence=High → expected {hint}, got {result}"

    def test_medium_confidence_passes_hint_through(self, spark):
        for hint in ("Critical", "High", "Medium", "Low"):
            result = self._eval(spark, hint, "Medium")
            assert result == hint

    def test_low_confidence_downgrades_severity(self, spark):
        assert self._eval(spark, "Critical", "Low") == "High"
        assert self._eval(spark, "High", "Low") == "Medium"
        assert self._eval(spark, "Medium", "Low") == "Low"
        assert self._eval(spark, "Low", "Low") == "Low"


# ---------------------------------------------------------------------------
# Unknown-not-Low integration: missing row scores Unknown end-to-end
# ---------------------------------------------------------------------------

class TestUnknownNotLowInvariant:
    """Confirm the critical design invariant at the column-expression level."""

    def test_completely_missing_evidence_row_is_unknown_unknown(self, spark):
        """A row with null order_number and null plant_code must score Unknown / Unknown."""
        df = spark.range(1).select(
            F.lit(None).cast(StringType()).alias("order_number"),
            F.lit(None).cast(StringType()).alias("plant_code"),
            F.lit(None).cast(StringType()).alias("severity_hint"),
        )
        conf_col = evidence_confidence({
            "order_number_required": F.col("order_number"),
            "plant_code_required": F.col("plant_code"),
        })
        conf_expr = conf_col.alias("ev_conf")
        sev_expr = base_severity_from_evidence(F.col("severity_hint"), conf_col).alias("sev")

        row = df.select(conf_expr, sev_expr).collect()[0].asDict()

        assert row["ev_conf"] == "Unknown", (
            f"Missing evidence → confidence must be Unknown, got '{row['ev_conf']}'"
        )
        assert row["sev"] == "Unknown", (
            f"Missing evidence → severity must be Unknown, got '{row['sev']}'"
        )
        assert row["ev_conf"] != "Low", "Unknown must NOT collapse to Low"
        assert row["sev"] != "Low", "Unknown severity must NOT collapse to Low"


# ---------------------------------------------------------------------------
# REASON_CODES constant
# ---------------------------------------------------------------------------

class TestReasonCodes:
    """REASON_CODES must load from the CSV and contain all canonical codes."""

    EXPECTED_CODES = {
        "MATERIAL_SHORTFALL",
        "STAGING_INCOMPLETE",
        "TR_AGEING",
        "TO_UNCONFIRMED",
        "ORDER_NOT_STARTED",
        "PRODUCTION_BEHIND_PLAN",
        "QUALITY_HOLD",
        "INSPECTION_LOT_OPEN",
        "UD_MISSING",
        "MIC_RESULT_MISSING",
        "MIC_RESULT_FAILED",
        "OUTBOUND_PICK_INCOMPLETE",
        "DELIVERY_PAST_GI",
        "PREVIOUS_ORDER_OVERRUN",
        "SCHEDULE_CHANGED",
        "STALE_SOURCE",
        "MISSING_MAPPING",
        "UNKNOWN",
    }

    def test_all_expected_codes_present(self):
        assert self.EXPECTED_CODES == set(REASON_CODES.keys()), (
            f"REASON_CODES mismatch.\n"
            f"  Missing: {self.EXPECTED_CODES - set(REASON_CODES.keys())}\n"
            f"  Extra:   {set(REASON_CODES.keys()) - self.EXPECTED_CODES}"
        )

    def test_each_code_has_required_fields(self):
        required = {"reason_code", "domain", "label", "default_responsible_function", "default_severity_hint"}
        for code, row in REASON_CODES.items():
            for field in required:
                assert field in row and row[field], (
                    f"REASON_CODES['{code}'] missing or empty field '{field}'"
                )
