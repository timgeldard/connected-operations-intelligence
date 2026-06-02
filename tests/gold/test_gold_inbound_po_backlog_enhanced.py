from datetime import date, datetime

from pyspark.sql import Row

from gold.warehouse_inbound_gold import gold_inbound_po_backlog_enhanced
from silver.movement_types import build_movement_type_classification_records
from tests.conftest import all_rows


def test_gold_inbound_po_backlog_enhanced_receipts_and_putaway(save_table):
    save_table([
        Row(purchase_order_number="450001", item_number="00010", plant_code="C061", vendor_code="V1",
            purchasing_org="IT01", ordered_quantity=100.0, net_value=1000.0,
            purchase_order_date=date(2026, 5, 1), qa_stock_type=" ", is_delivery_complete=False,
            is_item_deleted=False),
        Row(purchase_order_number="450001", item_number="00020", plant_code="C061", vendor_code="V1",
            purchasing_org="IT01", ordered_quantity=40.0, net_value=400.0,
            purchase_order_date=date(2026, 5, 1), qa_stock_type="Q", is_delivery_complete=False,
            is_item_deleted=False),
    ], "purchase_order")
    save_table(
        build_movement_type_classification_records(["101", "103", "104"]),
        "movement_type_classification",
    )
    save_table([
        Row(purchase_order_number="450001", purchase_order_item="00010", movement_type_code="103",
            quantity=60.0, posting_date=date(2026, 5, 5)),
        Row(purchase_order_number="450001", purchase_order_item="00010", movement_type_code="104",
            quantity=10.0, posting_date=date(2026, 5, 6)),
        Row(purchase_order_number="450001", purchase_order_item="00020", movement_type_code="101",
            quantity=40.0, posting_date=date(2026, 5, 7)),
    ], "goods_movement")
    save_table([
        Row(transfer_order_number="TO1", item_status="Fully Confirmed", source_reference_number="450001",
            created_datetime=datetime(2026, 5, 6, 8, 0), confirmed_date=date(2026, 5, 6)),
    ], "warehouse_transfer_order")

    rows = all_rows(gold_inbound_po_backlog_enhanced())

    assert len(rows) == 1
    row = rows[0]
    assert row["open_item_count"] == 2
    assert row["total_gr_qty"] == 50.0
    assert row["remaining_open_qty"] == 90.0
    assert row["qa_inspection_item_count"] == 1
    assert row["putaway_to_count"] == 1
    assert row["confirmed_putaway_to_count"] == 1
