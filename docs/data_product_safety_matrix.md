# Data Product Safety Matrix

This matrix maps each Gold data product to its domain, current repository status, plant-specific assumptions, and required validation checks.

| Data Product | Domain | Current Repo Status | Plant-Specific Assumptions | Required Validation |
|---|---|---|---|---|
| `gold_transfer_order_performance` | Warehouse | Production-candidate | `LTAP`/`LTAK` usage is consistent; confirmation timestamps are reliable. | TO volume sanity, confirmation timestamp coverage. |
| `gold_transfer_requirement_backlog` | Warehouse | Production-candidate | Open quantity/status fields are reliable. | TR open/closed status coverage. |
| `gold_bin_occupancy` | Warehouse | Production-candidate | `LAGP`/`LQUA` plant mapping is reliable. | Warehouse-to-plant mapping, shared warehouse checks. |
| `gold_stock_availability` | Stock | Production-candidate | `MCHB` reflects batch stock; UoM is stable. | Stock quantity sanity, batch/material coverage. |
| `gold_lineside_stock` | Warehouse | Pilot-grade | Storage type role mapping is complete. | Storage type role coverage. |
| `gold_delivery_pick_status` | Outbound | Pilot-grade | Delivery quantity ratio is valid; no mixed-UoM issues. | Mixed-UoM delivery count, partial goods-issue checks. |
| `gold_process_order_staging` | Warehouse/PP | Pilot-grade | TO source reference maps directly to process order (`BENUM` matches `AUFNR`). | `BENUM`/`AUFNR` match rate validation. |
| `gold_inbound_po_backlog` | Inbound | Directional only | Open PO represents inbound exposure. | Must be labeled backlog, not GR status. |
| `gold_shift_output_summary` | Production | Compatibility only | Assumes shift but no shift calendar exists. | Blocked for true shift reporting. |
| `gold_stock_reconciliation` | Stock | Pilot/directional | IM and WM stock are comparable at plant/material grain. | Reconciliation grain and UoM checks. |

---

## Required Validations & Metrics

### 1. Storage Type Role Coverage
* **Target Table:** `gold_lineside_stock`, `gold_bin_occupancy`, `gold_stock_reconciliation`
* **Checks:** All active WM storage types mapped to roles; fallback roles not used; quarantine/QI types not treated as conformed available stock.

### 2. Movement Type Classification Coverage
* **Target Table:** `gold_shift_output_summary`, `gold_plant_production_quality_summary`, `gold_process_order_operations`
* **Checks:** All movement types used in the last 90 days are classified; all `Z*` movements are reviewed; reversal relationships are verified.

### 3. Process Order Staging Validation
* **Target Table:** `gold_process_order_staging`, `gold_dispensary_backlog`
* **Checks:** `BENUM`/`AUFNR` key match rates; staging storage types configured; completed TOs align with released process orders.

### 4. Recipe/Process-Line Enrichment Coverage
* **Target Table:** `gold_shift_output_summary`, `gold_process_order_operations`
* **Checks:** Percentage of process orders resolving to a conformed production line; unresolved recipes; stale recipe mapping.

### 5. Delivery Pick Logic Validation
* **Target Table:** `gold_delivery_pick_status`
* **Checks:** Mixed-UoM delivery counts; partial goods-issue occurrences.

### 6. Stock Reconciliation Readiness
* **Target Table:** `gold_stock_reconciliation`
* **Checks:** WM-managed storage locations identified; UoM conversion coverage; batch relevance conformed.

### 7. Freshness Readiness
* **Target Table:** All tables
* **Checks:** Lag minutes vs SLA for LTAK, LTAP, LTBK, LTBP, LAGP, LQUA, MCHB, MARD, MBEW, AFKO, AUFK, RESB, MSEG, EKKO, EKPO, EKBE.
