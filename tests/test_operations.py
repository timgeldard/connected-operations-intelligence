"""
Tests for the operations-level silver transformations.

Business rules under test:
  - process_order_operation: AFVC+AFVV+AFKO three-way join, is_confirmed from
    RUECK presence, zero-padding on order_number
  - pi_sheet_execution: pi_sheet_status derivation (Completed/In Progress/Not
    Started), duration_hours = ZDUR * 24, zero-padding on ZAUFNR
  - downtime_event: ZDEL='X' soft-delete filter, duration_minutes from start/end timestamps
  - quality_inspection_lot: usage_decision derivation from VCODE,
    is_deletion_flagged from KZLOESCH, QALS+QMIH left join
"""

from datetime import date, datetime
from typing import List

from pyspark.sql import DataFrame, Row, SparkSession
from pyspark.sql import functions as F

from silver.helpers import sap_date, sap_datetime, sap_flag, strip_zeros
from tests.conftest import all_rows, first_row

_AFVC_SCHEMA = (
    "AUFPL STRING, APLZL STRING, MANDT STRING, VORNR STRING, WERKS STRING, "
    "LTXA1 STRING, RUECK STRING, AEDATTM STRING"
)
_AFVV_SCHEMA = (
    "AUFPL STRING, APLZL STRING, MANDT STRING, "
    "SSAVD STRING, SSAVZ STRING, SSEDD STRING, SSEDZ STRING, LMNGA DOUBLE"
)
_AFKO_OP_SCHEMA = "AUFPL STRING, AUFNR STRING, MANDT STRING"
_PI_SCHEMA = (
    "ZWERKS STRING, ZAUFNR STRING, ZVORNR STRING, "
    "ZSDATS STRING, ZSTIMS STRING, ZEDATS STRING, ZETIMS STRING, "
    "ZDUR DOUBLE, ZUSERSTART STRING, ZUSEREND STRING, AEDATTM STRING"
)
_DOWNTIME_SCHEMA = (
    "AUFNR STRING, WERKS STRING, MATNR STRING, VORNR STRING, ZITEM STRING, "
    "ZRCD STRING, ZTEXT STRING, ZAUSVN STRING, ZAUZTV STRING, "
    "ZAUSBS STRING, ZAUZTB STRING, ZEAUSZT DOUBLE, ZDEL STRING, AEDATTM STRING"
)
_QALS_SCHEMA = (
    "PRUEFLOS STRING, MANDT STRING, WERKS STRING, MATNR STRING, CHARG STRING, "
    "MENGE DOUBLE, ENSTDE STRING, EENDDE STRING, VCODE STRING, "
    "KZLOESCH STRING, AEDATTM STRING"
)
_QMIH_SCHEMA = "PRUEFLOS STRING, MANDT STRING, QMNUM STRING, AUFNR STRING"


# ─────────────────────────────────────────────────────────────────────────────
# Process Order Operation helpers
# ─────────────────────────────────────────────────────────────────────────────

def apply_operation_transform(
    spark: SparkSession,
    afvc_rows: List[Row],
    afvv_rows: List[Row],
    afko_rows: List[Row],
) -> DataFrame:
    afvc = spark.createDataFrame(afvc_rows, _AFVC_SCHEMA)
    afvv = spark.createDataFrame(afvv_rows, _AFVV_SCHEMA)
    afko = spark.createDataFrame(afko_rows, _AFKO_OP_SCHEMA)

    return (
        afvc.alias("o")
        .join(afvv.alias("v"),  ["AUFPL", "APLZL", "MANDT"], "left")
        .join(afko.alias("h"),  ["AUFPL",           "MANDT"], "left")
        .select(
            strip_zeros("h.AUFNR").alias("order_number"),
            F.col("o.AUFPL").alias("routing_number"),
            F.col("o.APLZL").alias("operation_counter"),
            F.col("o.VORNR").alias("operation_number"),
            F.col("o.WERKS").alias("plant_code"),
            F.col("o.LTXA1").alias("operation_description"),
            sap_datetime("v.SSAVD", "v.SSAVZ").alias("scheduled_start_datetime"),
            sap_datetime("v.SSEDD", "v.SSEDZ").alias("scheduled_finish_datetime"),
            F.col("v.LMNGA").alias("confirmed_yield_quantity"),
            F.when(F.col("o.RUECK").isNotNull(), True).otherwise(False).alias("is_confirmed"),
            F.col("o.RUECK").alias("confirmation_number"),
            F.col("o.AEDATTM").alias("_replicated_at"),
        )
    )


def make_afvc(
    AUFPL="0000000001",
    APLZL="0000",
    MANDT="100",
    VORNR="0010",
    WERKS="1000",
    LTXA1="Mix and blend",
    RUECK=None,  # null = not yet confirmed; schema specifies STRING so inference works
    AEDATTM="2024-12-01T10:00:00",
):
    return Row(
        AUFPL=AUFPL, APLZL=APLZL, MANDT=MANDT, VORNR=VORNR,
        WERKS=WERKS, LTXA1=LTXA1, RUECK=RUECK, AEDATTM=AEDATTM,
    )


def make_afvv(
    AUFPL="0000000001",
    APLZL="0000",
    MANDT="100",
    SSAVD="20241205",
    SSAVZ="060000",
    SSEDD="20241205",
    SSEDZ="140000",
    LMNGA=0.0,
):
    return Row(
        AUFPL=AUFPL, APLZL=APLZL, MANDT=MANDT,
        SSAVD=SSAVD, SSAVZ=SSAVZ, SSEDD=SSEDD, SSEDZ=SSEDZ,
        LMNGA=LMNGA,
    )


def make_afko_for_op(
    AUFPL="0000000001",
    AUFNR="000000012345",
    MANDT="100",
):
    return Row(AUFPL=AUFPL, AUFNR=AUFNR, MANDT=MANDT)


# ─────────────────────────────────────────────────────────────────────────────
# PI Sheet Execution helpers
# ─────────────────────────────────────────────────────────────────────────────

def apply_pi_sheet_transform(spark: SparkSession, src_rows: List[Row]) -> DataFrame:
    src = spark.createDataFrame(src_rows, _PI_SCHEMA)
    pi_sheet_start_datetime = sap_datetime("ZSDATS", "ZSTIMS")
    pi_sheet_end_datetime = sap_datetime("ZEDATS", "ZETIMS")
    return src.select(
        F.col("ZWERKS").alias("plant_code"),
        strip_zeros("ZAUFNR").alias("order_number"),
        F.col("ZVORNR").alias("operation_number"),
        pi_sheet_start_datetime.alias("pi_sheet_start_datetime"),
        pi_sheet_end_datetime.alias("pi_sheet_end_datetime"),
        F.col("ZDUR").alias("duration_decimal_days"),
        F.round(F.col("ZDUR") * 24, 4).alias("duration_hours"),
        F.when(pi_sheet_end_datetime.isNotNull(), "Completed")
         .when(pi_sheet_start_datetime.isNotNull(), "In Progress")
         .otherwise("Not Started").alias("pi_sheet_status"),
        F.col("ZUSERSTART").alias("started_by_user"),
        F.col("ZUSEREND").alias("completed_by_user"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


def make_pi_sheet(
    ZWERKS="1000",
    ZAUFNR="000000012345",
    ZVORNR="0010",
    ZSDATS="20241205",
    ZSTIMS="060000",
    ZEDATS=None,    # null → "In Progress" (sheet started, not yet ended)
    ZETIMS=None,
    ZDUR=0.5,
    ZUSERSTART="JSMITH",
    ZUSEREND=None,
    AEDATTM="2024-12-05T10:00:00",
):
    return Row(
        ZWERKS=ZWERKS, ZAUFNR=ZAUFNR, ZVORNR=ZVORNR,
        ZSDATS=ZSDATS, ZSTIMS=ZSTIMS, ZEDATS=ZEDATS, ZETIMS=ZETIMS,
        ZDUR=ZDUR, ZUSERSTART=ZUSERSTART, ZUSEREND=ZUSEREND,
        AEDATTM=AEDATTM,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Downtime Event helpers
# ─────────────────────────────────────────────────────────────────────────────

def apply_downtime_transform(spark: SparkSession, src_rows: List[Row]) -> DataFrame:
    src = spark.createDataFrame(src_rows, _DOWNTIME_SCHEMA)
    start_datetime = sap_datetime("ZAUSVN", "ZAUZTV")
    end_datetime = sap_datetime("ZAUSBS", "ZAUZTB")
    return (
        src.filter(F.col("ZDEL").isNull() | (F.col("ZDEL") != "X"))
        .select(
            strip_zeros("AUFNR").alias("order_number"),
            F.col("WERKS").alias("plant_code"),
            strip_zeros("MATNR").alias("material_code"),
            F.col("VORNR").alias("operation_number"),
            F.col("ZITEM").alias("item_number"),
            F.col("ZRCD").alias("downtime_reason_code"),
            F.col("ZTEXT").alias("downtime_reason_description"),
            start_datetime.alias("start_datetime"),
            end_datetime.alias("end_datetime"),
            F.when(
                start_datetime.isNotNull() & end_datetime.isNotNull(),
                (F.unix_timestamp(end_datetime) - F.unix_timestamp(start_datetime)) / 60,
            )
            .otherwise(F.col("ZEAUSZT"))
            .alias("duration_minutes"),
            F.col("ZDEL").alias("_zdel"),
            F.col("AEDATTM").alias("_replicated_at"),
        )
    )


def make_downtime(
    AUFNR="000000012345",
    WERKS="1000",
    MATNR="000000000000012345",
    VORNR="0010",
    ZITEM="001",
    ZRCD="M01",
    ZTEXT="Equipment failure",
    ZAUSVN="20241205",
    ZAUZTV="080000",
    ZAUSBS="20241205",
    ZAUZTB="090000",
    ZEAUSZT=1.0,
    ZDEL="",
    AEDATTM="2024-12-05T10:00:00",
):
    return Row(
        AUFNR=AUFNR, WERKS=WERKS, MATNR=MATNR, VORNR=VORNR, ZITEM=ZITEM,
        ZRCD=ZRCD, ZTEXT=ZTEXT, ZAUSVN=ZAUSVN, ZAUZTV=ZAUZTV,
        ZAUSBS=ZAUSBS, ZAUZTB=ZAUZTB, ZEAUSZT=ZEAUSZT, ZDEL=ZDEL,
        AEDATTM=AEDATTM,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Quality Inspection Lot helpers
# ─────────────────────────────────────────────────────────────────────────────

def apply_quality_lot_transform(
    spark: SparkSession,
    qals_rows: List[Row],
    qmih_rows: List[Row],
) -> DataFrame:
    qals = spark.createDataFrame(qals_rows, _QALS_SCHEMA)
    qmih = spark.createDataFrame(qmih_rows, _QMIH_SCHEMA)

    return (
        qals.alias("l")
        .join(qmih.alias("m"), (F.col("l.PRUEFLOS") == F.col("m.PRUEFLOS")) & (F.col("l.MANDT") == F.col("m.MANDT")), "left")
        .select(
            F.col("l.PRUEFLOS").alias("inspection_lot_number"),
            F.col("l.WERKS").alias("plant_code"),
            strip_zeros("l.MATNR").alias("material_code"),
            strip_zeros("l.CHARG").alias("batch_number"),
            strip_zeros("m.AUFNR").alias("order_number"),
            F.col("m.QMNUM").alias("quality_notification_number"),
            F.col("l.MENGE").alias("inspection_lot_quantity"),
            sap_date("l.ENSTDE").alias("inspection_start_date"),
            sap_date("l.EENDDE").alias("inspection_end_date"),
            F.col("l.VCODE").alias("usage_decision_code"),
            F.when(F.col("l.VCODE").isin("A", "AA"), "Accepted")
             .when(F.col("l.VCODE").isin("R", "RA"), "Rejected")
             .when(F.col("l.VCODE").isNotNull(),      "Other Decision")
             .otherwise("Pending").alias("usage_decision"),
            sap_flag("l.KZLOESCH").alias("is_deletion_flagged"),
            F.col("l.AEDATTM").alias("_replicated_at"),
        )
    )


def make_qals(
    PRUEFLOS="000000000001",
    MANDT="100",
    WERKS="1000",
    MATNR="000000000000012345",
    CHARG="0000001234",
    MENGE=1000.0,
    ENSTDE="20241201",
    EENDDE=None,    # null → inspection still open
    VCODE=None,     # null → usage decision not yet recorded → "Pending"
    KZLOESCH="",
    AEDATTM="2024-12-01T10:00:00",
):
    return Row(
        PRUEFLOS=PRUEFLOS, MANDT=MANDT, WERKS=WERKS, MATNR=MATNR, CHARG=CHARG,
        MENGE=MENGE, ENSTDE=ENSTDE, EENDDE=EENDDE, VCODE=VCODE,
        KZLOESCH=KZLOESCH, AEDATTM=AEDATTM,
    )


def make_qmih(
    PRUEFLOS="000000000001",
    MANDT="100",
    QMNUM="000100000001",
    AUFNR="000000012345",
):
    return Row(PRUEFLOS=PRUEFLOS, MANDT=MANDT, QMNUM=QMNUM, AUFNR=AUFNR)


# ─────────────────────────────────────────────────────────────────────────────
# Process Order Operation — confirmation status
# ─────────────────────────────────────────────────────────────────────────────

class TestProcessOrderOperation:
    def test_confirmed_when_rueck_present(self, spark):
        df = apply_operation_transform(
            spark,
            [make_afvc(RUECK="0000000001")],
            [make_afvv()],
            [make_afko_for_op()],
        )
        row = first_row(df)
        assert row["is_confirmed"] is True
        assert row["confirmation_number"] == "0000000001"

    def test_not_confirmed_when_rueck_null(self, spark):
        df = apply_operation_transform(
            spark,
            [make_afvc(RUECK=None)],
            [make_afvv()],
            [make_afko_for_op()],
        )
        row = first_row(df)
        assert row["is_confirmed"] is False
        assert row["confirmation_number"] is None

    def test_order_number_stripped_via_afko(self, spark):
        df = apply_operation_transform(
            spark,
            [make_afvc()],
            [make_afvv()],
            [make_afko_for_op(AUFNR="000000099999")],
        )
        assert first_row(df)["order_number"] == "99999"

    def test_operation_without_afvv_retained(self, spark):
        """Operation with no AFVV row (no quantity/date data) must still appear."""
        df = apply_operation_transform(
            spark,
            [make_afvc(AUFPL="0000000099")],
            [],  # no AFVV
            [make_afko_for_op(AUFPL="0000000099")],
        )
        rows = all_rows(df)
        assert len(rows) == 1
        assert rows[0]["scheduled_start_datetime"] is None

    def test_scheduled_start_datetime_parsed(self, spark):
        df = apply_operation_transform(
            spark,
            [make_afvc()],
            [make_afvv(SSAVD="20241205", SSAVZ="060000")],
            [make_afko_for_op()],
        )
        assert first_row(df)["scheduled_start_datetime"] == datetime(2024, 12, 5, 6, 0, 0)

    def test_repeated_display_operation_numbers_keep_technical_grain(self, spark):
        df = apply_operation_transform(
            spark,
            [
                make_afvc(APLZL="0001", VORNR="0010", LTXA1="Main operation"),
                make_afvc(APLZL="0002", VORNR="0010", LTXA1="Parallel operation"),
            ],
            [
                make_afvv(APLZL="0001", LMNGA=10.0),
                make_afvv(APLZL="0002", LMNGA=20.0),
            ],
            [make_afko_for_op()],
        )
        rows = all_rows(df)
        assert len(rows) == 2
        assert {r["operation_counter"] for r in rows} == {"0001", "0002"}
        assert {r["operation_number"] for r in rows} == {"0010"}


# ─────────────────────────────────────────────────────────────────────────────
# PI Sheet Execution — status and duration
# ─────────────────────────────────────────────────────────────────────────────

class TestPiSheetExecution:
    def test_status_completed_when_end_date_set(self, spark):
        df = apply_pi_sheet_transform(
            spark,
            [make_pi_sheet(ZSDATS="20241205", ZEDATS="20241205", ZETIMS="140000")],
        )
        assert first_row(df)["pi_sheet_status"] == "Completed"

    def test_status_in_progress_when_only_start_set(self, spark):
        df = apply_pi_sheet_transform(
            spark,
            [make_pi_sheet(ZSDATS="20241205", ZEDATS=None)],
        )
        assert first_row(df)["pi_sheet_status"] == "In Progress"

    def test_status_not_started_when_no_dates(self, spark):
        df = apply_pi_sheet_transform(
            spark,
            [make_pi_sheet(ZSDATS=None, ZSTIMS=None, ZEDATS=None, ZETIMS=None)],
        )
        assert first_row(df)["pi_sheet_status"] == "Not Started"

    def test_status_in_progress_when_end_date_is_sap_zero_sentinel(self, spark):
        df = apply_pi_sheet_transform(
            spark,
            [make_pi_sheet(ZSDATS="20241205", ZSTIMS="060000", ZEDATS="00000000", ZETIMS="000000")],
        )
        row = first_row(df)
        assert row["pi_sheet_end_datetime"] is None
        assert row["pi_sheet_status"] == "In Progress"

    def test_duration_hours_is_zdur_times_24(self, spark):
        df = apply_pi_sheet_transform(
            spark, [make_pi_sheet(ZDUR=0.5)]
        )
        assert first_row(df)["duration_hours"] == 12.0

    def test_duration_hours_fractional(self, spark):
        """ZDUR=0.25 day → 6 hours."""
        df = apply_pi_sheet_transform(
            spark, [make_pi_sheet(ZDUR=0.25)]
        )
        assert first_row(df)["duration_hours"] == 6.0

    def test_order_number_stripped(self, spark):
        df = apply_pi_sheet_transform(
            spark, [make_pi_sheet(ZAUFNR="000000099999")]
        )
        assert first_row(df)["order_number"] == "99999"

    def test_pi_sheet_start_datetime_parsed(self, spark):
        df = apply_pi_sheet_transform(
            spark, [make_pi_sheet(ZSDATS="20241205", ZSTIMS="063000")]
        )
        assert first_row(df)["pi_sheet_start_datetime"] == datetime(2024, 12, 5, 6, 30, 0)


# ─────────────────────────────────────────────────────────────────────────────
# Downtime Event — soft-delete filter and duration
# ─────────────────────────────────────────────────────────────────────────────

class TestDowntimeEvent:
    def test_active_rows_are_included(self, spark):
        df = apply_downtime_transform(
            spark, [make_downtime(ZDEL="")]
        )
        rows = all_rows(df)
        assert len(rows) == 1

    def test_soft_deleted_rows_excluded(self, spark):
        """ZDEL='X' means the record was deleted in SAP — must be filtered out."""
        df = apply_downtime_transform(
            spark, [make_downtime(ZDEL="X")]
        )
        assert len(all_rows(df)) == 0

    def test_mixed_rows_only_active_returned(self, spark):
        df = apply_downtime_transform(
            spark,
            [
                make_downtime(ZITEM="001", ZDEL=""),
                make_downtime(ZITEM="002", ZDEL="X"),
                make_downtime(ZITEM="003", ZDEL=""),
            ],
        )
        rows = all_rows(df)
        assert len(rows) == 2
        items = {r["item_number"] for r in rows}
        assert items == {"001", "003"}

    def test_duration_minutes_uses_start_and_end_timestamps(self, spark):
        df = apply_downtime_transform(
            spark, [make_downtime(ZAUZTV="080000", ZAUZTB="093000", ZEAUSZT=999.0)]
        )
        assert first_row(df)["duration_minutes"] == 90.0

    def test_duration_minutes_falls_back_to_raw_duration_when_end_missing(self, spark):
        df = apply_downtime_transform(
            spark, [make_downtime(ZAUSBS=None, ZAUZTB=None, ZEAUSZT=30.0)]
        )
        assert first_row(df)["duration_minutes"] == 30.0

    def test_order_number_stripped(self, spark):
        df = apply_downtime_transform(
            spark, [make_downtime(AUFNR="000000099999")]
        )
        assert first_row(df)["order_number"] == "99999"

    def test_material_code_stripped(self, spark):
        df = apply_downtime_transform(
            spark, [make_downtime(MATNR="000000000000099999")]
        )
        assert first_row(df)["material_code"] == "99999"

    def test_zdel_null_rows_are_included(self, spark):
        """ZDEL=None (field never set in SAP) must NOT be treated as deleted.
        Spark evaluates NULL != 'X' as NULL (falsy), so without the IS NULL guard
        these rows were silently dropped."""
        df = apply_downtime_transform(
            spark, [make_downtime(ZDEL=None)]
        )
        assert len(all_rows(df)) == 1

    def test_zdel_null_and_deleted_mixed(self, spark):
        df = apply_downtime_transform(
            spark,
            [
                make_downtime(ZITEM="001", ZDEL=None),   # unset — must pass through
                make_downtime(ZITEM="002", ZDEL="X"),    # deleted — must be excluded
                make_downtime(ZITEM="003", ZDEL=""),     # blank — must pass through
            ],
        )
        items = {r["item_number"] for r in all_rows(df)}
        assert items == {"001", "003"}


# ─────────────────────────────────────────────────────────────────────────────
# Quality Inspection Lot — usage decision derivation
# ─────────────────────────────────────────────────────────────────────────────

class TestQualityInspectionLot:
    def test_vcode_a_accepted(self, spark):
        df = apply_quality_lot_transform(
            spark, [make_qals(VCODE="A")], [make_qmih()]
        )
        assert first_row(df)["usage_decision"] == "Accepted"

    def test_vcode_aa_accepted(self, spark):
        """Extended accept code AA also maps to Accepted."""
        df = apply_quality_lot_transform(
            spark, [make_qals(VCODE="AA")], [make_qmih()]
        )
        assert first_row(df)["usage_decision"] == "Accepted"

    def test_vcode_r_rejected(self, spark):
        df = apply_quality_lot_transform(
            spark, [make_qals(VCODE="R")], [make_qmih()]
        )
        assert first_row(df)["usage_decision"] == "Rejected"

    def test_vcode_ra_rejected(self, spark):
        """Extended reject code RA also maps to Rejected."""
        df = apply_quality_lot_transform(
            spark, [make_qals(VCODE="RA")], [make_qmih()]
        )
        assert first_row(df)["usage_decision"] == "Rejected"

    def test_vcode_other_non_null(self, spark):
        """Any VCODE that is not A/AA/R/RA but is present → 'Other Decision'."""
        df = apply_quality_lot_transform(
            spark, [make_qals(VCODE="X")], [make_qmih()]
        )
        assert first_row(df)["usage_decision"] == "Other Decision"

    def test_no_vcode_is_pending(self, spark):
        """VCODE NULL (decision not yet recorded) → 'Pending'."""
        df = apply_quality_lot_transform(
            spark, [make_qals(VCODE=None)], [make_qmih()]
        )
        assert first_row(df)["usage_decision"] == "Pending"

    def test_deletion_flagged(self, spark):
        df = apply_quality_lot_transform(
            spark, [make_qals(KZLOESCH="X")], [make_qmih()]
        )
        assert first_row(df)["is_deletion_flagged"] is True

    def test_not_deletion_flagged(self, spark):
        df = apply_quality_lot_transform(
            spark, [make_qals(KZLOESCH="")], [make_qmih()]
        )
        assert first_row(df)["is_deletion_flagged"] is False

    def test_lot_without_qmih_retained(self, spark):
        """Inspection lot with no linked quality message must still appear."""
        df = apply_quality_lot_transform(
            spark,
            [make_qals(PRUEFLOS="000000000099")],
            [],  # no QMIH
        )
        rows = all_rows(df)
        assert len(rows) == 1
        assert rows[0]["inspection_lot_number"] == "000000000099"
        assert rows[0]["order_number"] is None

    def test_material_and_batch_stripped(self, spark):
        df = apply_quality_lot_transform(
            spark,
            [make_qals(MATNR="000000000000099999", CHARG="0000099999")],
            [make_qmih()],
        )
        row = first_row(df)
        assert row["material_code"] == "99999"
        assert row["batch_number"] == "99999"

    def test_order_number_stripped_via_qmih(self, spark):
        df = apply_quality_lot_transform(
            spark,
            [make_qals()],
            [make_qmih(AUFNR="000000099999")],
        )
        assert first_row(df)["order_number"] == "99999"

    def test_inspection_start_date_parsed(self, spark):
        df = apply_quality_lot_transform(
            spark, [make_qals(ENSTDE="20241201")], [make_qmih()]
        )
        assert first_row(df)["inspection_start_date"] == date(2024, 12, 1)

    def test_same_lot_number_different_clients_not_linked(self, spark):
        """PRUEFLOS is only unique within a MANDT. A lot from client 100 must not
        receive the qmih row from client 200, even if PRUEFLOS values collide."""
        df = apply_quality_lot_transform(
            spark,
            [make_qals(PRUEFLOS="000000000001", MANDT="100")],
            [make_qmih(PRUEFLOS="000000000001", MANDT="200", AUFNR="000000099999")],
        )
        row = first_row(df)
        # Cross-client qmih must not match — order_number should be NULL
        assert row["order_number"] is None
