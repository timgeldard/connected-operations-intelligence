"""Unit tests for generate_warehouse360_validation_sql.py."""

import re

import pytest
import yaml
from generate_warehouse360_validation_sql import generate_sql_for_env


@pytest.fixture
def sample_config():
    return {
        "environment_targets": {
            "dev": {"catalog": "connected_plant_dev", "schema": "gold_io_reporting"},
            "uat": {"catalog": "connected_plant_uat", "schema": "gold_io_reporting"},
        },
        "views": [
            {
                "name": "vw_consumption_warehouse360_overview",
                "contract_id": "warehouse360.overview",
                "expected_grain": "one row per plant_id + snapshot timestamp",
                "primary_key": ["plant_id", "snapshot_ts"],
                "row_level_key": "plant_id",
                "must_not_be_null": ["plant_id", "snapshot_ts"],
                "expected_columns": [
                    {"name": "plant_id", "type": "string"},
                    {"name": "snapshot_ts", "type": "timestamp"},
                ],
                "freshness_column": "snapshot_ts",
            },
            {
                "name": "vw_consumption_warehouse360_inbound_backlog",
                "contract_id": "warehouse360.inbound_backlog",
                "expected_grain": "one row per plant_id + po_id + po_item",
                "primary_key": ["plant_id", "po_id", "po_item"],
                "row_level_key": "plant_id",
                "must_not_be_null": ["plant_id", "po_id"],
                "expected_columns": [
                    {"name": "plant_id", "type": "string"},
                    {"name": "po_id", "type": "string"},
                ],
                "freshness_column": None,
            },
            {
                "name": "vw_consumption_warehouse360_dispensary_queue",
                "contract_id": "warehouse360.dispensary_queue",
                "status": "not_runtime_ready",
                "primary_key": ["plant_id"],
            },
        ],
    }


def test_generate_sql_skips_not_runtime_ready(sample_config):
    sql = generate_sql_for_env("dev", sample_config)
    assert "vw_consumption_warehouse360_dispensary_queue" not in sql
    assert "vw_consumption_warehouse360_overview" in sql
    assert "vw_consumption_warehouse360_inbound_backlog" in sql


def test_generate_sql_correct_catalog_schema(sample_config):
    dev_sql = generate_sql_for_env("dev", sample_config)
    assert "connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview" in dev_sql

    uat_sql = generate_sql_for_env("uat", sample_config)
    assert "connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_overview" in uat_sql


def test_generate_sql_primary_key_duplicate_check(sample_config):
    sql = generate_sql_for_env("dev", sample_config)
    # Overview PK is plant_id, snapshot_ts
    assert "COUNT(DISTINCT CONCAT_WS('||', plant_id, snapshot_ts)) AS distinct_pk_rows" in sql
    # Inbound PK is plant_id, po_id, po_item
    assert "COUNT(DISTINCT CONCAT_WS('||', plant_id, po_id, po_item)) AS distinct_pk_rows" in sql


def test_generate_sql_nullability_checks(sample_config):
    sql = generate_sql_for_env("dev", sample_config)
    # Overview must_not_be_null has plant_id, snapshot_ts
    assert "COUNT_IF(plant_id IS NULL) AS null_plant_id_rows" in sql
    assert "COUNT_IF(snapshot_ts IS NULL) AS null_snapshot_ts_rows" in sql
    # Inbound must_not_be_null has plant_id, po_id
    assert "COUNT_IF(po_id IS NULL) AS null_po_id_rows" in sql
    assert "COUNT_IF(po_item IS NULL)" not in sql


def test_generate_sql_freshness_check(sample_config):
    sql = generate_sql_for_env("dev", sample_config)
    # Overview has freshness_column: snapshot_ts
    assert "MAX(snapshot_ts) AS max_freshness_ts" in sql
    # Inbound has freshness_column: None, so it shouldn't have max_freshness_ts
    # Let's count how many times max_freshness_ts appears
    matches = re.findall(r"max_freshness_ts", sql)
    assert len(matches) == 1


def test_generate_sql_plant_scope(sample_config):
    sql = generate_sql_for_env("dev", sample_config)
    # Overview has plant_id, so it should group by plant_id and count
    assert "GROUP BY plant_id" in sql
    assert "LIMIT 20" in sql


def test_generate_sql_is_read_only(sample_config):
    sql = generate_sql_for_env("dev", sample_config)

    # Strip comments to verify actual SQL statements
    statements = []
    for line in sql.splitlines():
        line_clean = line.split("--")[0].strip()
        if line_clean:
            statements.append(line_clean)

    cleaned_sql = "\n".join(statements)

    forbidden_keywords = [
        r"\bCREATE\b",
        r"\bINSERT\b",
        r"\bUPDATE\b",
        r"\bDELETE\b",
        r"\bMERGE\b",
        r"\bDROP\b",
        r"\bALTER\b",
        r"\bTRUNCATE\b",
    ]

    for kw in forbidden_keywords:
        match = re.search(kw, cleaned_sql, re.IGNORECASE)
        assert not match, f"Forbidden write keyword found: {kw}"


def test_check_mode_detects_drift(tmp_path, sample_config):
    # Setup paths and environment
    from unittest.mock import patch

    import generate_warehouse360_validation_sql

    # Mock constant EXPECTATIONS_PATH and OUTPUT_DIR
    expectations_file = tmp_path / "warehouse360_view_expectations.yml"
    output_dir = tmp_path / "validation" / "generated"

    with open(expectations_file, "w", encoding="utf-8") as f:
        yaml.dump(sample_config, f)

    with patch("generate_warehouse360_validation_sql.EXPECTATIONS_PATH", str(expectations_file)), \
         patch("generate_warehouse360_validation_sql.OUTPUT_DIR", str(output_dir)):

        # Run normal generation
        with patch("sys.argv", ["generate_warehouse360_validation_sql.py"]):
            code = generate_warehouse360_validation_sql.main()
            assert code == 0

        # Check mode should now pass
        with patch("sys.argv", ["generate_warehouse360_validation_sql.py", "--check"]):
            code = generate_warehouse360_validation_sql.main()
            assert code == 0

        # Modify one file to introduce drift
        dev_file = output_dir / "warehouse360_contract_validation_dev.sql"
        with open(dev_file, "w", encoding="utf-8") as f:
            f.write("SELECT 1;")

        # Check mode should now fail
        with patch("sys.argv", ["generate_warehouse360_validation_sql.py", "--check"]):
            code = generate_warehouse360_validation_sql.main()
            assert code == 1
