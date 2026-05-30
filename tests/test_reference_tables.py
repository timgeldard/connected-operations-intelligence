"""
Tests for the reference / slowly-changing silver tables.

Business rules under test:
  - material: 4-way join (MARC + MARA + MAKT + LOFT), language filter on MAKT,
    compliance flags, zero-padding on material_code
  - storage_location: simple select, key presence
  - work_centre: CRHD + CRTX join, language filter on CRTX, internal_id linkage
  - capacity_utilisation: KAPA + KAKO join, date parsing, NULL work_centre when
    KAKO row is missing
"""

from datetime import date
from typing import List

from pyspark.sql import DataFrame, Row, SparkSession
from pyspark.sql import functions as F

from silver.helpers import sap_date, sap_flag, strip_zeros
from tests.conftest import all_rows, first_row

_MARC_SCHEMA = (
    "MATNR STRING, MANDT STRING, WERKS STRING, DISPO STRING, DISMM STRING, "
    "LGPRO STRING, LGFSB STRING, FEVOR STRING, AEDATTM STRING"
)
_MARA_SCHEMA = (
    "MATNR STRING, MANDT STRING, MTART STRING, MATKL STRING, MEINS STRING, "
    "NTGEW DOUBLE, BRGEW DOUBLE, GEWEI STRING, MHDRZ DOUBLE, MHDLP DOUBLE, "
    "XCHPF STRING, IPRKZ STRING, STOFF STRING"
)
_MAKT_SCHEMA = "MATNR STRING, MANDT STRING, SPRAS STRING, MAKTX STRING"
_LOFT_SCHEMA = (
    "MATNR STRING, MANDT STRING, KOSHERSUIT STRING, KOSHERAPP STRING, "
    "HALALSUIT STRING, HALALAPP STRING, ORGANICSUIT STRING, ORGANICAPP STRING, "
    "ZGMO_CODE STRING, Z_LOFTWARE_LABEL STRING, ZZPALLBLTEMP STRING, STORCOND STRING"
)
_T001L_SCHEMA = "WERKS STRING, LGORT STRING, LGOBE STRING, AEDATTM STRING"
_CRHD_SCHEMA = (
    "OBJID STRING, MANDT STRING, ARBPL STRING, WERKS STRING, "
    "VERWE STRING, KOSTL STRING, AEDATTM STRING"
)
_CRTX_SCHEMA = "OBJID STRING, MANDT STRING, SPRAS STRING, KTEXT STRING"
_KAPA_SCHEMA = (
    "KAPID STRING, MANDT STRING, DAFBI STRING, DAFEI STRING, "
    "KAPAZ DOUBLE, MEINH STRING, OEFFZ DOUBLE, NORMA DOUBLE, AEDATTM STRING"
)
_KAKO_SCHEMA = "KAPID STRING, MANDT STRING, ARBPL STRING, WERKS STRING, KAPAR STRING"


# ─────────────────────────────────────────────────────────────────────────────
# Material helpers
# ─────────────────────────────────────────────────────────────────────────────

def apply_material_transform(
    spark: SparkSession,
    marc_rows: List[Row],
    mara_rows: List[Row],
    makt_rows: List[Row],
    loft_rows: List[Row],
) -> DataFrame:
    marc = spark.createDataFrame(marc_rows, _MARC_SCHEMA)
    mara = spark.createDataFrame(mara_rows, _MARA_SCHEMA)
    makt = spark.createDataFrame(makt_rows, _MAKT_SCHEMA).filter(F.col("SPRAS") == "E")
    loft = spark.createDataFrame(loft_rows, _LOFT_SCHEMA)

    return (
        marc.alias("p")
        .join(mara.alias("g"), ["MATNR", "MANDT"], "left")
        .join(makt.alias("d"), ["MATNR", "MANDT"], "left")
        .join(loft.alias("l"), ["MATNR", "MANDT"], "left")
        .select(
            strip_zeros("p.MATNR").alias("material_code"),
            F.col("p.WERKS").alias("plant_code"),
            F.col("d.MAKTX").alias("material_description"),
            F.col("g.MTART").alias("material_type"),
            F.col("g.MEINS").alias("base_uom"),
            sap_flag("g.XCHPF").alias("batch_management_required"),
            sap_flag("l.KOSHERSUIT").alias("is_kosher_suitable"),
            sap_flag("l.HALALSUIT").alias("is_halal_suitable"),
            sap_flag("l.ORGANICSUIT").alias("is_organic_suitable"),
            F.col("l.ZGMO_CODE").alias("gmo_code"),
            F.col("p.AEDATTM").alias("_replicated_at"),
        )
    )


def make_marc(
    MATNR="000000000000012345",
    MANDT="100",
    WERKS="1000",
    DISPO="MRP001",
    DISMM="PD",
    LGPRO="0001",
    LGFSB="0001",
    FEVOR="PROD01",
    AEDATTM="2024-12-01T10:00:00",
):
    return Row(
        MATNR=MATNR, MANDT=MANDT, WERKS=WERKS, DISPO=DISPO,
        DISMM=DISMM, LGPRO=LGPRO, LGFSB=LGFSB, FEVOR=FEVOR, AEDATTM=AEDATTM,
    )


def make_mara(
    MATNR="000000000000012345",
    MANDT="100",
    MTART="FERT",
    MATKL="0001",
    MEINS="KG",
    NTGEW=10.0,
    BRGEW=11.0,
    GEWEI="KG",
    MHDRZ=365.0,
    MHDLP=30.0,
    XCHPF="X",
    IPRKZ="",
    STOFF="",
):
    return Row(
        MATNR=MATNR, MANDT=MANDT, MTART=MTART, MATKL=MATKL, MEINS=MEINS,
        NTGEW=NTGEW, BRGEW=BRGEW, GEWEI=GEWEI, MHDRZ=MHDRZ, MHDLP=MHDLP,
        XCHPF=XCHPF, IPRKZ=IPRKZ, STOFF=STOFF,
    )


def make_makt(
    MATNR="000000000000012345",
    MANDT="100",
    SPRAS="E",
    MAKTX="Chocolate Coating 1kg",
):
    return Row(MATNR=MATNR, MANDT=MANDT, SPRAS=SPRAS, MAKTX=MAKTX)


def make_loft(
    MATNR="000000000000012345",
    MANDT="100",
    KOSHERSUIT="X",
    KOSHERAPP="",
    HALALSUIT="X",
    HALALAPP="",
    ORGANICSUIT="",
    ORGANICAPP="",
    ZGMO_CODE="NON-GMO",
    Z_LOFTWARE_LABEL="STD-LABEL",
    ZZPALLBLTEMP="PALLET-A",
    STORCOND="Cool and dry",
):
    return Row(
        MATNR=MATNR, MANDT=MANDT, KOSHERSUIT=KOSHERSUIT, KOSHERAPP=KOSHERAPP,
        HALALSUIT=HALALSUIT, HALALAPP=HALALAPP, ORGANICSUIT=ORGANICSUIT,
        ORGANICAPP=ORGANICAPP, ZGMO_CODE=ZGMO_CODE, Z_LOFTWARE_LABEL=Z_LOFTWARE_LABEL,
        ZZPALLBLTEMP=ZZPALLBLTEMP, STORCOND=STORCOND,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Material — key stripping and joins
# ─────────────────────────────────────────────────────────────────────────────

class TestMaterial:
    def test_material_code_stripped(self, spark):
        df = apply_material_transform(
            spark,
            [make_marc(MATNR="000000000000099999")],
            [make_mara(MATNR="000000000000099999")],
            [make_makt(MATNR="000000000000099999")],
            [make_loft(MATNR="000000000000099999")],
        )
        assert first_row(df)["material_code"] == "99999"

    def test_english_description_selected(self, spark):
        """MAKT filter keeps only SPRAS='E'. German row must not appear."""
        df = apply_material_transform(
            spark,
            [make_marc()],
            [make_mara()],
            [
                make_makt(SPRAS="E", MAKTX="Chocolate Coating"),
                make_makt(SPRAS="D", MAKTX="Schokoladenüberzug"),
            ],
            [make_loft()],
        )
        rows = all_rows(df)
        assert len(rows) == 1
        assert rows[0]["material_description"] == "Chocolate Coating"

    def test_non_english_description_filtered_out(self, spark):
        """If only a German description exists, material_description is NULL."""
        df = apply_material_transform(
            spark,
            [make_marc()],
            [make_mara()],
            [make_makt(SPRAS="D", MAKTX="Schokoladenüberzug")],
            [make_loft()],
        )
        assert first_row(df)["material_description"] is None

    def test_material_without_loft_retained(self, spark):
        """Material with no Loftware compliance record must still appear."""
        df = apply_material_transform(
            spark, [make_marc()], [make_mara()], [make_makt()], []
        )
        row = first_row(df)
        assert row["material_code"] == "12345"
        assert row["is_kosher_suitable"] is False

    def test_batch_management_required_flag(self, spark):
        df = apply_material_transform(
            spark,
            [make_marc()],
            [make_mara(XCHPF="X")],
            [make_makt()],
            [make_loft()],
        )
        assert first_row(df)["batch_management_required"] is True

    def test_compliance_flags(self, spark):
        df = apply_material_transform(
            spark,
            [make_marc()],
            [make_mara()],
            [make_makt()],
            [make_loft(KOSHERSUIT="X", HALALSUIT="X", ORGANICSUIT="")],
        )
        row = first_row(df)
        assert row["is_kosher_suitable"] is True
        assert row["is_halal_suitable"] is True
        assert row["is_organic_suitable"] is False


# ─────────────────────────────────────────────────────────────────────────────
# Storage Location helpers and tests
# ─────────────────────────────────────────────────────────────────────────────

def apply_storage_location_transform(spark: SparkSession, rows: List[Row]) -> DataFrame:
    src = spark.createDataFrame(rows, _T001L_SCHEMA)
    return src.select(
        F.col("WERKS").alias("plant_code"),
        F.col("LGORT").alias("storage_location_code"),
        F.col("LGOBE").alias("storage_location_description"),
        F.col("AEDATTM").alias("_replicated_at"),
    )


def make_t001l(
    WERKS="1000",
    LGORT="0001",
    LGOBE="Raw Materials Store",
    AEDATTM="2024-01-01T00:00:00",
):
    return Row(WERKS=WERKS, LGORT=LGORT, LGOBE=LGOBE, AEDATTM=AEDATTM)


class TestStorageLocation:
    def test_basic_select(self, spark):
        df = apply_storage_location_transform(
            spark, [make_t001l(WERKS="1000", LGORT="0001", LGOBE="Raw Materials")]
        )
        row = first_row(df)
        assert row["plant_code"] == "1000"
        assert row["storage_location_code"] == "0001"
        assert row["storage_location_description"] == "Raw Materials"

    def test_multiple_locations_per_plant(self, spark):
        df = apply_storage_location_transform(
            spark,
            [
                make_t001l(WERKS="1000", LGORT="0001"),
                make_t001l(WERKS="1000", LGORT="0002"),
            ],
        )
        codes = {r["storage_location_code"] for r in all_rows(df)}
        assert codes == {"0001", "0002"}

    def test_multiple_plants(self, spark):
        df = apply_storage_location_transform(
            spark,
            [make_t001l(WERKS="1000"), make_t001l(WERKS="2000")],
        )
        plants = {r["plant_code"] for r in all_rows(df)}
        assert plants == {"1000", "2000"}


# ─────────────────────────────────────────────────────────────────────────────
# Work Centre helpers and tests
# ─────────────────────────────────────────────────────────────────────────────

def apply_work_centre_transform(
    spark: SparkSession,
    crhd_rows: List[Row],
    crtx_rows: List[Row],
) -> DataFrame:
    crhd = spark.createDataFrame(crhd_rows, _CRHD_SCHEMA)
    crtx = spark.createDataFrame(crtx_rows, _CRTX_SCHEMA).filter(F.col("SPRAS") == "E")

    return (
        crhd.alias("w")
        .join(crtx.alias("t"), ["OBJID", "MANDT"], "left")
        .select(
            F.col("w.ARBPL").alias("work_centre_code"),
            F.col("w.WERKS").alias("plant_code"),
            F.col("t.KTEXT").alias("work_centre_description"),
            F.col("w.VERWE").alias("work_centre_category"),
            F.col("w.KOSTL").alias("cost_centre"),
            F.col("w.OBJID").alias("work_centre_internal_id"),
            F.col("w.AEDATTM").alias("_replicated_at"),
        )
    )


def make_crhd(
    OBJID="00000001",
    MANDT="100",
    ARBPL="LINE-A",
    WERKS="1000",
    VERWE="A",
    KOSTL="CC001",
    AEDATTM="2024-01-01T00:00:00",
):
    return Row(OBJID=OBJID, MANDT=MANDT, ARBPL=ARBPL, WERKS=WERKS,
               VERWE=VERWE, KOSTL=KOSTL, AEDATTM=AEDATTM)


def make_crtx(
    OBJID="00000001",
    MANDT="100",
    SPRAS="E",
    KTEXT="Production Line A",
):
    return Row(OBJID=OBJID, MANDT=MANDT, SPRAS=SPRAS, KTEXT=KTEXT)


class TestWorkCentre:
    def test_description_joined(self, spark):
        df = apply_work_centre_transform(
            spark, [make_crhd()], [make_crtx(KTEXT="Mixing Line")]
        )
        assert first_row(df)["work_centre_description"] == "Mixing Line"

    def test_english_only(self, spark):
        """Non-English text rows are filtered before the join."""
        df = apply_work_centre_transform(
            spark,
            [make_crhd()],
            [
                make_crtx(SPRAS="E", KTEXT="Mixing Line"),
                make_crtx(SPRAS="D", KTEXT="Mischanlage"),
            ],
        )
        rows = all_rows(df)
        assert len(rows) == 1
        assert rows[0]["work_centre_description"] == "Mixing Line"

    def test_work_centre_without_description_retained(self, spark):
        """A work centre with no text record must still appear (description NULL)."""
        df = apply_work_centre_transform(
            spark, [make_crhd(OBJID="99999")], []
        )
        row = first_row(df)
        assert row["work_centre_code"] == "LINE-A"
        assert row["work_centre_description"] is None

    def test_internal_id_propagated(self, spark):
        """OBJID is used as the join key to process_order_operation — must appear."""
        df = apply_work_centre_transform(
            spark, [make_crhd(OBJID="00042")], [make_crtx(OBJID="00042")]
        )
        assert first_row(df)["work_centre_internal_id"] == "00042"


# ─────────────────────────────────────────────────────────────────────────────
# Capacity Utilisation helpers and tests
# ─────────────────────────────────────────────────────────────────────────────

def apply_capacity_utilisation_transform(
    spark: SparkSession,
    kapa_rows: List[Row],
    kako_rows: List[Row],
) -> DataFrame:
    kapa = spark.createDataFrame(kapa_rows, _KAPA_SCHEMA)
    kako = spark.createDataFrame(kako_rows, _KAKO_SCHEMA)

    return (
        kapa.alias("k")
        .join(kako.alias("h"), ["KAPID", "MANDT"], "left")
        .select(
            F.col("k.KAPID").alias("capacity_id"),
            F.col("h.ARBPL").alias("work_centre_code"),
            F.col("h.WERKS").alias("plant_code"),
            F.col("h.KAPAR").alias("capacity_category"),
            sap_date("k.DAFBI").alias("valid_from_date"),
            sap_date("k.DAFEI").alias("valid_to_date"),
            F.col("k.KAPAZ").alias("available_capacity"),
            F.col("k.MEINH").alias("capacity_unit"),
            F.col("k.AEDATTM").alias("_replicated_at"),
        )
    )


def make_kapa(
    KAPID="00000001",
    MANDT="100",
    DAFBI="20240101",
    DAFEI="20241231",
    KAPAZ=480.0,
    MEINH="MIN",
    OEFFZ=480.0,
    NORMA=480.0,
    AEDATTM="2024-01-01T00:00:00",
):
    return Row(
        KAPID=KAPID, MANDT=MANDT, DAFBI=DAFBI, DAFEI=DAFEI,
        KAPAZ=KAPAZ, MEINH=MEINH, OEFFZ=OEFFZ, NORMA=NORMA, AEDATTM=AEDATTM,
    )


def make_kako(
    KAPID="00000001",
    MANDT="100",
    ARBPL="LINE-A",
    WERKS="1000",
    KAPAR="001",
):
    return Row(KAPID=KAPID, MANDT=MANDT, ARBPL=ARBPL, WERKS=WERKS, KAPAR=KAPAR)


class TestCapacityUtilisation:
    def test_valid_from_date_parsed(self, spark):
        df = apply_capacity_utilisation_transform(
            spark, [make_kapa(DAFBI="20240101")], [make_kako()]
        )
        assert first_row(df)["valid_from_date"] == date(2024, 1, 1)

    def test_valid_to_date_parsed(self, spark):
        df = apply_capacity_utilisation_transform(
            spark, [make_kapa(DAFEI="20241231")], [make_kako()]
        )
        assert first_row(df)["valid_to_date"] == date(2024, 12, 31)

    def test_capacity_and_unit(self, spark):
        df = apply_capacity_utilisation_transform(
            spark, [make_kapa(KAPAZ=480.0, MEINH="MIN")], [make_kako()]
        )
        row = first_row(df)
        assert row["available_capacity"] == 480.0
        assert row["capacity_unit"] == "MIN"

    def test_work_centre_joined(self, spark):
        df = apply_capacity_utilisation_transform(
            spark,
            [make_kapa(KAPID="CAP001")],
            [make_kako(KAPID="CAP001", ARBPL="MIX-01", WERKS="2000")],
        )
        row = first_row(df)
        assert row["work_centre_code"] == "MIX-01"
        assert row["plant_code"] == "2000"

    def test_capacity_without_kako_retained(self, spark):
        """Capacity record with no KAKO (work centre header) must still appear."""
        df = apply_capacity_utilisation_transform(
            spark, [make_kapa(KAPID="ORPHAN")], []
        )
        row = first_row(df)
        assert row["capacity_id"] == "ORPHAN"
        assert row["work_centre_code"] is None
        assert row["plant_code"] is None
