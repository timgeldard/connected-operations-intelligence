from datetime import date, datetime

from pyspark.sql import Row

from gold.dlt_gold_pipeline import gold_order_downtime_summary
from tests.conftest import all_rows


def test_gold_order_downtime_summary_reason_grain(save_table):
    save_table([
        Row(order_number="10", material_code="MAT01", scheduled_start_date=date(2026, 6, 1),
            production_line_description="Line 1"),
    ], "process_order")
    save_table([
        Row(plant_code="1000", order_number="10", operation_number="0010", work_centre_code="WC01",
            downtime_reason_code="D01", downtime_reason_description="Setup", sub_reason_code="S01",
            sub_reason_description="Tooling", duration_minutes=30.0,
            start_datetime=datetime(2026, 6, 1, 10, 0), end_datetime=datetime(2026, 6, 1, 10, 30)),
        Row(plant_code="1000", order_number="10", operation_number="0010", work_centre_code="WC01",
            downtime_reason_code="D01", downtime_reason_description="Setup", sub_reason_code="S01",
            sub_reason_description="Tooling", duration_minutes=15.0,
            start_datetime=datetime(2026, 6, 1, 11, 0), end_datetime=datetime(2026, 6, 1, 11, 15)),
    ], "downtime_event")

    rows = all_rows(gold_order_downtime_summary())

    assert len(rows) == 1
    assert rows[0]["event_count"] == 2
    assert rows[0]["total_downtime_minutes"] == 45.0
    assert rows[0]["earliest_start_datetime"] == datetime(2026, 6, 1, 10, 0)
    assert rows[0]["latest_end_datetime"] == datetime(2026, 6, 1, 11, 15)
