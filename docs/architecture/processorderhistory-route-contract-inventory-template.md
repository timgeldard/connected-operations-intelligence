# Process Order History Route-To-Contract Inventory Template

Status: planning template only. No Process Order History route has been validated or repointed to governed contracts.

Candidate naming:

- Contract IDs: `process_order_history.<capability>`
- Source views: `vw_consumption_process_order_history_<capability>`

| route | adapter | current data object | current query path | future contract_id candidate | future source view candidate | migration risk | status |
|---|---|---|---|---|---|---|---|
| `POST /api/por/order-header` | `apps/api/adapters/poh/poh_databricks_adapter.py` | `vw_gold_process_order` | Databricks QuerySpec using `resolve_domain_object("poh", "vw_gold_process_order")` | `process_order_history.order_header` | `vw_consumption_process_order_history_order_header` | Medium: header fields have known unavailable columns | Candidate only |
| `GET /api/por/order-operations` | `apps/api/adapters/poh/poh_databricks_adapter.py` | `vw_gold_process_order_phase` | Databricks QuerySpec using `resolve_domain_object("poh", "vw_gold_process_order_phase")` | `process_order_history.order_operations` | `vw_consumption_process_order_history_order_operations` | Medium: phase/operation identity and durations | Candidate only |
| `GET /api/por/order-confirmations` | `apps/api/adapters/poh/poh_databricks_adapter.py` | `vw_gold_confirmation` | Databricks QuerySpec using `resolve_domain_object("poh", "vw_gold_confirmation")` | `process_order_history.order_confirmations` | `vw_consumption_process_order_history_order_confirmations` | Medium: confirmation status and final-confirmation gaps | Candidate only |
| `GET /api/por/order-goods-movements` | `apps/api/adapters/poh/poh_databricks_adapter.py` | `vw_gold_adp_movement` | Databricks QuerySpec using `resolve_domain_object("poh", "vw_gold_adp_movement")` | `process_order_history.order_goods_movements` | `vw_consumption_process_order_history_order_goods_movements` | Medium-high: movement type mapping and material description gaps | Candidate only |
| `POST /api/por/order-search` | `apps/api/adapters/poh/poh_databricks_adapter.py` | `vw_gold_process_order` plus search columns in adapter | Databricks QuerySpec | `process_order_history.order_search` | `vw_consumption_process_order_history_order_search` | Medium: search behavior and ranking must be preserved | Inventory pending |

Next offline step: create POH source object/column validation SQL after Warehouse360 DEV evidence is accepted.
