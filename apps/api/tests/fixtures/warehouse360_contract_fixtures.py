"""Mock Warehouse360 governed-contract rows for offline API tests.

These rows model the active Wave 1 governed consumption views. They are not
Databricks validation evidence and must not be treated as source profiling.
"""
from __future__ import annotations

WAREHOUSE360_CONTRACT_FIXTURES: dict[str, list[dict[str, object]]] = {
    "warehouse360.overview": [
        {
            "plant_id": "IE10",
            "snapshot_ts": "2026-06-06T08:00:00",
            "orders_total": 24,
            "orders_red": 2,
            "orders_amber": 5,
            "trs_open": 9573882,
            "tos_open": 0,
            "deliveries_today": 12,
            "deliveries_at_risk": 3,
            "inbound_open": 18671,
            "bins_blocked": 16614,
            "bins_total": 352027,
            "bin_util_pct": "56.8",
        }
    ],
    "warehouse360.inbound_backlog": [
        {
            "plant_id": "IE10",
            "po_id": "0045001234",
            "po_item": "00010",
            "doc_type": "PO",
            "vendor_id": "0008100123",
            "vendor_name": "Dairy Supplier Ltd",
            "storage_loc": "SL01",
            "material_id": "000000000000821034",
            "material_name": "Raw Milk",
            "ordered_qty": 25000.0,
            "gr_qty": 0.0,
            "open_qty": 25000.0,
            "uom": "L",
            "delivery_date": "2026-05-18",
            "po_date": "2026-05-10",
            "qa_status": None,
            "oldest_po_age_days": 7,
            "inbound_backlog_risk_band": "amber",
        }
    ],
    "warehouse360.outbound_backlog": [
        {
            "plant_id": "IE10",
            "delivery_id": "0080047212",
            "delivery_type": "LF",
            "customer_id": "0003829100",
            "customer_name": "Acme Foods Ltd",
            "carrier": "DHL",
            "planned_gi_date": "2026-05-18",
            "actual_gi_date": None,
            "delivery_date": "2026-05-19",
            "gross_weight": 960.0,
            "pick_pct": 0.85,
            "line_count": 3,
            "risk": "amber",
            "shipped": False,
        }
    ],
    "warehouse360.staging_workload": [
        {
            "plant_id": "IE10",
            "order_id": "1000123456",
            "sap_order": "0001000123456",
            "reservation_no": "0009876543",
            "material_id": "000000000000741234",
            "material_name": "Blend Component",
            "batch_id": "BATCH-001",
            "uom": "KG",
            "order_qty": 1200.0,
            "sched_start": "2026-05-20",
            "sched_finish": "2026-05-21",
            "staging_pct": 0.5,
            "to_items_total": 4,
            "to_items_done": 2,
            "mins_to_start": 1440.0,
            "risk": "amber",
        }
    ],
    "warehouse360.im_wm_reconciliation": [
        {
            "plant_id": "IE10",
            "material_id": "000000000000821034",
            "batch_id": "BATCH-001",
            "storage_loc": "SL01",
            "exception_type": "IM_WM_MISMATCH",
            "severity": 2,
            "sla_hours": 24,
            "qty": 12.5,
            "bin_id": "A-01-01",
            "detail_text": "Quantity mismatch between IM and WM",
            "detected_date": "2026-05-18",
        }
    ],
}


def warehouse360_fixture_rows(contract_id: str) -> list[dict[str, object]]:
    return [dict(row) for row in WAREHOUSE360_CONTRACT_FIXTURES[contract_id]]
