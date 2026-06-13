"""
PySpark fixture tests for silver.material_allergen.

These tests run in CI only (requires a local JVM / PySpark installation).
They exercise the transform logic directly without a live DLT runtime by
replicating the join logic from reference.py:material_allergen().

Business rules under test:
  - Multi-allergen material → exactly N rows (one per allergen value × counter)
  - Zero-padding stripped from OBJEK → material_code
  - Missing CAWNT row → allergen_name is NULL but row is still present
  - Grain uniqueness on (material_code_raw, allergen_atinn, allergen_value_counter)
  - Material with no KLART='001' / ALLERGEN_ATINN classification → zero rows
"""

from typing import List

from pyspark.sql import DataFrame, Row, SparkSession
from pyspark.sql import functions as F

from silver.helpers import ALLERGEN_ATINN, strip_zeros
from tests.conftest import all_rows, first_row

# ── Schema strings matching the published central_services table shapes ────────

_AUSP_SCHEMA = (
    "MANDT STRING, OBJEK STRING, KLART STRING, ATINN STRING, "
    "ATZHL STRING, ATWRT STRING"
)
_CAWNT_SCHEMA = (
    "MANDT STRING, ATINN STRING, ATZHL STRING, SPRAS STRING, ATWTB STRING"
)


# ── Transform helper — mirrors reference.py:material_allergen() ────────────────

def apply_material_allergen_transform(
    spark: SparkSession,
    ausp_rows: List[Row],
    cawnt_rows: List[Row],
) -> DataFrame:
    """Replicate the material_allergen join logic for offline testing.

    Accepts raw AUSP and CAWNT rows (pre-filtered to the right KLART/ATINN/SPRAS
    in the production code; here we pre-filter identically so the test controls
    what reaches the join).
    """
    ausp = (
        spark.createDataFrame(ausp_rows, _AUSP_SCHEMA)
        .filter((F.col("KLART") == "001") & (F.col("ATINN") == ALLERGEN_ATINN))
        .select(
            strip_zeros(F.col("OBJEK")).alias("material_code"),
            F.col("OBJEK").alias("material_code_raw"),
            F.col("ATINN").alias("allergen_atinn"),
            F.col("ATZHL").alias("allergen_value_counter"),
            F.col("ATWRT").alias("allergen_value"),
        )
        .dropDuplicates(["material_code_raw", "allergen_atinn", "allergen_value_counter"])
    )
    cawnt = (
        spark.createDataFrame(cawnt_rows, _CAWNT_SCHEMA)
        # Mirror production: pre-filter to English AND the allergen characteristic before the join.
        .filter((F.col("SPRAS") == "E") & (F.col("ATINN") == ALLERGEN_ATINN))
        .select(
            F.col("ATINN").alias("_c_atinn"),
            F.col("ATZHL").alias("_c_atzhl"),
            F.col("ATWTB").alias("allergen_name"),
        )
    )
    return (
        ausp.join(
            cawnt,
            (ausp["allergen_atinn"] == cawnt["_c_atinn"])
            & (ausp["allergen_value_counter"] == cawnt["_c_atzhl"]),
            "left",
        )
        .select(
            F.col("material_code"),
            F.col("material_code_raw"),
            F.col("allergen_value"),
            F.col("allergen_name"),
            F.col("allergen_atinn"),
            F.col("allergen_value_counter"),
        )
    )


# ── Row factory helpers ────────────────────────────────────────────────────────

def make_ausp(
    MANDT="100",
    OBJEK="000000000000012345",
    KLART="001",
    ATINN="0000000849",
    ATZHL="0001",
    ATWRT="WHEAT",
):
    return Row(
        MANDT=MANDT, OBJEK=OBJEK, KLART=KLART,
        ATINN=ATINN, ATZHL=ATZHL, ATWRT=ATWRT,
    )


def make_cawnt(
    MANDT="100",
    ATINN="0000000849",
    ATZHL="0001",
    SPRAS="E",
    ATWTB="Wheat",
):
    return Row(MANDT=MANDT, ATINN=ATINN, ATZHL=ATZHL, SPRAS=SPRAS, ATWTB=ATWTB)


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestMaterialAllergenMultiValue:
    """A material with two allergen values must produce exactly two rows."""

    def test_two_allergens_yield_two_rows(self, spark):
        ausp_rows = [
            make_ausp(OBJEK="000000000000012345", ATZHL="0001", ATWRT="WHEAT"),
            make_ausp(OBJEK="000000000000012345", ATZHL="0002", ATWRT="BARLEY"),
        ]
        cawnt_rows = [
            make_cawnt(ATZHL="0001", ATWTB="Wheat"),
            make_cawnt(ATZHL="0002", ATWTB="Barley"),
        ]
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        rows = all_rows(df)
        assert len(rows) == 2, f"Expected 2 rows for 2 allergens, got {len(rows)}"
        values = {r["allergen_value"] for r in rows}
        assert values == {"WHEAT", "BARLEY"}

    def test_two_allergens_correct_material_code(self, spark):
        """Both rows carry the same stripped material_code."""
        ausp_rows = [
            make_ausp(OBJEK="000000000000012345", ATZHL="0001", ATWRT="WHEAT"),
            make_ausp(OBJEK="000000000000012345", ATZHL="0002", ATWRT="BARLEY"),
        ]
        cawnt_rows = [
            make_cawnt(ATZHL="0001", ATWTB="Wheat"),
            make_cawnt(ATZHL="0002", ATWTB="Barley"),
        ]
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        rows = all_rows(df)
        assert all(r["material_code"] == "12345" for r in rows)
        assert all(r["material_code_raw"] == "000000000000012345" for r in rows)

    def test_allergen_names_populated(self, spark):
        """English CAWNT text is joined for each allergen row."""
        ausp_rows = [
            make_ausp(OBJEK="000000000000012345", ATZHL="0001", ATWRT="WHEAT"),
            make_ausp(OBJEK="000000000000012345", ATZHL="0002", ATWRT="BARLEY"),
        ]
        cawnt_rows = [
            make_cawnt(ATZHL="0001", ATWTB="Wheat"),
            make_cawnt(ATZHL="0002", ATWTB="Barley"),
        ]
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        rows = {r["allergen_value"]: r["allergen_name"] for r in all_rows(df)}
        assert rows["WHEAT"] == "Wheat"
        assert rows["BARLEY"] == "Barley"


class TestMaterialAllergenZeroPadding:
    """OBJEK zero-padding must be stripped to produce the natural material_code."""

    def test_zero_padded_objek_stripped(self, spark):
        ausp_rows = [make_ausp(OBJEK="000000000000099999")]
        cawnt_rows = [make_cawnt()]
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        row = first_row(df)
        assert row["material_code"] == "99999"

    def test_raw_objek_preserved(self, spark):
        """material_code_raw must keep the original zero-padded value."""
        ausp_rows = [make_ausp(OBJEK="000000000000099999")]
        cawnt_rows = [make_cawnt()]
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        row = first_row(df)
        assert row["material_code_raw"] == "000000000000099999"

    def test_short_material_code(self, spark):
        """Short material numbers (no leading zeros) are preserved as-is."""
        ausp_rows = [make_ausp(OBJEK="Z-RAW-001")]
        cawnt_rows = [make_cawnt()]
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        row = first_row(df)
        # strip_zeros leaves non-numeric strings unchanged (no leading zeros to strip)
        assert row["material_code"] == "Z-RAW-001"
        assert row["material_code_raw"] == "Z-RAW-001"


class TestMaterialAllergenMissingCawnt:
    """If there is no matching CAWNT row, allergen_name is NULL but the row is present."""

    def test_missing_cawnt_row_still_present(self, spark):
        ausp_rows = [make_ausp(OBJEK="000000000000012345", ATZHL="0001", ATWRT="MUSTARD")]
        cawnt_rows = []  # no CAWNT row at all
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        rows = all_rows(df)
        assert len(rows) == 1, "Row must be present even without a CAWNT match"
        assert rows[0]["allergen_name"] is None

    def test_missing_cawnt_allergen_value_retained(self, spark):
        """allergen_value (ATWRT) is from AUSP and is always present."""
        ausp_rows = [make_ausp(OBJEK="000000000000012345", ATZHL="0001", ATWRT="MUSTARD")]
        cawnt_rows = []
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        row = first_row(df)
        assert row["allergen_value"] == "MUSTARD"

    def test_non_english_cawnt_not_substituted(self, spark):
        """A German-only CAWNT row must not be joined (SPRAS='E' filter applied before join)."""
        ausp_rows = [make_ausp(OBJEK="000000000000012345", ATZHL="0001", ATWRT="WHEAT")]
        cawnt_rows = [make_cawnt(ATZHL="0001", SPRAS="D", ATWTB="Weizen")]
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        row = first_row(df)
        # German row is filtered out; allergen_name is NULL (no English row)
        assert row["allergen_name"] is None


class TestMaterialAllergenGrainUniqueness:
    """Grain (material_code_raw, allergen_atinn, allergen_value_counter) must be unique."""

    def test_duplicate_ausp_rows_deduped(self, spark):
        """Defensive dedup: exact duplicate AUSP rows must collapse to one output row."""
        dup_row = make_ausp(OBJEK="000000000000012345", ATZHL="0001", ATWRT="WHEAT")
        ausp_rows = [dup_row, dup_row]  # exact duplicate
        cawnt_rows = [make_cawnt(ATZHL="0001", ATWTB="Wheat")]
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        rows = all_rows(df)
        assert len(rows) == 1, f"Duplicate AUSP rows must be deduped; got {len(rows)}"

    def test_different_atzhl_gives_two_rows(self, spark):
        """Two different ATZHL values for the same material → two rows (distinct grain)."""
        ausp_rows = [
            make_ausp(OBJEK="000000000000012345", ATZHL="0001", ATWRT="WHEAT"),
            make_ausp(OBJEK="000000000000012345", ATZHL="0002", ATWRT="WHEAT"),
        ]
        cawnt_rows = [
            make_cawnt(ATZHL="0001", ATWTB="Wheat"),
            make_cawnt(ATZHL="0002", ATWTB="Wheat"),
        ]
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        rows = all_rows(df)
        assert len(rows) == 2

    def test_grain_columns_present(self, spark):
        """allergen_atinn and allergen_value_counter must appear in output for traceability."""
        ausp_rows = [make_ausp(OBJEK="000000000000012345", ATZHL="0007", ATWRT="WHEAT")]
        cawnt_rows = [make_cawnt(ATZHL="0007", ATWTB="Wheat")]
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        row = first_row(df)
        assert row["allergen_atinn"] == ALLERGEN_ATINN
        assert row["allergen_value_counter"] == "0007"


class TestMaterialAllergenUnclassifiedMaterial:
    """A material with no KLART='001'/ALLERGEN_ATINN classification yields zero rows."""

    def test_wrong_klart_filtered_out(self, spark):
        """A row with KLART='018' (recipe class) must not appear."""
        ausp_rows = [make_ausp(OBJEK="000000000000012345", KLART="018")]
        cawnt_rows = [make_cawnt()]
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        assert df.count() == 0, "KLART='018' rows must be excluded"

    def test_wrong_atinn_filtered_out(self, spark):
        """A row with a different ATINN (not ALLERGEN_ATINN) must not appear."""
        ausp_rows = [make_ausp(OBJEK="000000000000012345", KLART="001", ATINN="0000000999")]
        cawnt_rows = [make_cawnt()]
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        assert df.count() == 0, "Non-allergen ATINN must be excluded"

    def test_no_ausp_rows_yields_empty_dataframe(self, spark):
        """If AUSP has no matching rows for a material, the output is empty."""
        ausp_rows = []
        cawnt_rows = [make_cawnt()]
        df = apply_material_allergen_transform(spark, ausp_rows, cawnt_rows)
        assert df.count() == 0
