"""
Unit tests for the SAP transformation helper functions.

These functions are the foundation of every silver table — a mistake here
propagates to all 14 tables, so every edge case is covered explicitly.
"""

from datetime import date, datetime

from pyspark.sql import Row

from silver.helpers import sap_date, sap_datetime, sap_flag, strip_zeros

# ─────────────────────────────────────────────────────────────────────────────
# strip_zeros — SAP leading-zero removal
# ─────────────────────────────────────────────────────────────────────────────

class TestStripZeros:
    def test_standard_material_number(self, spark):
        """18-char zero-padded MATNR collapses to unpadded value."""
        df = spark.createDataFrame([Row(MATNR="000000000000012345")])
        result = df.withColumn("out", strip_zeros("MATNR")).collect()[0]["out"]
        assert result == "12345"

    def test_already_unpadded(self, spark):
        """Non-padded value is returned unchanged."""
        df = spark.createDataFrame([Row(MATNR="ABC-123")])
        result = df.withColumn("out", strip_zeros("MATNR")).collect()[0]["out"]
        assert result == "ABC-123"

    def test_short_padded_key(self, spark):
        """Short padded key (e.g. order item) strips correctly."""
        df = spark.createDataFrame([Row(v="0010")])
        result = df.withColumn("out", strip_zeros("v")).collect()[0]["out"]
        assert result == "10"

    def test_single_zero(self, spark):
        """A fully zero-padded key is normalised to NULL, not an empty string."""
        df = spark.createDataFrame([Row(v="0")])
        result = df.withColumn("out", strip_zeros("v")).collect()[0]["out"]
        assert result is None

    def test_null_passthrough(self, spark):
        """NULL values propagate through unchanged."""
        df = spark.createDataFrame([Row(v=None)], "v STRING")
        result = df.withColumn("out", strip_zeros("v")).collect()[0]["out"]
        assert result is None

    def test_alphanumeric_with_leading_zeros(self, spark):
        """Alphanumeric identifiers are preserved; ALPHA stripping is numeric-only."""
        df = spark.createDataFrame([Row(v="0000ABC001")])
        result = df.withColumn("out", strip_zeros("v")).collect()[0]["out"]
        assert result == "0000ABC001"

    def test_ten_char_padded_order(self, spark):
        """10-char padded sales order number."""
        df = spark.createDataFrame([Row(VBELN="0000012345")])
        result = df.withColumn("out", strip_zeros("VBELN")).collect()[0]["out"]
        assert result == "12345"

    def test_twelve_char_padded_order(self, spark):
        """12-char padded production order number."""
        df = spark.createDataFrame([Row(AUFNR="000000123456")])
        result = df.withColumn("out", strip_zeros("AUFNR")).collect()[0]["out"]
        assert result == "123456"


# ─────────────────────────────────────────────────────────────────────────────
# sap_date — YYYYMMDD string → DATE
# ─────────────────────────────────────────────────────────────────────────────

class TestSapDate:
    def test_valid_date(self, spark):
        df = spark.createDataFrame([Row(d="20241215")])
        result = df.withColumn("out", sap_date("d")).collect()[0]["out"]
        assert result == date(2024, 12, 15)

    def test_start_of_year(self, spark):
        df = spark.createDataFrame([Row(d="20240101")])
        result = df.withColumn("out", sap_date("d")).collect()[0]["out"]
        assert result == date(2024, 1, 1)

    def test_null_returns_null(self, spark):
        df = spark.createDataFrame([Row(d=None)], "d STRING")
        result = df.withColumn("out", sap_date("d")).collect()[0]["out"]
        assert result is None

    def test_sap_empty_date_returns_null(self, spark):
        """SAP uses '00000000' for unset dates — these should not parse to a real date."""
        df = spark.createDataFrame([Row(d="00000000")])
        result = df.withColumn("out", sap_date("d")).collect()[0]["out"]
        # Spark returns NULL for an unparseable date with to_date
        assert result is None

    def test_leap_day(self, spark):
        df = spark.createDataFrame([Row(d="20240229")])
        result = df.withColumn("out", sap_date("d")).collect()[0]["out"]
        assert result == date(2024, 2, 29)

    def test_invalid_date_returns_null(self, spark):
        df = spark.createDataFrame([Row(d="20240230")])
        result = df.withColumn("out", sap_date("d")).collect()[0]["out"]
        assert result is None


# ─────────────────────────────────────────────────────────────────────────────
# sap_datetime — YYYYMMDD + HHMMSS → TIMESTAMP
# ─────────────────────────────────────────────────────────────────────────────

class TestSapDatetime:
    def test_full_timestamp(self, spark):
        df = spark.createDataFrame([Row(d="20241215", t="143000")])
        result = df.withColumn("out", sap_datetime("d", "t")).collect()[0]["out"]
        assert result == datetime(2024, 12, 15, 14, 30, 0)

    def test_midnight(self, spark):
        df = spark.createDataFrame([Row(d="20241215", t="000000")])
        result = df.withColumn("out", sap_datetime("d", "t")).collect()[0]["out"]
        assert result == datetime(2024, 12, 15, 0, 0, 0)

    def test_time_without_leading_zero(self, spark):
        """SAP sometimes stores time as '90000' (9am) rather than '090000'.
        lpad to 6 ensures correct parsing."""
        df = spark.createDataFrame([Row(d="20241215", t="90000")])
        result = df.withColumn("out", sap_datetime("d", "t")).collect()[0]["out"]
        assert result == datetime(2024, 12, 15, 9, 0, 0)

    def test_null_date_returns_null(self, spark):
        df = spark.createDataFrame([Row(d=None, t="143000")], "d STRING, t STRING")
        result = df.withColumn("out", sap_datetime("d", "t")).collect()[0]["out"]
        assert result is None

    def test_null_time_returns_null(self, spark):
        df = spark.createDataFrame([Row(d="20241215", t=None)], "d STRING, t STRING")
        result = df.withColumn("out", sap_datetime("d", "t")).collect()[0]["out"]
        assert result is None

    def test_end_of_day(self, spark):
        df = spark.createDataFrame([Row(d="20241215", t="235959")])
        result = df.withColumn("out", sap_datetime("d", "t")).collect()[0]["out"]
        assert result == datetime(2024, 12, 15, 23, 59, 59)


# ─────────────────────────────────────────────────────────────────────────────
# sap_flag — SAP 'X' / blank → boolean
# ─────────────────────────────────────────────────────────────────────────────

class TestSapFlag:
    def test_x_is_true(self, spark):
        df = spark.createDataFrame([Row(f="X")])
        result = df.withColumn("out", sap_flag("f")).collect()[0]["out"]
        assert result is True

    def test_blank_is_false(self, spark):
        df = spark.createDataFrame([Row(f="")])
        result = df.withColumn("out", sap_flag("f")).collect()[0]["out"]
        assert result is False

    def test_null_is_false(self, spark):
        """NULL in SAP flag fields means 'not set' — treat as False."""
        df = spark.createDataFrame([Row(f=None)], "f STRING")
        result = df.withColumn("out", sap_flag("f")).collect()[0]["out"]
        assert result is False

    def test_lowercase_x_is_false(self, spark):
        """SAP flags are always uppercase X — lowercase is not a valid flag."""
        df = spark.createDataFrame([Row(f="x")])
        result = df.withColumn("out", sap_flag("f")).collect()[0]["out"]
        assert result is False
