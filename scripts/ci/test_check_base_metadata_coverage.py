#!/usr/bin/env python3
"""
Unit tests for check_base_metadata_coverage.py.

Tests cover:
1. Column extraction from .alias() calls
2. Excluded column filtering (_-prefixed, record_activity, system cols)
3. Vacuous description detection
4. Coverage math (table and column percentages)
5. --strict flag: exits 1 on missing/blank, exits 0 when all covered
6. Table extraction from streaming table (apply_changes target) patterns
7. Conditional-registration tables do not false-fail
8. Dynamic-select tables (__dynamic__ sentinel) handled correctly
9. Metadata YAML loading (missing file, blank comments, filled comments)
10. End-to-end report-mode (exits 0 even with gaps)
11. Gold table extraction from gold_table_args pattern
12. YAML with multiple tables in one file
"""
import pathlib
import sys
import textwrap

import pytest

# Ensure the scripts/ci directory is importable
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from check_base_metadata_coverage import (
    MetadataEntry,
    TableDef,
    _compute_coverage,
    _extract_alias_names,
    _is_vacuous,
    _load_metadata_yamls,
    _parse_gold_file,
    _parse_silver_file,
    _should_exclude_column,
    run_check,
)

# ── 1. Column extraction from .alias() ────────────────────────────────────────

class TestExtractAliasNames:
    def test_single_alias(self):
        src = 'F.col("WERKS").alias("plant_code")'
        assert _extract_alias_names(src) == ["plant_code"]

    def test_multiple_aliases(self):
        src = (
            'F.col("WERKS").alias("plant_code"),\n'
            'F.col("MATNR").alias("material_code"),\n'
            'F.col("MENGE").alias("quantity")\n'
        )
        result = _extract_alias_names(src)
        assert "plant_code" in result
        assert "material_code" in result
        assert "quantity" in result

    def test_single_quoted_alias(self):
        src = "strip_zeros('MATNR').alias('material_code')"
        assert "material_code" in _extract_alias_names(src)

    def test_no_aliases(self):
        src = "spark.read.table('foo').select('*')"
        assert _extract_alias_names(src) == []


# ── 2. Excluded column filtering ─────────────────────────────────────────────

class TestShouldExcludeColumn:
    def test_underscore_prefix_excluded(self):
        assert _should_exclude_column("_replicated_at") is True
        assert _should_exclude_column("_change_run_id") is True
        assert _should_exclude_column("_lot_plant") is True

    def test_record_activity_excluded(self):
        assert _should_exclude_column("record_activity") is True

    def test_system_cols_excluded(self):
        assert _should_exclude_column("__START_AT") is True
        assert _should_exclude_column("__END_AT") is True

    def test_storage_bin_occupancy_key_excluded(self):
        assert _should_exclude_column("_storage_bin_occupancy_key") is True

    def test_regular_columns_included(self):
        assert _should_exclude_column("plant_code") is False
        assert _should_exclude_column("material_code") is False
        assert _should_exclude_column("posting_date") is False
        assert _should_exclude_column("order_number") is False


# ── 3. Vacuous description detection ──────────────────────────────────────────

class TestIsVacuous:
    def test_empty_string(self):
        assert _is_vacuous("") is True

    def test_none(self):
        assert _is_vacuous(None) is True

    def test_whitespace_only(self):
        assert _is_vacuous("   ") is True

    def test_todo(self):
        assert _is_vacuous("TODO") is True
        assert _is_vacuous("todo") is True
        assert _is_vacuous("TODO.") is True

    def test_tbd(self):
        assert _is_vacuous("TBD") is True

    def test_description_equals_col_name(self):
        assert _is_vacuous("plant_code", "plant_code") is True
        assert _is_vacuous("PLANT_CODE", "plant_code") is True

    def test_real_description(self):
        assert _is_vacuous("The plant code from SAP WERKS field", "plant_code") is False

    def test_short_but_real(self):
        assert _is_vacuous("SAP plant identifier", "plant_code") is False


# ── 4. Coverage math ──────────────────────────────────────────────────────────

class TestComputeCoverage:
    def _make_table(self, name, cols, source_file="test.py", conditional=False):
        return TableDef(name=name, columns=cols, source_file=source_file, conditional=conditional)

    def test_all_covered_non_strict(self):
        extracted = [
            self._make_table("foo", ["plant_code", "material_code"]),
        ]
        metadata = {
            "foo": MetadataEntry(
                table_name="foo",
                table_comment="Foo table",
                column_comments={"plant_code": "Plant identifier", "material_code": "Material"},
            )
        }
        ok, lines = _compute_coverage(extracted, metadata, strict=False)
        assert ok is True  # non-strict always ok

    def test_missing_table_strict(self):
        extracted = [self._make_table("missing_table", ["col_a"])]
        metadata = {}
        ok, lines = _compute_coverage(extracted, metadata, strict=True)
        assert ok is False
        assert any("MISSING TABLE" in line for line in lines)

    def test_missing_column_strict(self):
        extracted = [self._make_table("foo", ["col_a", "col_b"])]
        metadata = {
            "foo": MetadataEntry(
                table_name="foo",
                table_comment="Foo",
                column_comments={"col_a": "Column A"},  # col_b missing
            )
        }
        ok, lines = _compute_coverage(extracted, metadata, strict=True)
        assert ok is False
        assert any("MISSING COLUMN" in line for line in lines)

    def test_blank_comment_strict(self):
        extracted = [self._make_table("foo", ["col_a"])]
        metadata = {
            "foo": MetadataEntry(
                table_name="foo",
                table_comment="Foo",
                column_comments={"col_a": ""},  # blank
            )
        }
        ok, lines = _compute_coverage(extracted, metadata, strict=True)
        assert ok is False
        assert any("BLANK COMMENT" in line for line in lines)

    def test_blank_comment_non_strict(self):
        extracted = [self._make_table("foo", ["col_a"])]
        metadata = {
            "foo": MetadataEntry(
                table_name="foo",
                table_comment="",
                column_comments={"col_a": ""},
            )
        }
        ok, lines = _compute_coverage(extracted, metadata, strict=False)
        assert ok is True  # non-strict exits 0

    def test_dynamic_columns_skipped(self):
        extracted = [self._make_table("dynamic_table", ["__dynamic__"])]
        metadata = {
            "dynamic_table": MetadataEntry(
                table_name="dynamic_table",
                table_comment="Dynamic table",
                column_comments={},
            )
        }
        # __dynamic__ should not count towards columns total
        ok, lines = _compute_coverage(extracted, metadata, strict=True)
        assert ok is True  # no columns to check


# ── 5. --strict flag exit codes ───────────────────────────────────────────────

class TestStrictMode:
    def test_strict_ok_exits_0(self, tmp_path):
        # Create a minimal metadata YAML and source file
        silver_dir = tmp_path / "silver" / "tables"
        silver_dir.mkdir(parents=True)
        meta_dir = tmp_path / "metadata" / "silver"
        meta_dir.mkdir(parents=True)

        # Write a simple silver source file
        (silver_dir / "simple.py").write_text(
            textwrap.dedent("""\
            import dlt
            from pyspark.sql import functions as F

            @dlt.table(comment="Simple table")
            def my_table():
                return df.select(F.col("A").alias("col_a"))
            """),
            encoding="utf-8",
        )

        # Write matching metadata
        (meta_dir / "simple.metadata.yml").write_text(
            textwrap.dedent("""\
            tables:
              - name: my_table
                comment: "Simple table"
                tags: {product_area: test, layer: silver}
                columns:
                  - {name: col_a, comment: "Column A description"}
            """),
            encoding="utf-8",
        )

        ok = run_check(tmp_path, ["silver"], strict=True)
        assert ok is True

    def test_strict_missing_exits_1(self, tmp_path):
        silver_dir = tmp_path / "silver" / "tables"
        silver_dir.mkdir(parents=True)
        meta_dir = tmp_path / "metadata" / "silver"
        meta_dir.mkdir(parents=True)

        (silver_dir / "missing.py").write_text(
            textwrap.dedent("""\
            import dlt
            from pyspark.sql import functions as F

            @dlt.table(comment="Table with no metadata")
            def undocumented_table():
                return df.select(F.col("X").alias("col_x"))
            """),
            encoding="utf-8",
        )
        # No metadata YAML written

        ok = run_check(tmp_path, ["silver"], strict=True)
        assert ok is False


# ── 6. Streaming table extraction (apply_changes pattern) ─────────────────────

class TestStreamingTableExtraction:
    def test_streaming_table_with_apply_changes(self, tmp_path):
        silver_dir = tmp_path / "silver" / "tables"
        silver_dir.mkdir(parents=True)
        src_file = silver_dir / "stream.py"
        src_file.write_text(
            textwrap.dedent("""\
            import dlt
            from pyspark.sql import functions as F

            @dlt.view(name="stg_goods_movement")
            def stg_goods_movement():
                return df.select(
                    F.col("MBLNR").alias("material_document_number"),
                    F.col("WERKS").alias("plant_code"),
                    F.col("RecordActivity").alias("record_activity"),
                    F.col("AEDATTM").alias("_replicated_at"),
                    F.col("AERUNID").alias("_run_id"),
                )

            dlt.create_streaming_table(name="goods_movement")
            dlt.apply_changes(
                target="goods_movement",
                source="stg_goods_movement",
                keys=["material_document_number"],
            )
            """),
            encoding="utf-8",
        )
        tables = _parse_silver_file(src_file)
        names = {t.name for t in tables}
        assert "goods_movement" in names
        cols = next(t.columns for t in tables if t.name == "goods_movement")
        assert "material_document_number" in cols
        assert "plant_code" in cols
        # record_activity and _-prefixed should be excluded
        assert "record_activity" not in cols
        assert "_replicated_at" not in cols
        assert "_run_id" not in cols


# ── 7. Conditional-registration tables ────────────────────────────────────────

class TestConditionalRegistration:
    def test_conditional_table_flagged(self, tmp_path):
        silver_dir = tmp_path / "silver" / "tables"
        silver_dir.mkdir(parents=True)
        src_file = silver_dir / "conditional.py"
        src_file.write_text(
            textwrap.dedent("""\
            import dlt
            from pyspark.sql import functions as F
            from silver.helpers import bronze_columns_exist

            if bronze_columns_exist("source_table", ["COL1"]):
                @dlt.table(name="conditional_table", comment="Conditional table")
                def conditional_table():
                    return df.select(F.col("COL1").alias("col1"))
            """),
            encoding="utf-8",
        )
        tables = _parse_silver_file(src_file)
        cond_tables = [t for t in tables if t.name == "conditional_table"]
        assert len(cond_tables) == 1
        assert cond_tables[0].conditional is True


# ── 8. Dynamic-select tables ──────────────────────────────────────────────────

class TestDynamicSelectTables:
    def test_dynamic_columns_marked(self, tmp_path):
        silver_dir = tmp_path / "silver" / "tables"
        silver_dir.mkdir(parents=True)
        src_file = silver_dir / "dynamic.py"
        src_file.write_text(
            textwrap.dedent("""\
            import dlt
            from pyspark.sql import functions as F

            @dlt.table(name="dynamic_table", comment="Dynamic")
            def dynamic_table():
                # Uses a dynamic column list
                return df.select(*_COLS)
            """),
            encoding="utf-8",
        )
        tables = _parse_silver_file(src_file)
        dyn = [t for t in tables if t.name == "dynamic_table"]
        assert len(dyn) == 1
        assert dyn[0].columns == ["__dynamic__"]


# ── 9. Metadata YAML loading ──────────────────────────────────────────────────

class TestLoadMetadataYamls:
    def test_loads_tables_and_columns(self, tmp_path):
        meta_dir = tmp_path / "metadata" / "silver"
        meta_dir.mkdir(parents=True)
        (meta_dir / "test.metadata.yml").write_text(
            textwrap.dedent("""\
            tables:
              - name: table_a
                comment: "Table A"
                tags: {product_area: warehouse, layer: silver}
                columns:
                  - {name: col1, comment: "Column 1"}
                  - {name: col2, comment: ""}
            """),
            encoding="utf-8",
        )
        result = _load_metadata_yamls(tmp_path, "silver")
        assert "table_a" in result
        entry = result["table_a"]
        assert entry.table_comment == "Table A"
        assert entry.column_comments["col1"] == "Column 1"
        assert entry.column_comments["col2"] == ""

    def test_empty_directory(self, tmp_path):
        (tmp_path / "metadata" / "silver").mkdir(parents=True)
        result = _load_metadata_yamls(tmp_path, "silver")
        assert result == {}

    def test_multiple_tables_one_file(self, tmp_path):
        meta_dir = tmp_path / "metadata" / "silver"
        meta_dir.mkdir(parents=True)
        (meta_dir / "multi.metadata.yml").write_text(
            textwrap.dedent("""\
            tables:
              - name: table_x
                comment: "X"
                tags: {}
                columns: []
              - name: table_y
                comment: "Y"
                tags: {}
                columns:
                  - {name: c1, comment: "C1 desc"}
            """),
            encoding="utf-8",
        )
        result = _load_metadata_yamls(tmp_path, "silver")
        assert "table_x" in result
        assert "table_y" in result
        assert result["table_y"].column_comments["c1"] == "C1 desc"


# ── 10. End-to-end report mode ────────────────────────────────────────────────

class TestEndToEndReportMode:
    def test_report_mode_exits_0_with_gaps(self, tmp_path):
        """Report mode exits 0 even when tables are missing from metadata."""
        silver_dir = tmp_path / "silver" / "tables"
        silver_dir.mkdir(parents=True)
        meta_dir = tmp_path / "metadata" / "silver"
        meta_dir.mkdir(parents=True)

        (silver_dir / "undocumented.py").write_text(
            textwrap.dedent("""\
            import dlt
            from pyspark.sql import functions as F

            @dlt.table(comment="Undocumented")
            def undocumented_table():
                return df.select(F.col("X").alias("x"))
            """),
            encoding="utf-8",
        )
        # No YAML

        ok = run_check(tmp_path, ["silver"], strict=False)
        assert ok is True  # exits 0 in report mode


# ── 11. Gold table extraction ────────────────────────────────────────────────

class TestGoldTableExtraction:
    def test_gold_table_args_pattern(self, tmp_path):
        gold_dir = tmp_path / "gold"
        gold_dir.mkdir()
        src_file = gold_dir / "wm_gold.py"
        src_file.write_text(
            textwrap.dedent("""\
            import dlt
            from pyspark.sql import functions as F
            from gold._shared import gold_table_args

            @dlt.table(**gold_table_args(
                comment="WM worklist summary.",
                cluster_by=["plant_code"]
            ))
            def gold_wm_worklist_summary():
                return df.select(
                    F.col("plant_code").alias("plant_code"),
                    F.col("pending").alias("pending_count"),
                )
            """),
            encoding="utf-8",
        )
        tables = _parse_gold_file(src_file)
        names = {t.name for t in tables}
        assert "gold_wm_worklist_summary" in names
        cols = next(t.columns for t in tables if t.name == "gold_wm_worklist_summary")
        assert "plant_code" in cols
        assert "pending_count" in cols


# ── 12. Multiple tables in one YAML file ─────────────────────────────────────

class TestMultiTableYamlFile:
    def test_all_tables_loaded(self, tmp_path):
        meta_dir = tmp_path / "metadata" / "gold"
        meta_dir.mkdir(parents=True)
        (meta_dir / "warehouse_gold.metadata.yml").write_text(
            textwrap.dedent("""\
            tables:
              - name: gold_wm_worklist_summary
                comment: ""
                tags: {product_area: warehouse, layer: gold}
                columns:
                  - {name: plant_code, comment: ""}
                  - {name: open_count, comment: ""}
              - name: gold_wm_staging_worklist
                comment: ""
                tags: {product_area: warehouse, layer: gold}
                columns:
                  - {name: order_number, comment: ""}
            """),
            encoding="utf-8",
        )
        result = _load_metadata_yamls(tmp_path, "gold")
        assert len(result) == 2
        assert "gold_wm_worklist_summary" in result
        assert "gold_wm_staging_worklist" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
