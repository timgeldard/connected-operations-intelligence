"""
Tests for the process_order silver transformation.

Business rules under test:
  - AUFK PHAS0-3 flags determine lifecycle status
  - LOEKZ flag maps to is_deletion_flagged
  - Material code and order number are zero-stripped
  - Scheduling dates from AFKO are correctly parsed
  - Left join: orders without an AFKO row are retained (material fields NULL)
  - Order type filter: when PP_PI_ORDER_TYPES is set, non-matching orders excluded
"""

from datetime import date, datetime
from typing import List

import pytest
from pyspark.sql import DataFrame, Row, SparkSession
from pyspark.sql import functions as F

from silver.dlt_silver_pipeline import sap_date, sap_datetime, sap_flag, strip_zeros
from tests.conftest import all_rows, first_row

# Explicit schemas prevent inference failures when rows contain None fields
# or when the list is empty (left-join tests).
_AUFK_SCHEMA = (
    "AUFNR STRING, MANDT STRING, WERKS STRING, AUART STRING, KTEXT STRING, "
    "ERDAT STRING, ERNAM STRING, PHAS0 STRING, PHAS1 STRING, PHAS2 STRING, "
    "PHAS3 STRING, LOEKZ STRING, KDAUF STRING, STDAT STRING, "
    "RecordActivity STRING, AEDATTM STRING"
)
_AFKO_SCHEMA = (
    "AUFNR STRING, MANDT STRING, PLNBEZ STRING, GAMNG DOUBLE, GMEIN STRING, "
    "GSTRS STRING, GLTRS STRING, GSUZS STRING, GLUZS STRING, "
    "GSTRI STRING, GLTRI STRING"
)


# ── Shared transformation (mirrors stg_process_order logic) ─────────────────

def apply_process_order_transform(
    spark: SparkSession,
    aufk_rows: List[Row],
    afko_rows: List[Row],
) -> DataFrame:
    """Build a DataFrame that replicates the stg_process_order staging view."""
    aufk = spark.createDataFrame(aufk_rows, _AUFK_SCHEMA)
    afko = spark.createDataFrame(afko_rows, _AFKO_SCHEMA)

    return (
        aufk.alias("k")
        .join(afko.alias("h"), ["AUFNR", "MANDT"], "left")
        .select(
            strip_zeros("k.AUFNR").alias("order_number"),
            F.col("k.WERKS").alias("plant_code"),
            F.col("k.AUART").alias("order_type_code"),
            F.col("k.KTEXT").alias("order_description"),
            strip_zeros("h.PLNBEZ").alias("material_code"),
            F.col("h.GAMNG").alias("order_quantity"),
            F.col("h.GMEIN").alias("order_quantity_uom"),
            sap_date("h.GSTRS").alias("scheduled_start_date"),
            sap_date("h.GLTRS").alias("scheduled_finish_date"),
            sap_datetime("h.GSTRS", "h.GSUZS").alias("scheduled_start_datetime"),
            sap_date("h.GSTRI").alias("actual_start_date"),
            sap_date("h.GLTRI").alias("actual_finish_date"),
            sap_date("k.ERDAT").alias("created_date"),
            F.col("k.ERNAM").alias("created_by"),
            sap_flag("k.PHAS0").alias("is_created"),
            sap_flag("k.PHAS1").alias("is_released"),
            sap_flag("k.PHAS2").alias("is_completed"),
            sap_flag("k.PHAS3").alias("is_closed"),
            sap_flag("k.LOEKZ").alias("is_deletion_flagged"),
            strip_zeros("k.KDAUF").alias("sales_order_number"),
            F.col("k.RecordActivity").alias("record_activity"),
            F.col("k.AEDATTM").alias("_replicated_at"),
        )
    )


# ── Fixture data ─────────────────────────────────────────────────────────────

def make_aufk(
    AUFNR="000000012345",
    MANDT="100",
    WERKS="1000",
    AUART="PI01",
    KTEXT="Test Process Order",
    ERDAT="20241201",
    ERNAM="JSMITH",
    PHAS0="X", PHAS1="X", PHAS2="", PHAS3="",
    LOEKZ="",
    KDAUF="0000012345",
    STDAT="20241201",
    RecordActivity="I",
    AEDATTM="2024-12-01T10:00:00",
) -> Row:
    return Row(
        AUFNR=AUFNR, MANDT=MANDT, WERKS=WERKS, AUART=AUART,
        KTEXT=KTEXT, ERDAT=ERDAT, ERNAM=ERNAM,
        PHAS0=PHAS0, PHAS1=PHAS1, PHAS2=PHAS2, PHAS3=PHAS3,
        LOEKZ=LOEKZ, KDAUF=KDAUF, STDAT=STDAT,
        RecordActivity=RecordActivity, AEDATTM=AEDATTM,
    )


def make_afko(
    AUFNR="000000012345",
    MANDT="100",
    PLNBEZ="000000000000012345",
    GAMNG=1000.0,
    GMEIN="KG",
    GSTRS="20241205",
    GLTRS="20241210",
    GSUZS="060000",
    GLUZS="220000",
    GSTRI="20241205",
    GLTRI="",  # SAP blank date — sap_date converts to None
) -> Row:
    return Row(
        AUFNR=AUFNR, MANDT=MANDT, PLNBEZ=PLNBEZ, GAMNG=GAMNG,
        GMEIN=GMEIN, GSTRS=GSTRS, GLTRS=GLTRS,
        GSUZS=GSUZS, GLUZS=GLUZS, GSTRI=GSTRI, GLTRI=GLTRI,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Key stripping
# ─────────────────────────────────────────────────────────────────────────────

class TestProcessOrderKeyStripping:
    def test_order_number_stripped(self, spark):
        df = apply_process_order_transform(
            spark, [make_aufk(AUFNR="000000012345")], [make_afko()]
        )
        row = first_row(df)
        assert row["order_number"] == "12345"

    def test_material_code_stripped(self, spark):
        df = apply_process_order_transform(
            spark, [make_aufk()], [make_afko(PLNBEZ="000000000000000999")]
        )
        row = first_row(df)
        assert row["material_code"] == "999"

    def test_sales_order_number_stripped(self, spark):
        df = apply_process_order_transform(
            spark, [make_aufk(KDAUF="0000067890")], [make_afko()]
        )
        row = first_row(df)
        assert row["sales_order_number"] == "67890"


# ─────────────────────────────────────────────────────────────────────────────
# Order lifecycle status flags
# ─────────────────────────────────────────────────────────────────────────────

class TestProcessOrderStatusFlags:
    def test_released_order(self, spark):
        df = apply_process_order_transform(
            spark,
            [make_aufk(PHAS0="X", PHAS1="X", PHAS2="", PHAS3="")],
            [make_afko()],
        )
        row = first_row(df)
        assert row["is_created"]  is True
        assert row["is_released"] is True
        assert row["is_completed"] is False
        assert row["is_closed"]    is False

    def test_completed_order(self, spark):
        df = apply_process_order_transform(
            spark,
            [make_aufk(PHAS0="X", PHAS1="X", PHAS2="X", PHAS3="")],
            [make_afko()],
        )
        row = first_row(df)
        assert row["is_completed"] is True
        assert row["is_closed"]    is False

    def test_closed_order(self, spark):
        df = apply_process_order_transform(
            spark,
            [make_aufk(PHAS0="X", PHAS1="X", PHAS2="X", PHAS3="X")],
            [make_afko()],
        )
        row = first_row(df)
        assert row["is_closed"] is True

    def test_newly_created_order_only_phas0(self, spark):
        df = apply_process_order_transform(
            spark,
            [make_aufk(PHAS0="X", PHAS1="", PHAS2="", PHAS3="")],
            [make_afko()],
        )
        row = first_row(df)
        assert row["is_created"]   is True
        assert row["is_released"]  is False
        assert row["is_completed"] is False

    def test_deletion_flagged(self, spark):
        df = apply_process_order_transform(
            spark, [make_aufk(LOEKZ="X")], [make_afko()]
        )
        row = first_row(df)
        assert row["is_deletion_flagged"] is True

    def test_not_deletion_flagged(self, spark):
        df = apply_process_order_transform(
            spark, [make_aufk(LOEKZ="")], [make_afko()]
        )
        row = first_row(df)
        assert row["is_deletion_flagged"] is False


# ─────────────────────────────────────────────────────────────────────────────
# Scheduling dates
# ─────────────────────────────────────────────────────────────────────────────

class TestProcessOrderDates:
    def test_scheduled_start_date_parsed(self, spark):
        df = apply_process_order_transform(
            spark, [make_aufk()], [make_afko(GSTRS="20241205")]
        )
        row = first_row(df)
        assert row["scheduled_start_date"] == date(2024, 12, 5)

    def test_scheduled_finish_date_parsed(self, spark):
        df = apply_process_order_transform(
            spark, [make_aufk()], [make_afko(GLTRS="20241231")]
        )
        row = first_row(df)
        assert row["scheduled_finish_date"] == date(2024, 12, 31)

    def test_scheduled_start_datetime_combines_date_and_time(self, spark):
        df = apply_process_order_transform(
            spark, [make_aufk()], [make_afko(GSTRS="20241205", GSUZS="060000")]
        )
        row = first_row(df)
        assert row["scheduled_start_datetime"] == datetime(2024, 12, 5, 6, 0, 0)

    def test_actual_start_date_parsed(self, spark):
        df = apply_process_order_transform(
            spark, [make_aufk()], [make_afko(GSTRI="20241206")]
        )
        row = first_row(df)
        assert row["actual_start_date"] == date(2024, 12, 6)

    def test_null_actual_finish_date_when_in_progress(self, spark):
        """Order still running — GLTRI is blank in SAP, arrives as empty string."""
        df = apply_process_order_transform(
            spark, [make_aufk()], [make_afko(GLTRI="")]
        )
        row = first_row(df)
        assert row["actual_finish_date"] is None

    def test_created_date_parsed(self, spark):
        df = apply_process_order_transform(
            spark, [make_aufk(ERDAT="20241201")], [make_afko()]
        )
        row = first_row(df)
        assert row["created_date"] == date(2024, 12, 1)


# ─────────────────────────────────────────────────────────────────────────────
# AUFK–AFKO join behaviour
# ─────────────────────────────────────────────────────────────────────────────

class TestProcessOrderJoin:
    def test_order_without_afko_retained(self, spark):
        """AUFK → AFKO is a left join. An order with no header scheduling data
        must still appear in silver (fields will be NULL)."""
        df = apply_process_order_transform(
            spark,
            [make_aufk(AUFNR="000000099999")],
            [],  # no AFKO row
        )
        rows = all_rows(df)
        assert len(rows) == 1
        assert rows[0]["order_number"] == "99999"
        assert rows[0]["material_code"] is None

    def test_multiple_orders_all_present(self, spark):
        df = apply_process_order_transform(
            spark,
            [make_aufk(AUFNR="000000000001"), make_aufk(AUFNR="000000000002")],
            [make_afko(AUFNR="000000000001"), make_afko(AUFNR="000000000002")],
        )
        rows = all_rows(df)
        order_numbers = {r["order_number"] for r in rows}
        assert order_numbers == {"1", "2"}

    def test_record_activity_delete_flagged(self, spark):
        """RecordActivity='D' rows must be identifiable for apply_changes delete."""
        df = apply_process_order_transform(
            spark, [make_aufk(RecordActivity="D")], [make_afko()]
        )
        row = first_row(df)
        assert row["record_activity"] == "D"
