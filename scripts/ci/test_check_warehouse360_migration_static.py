"""Unit tests for check_warehouse360_migration_static.py.

Verifies the split_select_fields and parse_views_from_sql utilities
work correctly, including with complex Spark SQL functions and castings.
"""
import os
import sys

# Add parent directory to path to import the checker
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from check_warehouse360_migration_static import parse_views_from_sql, split_select_fields


def test_split_select_fields_simple():
    assert split_select_fields("a, b, c") == ["a", "b", "c"]


def test_split_select_fields_with_parentheses():
    # Commas inside decimal casting should not be split
    select_text = "plant_code AS plant_id, CAST(bin_utilisation_pct AS DECIMAL(5,2)) AS bin_util_pct, orders_total"
    expected = [
        "plant_code AS plant_id",
        "CAST(bin_utilisation_pct AS DECIMAL(5,2)) AS bin_util_pct",
        "orders_total"
    ]
    assert split_select_fields(select_text) == expected


def test_split_select_fields_nested_parentheses():
    select_text = "a, coalesce(foo(bar(1, 2), 3), 4) as x, b"
    expected = [
        "a",
        "coalesce(foo(bar(1, 2), 3), 4) as x",
        "b"
    ]
    assert split_select_fields(select_text) == expected


def test_parse_views_from_sql():
    sql = """
    -- Comment 1
    CREATE OR REPLACE VIEW vw_consumption_warehouse360_overview AS
    SELECT
      plant_code AS plant_id,
      CAST(snapshot_date AS TIMESTAMP) AS snapshot_ts,
      active_order_count AS orders_total
    FROM connected_plant_dev.gold_io_reporting.gold_warehouse_kpi_snapshot_secured;

    /* Comment 2 */
    CREATE VIEW vw_consumption_warehouse360_inbound_backlog AS
    SELECT
      plant_id,
      po_id
    FROM connected_plant_dev.gold_io_reporting.gold_inbound_po_backlog_enhanced_live;
    """

    views = parse_views_from_sql(sql)
    assert "vw_consumption_warehouse360_overview" in views
    assert "vw_consumption_warehouse360_inbound_backlog" in views

    overview = views["vw_consumption_warehouse360_overview"]
    assert overview["source"] == "connected_plant_dev.gold_io_reporting.gold_warehouse_kpi_snapshot_secured"
    assert overview["fields"] == {
        "plant_id": "plant_code",
        "snapshot_ts": "CAST(snapshot_date AS TIMESTAMP)",
        "orders_total": "active_order_count"
    }

    inbound = views["vw_consumption_warehouse360_inbound_backlog"]
    assert inbound["source"] == "connected_plant_dev.gold_io_reporting.gold_inbound_po_backlog_enhanced_live"
    assert inbound["fields"] == {
        "plant_id": "plant_id",
        "po_id": "po_id"
    }


def test_parse_views_with_nested_as_and_quoted_literals():
    from check_warehouse360_migration_static import parse_views_from_sql
    sql = """
    CREATE VIEW vw_consumption_warehouse360_complex AS
    SELECT
      CAST(val AS DECIMAL(5,2)) AS decimal_val,
      'hello, world (nested)' AS label_val,
      CAST(val2 AS STRING)
    FROM my_source;
    """
    views = parse_views_from_sql(sql)
    assert "vw_consumption_warehouse360_complex" in views
    complex_view = views["vw_consumption_warehouse360_complex"]
    assert complex_view["fields"] == {
        "decimal_val": "CAST(val AS DECIMAL(5,2))",
        "label_val": "'hello, world (nested)'",
        "CAST(val2 AS STRING)": "CAST(val2 AS STRING)"
    }
