"""Unit tests for the base-MV determinism guard (pure scan_source logic)."""
import textwrap

from check_gold_mv_determinism import scan_source

VIOLATING_TABLE = textwrap.dedent(
    """
    import dlt
    from pyspark.sql import functions as F

    @dlt.table(comment="x")
    def gold_bad():
        df = spark.read.table("t")
        return df.withColumn("age", F.datediff(F.current_date(), F.col("d")))
    """
)

CLEAN_TABLE = textwrap.dedent(
    """
    import dlt
    from pyspark.sql import functions as F

    @dlt.table(comment="x")
    def gold_good():
        df = spark.read.table("t")
        # unix_timestamp WITH arguments is deterministic (no wall clock).
        return df.withColumn("h", (F.unix_timestamp("a") - F.unix_timestamp("b")) / 3600)
    """
)

VIEW_WITH_CLOCK = textwrap.dedent(
    """
    import dlt
    from pyspark.sql import functions as F

    @dlt.view(comment="freshness gate")
    def gold_gate():
        return spark.range(1).withColumn("t", F.current_timestamp())
    """
)

MARKED_EXEMPT = textwrap.dedent(
    """
    import dlt
    from pyspark.sql import functions as F

    @dlt.table(comment="x")
    def config_table():
        df = spark.read.table("cfg")
        return df.filter(F.col("valid_to") > F.current_date())  # determinism-exempt
    """
)

BARE_UNIX_TIMESTAMP = textwrap.dedent(
    """
    import dlt
    from pyspark.sql import functions as F

    @dlt.table(comment="x")
    def gold_bad_unix():
        return spark.read.table("t").withColumn("now_s", F.unix_timestamp())
    """
)


def test_flags_current_date_in_dlt_table():
    errs = scan_source(VIOLATING_TABLE, "gold/bad.py")
    assert len(errs) == 1
    assert "gold/bad.py:8" in errs[0]
    assert "gold_bad" in errs[0]


def test_allows_deterministic_unix_timestamp_with_args():
    assert scan_source(CLEAN_TABLE, "gold/good.py") == []


def test_flags_zero_arg_unix_timestamp():
    errs = scan_source(BARE_UNIX_TIMESTAMP, "gold/bad_unix.py")
    assert len(errs) == 1


def test_ignores_dlt_views():
    assert scan_source(VIEW_WITH_CLOCK, "gold/gate.py") == []


def test_honours_inline_exemption_marker():
    assert scan_source(MARKED_EXEMPT, "silver/tables/cfg.py") == []
