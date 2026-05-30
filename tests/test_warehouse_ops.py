"""
Tests for the warehouse operations silver transformations.

Business rules under test:
  - warehouse_transfer_order: PQUIT/KQUIT status derivation, LTAP+LTAK left join,
    zero-padding on MATNR/CHARG/VBELN/BENUM, RecordActivity CDC
  - warehouse_transfer_requirement: ELIKZ flag, OPFLAG CDC, custom ZZ fields,
    LTBP+LTBK left join
  - storage_bin: LAGP+LQUA left join (empty bins retain bin attributes, NULL stock),
    SPGRU blocking flag
  - batch_stock: compound natural key, all stock type quantities, zero-padding
"""

from typing import List

from pyspark.sql import DataFrame, Row, SparkSession
from pyspark.sql import functions as F

from silver.dlt_silver_pipeline import sap_date, sap_datetime, sap_flag, strip_zeros
from tests.conftest import all_rows, first_row

_LTAP_SCHEMA = (
    "LGNUM STRING, TANUM STRING, TAPOS STRING, MANDT STRING, WERKS STRING, "
    "MATNR STRING, CHARG STRING, ANFME DOUBLE, ENMNG DOUBLE, PQUIT STRING"
)
_LTAK_SCHEMA = (
    "LGNUM STRING, TANUM STRING, MANDT STRING, KQUIT STRING, "
    "BDATU STRING, BZEIT STRING, BENUM STRING, VBELN STRING, "
    "RecordActivity STRING, AEDATTM STRING"
)
_LTBP_SCHEMA = (
    "LGNUM STRING, TBNUM STRING, TBPOS STRING, MANDT STRING, WERKS STRING, "
    "MATNR STRING, MENGE DOUBLE, ENQTY DOUBLE, ELIKZ STRING"
)
_LTBK_SCHEMA = (
    "LGNUM STRING, TBNUM STRING, MANDT STRING, ZZ_CAMPAIGN STRING, "
    "ZZ_PICK_STAT_M STRING, ZZ_PICK_STAT_D STRING, ZZQUEUE STRING, "
    "OPFLAG STRING, AEDATTM STRING"
)
_LAGP_SCHEMA = (
    "LGNUM STRING, LGTYP STRING, LGPLA STRING, MANDT STRING, "
    "LGBER STRING, MAXGW DOUBLE, SPGRU STRING, AEDATTM STRING"
)
_LQUA_SCHEMA = (
    "LGNUM STRING, LGTYP STRING, LGPLA STRING, MANDT STRING, "
    "LQNUM STRING, MATNR STRING, WERKS STRING, CHARG STRING, "
    "GESME DOUBLE, VERME DOUBLE"
)
_T320_SCHEMA = (
    "LGNUM STRING, WERKS STRING, LGORT STRING, AEDATTM STRING"
)
_MCHB_SCHEMA = (
    "MATNR STRING, WERKS STRING, LGORT STRING, CHARG STRING, "
    "CLABS DOUBLE, CINSM DOUBLE, CSPEM DOUBLE, CEINM DOUBLE, "
    "CUMLM DOUBLE, CRETM DOUBLE, AEDATTM STRING"
)


# ─────────────────────────────────────────────────────────────────────────────
# Warehouse Transfer Order helpers
# ─────────────────────────────────────────────────────────────────────────────

def apply_transfer_order_transform(
    spark: SparkSession,
    ltap_rows: List[Row],
    ltak_rows: List[Row],
) -> DataFrame:
    ltap = spark.createDataFrame(ltap_rows, _LTAP_SCHEMA)
    ltak = spark.createDataFrame(ltak_rows, _LTAK_SCHEMA)

    return (
        ltak.alias("h")
        .join(ltap.alias("i"), ["LGNUM", "TANUM", "MANDT"], "left")
        .select(
            F.col("i.LGNUM").alias("warehouse_number"),
            F.col("i.TANUM").alias("transfer_order_number"),
            F.col("i.TAPOS").alias("item_number"),
            F.col("i.WERKS").alias("plant_code"),
            strip_zeros("i.MATNR").alias("material_code"),
            strip_zeros("i.CHARG").alias("batch_number"),
            F.col("i.ANFME").alias("requested_quantity"),
            F.col("i.ENMNG").alias("confirmed_quantity"),
            F.when(F.col("i.PQUIT") == "B", "Fully Confirmed")
             .when(F.col("i.PQUIT") == "A", "Partially Confirmed")
             .otherwise("Open").alias("item_status"),
            F.when(F.col("h.KQUIT") == "B", "Fully Confirmed")
             .when(F.col("h.KQUIT") == "A", "Partially Confirmed")
             .otherwise("Open").alias("header_status"),
            sap_datetime("h.BDATU", "h.BZEIT").alias("created_datetime"),
            strip_zeros("h.BENUM").alias("source_reference_number"),
            strip_zeros("h.VBELN").alias("delivery_number"),
            F.col("h.RecordActivity").alias("record_activity"),
            F.col("h.AEDATTM").alias("_replicated_at"),
        )
    )


def make_ltap(
    LGNUM="001",
    TANUM="0000001234",
    TAPOS="0001",
    MANDT="100",
    WERKS="1000",
    MATNR="000000000000012345",
    CHARG="0000001234",
    ANFME=100.0,
    ENMNG=100.0,
    PQUIT="",
):
    return Row(
        LGNUM=LGNUM, TANUM=TANUM, TAPOS=TAPOS, MANDT=MANDT,
        WERKS=WERKS, MATNR=MATNR, CHARG=CHARG,
        ANFME=ANFME, ENMNG=ENMNG, PQUIT=PQUIT,
    )


def make_ltak(
    LGNUM="001",
    TANUM="0000001234",
    MANDT="100",
    KQUIT="",
    BDATU="20241201",
    BZEIT="080000",
    BENUM="0000099999",
    VBELN="0000012345",
    RecordActivity="I",
    AEDATTM="2024-12-01T10:00:00",
):
    return Row(
        LGNUM=LGNUM, TANUM=TANUM, MANDT=MANDT,
        KQUIT=KQUIT, BDATU=BDATU, BZEIT=BZEIT,
        BENUM=BENUM, VBELN=VBELN,
        RecordActivity=RecordActivity, AEDATTM=AEDATTM,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Warehouse Transfer Requirement helpers
# ─────────────────────────────────────────────────────────────────────────────

def apply_transfer_requirement_transform(
    spark: SparkSession,
    ltbp_rows: List[Row],
    ltbk_rows: List[Row],
) -> DataFrame:
    ltbp = spark.createDataFrame(ltbp_rows, _LTBP_SCHEMA)
    ltbk = spark.createDataFrame(ltbk_rows, _LTBK_SCHEMA)

    return (
        ltbk.alias("h")
        .join(ltbp.alias("i"), ["LGNUM", "TBNUM", "MANDT"], "left")
        .select(
            F.col("i.LGNUM").alias("warehouse_number"),
            F.col("i.TBNUM").alias("transfer_requirement_number"),
            F.col("i.TBPOS").alias("item_number"),
            F.col("i.WERKS").alias("plant_code"),
            strip_zeros("i.MATNR").alias("material_code"),
            F.col("i.MENGE").alias("required_quantity"),
            F.col("i.ENQTY").alias("open_quantity"),
            sap_flag("i.ELIKZ").alias("is_processing_complete"),
            F.col("h.ZZ_CAMPAIGN").alias("campaign_reference"),
            F.col("h.ZZ_PICK_STAT_M").alias("manual_pick_status"),
            F.col("h.ZZ_PICK_STAT_D").alias("direct_pick_status"),
            F.col("h.ZZQUEUE").alias("queue"),
            F.col("h.OPFLAG").alias("record_activity"),
            F.col("h.AEDATTM").alias("_replicated_at"),
        )
    )


def make_ltbp(
    LGNUM="001",
    TBNUM="0000005678",
    TBPOS="0001",
    MANDT="100",
    WERKS="1000",
    MATNR="000000000000012345",
    MENGE=50.0,
    ENQTY=50.0,
    ELIKZ="",
):
    return Row(
        LGNUM=LGNUM, TBNUM=TBNUM, TBPOS=TBPOS, MANDT=MANDT,
        WERKS=WERKS, MATNR=MATNR, MENGE=MENGE, ENQTY=ENQTY, ELIKZ=ELIKZ,
    )


def make_ltbk(
    LGNUM="001",
    TBNUM="0000005678",
    MANDT="100",
    ZZ_CAMPAIGN="CAMP001",
    ZZ_PICK_STAT_M="",
    ZZ_PICK_STAT_D="",
    ZZQUEUE="A",
    OPFLAG="I",
    AEDATTM="2024-12-01T10:00:00",
):
    return Row(
        LGNUM=LGNUM, TBNUM=TBNUM, MANDT=MANDT,
        ZZ_CAMPAIGN=ZZ_CAMPAIGN, ZZ_PICK_STAT_M=ZZ_PICK_STAT_M,
        ZZ_PICK_STAT_D=ZZ_PICK_STAT_D, ZZQUEUE=ZZQUEUE,
        OPFLAG=OPFLAG, AEDATTM=AEDATTM,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Storage Bin helpers
# ─────────────────────────────────────────────────────────────────────────────

def apply_storage_bin_transform(
    spark: SparkSession,
    lagp_rows: List[Row],
    lqua_rows: List[Row],
    t320_rows: List[Row] = None,
) -> DataFrame:
    lagp = spark.createDataFrame(lagp_rows, _LAGP_SCHEMA)
    lqua = spark.createDataFrame(lqua_rows, _LQUA_SCHEMA)
    if t320_rows is None:
        t320_rows = []
    t320 = spark.createDataFrame(t320_rows, _T320_SCHEMA).select(
        F.col("LGNUM").alias("warehouse_number"),
        F.col("WERKS").alias("plant_code"),
        F.col("LGORT").alias("storage_location_code"),
        F.col("AEDATTM").alias("_replicated_at"),
    )

    bins_with_quants = (
        lagp.alias("b")
        .join(
            lqua.alias("q"),
            (F.col("b.LGNUM") == F.col("q.LGNUM")) &
            (F.col("b.LGTYP") == F.col("q.LGTYP")) &
            (F.col("b.LGPLA") == F.col("q.LGPLA")) &
            (F.col("b.MANDT") == F.col("q.MANDT")),
            "left",
        )
    )

    return (
        bins_with_quants
        .join(
            t320.alias("m"),
            F.col("b.LGNUM") == F.col("m.warehouse_number"),
            "left",
        )
        .select(
            F.col("b.LGNUM").alias("warehouse_number"),
            F.col("b.LGTYP").alias("storage_type"),
            F.col("b.LGPLA").alias("bin_code"),
            F.coalesce(F.col("q.WERKS"), F.col("m.plant_code")).alias("plant_code"),
            F.col("b.LGBER").alias("storage_section"),
            F.col("b.MAXGW").alias("maximum_weight"),
            sap_flag("b.SPGRU").alias("is_blocked"),
            F.col("b.SPGRU").alias("blocking_reason_code"),
            F.col("q.LQNUM").alias("quant_number"),
            strip_zeros("q.MATNR").alias("material_code"),
            strip_zeros("q.CHARG").alias("batch_number"),
            F.col("q.GESME").alias("total_quantity"),
            F.col("q.VERME").alias("available_quantity"),
            F.col("b.AEDATTM").alias("_replicated_at"),
        )
    )


def make_t320(
    LGNUM="001",
    WERKS="1000",
    LGORT="0001",
    AEDATTM="2024-12-01T10:00:00",
):
    return Row(
        LGNUM=LGNUM,
        WERKS=WERKS,
        LGORT=LGORT,
        AEDATTM=AEDATTM,
    )


def make_lagp(
    LGNUM="001",
    LGTYP="001",
    LGPLA="BIN-001",
    MANDT="100",
    LGBER="A",
    MAXGW=1000.0,
    SPGRU="",
    AEDATTM="2024-12-01T10:00:00",
):
    return Row(
        LGNUM=LGNUM, LGTYP=LGTYP, LGPLA=LGPLA, MANDT=MANDT,
        LGBER=LGBER, MAXGW=MAXGW, SPGRU=SPGRU, AEDATTM=AEDATTM,
    )


def make_lqua(
    LGNUM="001",
    LGTYP="001",
    LGPLA="BIN-001",
    MANDT="100",
    LQNUM="000001",
    MATNR="000000000000012345",
    WERKS="1000",
    CHARG="0000001234",
    GESME=500.0,
    VERME=500.0,
):
    return Row(
        LGNUM=LGNUM, LGTYP=LGTYP, LGPLA=LGPLA, MANDT=MANDT,
        LQNUM=LQNUM, MATNR=MATNR, WERKS=WERKS, CHARG=CHARG,
        GESME=GESME, VERME=VERME,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Batch Stock helpers
# ─────────────────────────────────────────────────────────────────────────────

def apply_batch_stock_transform(spark: SparkSession, mchb_rows: List[Row]) -> DataFrame:
    src = spark.createDataFrame(mchb_rows, _MCHB_SCHEMA)
    return src.select(
        strip_zeros("MATNR").alias("material_code"),
        F.col("WERKS").alias("plant_code"),
        F.col("LGORT").alias("storage_location_code"),
        strip_zeros("CHARG").alias("batch_number"),
        F.col("CLABS").alias("unrestricted_quantity"),
        F.col("CINSM").alias("quality_inspection_quantity"),
        F.col("CSPEM").alias("blocked_quantity"),
        F.col("CEINM").alias("restricted_use_quantity"),
        F.col("CUMLM").alias("in_transfer_quantity"),
        F.col("CRETM").alias("blocked_returns_quantity"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


def make_mchb(
    MATNR="000000000000012345",
    WERKS="1000",
    LGORT="0001",
    CHARG="0000001234",
    CLABS=1000.0,
    CINSM=0.0,
    CSPEM=0.0,
    CEINM=0.0,
    CUMLM=0.0,
    CRETM=0.0,
    AEDATTM="2024-12-01T10:00:00",
):
    return Row(
        MATNR=MATNR, WERKS=WERKS, LGORT=LGORT, CHARG=CHARG,
        CLABS=CLABS, CINSM=CINSM, CSPEM=CSPEM, CEINM=CEINM,
        CUMLM=CUMLM, CRETM=CRETM, AEDATTM=AEDATTM,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Transfer Order — status derivation
# ─────────────────────────────────────────────────────────────────────────────

class TestTransferOrderStatus:
    def test_item_fully_confirmed(self, spark):
        df = apply_transfer_order_transform(
            spark, [make_ltap(PQUIT="B")], [make_ltak()]
        )
        assert first_row(df)["item_status"] == "Fully Confirmed"

    def test_item_partially_confirmed(self, spark):
        df = apply_transfer_order_transform(
            spark, [make_ltap(PQUIT="A")], [make_ltak()]
        )
        assert first_row(df)["item_status"] == "Partially Confirmed"

    def test_item_open_when_blank(self, spark):
        df = apply_transfer_order_transform(
            spark, [make_ltap(PQUIT="")], [make_ltak()]
        )
        assert first_row(df)["item_status"] == "Open"

    def test_header_fully_confirmed(self, spark):
        df = apply_transfer_order_transform(
            spark, [make_ltap()], [make_ltak(KQUIT="B")]
        )
        assert first_row(df)["header_status"] == "Fully Confirmed"

    def test_item_without_header_not_returned(self, spark):
        """After flipping the join to header-drives: an item with no LTAK header
        does not appear in the output. Headers are always created before items in SAP;
        a missing header indicates replication lag — the item processes on next update."""
        df = apply_transfer_order_transform(
            spark,
            [make_ltap(LGNUM="001", TANUM="9999")],  # ltap_rows
            [],                                       # no ltak header
        )
        assert len(all_rows(df)) == 0


# ─────────────────────────────────────────────────────────────────────────────
# Transfer Order — key stripping
# ─────────────────────────────────────────────────────────────────────────────

class TestTransferOrderKeyStripping:
    def test_material_code_stripped(self, spark):
        df = apply_transfer_order_transform(
            spark, [make_ltap(MATNR="000000000000099999")], [make_ltak()]
        )
        assert first_row(df)["material_code"] == "99999"

    def test_batch_number_stripped(self, spark):
        df = apply_transfer_order_transform(
            spark, [make_ltap(CHARG="0000099999")], [make_ltak()]
        )
        assert first_row(df)["batch_number"] == "99999"

    def test_delivery_number_stripped(self, spark):
        df = apply_transfer_order_transform(
            spark, [make_ltap()], [make_ltak(VBELN="0000088888")]
        )
        assert first_row(df)["delivery_number"] == "88888"

    def test_source_reference_number_stripped(self, spark):
        df = apply_transfer_order_transform(
            spark, [make_ltap()], [make_ltak(BENUM="0000077777")]
        )
        assert first_row(df)["source_reference_number"] == "77777"


# ─────────────────────────────────────────────────────────────────────────────
# Transfer Order — CDC
# ─────────────────────────────────────────────────────────────────────────────

class TestTransferOrderCDC:
    def test_record_activity_delete_flagged(self, spark):
        df = apply_transfer_order_transform(
            spark, [make_ltap()], [make_ltak(RecordActivity="D")]
        )
        assert first_row(df)["record_activity"] == "D"

    def test_record_activity_insert(self, spark):
        df = apply_transfer_order_transform(
            spark, [make_ltap()], [make_ltak(RecordActivity="I")]
        )
        assert first_row(df)["record_activity"] == "I"


# ─────────────────────────────────────────────────────────────────────────────
# Transfer Requirement — processing complete flag
# ─────────────────────────────────────────────────────────────────────────────

class TestTransferRequirementStatus:
    def test_elikz_x_is_complete(self, spark):
        df = apply_transfer_requirement_transform(
            spark, [make_ltbp(ELIKZ="X")], [make_ltbk()]
        )
        assert first_row(df)["is_processing_complete"] is True

    def test_elikz_blank_is_not_complete(self, spark):
        df = apply_transfer_requirement_transform(
            spark, [make_ltbp(ELIKZ="")], [make_ltbk()]
        )
        assert first_row(df)["is_processing_complete"] is False

    def test_opflag_delete_for_cdc(self, spark):
        """OPFLAG (not RecordActivity) is the CDC column for LTBK."""
        df = apply_transfer_requirement_transform(
            spark, [make_ltbp()], [make_ltbk(OPFLAG="D")]
        )
        assert first_row(df)["record_activity"] == "D"


# ─────────────────────────────────────────────────────────────────────────────
# Transfer Requirement — custom ZZ fields
# ─────────────────────────────────────────────────────────────────────────────

class TestTransferRequirementCustomFields:
    def test_campaign_reference_propagated(self, spark):
        df = apply_transfer_requirement_transform(
            spark, [make_ltbp()], [make_ltbk(ZZ_CAMPAIGN="CAMP-2024-001")]
        )
        assert first_row(df)["campaign_reference"] == "CAMP-2024-001"

    def test_manual_pick_status_propagated(self, spark):
        df = apply_transfer_requirement_transform(
            spark, [make_ltbp()], [make_ltbk(ZZ_PICK_STAT_M="P")]
        )
        assert first_row(df)["manual_pick_status"] == "P"

    def test_queue_propagated(self, spark):
        df = apply_transfer_requirement_transform(
            spark, [make_ltbp()], [make_ltbk(ZZQUEUE="HIGH")]
        )
        assert first_row(df)["queue"] == "HIGH"

    def test_item_without_header_not_returned(self, spark):
        """After flipping the join to header-drives: a requirement item with no
        LTBK header does not appear in the output."""
        df = apply_transfer_requirement_transform(
            spark,
            [make_ltbp(LGNUM="001", TBNUM="9999")],  # ltbp_rows
            [],                                       # no ltbk header
        )
        assert len(all_rows(df)) == 0


# ─────────────────────────────────────────────────────────────────────────────
# Storage Bin — occupied vs empty
# ─────────────────────────────────────────────────────────────────────────────

class TestStorageBin:
    def test_occupied_bin_has_stock_fields(self, spark):
        df = apply_storage_bin_transform(
            spark,
            [make_lagp(LGNUM="001", LGTYP="001", LGPLA="BIN-A")],
            [make_lqua(LGNUM="001", LGTYP="001", LGPLA="BIN-A", GESME=500.0)],
        )
        row = first_row(df)
        assert row["total_quantity"] == 500.0
        assert row["material_code"] == "12345"

    def test_empty_bin_retains_bin_attributes(self, spark):
        """A bin with no quant must appear; bin attributes present, stock fields NULL."""
        df = apply_storage_bin_transform(
            spark,
            [make_lagp(LGNUM="001", LGTYP="002", LGPLA="EMPTY-BIN", LGBER="B")],
            [],  # no quant
        )
        row = first_row(df)
        assert row["bin_code"] == "EMPTY-BIN"
        assert row["storage_section"] == "B"
        assert row["total_quantity"] is None
        assert row["material_code"] is None

    def test_blocked_bin(self, spark):
        df = apply_storage_bin_transform(
            spark, [make_lagp(SPGRU="X")], [make_lqua()]
        )
        row = first_row(df)
        assert row["is_blocked"] is True
        assert row["blocking_reason_code"] == "X"

    def test_unblocked_bin(self, spark):
        df = apply_storage_bin_transform(
            spark, [make_lagp(SPGRU="")], [make_lqua()]
        )
        assert first_row(df)["is_blocked"] is False

    def test_material_code_stripped_in_quant(self, spark):
        df = apply_storage_bin_transform(
            spark,
            [make_lagp()],
            [make_lqua(MATNR="000000000000099999")],
        )
        assert first_row(df)["material_code"] == "99999"

    def test_multiple_bins_all_returned(self, spark):
        df = apply_storage_bin_transform(
            spark,
            [
                make_lagp(LGPLA="BIN-001"),
                make_lagp(LGPLA="BIN-002"),
            ],
            [
                make_lqua(LGPLA="BIN-001"),
                make_lqua(LGPLA="BIN-002"),
            ],
        )
        bins = {r["bin_code"] for r in all_rows(df)}
        assert bins == {"BIN-001", "BIN-002"}

    def test_empty_bin_resolves_plant_from_t320(self, spark):
        df = apply_storage_bin_transform(
            spark,
            [make_lagp(LGNUM="001", LGTYP="001", LGPLA="BIN-EMPTY")],
            [],  # empty bin (no quant)
            [make_t320(LGNUM="001", WERKS="1000")],
        )
        row = first_row(df)
        assert row["bin_code"] == "BIN-EMPTY"
        assert row["plant_code"] == "1000"

    def test_occupied_bin_retains_quant_plant_override(self, spark):
        # Even if warehouse maps to plant 1000, if quant lists plant 2000, quant plant takes precedence
        df = apply_storage_bin_transform(
            spark,
            [make_lagp(LGNUM="001", LGTYP="001", LGPLA="BIN-OCCUPIED")],
            [make_lqua(LGNUM="001", LGTYP="001", LGPLA="BIN-OCCUPIED", WERKS="2000")],
            [make_t320(LGNUM="001", WERKS="1000")],
        )
        row = first_row(df)
        assert row["bin_code"] == "BIN-OCCUPIED"
        assert row["plant_code"] == "2000"

    def test_shared_warehouse_duplicates_empty_bin_for_each_plant(self, spark):
        # A shared warehouse (001 mapped to plants 1000 and 1100) duplicates the bin row for each plant scope
        df = apply_storage_bin_transform(
            spark,
            [make_lagp(LGNUM="001", LGTYP="001", LGPLA="BIN-SHARED")],
            [],  # empty bin (no quant)
            [
                make_t320(LGNUM="001", WERKS="1000"),
                make_t320(LGNUM="001", WERKS="1100"),
            ],
        )
        results = all_rows(df)
        assert len(results) == 2
        plant_codes = {r["plant_code"] for r in results}
        assert plant_codes == {"1000", "1100"}


# ─────────────────────────────────────────────────────────────────────────────
# Batch Stock — compound key & quantities
# ─────────────────────────────────────────────────────────────────────────────

class TestBatchStock:
    def test_material_code_stripped(self, spark):
        df = apply_batch_stock_transform(
            spark, [make_mchb(MATNR="000000000000099999")]
        )
        assert first_row(df)["material_code"] == "99999"

    def test_batch_number_stripped(self, spark):
        df = apply_batch_stock_transform(
            spark, [make_mchb(CHARG="0000099999")]
        )
        assert first_row(df)["batch_number"] == "99999"

    def test_unrestricted_quantity(self, spark):
        df = apply_batch_stock_transform(
            spark, [make_mchb(CLABS=750.5)]
        )
        assert first_row(df)["unrestricted_quantity"] == 750.5

    def test_quality_inspection_quantity(self, spark):
        df = apply_batch_stock_transform(
            spark, [make_mchb(CINSM=200.0)]
        )
        assert first_row(df)["quality_inspection_quantity"] == 200.0

    def test_blocked_quantity(self, spark):
        df = apply_batch_stock_transform(
            spark, [make_mchb(CSPEM=50.0)]
        )
        assert first_row(df)["blocked_quantity"] == 50.0

    def test_in_transfer_quantity(self, spark):
        df = apply_batch_stock_transform(
            spark, [make_mchb(CUMLM=25.0)]
        )
        assert first_row(df)["in_transfer_quantity"] == 25.0

    def test_distinct_batches_for_same_material(self, spark):
        """Two batches of the same material in the same location are separate rows."""
        df = apply_batch_stock_transform(
            spark,
            [
                make_mchb(MATNR="000000000000012345", CHARG="0000000001", CLABS=100.0),
                make_mchb(MATNR="000000000000012345", CHARG="0000000002", CLABS=200.0),
            ],
        )
        rows = all_rows(df)
        assert len(rows) == 2
        totals = {r["batch_number"]: r["unrestricted_quantity"] for r in rows}
        assert totals == {"1": 100.0, "2": 200.0}

    def test_same_batch_different_locations_separate_rows(self, spark):
        """Same batch split across two storage locations are separate rows (compound key)."""
        df = apply_batch_stock_transform(
            spark,
            [
                make_mchb(LGORT="0001", CLABS=400.0),
                make_mchb(LGORT="0002", CLABS=600.0),
            ],
        )
        rows = all_rows(df)
        assert len(rows) == 2
        locations = {r["storage_location_code"] for r in rows}
        assert locations == {"0001", "0002"}
