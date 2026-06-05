from datetime import date

from pyspark.sql import Row

from gold.dlt_gold_pipeline import gold_process_order_operations
from tests.conftest import all_rows


def test_gold_process_order_operations_active_order_only(save_table):
    save_table([
        Row(order_number="10", plant_code="1000", material_code="MAT01",
            scheduled_start_date=date(2026, 6, 1), is_released=True, is_closed=False),
        Row(order_number="20", plant_code="1000", material_code="MAT02",
            scheduled_start_date=date(2026, 6, 2), is_released=True, is_closed=True),
    ], "process_order")
    save_table([
        Row(order_number="10", operation_number="0010", plant_code="1000",
            routing_number="R10", operation_counter="0001",
            scheduled_start_datetime=date(2026, 6, 1), scheduled_finish_datetime=date(2026, 6, 2),
            actual_start_datetime=date(2026, 6, 1), actual_finish_date=date(2026, 6, 2),
            work_centre_internal_id="WC01", planned_work=10.0, actual_work=12.0,
            is_confirmed=True, confirmed_yield_quantity=100.0, confirmed_scrap_quantity=0.0,
            control_key="PP01", number_of_employees=2.0),
        Row(order_number="20", operation_number="0010", plant_code="1000",
            routing_number="R20", operation_counter="0001",
            scheduled_start_datetime=date(2026, 6, 2), scheduled_finish_datetime=date(2026, 6, 3),
            actual_start_datetime=None, actual_finish_date=None,
            work_centre_internal_id="WC02", planned_work=1.0, actual_work=0.0,
            is_confirmed=False, confirmed_yield_quantity=0.0, confirmed_scrap_quantity=0.0,
            control_key="PP01", number_of_employees=1.0),
    ], "process_order_operation")
    save_table([
        Row(order_number="10", operation_number="0010", pi_sheet_status="Completed", duration_hours=4.5),
    ], "pi_sheet_execution")
    save_table([
        Row(order_number="10", operation_number="0010", duration_minutes=30.0),
        Row(order_number="10", operation_number="0010", duration_minutes=15.0),
    ], "downtime_event")

    rows = all_rows(gold_process_order_operations())

    assert len(rows) == 1
    assert rows[0]["order_number"] == "10"
    assert rows[0]["pi_sheet_status"] == "Completed"
    assert rows[0]["total_downtime_minutes"] == 45.0
    assert rows[0]["operation_join_confidence"] == "DISPLAY_OPERATION_UNIQUE"
    assert rows[0]["is_operationally_active"] is True
