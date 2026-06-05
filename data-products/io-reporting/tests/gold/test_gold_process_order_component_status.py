from datetime import date

from pyspark.sql import Row

from gold.dlt_gold_pipeline import gold_process_order_component_status
from silver.movement_types import build_movement_type_classification_records
from tests.conftest import all_rows


def test_gold_process_order_component_status_uses_classification(save_table):
    save_table(
        build_movement_type_classification_records(["101", "261"]),
        "movement_type_classification",
    )
    save_table([
        Row(order_number="10", plant_code="1000", scheduled_start_date=date(2026, 6, 1),
            is_released=True, is_closed=False, production_line_description="Line 1",
            material_code="FG01"),
    ], "process_order")
    save_table([
        Row(reservation_number="R01", reservation_item="0001", order_number="10", material_code="MAT01",
            required_quantity=50.0, open_quantity=30.0, requirement_date=date(2026, 6, 1),
            storage_location_code="SL01", production_supply_area="PSA01",
            movement_type_code="261", is_deletion_flagged=False),
        Row(reservation_number="R01", reservation_item="0002", order_number="10", material_code="MAT01",
            required_quantity=50.0, open_quantity=30.0, requirement_date=date(2026, 6, 1),
            storage_location_code="SL01", production_supply_area="PSA01",
            movement_type_code="101", is_deletion_flagged=False),
    ], "reservation_requirement")
    save_table([
        Row(plant_code="1000", storage_location_code="SL01", material_code="MAT01",
            unrestricted_quantity=40.0),
    ], "batch_stock")

    rows = all_rows(gold_process_order_component_status())

    assert len(rows) == 1
    assert rows[0]["reservation_item_number"] == "0001"
    assert rows[0]["available_unrestricted_qty"] == 40.0
    assert rows[0]["is_fully_covered"] is True
