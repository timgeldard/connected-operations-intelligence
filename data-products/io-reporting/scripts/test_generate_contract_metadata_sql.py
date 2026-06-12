"""Tests for the contract-metadata SQL generator.

Spark-free: the generator is pure string generation over the YAML manifest.
Each test runs against a controlled tmp_path so it does not touch the committed
resources/sql/ files.
"""
import importlib.util
import pathlib
import textwrap

import pytest
import yaml

_HERE = pathlib.Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    "gen_contract_metadata",
    _HERE / "generate_contract_metadata_sql.py",
)
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _write_minimal_manifest(base_dir: pathlib.Path, contracts: list[dict]) -> None:
    """Write a minimal manifest YAML at the expected path."""
    (base_dir / "contracts").mkdir(parents=True, exist_ok=True)
    manifest = {"contract_version": "0.1.0", "contracts": contracts}
    with open(base_dir / "contracts" / "app_contract_manifest.yml", "w") as f:
        yaml.dump(manifest, f, default_flow_style=False)


def _write_consumption_sql(base_dir: pathlib.Path, env: str, view_names: list[str]) -> None:
    """Write stub consumption-view SQL that the generator parses for view discovery."""
    sql_dir = base_dir / "resources" / "sql"
    sql_dir.mkdir(parents=True, exist_ok=True)
    lines = [f"-- stub for {env}\n"]
    for vn in view_names:
        catalog = gen.ENVIRONMENTS[env]["catalog"]
        schema = gen.ENVIRONMENTS[env]["gold_schema"]
        lines.append(f"CREATE OR REPLACE VIEW {catalog}.{schema}.{vn} AS SELECT 1;\n")
    with open(sql_dir / f"test_consumption_views_{env}.sql", "w") as f:
        f.writelines(lines)


def _run(tmp_path: pathlib.Path, env: str = "uat") -> str:
    """Run the generator for one env and return the generated SQL text."""
    gen.generate_sql(env_filter=env, base_dir=tmp_path)
    out = tmp_path / "resources" / "sql" / f"contract_metadata_{env}.sql"
    return out.read_text(encoding="utf-8")


SIMPLE_CONTRACT = {
    "id": "test.widget",
    "version": "0.2.0",
    "description": "Widget inventory levels.\n\nSecond paragraph — not included.",
    "source_view": "vw_consumption_test_widget",
    "grain": "one row per plant_id and widget_id",
    "freshness": {
        "expected_minutes": 15,
        "warning_minutes": 30,
        "critical_minutes": 60,
    },
    "access_policy": {"row_level_key": "plant_id"},
    "fields": [
        {"name": "plant_id", "type": "string", "required": True, "description": "SAP plant ID"},
        {"name": "widget_id", "type": "string", "required": True, "description": "Widget identifier"},
        {"name": "qty", "type": "double", "required": False},  # no description — should be skipped
    ],
}


# ── Unit tests for helper functions ──────────────────────────────────────────

class TestEscapeSqlString:
    def test_no_quotes(self):
        assert gen._escape_sql_string("hello world") == "hello world"

    def test_single_quote_doubled(self):
        assert gen._escape_sql_string("it's") == "it''s"

    def test_multiple_quotes(self):
        assert gen._escape_sql_string("O'Brien's data") == "O''Brien''s data"

    def test_empty_string(self):
        assert gen._escape_sql_string("") == ""

    def test_already_doubled_quote_not_tripled(self):
        # Verify the replace is simple (double each occurrence).
        result = gen._escape_sql_string("it''s")
        assert result == "it''''s"


class TestFirstParagraph:
    def test_single_line(self):
        assert gen._first_paragraph("Hello world.") == "Hello world."

    def test_internal_newline_collapsed(self):
        text = "First sentence.\nSecond sentence."
        result = gen._first_paragraph(text)
        assert "\n" not in result
        assert "First sentence." in result
        assert "Second sentence." in result

    def test_two_paragraphs_returns_first(self):
        text = "First paragraph.\n\nSecond paragraph."
        result = gen._first_paragraph(text)
        assert result == "First paragraph."

    def test_strips_leading_trailing_whitespace(self):
        assert gen._first_paragraph("  hello  ") == "hello"


class TestBuildViewComment:
    def test_contains_description(self):
        comment = gen._build_view_comment(SIMPLE_CONTRACT)
        assert "Widget inventory levels." in comment

    def test_first_paragraph_only(self):
        comment = gen._build_view_comment(SIMPLE_CONTRACT)
        # "Second paragraph" is separated by a blank line so should NOT appear.
        assert "Second paragraph" not in comment

    def test_contains_grain(self):
        comment = gen._build_view_comment(SIMPLE_CONTRACT)
        assert "one row per plant_id and widget_id" in comment

    def test_contains_contract_id_and_version(self):
        comment = gen._build_view_comment(SIMPLE_CONTRACT)
        assert "test.widget" in comment
        assert "v0.2.0" in comment

    def test_contains_freshness(self):
        comment = gen._build_view_comment(SIMPLE_CONTRACT)
        assert "expected 15 min" in comment
        assert "warning 30 min" in comment
        assert "critical 60 min" in comment

    def test_contains_row_level_key(self):
        comment = gen._build_view_comment(SIMPLE_CONTRACT)
        assert "plant_id" in comment

    def test_no_single_quotes_in_body(self):
        # The raw output of _build_view_comment should not itself contain quotes that
        # would break the SQL literal — escaping happens in the generator layer.
        comment = gen._build_view_comment(SIMPLE_CONTRACT)
        assert "'" not in comment  # no quotes in this sample

    def test_apostrophe_contract_escaped(self):
        c = {**SIMPLE_CONTRACT, "description": "Kerry's data."}
        comment = gen._build_view_comment(c)
        assert "Kerry's" in comment  # raw text; escaping is the generator's job


# ── Integration tests (file-generation round-trips) ──────────────────────────

class TestGenerateSql:
    def test_generates_output_file(self, tmp_path):
        _write_minimal_manifest(tmp_path, [SIMPLE_CONTRACT])
        _write_consumption_sql(tmp_path, "uat", ["vw_consumption_test_widget"])
        sql = _run(tmp_path)
        out = tmp_path / "resources" / "sql" / "contract_metadata_uat.sql"
        assert out.exists()

    def test_comment_on_view_present(self, tmp_path):
        _write_minimal_manifest(tmp_path, [SIMPLE_CONTRACT])
        _write_consumption_sql(tmp_path, "uat", ["vw_consumption_test_widget"])
        sql = _run(tmp_path)
        assert "COMMENT ON VIEW" in sql
        assert "vw_consumption_test_widget" in sql

    def test_catalog_and_schema_correct_uat(self, tmp_path):
        _write_minimal_manifest(tmp_path, [SIMPLE_CONTRACT])
        _write_consumption_sql(tmp_path, "uat", ["vw_consumption_test_widget"])
        sql = _run(tmp_path, env="uat")
        assert "connected_plant_uat.gold_io_reporting.vw_consumption_test_widget" in sql

    def test_catalog_correct_prod(self, tmp_path):
        _write_minimal_manifest(tmp_path, [SIMPLE_CONTRACT])
        _write_consumption_sql(tmp_path, "prod", ["vw_consumption_test_widget"])
        sql = _run(tmp_path, env="prod")
        assert "connected_plant_prod.gold_io_reporting.vw_consumption_test_widget" in sql

    def test_set_tags_present(self, tmp_path):
        _write_minimal_manifest(tmp_path, [SIMPLE_CONTRACT])
        _write_consumption_sql(tmp_path, "uat", ["vw_consumption_test_widget"])
        sql = _run(tmp_path)
        assert "ALTER VIEW" in sql
        assert "SET TAGS" in sql
        assert "'contract_id'" in sql or "contract_id" in sql
        assert "test.widget" in sql

    def test_tag_values_quoted(self, tmp_path):
        _write_minimal_manifest(tmp_path, [SIMPLE_CONTRACT])
        _write_consumption_sql(tmp_path, "uat", ["vw_consumption_test_widget"])
        sql = _run(tmp_path)
        # Tags should appear as key=value pairs with string literals.
        assert "'contract_id' = 'test.widget'" in sql
        assert "'contract_version' = '0.2.0'" in sql

    def test_column_comment_emitted_for_described_fields(self, tmp_path):
        _write_minimal_manifest(tmp_path, [SIMPLE_CONTRACT])
        _write_consumption_sql(tmp_path, "uat", ["vw_consumption_test_widget"])
        sql = _run(tmp_path)
        assert "COMMENT ON COLUMN" in sql
        assert ".plant_id IS" in sql
        assert ".widget_id IS" in sql
        assert "SAP plant ID" in sql
        assert "Widget identifier" in sql

    def test_field_without_description_not_emitted(self, tmp_path):
        _write_minimal_manifest(tmp_path, [SIMPLE_CONTRACT])
        _write_consumption_sql(tmp_path, "uat", ["vw_consumption_test_widget"])
        sql = _run(tmp_path)
        # 'qty' has no description — should not appear as COMMENT ON COLUMN
        assert ".qty IS" not in sql

    def test_missing_view_is_skipped(self, tmp_path):
        """A contract whose source_view is not in any consumption SQL is skipped."""
        _write_minimal_manifest(tmp_path, [SIMPLE_CONTRACT])
        # No consumption SQL at all — view cannot be discovered.
        (tmp_path / "resources" / "sql").mkdir(parents=True, exist_ok=True)
        sql = _run(tmp_path)
        assert "not found" in sql.lower() or "skipped" in sql.lower()
        # The actual statement should NOT be generated (only the header comment references it).
        # We check that the QUALIFIED view name does not appear in a COMMENT ON VIEW statement.
        assert "COMMENT ON VIEW connected_plant_uat" not in sql

    def test_apostrophe_in_description_escaped(self, tmp_path):
        """Single quotes in descriptions must be doubled in the SQL output."""
        contract = {**SIMPLE_CONTRACT, "description": "Kerry's plant data."}
        _write_minimal_manifest(tmp_path, [contract])
        _write_consumption_sql(tmp_path, "uat", ["vw_consumption_test_widget"])
        sql = _run(tmp_path)
        # "Kerry's" must become "Kerry''s" inside the SQL string literal.
        assert "Kerry''s" in sql

    def test_apostrophe_in_field_description_escaped(self, tmp_path):
        contract = {
            **SIMPLE_CONTRACT,
            "fields": [
                {"name": "plant_id", "type": "string", "required": True,
                 "description": "O'Brien's plant code"},
            ],
        }
        _write_minimal_manifest(tmp_path, [contract])
        _write_consumption_sql(tmp_path, "uat", ["vw_consumption_test_widget"])
        sql = _run(tmp_path)
        assert "O''Brien''s" in sql

    def test_unknown_env_rejected(self, tmp_path):
        _write_minimal_manifest(tmp_path, [SIMPLE_CONTRACT])
        with pytest.raises(SystemExit):
            gen.generate_sql(env_filter="staging", base_dir=tmp_path)

    def test_missing_manifest_raises(self, tmp_path):
        # No manifest written — should error.
        with pytest.raises(SystemExit):
            gen.generate_sql(env_filter="uat", base_dir=tmp_path)

    def test_all_three_envs_generated(self, tmp_path):
        _write_minimal_manifest(tmp_path, [SIMPLE_CONTRACT])
        for env in ("dev", "uat", "prod"):
            _write_consumption_sql(tmp_path, env, ["vw_consumption_test_widget"])
        gen.generate_sql(env_filter=None, base_dir=tmp_path)
        for env in ("dev", "uat", "prod"):
            out = tmp_path / "resources" / "sql" / f"contract_metadata_{env}.sql"
            assert out.exists(), f"Missing output for {env}"

    def test_deterministic(self, tmp_path):
        """Running twice should produce identical output."""
        _write_minimal_manifest(tmp_path, [SIMPLE_CONTRACT])
        _write_consumption_sql(tmp_path, "uat", ["vw_consumption_test_widget"])
        sql_a = _run(tmp_path)
        sql_b = _run(tmp_path)
        assert sql_a == sql_b

    def test_contract_without_source_view_skipped(self, tmp_path):
        contract_no_view = {
            "id": "test.no_view",
            "version": "0.1.0",
            "description": "A contract without a source_view.",
            # no source_view key
        }
        _write_minimal_manifest(tmp_path, [contract_no_view])
        (tmp_path / "resources" / "sql").mkdir(parents=True, exist_ok=True)
        sql = _run(tmp_path)
        # Should not crash; just skip and note in output.
        # No actual COMMENT ON VIEW statement should be emitted (only the header mentions it).
        assert "COMMENT ON VIEW connected_plant_uat" not in sql

    def test_no_alter_column_comment_syntax(self, tmp_path):
        """Confirm the generator never emits ALTER COLUMN COMMENT (unsupported on views)."""
        _write_minimal_manifest(tmp_path, [SIMPLE_CONTRACT])
        _write_consumption_sql(tmp_path, "uat", ["vw_consumption_test_widget"])
        sql = _run(tmp_path)
        assert "ALTER COLUMN" not in sql

    def test_null_freshness_contract(self, tmp_path):
        """A contract with freshness: null must not crash the generator."""
        contract = {
            **SIMPLE_CONTRACT,
            "freshness": None,
        }
        _write_minimal_manifest(tmp_path, [contract])
        _write_consumption_sql(tmp_path, "uat", ["vw_consumption_test_widget"])
        sql = _run(tmp_path)
        # Should produce a COMMENT ON VIEW without raising AttributeError on NoneType.
        assert "COMMENT ON VIEW" in sql
        # No freshness SLA clause emitted (all fields absent).
        assert "Freshness SLA" not in sql

    def test_empty_manifest(self, tmp_path):
        """An empty/null manifest (yaml.safe_load returns None) must not crash."""
        (tmp_path / "contracts").mkdir(parents=True, exist_ok=True)
        # Write a YAML file that parses to None (empty file).
        with open(tmp_path / "contracts" / "app_contract_manifest.yml", "w") as f:
            f.write("")
        (tmp_path / "resources" / "sql").mkdir(parents=True, exist_ok=True)
        sql = _run(tmp_path)
        # No contracts → nothing covered; header should still be written.
        assert "contract" in sql.lower() or "covered" in sql.lower()

    def test_backtick_quoted_view_names_discovered(self, tmp_path):
        """View names wrapped in backticks must be discovered by the regex."""
        _write_minimal_manifest(tmp_path, [SIMPLE_CONTRACT])
        sql_dir = tmp_path / "resources" / "sql"
        sql_dir.mkdir(parents=True, exist_ok=True)
        catalog = gen.ENVIRONMENTS["uat"]["catalog"]
        schema = gen.ENVIRONMENTS["uat"]["gold_schema"]
        # Write SQL using backtick-quoted identifiers.
        with open(sql_dir / "test_consumption_views_uat.sql", "w") as f:
            f.write(
                f"CREATE OR REPLACE VIEW `{catalog}`.`{schema}`.`vw_consumption_test_widget` AS SELECT 1;\n"
            )
        sql = _run(tmp_path)
        # The backtick-quoted view should be matched and covered.
        assert "COMMENT ON VIEW" in sql
        assert "vw_consumption_test_widget" in sql
