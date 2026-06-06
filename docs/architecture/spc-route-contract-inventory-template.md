# SPC Route-To-Contract Inventory Template

Status: planning template only. No SPC route has been validated or repointed to governed contracts.

Candidate naming:

- Contract IDs: `spc.<capability>`
- Source views: `vw_consumption_spc_<capability>`

| route | adapter | current data object | current query path | future contract_id candidate | future source view candidate | migration risk | status |
|---|---|---|---|---|---|---|---|
| `GET /api/spc/materials` | `apps/api/adapters/spc/spc_databricks_adapter.py` | `spc_quality_metric_subgroup_mv` | Databricks QuerySpec | `spc.materials` | `vw_consumption_spc_materials` | Medium: distinct material semantics and plant filtering | Candidate only |
| `GET /api/spc/plants` | `apps/api/adapters/spc/spc_databricks_adapter.py` | `spc_quality_metric_subgroup_mv` | Databricks QuerySpec | `spc.plants` | `vw_consumption_spc_plants` | Medium: plant/material distinctness and entitlement behavior | Candidate only |
| `GET /api/spc/search` | `apps/api/adapters/spc/spc_databricks_adapter.py` | `spc_quality_metric_subgroup_mv` | Databricks QuerySpec | `spc.search` | `vw_consumption_spc_search` | Medium-high: search ranking and P999 exclusion | Candidate only |
| `GET /api/spc/characteristics` | `apps/api/adapters/spc/spc_databricks_adapter.py` | `spc_quality_metric_subgroup_mv` | Databricks QuerySpec | `spc.characteristics` | `vw_consumption_spc_characteristics` | Medium: MIC grouping and operation identity | Candidate only |
| `GET /api/spc/capability` | `apps/api/routes/spc.py` plus SPC adapters | Current route behavior needs inventory | Mixed route path | `spc.capability` | `vw_consumption_spc_capability` | High: capability metrics are not currently available for all paths | Inventory pending |
| `POST /api/spc/chart-data` | `apps/api/adapters/spc/spc_databricks_chart_adapter.py` | `spc_quality_metric_subgroup_mv`, `spc_locked_limits` | Databricks QuerySpec for chart subgroups and locked limits | `spc.chart_data` | `vw_consumption_spc_chart_data` | Very high: chart baseline, locked limits, and statistical derivations | Candidate only |
| `GET /api/spc/subgroups` | `apps/api/adapters/spc/spc_databricks_adapter.py` | `spc_quality_metric_subgroup_mv` | Databricks QuerySpec | `spc.subgroups` | `vw_consumption_spc_subgroups` | High: subgroup aggregation, spec-limit sentinel rules, Nelson/capability gaps | Candidate only |

Next offline step: separate source-field SPC contracts from application-derived statistical/chart contracts before drafting candidate contracts.
