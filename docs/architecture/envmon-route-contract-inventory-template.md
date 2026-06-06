# EnvMon Route-To-Contract Inventory Template

Status: planning template only. No EnvMon route has been validated or repointed to governed contracts.

Candidate naming:

- Contract IDs: `envmon.<capability>`
- Source views: `vw_consumption_envmon_<capability>`

| route | adapter | current data object | current query path | future contract_id candidate | future source view candidate | migration risk | status |
|---|---|---|---|---|---|---|---|
| `GET /api/envmon/site-summary` | `apps/api/adapters/envmon/envmon_databricks_adapter.py` | `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` | Databricks QuerySpec using `resolve_domain_object("envmon", ...)` | `envmon.site_summary` | `vw_consumption_envmon_site_summary` | High: partial field coverage, CAPA placeholders, derived risk fields | Candidate only |
| `GET /api/envmon/swab-results` | `apps/api/adapters/envmon/envmon_databricks_adapter.py` | `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` | Databricks QuerySpec using `resolve_domain_object("envmon", ...)` | `envmon.swab_results` | `vw_consumption_envmon_swab_results` | High: inspection type filters, result valuation mapping, sample grain | Candidate only |

Next offline step: resolve CAPA placeholder handling and plant name enrichment before drafting candidate contracts.
