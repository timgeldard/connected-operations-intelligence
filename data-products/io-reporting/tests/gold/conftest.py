import pytest

from tests.conftest import create_df


@pytest.fixture(autouse=True)
def gold_test_silver_schema(spark):
    spark.conf.set("silver_catalog", "spark_catalog")
    spark.conf.set("silver_schema", "silver")
    spark.sql("CREATE DATABASE IF NOT EXISTS silver")
    yield
    spark.sql("DROP DATABASE IF EXISTS silver CASCADE")


@pytest.fixture
def save_table(spark):
    def _save(rows, table_name):
        create_df(spark, rows).write.mode("overwrite").saveAsTable(f"silver.{table_name}")

    return _save
