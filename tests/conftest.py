"""
Pytest configuration and shared fixtures for silver layer tests.

Run locally:  pip install -r tests/requirements-test.txt && pytest tests/ -v
Run in Databricks: attach to cluster, run `pytest tests/ -v` in terminal or
                   use %sh magic in a notebook.
"""

import sys
from typing import Any, Dict, List
from unittest.mock import MagicMock

import pytest
from pyspark.sql import DataFrame, SparkSession

# ── Shared SparkSession — created at module load so F.col() works at import time.
# dlt_silver_pipeline.py calls F.col() in module-level apply_changes() blocks;
# PySpark 3.5+ routes F.col through the JVM, which requires an active context.
_session = (
    SparkSession.builder
    .appName("ioreporting-silver-tests")
    .master("local[2]")
    .config("spark.sql.shuffle.partitions", "4")
    .config("spark.sql.session.timeZone", "UTC")
    .config("gold_apply_row_filter", "false")
    .getOrCreate()
)
_session.sparkContext.setLogLevel("ERROR")

# ── Mock the Databricks DLT module before any pipeline imports ───────────────
# DLT is only available inside a Databricks pipeline runtime. Mocking it here
# allows the helper functions (strip_zeros, sap_date, etc.) to be imported
# and tested without a live cluster.
_dlt_mock = MagicMock()
_dlt_mock.view = lambda *a, **kw: (lambda f: f)
_dlt_mock.table = lambda *a, **kw: (lambda f: f)
_dlt_mock.expect = lambda *a, **kw: (lambda f: f)
_dlt_mock.expect_or_drop = lambda *a, **kw: (lambda f: f)
_dlt_mock.expect_all = lambda *a, **kw: (lambda f: f)
_dlt_mock.expect_all_or_drop = lambda *a, **kw: (lambda f: f)
_dlt_mock.create_streaming_table = MagicMock()
_dlt_mock.apply_changes = MagicMock()
_dlt_mock.read = MagicMock()
_dlt_mock.read_stream = MagicMock()
sys.modules["dlt"] = _dlt_mock


# ── Shared SparkSession fixture ───────────────────────────────────────────────

@pytest.fixture(scope="session")
def spark():
    return _session


# ── Shared helper: collect single row ────────────────────────────────────────

def first_row(df: DataFrame) -> Dict[str, Any]:
    """Return the first Row from a DataFrame as a dict."""
    rows = df.limit(1).collect()
    assert rows, "DataFrame was empty — expected at least one row"
    return rows[0].asDict()


def all_rows(df: DataFrame) -> List[Dict[str, Any]]:
    """Return all rows as a list of dicts."""
    return [r.asDict() for r in df.collect()]
