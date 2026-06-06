# Trace2 Route-To-Contract Inventory Template

Status: planning template only. No Trace2 route has been validated or repointed to governed contracts.

Candidate naming:

- Contract IDs: `trace2.<capability>`
- Source views: `vw_consumption_trace2_<capability>`

| route | adapter | current data object | current query path | future contract_id candidate | future source view candidate | migration risk | status |
|---|---|---|---|---|---|---|---|
| `POST /api/trace2/batch-header` | `apps/api/adapters/trace2/batch_header_adapter.py` | `gold_batch_stock_v`, `gold_batch_summary_v`, `gold_material`, `gold_plant`, `gold_batch_material` | Databricks QuerySpec using `resolve_domain_object("trace2", ...)` | `trace2.batch_header` | `vw_consumption_trace2_batch_header` | High: multi-table batch/plant grain, stock status derivations | Candidate only |
| `POST /api/trace2/batch-search` | `apps/api/adapters/trace2/batch_header_adapter.py` | `gold_batch_stock_v`, `gold_material`, `gold_plant`, `gold_batch_production_history_v` | Databricks QuerySpec using `resolve_domain_object("trace2", ...)` | `trace2.batch_search` | `vw_consumption_trace2_batch_search` | High: search semantics and latest-production ranking | Candidate only |
| `POST /api/trace2/trace-graph` | `apps/api/adapters/trace2/trace_graph_adapter.py` | TBD from adapter inventory | Databricks QuerySpec | `trace2.trace_graph` | `vw_consumption_trace2_trace_graph` | Very high: graph traversal grain and edge semantics | Inventory pending |
| `POST /api/trace2/customer-exposure` | `apps/api/adapters/trace2/customer_adapter.py` | TBD from adapter inventory | Databricks QuerySpec | `trace2.customer_exposure` | `vw_consumption_trace2_customer_exposure` | High: customer delivery lineage and aggregation grain | Inventory pending |
| `POST /api/trace2/customer-deliveries` | `apps/api/adapters/trace2/customer_adapter.py` | TBD from adapter inventory | Databricks QuerySpec | `trace2.customer_deliveries` | `vw_consumption_trace2_customer_deliveries` | High: delivery grain and date/source joins | Inventory pending |
| `POST /api/trace2/supplier-exposure` | `apps/api/adapters/trace2/supplier_adapter.py` | TBD from adapter inventory | Databricks QuerySpec | `trace2.supplier_exposure` | `vw_consumption_trace2_supplier_exposure` | High: supplier batch linkage and exposure rollups | Inventory pending |
| `POST /api/trace2/production-history` | `apps/api/adapters/trace2/production_history_adapter.py` | TBD from adapter inventory | Databricks QuerySpec | `trace2.production_history` | `vw_consumption_trace2_production_history` | Medium-high: production event grain and batch joins | Inventory pending |
| `POST /api/trace2/mass-balance` | `apps/api/adapters/trace2/mass_balance_adapter.py` | TBD from adapter inventory | Databricks QuerySpec | `trace2.mass_balance` | `vw_consumption_trace2_mass_balance` | Very high: reconciliation math and tolerances | Inventory pending |
| `POST /api/trace2/recall-readiness` | `apps/api/adapters/trace2/recall_readiness_adapter.py` | TBD from adapter inventory | Databricks QuerySpec | `trace2.recall_readiness` | `vw_consumption_trace2_recall_readiness` | High: readiness flags must not be invented | Inventory pending |
| `POST /api/trace2/supplier-batches` | `apps/api/adapters/trace2/supplier_adapter.py` | TBD from adapter inventory | Databricks QuerySpec | `trace2.supplier_batches` | `vw_consumption_trace2_supplier_batches` | High: supplier batch identity and fallback paths | Inventory pending |
| `POST /api/trace2/batch-quality-passport` | `apps/api/adapters/trace2/quality_passport_adapter.py` | TBD from adapter inventory | Databricks QuerySpec | `trace2.batch_quality_passport` | `vw_consumption_trace2_batch_quality_passport` | Very high: quality evidence joins and optional sections | Inventory pending |
| `POST /api/trace2/mass-balance-ledger` | `apps/api/adapters/trace2/mass_balance_adapter.py` | TBD from adapter inventory | Databricks QuerySpec | `trace2.mass_balance_ledger` | `vw_consumption_trace2_mass_balance_ledger` | Very high: ledger line grain and reconciliation evidence | Inventory pending |
| `POST /api/trace2/investigation-timeline` | `apps/api/adapters/trace2/investigation_timeline_adapter.py` | TBD from adapter inventory | Databricks QuerySpec | `trace2.investigation_timeline` | `vw_consumption_trace2_investigation_timeline` | High: event ordering and source classification | Inventory pending |
| `POST /api/trace2/holds-ledger` | `apps/api/adapters/trace2/holds_ledger_adapter.py` | TBD from adapter inventory | Databricks QuerySpec | `trace2.holds_ledger` | `vw_consumption_trace2_holds_ledger` | High: hold status lifecycle and ledger grain | Inventory pending |

Next offline step: complete source-object inventory from each adapter and classify route grains before drafting candidate contracts.
