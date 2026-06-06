# Quality And Connected Quality Route-To-Contract Inventory Template

Status: planning template only. No Quality or Connected Quality route has been validated or repointed to governed contracts.

Candidate naming:

- Quality contract IDs: `quality.<capability>`
- Connected Quality Lab contract IDs: `connected_quality.<capability>`
- Source views: `vw_consumption_quality_<capability>` or `vw_consumption_connected_quality_<capability>`

| route | adapter | current data object | current query path | future contract_id candidate | future source view candidate | migration risk | status |
|---|---|---|---|---|---|---|---|
| `POST /api/quality/read-only-evidence` | `apps/api/adapters/quality/quality_databricks_adapter.py` | `gold_inspection_usage_decision`, `gold_inspection_lot` | Databricks QuerySpec using `resolve_domain_object("cq", ...)` | `quality.read_only_evidence` | `vw_consumption_quality_read_only_evidence` | High: usage-decision mapping, lot selection, and missing evidence sections | Candidate only |
| `GET /api/cq/lab/plants` | `apps/api/adapters/cq/cq_databricks_adapter.py` | `gold_plant` | Databricks QuerySpec using `resolve_domain_object("cq", "gold_plant", schema_override="gold")` | `connected_quality.lab_plants` | `vw_consumption_connected_quality_lab_plants` | Low-medium: dimension lookup but entitlement behavior must be checked | Candidate only |
| `GET /api/cq/lab/fails` | `apps/api/adapters/cq/cq_databricks_adapter.py` | `vw_gold_inspection_result`, `vw_gold_process_order`, `vw_gold_inspection_usage_decision`, `vw_gold_inspection_lot`, `vw_gold_inspection_specification`, `vw_gold_material` | Databricks QuerySpec using joined CQ source views | `connected_quality.lab_fails` | `vw_consumption_connected_quality_lab_fails` | High: fail/warn semantics, lot type filters, nullable limits | Candidate only |

Next offline step: decide whether Quality and Connected Quality Lab share one contract namespace or remain separate app-facing namespaces.
