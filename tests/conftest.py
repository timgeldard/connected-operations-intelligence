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
    .config("source_catalog", "connected_plant_dev")
    .config("source_schema", "sap")
    .config("published_catalog", "published_uat")
    .config("published_schema", "central_services")
    .config("silver_catalog", "connected_plant_dev")
    .config("silver_schema", "silver_dev")
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


def create_df(spark: SparkSession, rows: List[Any]) -> DataFrame:
    """Dynamically build a Spark DataFrame with schema inference that defaults
    entirely-NULL columns to StringType() to avoid PySparkValueError: [CANNOT_DETERMINE_TYPE].
    """
    import datetime

    from pyspark.sql.types import (
        BooleanType,
        DateType,
        DoubleType,
        IntegerType,
        StringType,
        StructField,
        StructType,
        TimestampType,
    )

    if not rows:
        return spark.createDataFrame([], StructType([]))

    # Inspect all rows to construct complete field lists and gather non-None sample values
    fields = {}
    for r in rows:
        d = r.asDict() if hasattr(r, "asDict") else r
        for k, v in d.items():
            if k not in fields or fields[k] is None:
                fields[k] = v

    struct_fields = []
    for k, sample_val in fields.items():
        if sample_val is None:
            dt = StringType()
        elif isinstance(sample_val, bool):
            dt = BooleanType()
        elif isinstance(sample_val, int):
            dt = IntegerType()
        elif isinstance(sample_val, float):
            dt = DoubleType()
        elif isinstance(sample_val, datetime.date) and not isinstance(sample_val, datetime.datetime):
            dt = DateType()
        elif isinstance(sample_val, datetime.datetime):
            dt = TimestampType()
        else:
            dt = StringType()
        struct_fields.append(StructField(k, dt, True))

    schema = StructType(struct_fields)
    return spark.createDataFrame(rows, schema)
