from pyspark.sql import Row

from gold.warehouse_flow_gold import gold_stock_reconciliation_summary
from tests.conftest import all_rows, create_df


def test_gold_stock_reconciliation_summary_statuses(spark, monkeypatch):
    import gold.warehouse_flow_gold as flow

    summary_df = create_df(spark, [
        Row(plant_code="C061", warehouse_number="208", mismatch_reason="MATCHED",
            mismatch_severity="INFO", row_count=10, exception_count=0,
            tolerance_exceeded_count=0, abs_delta_quantity_total=0.0, abs_delta_value_total=0.0),
        Row(plant_code="C061", warehouse_number="208", mismatch_reason="BATCH_MISSING_IN_WM",
            mismatch_severity="MEDIUM", row_count=1, exception_count=1,
            tolerance_exceeded_count=1, abs_delta_quantity_total=2.0, abs_delta_value_total=20.0),
        Row(plant_code="C061", warehouse_number="208", mismatch_reason="TRUE_VARIANCE",
            mismatch_severity="HIGH", row_count=2, exception_count=2,
            tolerance_exceeded_count=2, abs_delta_quantity_total=5.0, abs_delta_value_total=50.0),
    ])
    monkeypatch.setattr(flow.dlt, "read", lambda _: summary_df)

    rows = {r["mismatch_reason"]: r for r in all_rows(gold_stock_reconciliation_summary())}

    assert rows["MATCHED"]["reconciliation_status"] == "RECONCILED"
    assert rows["BATCH_MISSING_IN_WM"]["reconciliation_status"] == "REVIEW"
    assert rows["TRUE_VARIANCE"]["reconciliation_status"] == "ACTION_REQUIRED"
