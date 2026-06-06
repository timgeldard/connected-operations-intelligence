# App Contract Migration Sequencing

This plan defines the offline-safe sequence for migrating app Databricks query paths toward governed data contracts.

Warehouse360 is the pilot. PR 13 added the Warehouse360 DEV validation evidence pack, but no live Databricks validation is assumed here. Other apps must not be repointed to governed contracts until Warehouse360 DEV validation evidence is accepted and the Warehouse360 app smoke-test pattern is proven.

## Recommended Sequence

| Order | App | Rationale | Gate Before Runtime Repointing |
|---|---|---|---|
| 1 | Warehouse360 | Pilot for app-facing governed consumption views, explicit source mode, contract_id QuerySpec metadata, DEV validation evidence pack. | DEV validation evidence accepted; DEV app smoke test complete; blocking grain/security issues resolved. |
| 2 | Process Order History | Mature Databricks adapters, process-order gold views already identified, relatively bounded route set. | Warehouse360 pilot accepted; POH route inventory completed; source object/column evidence pack prepared. |
| 3 | Trace2 | Broadest lineage surface and strongest cross-domain dependency footprint. Should follow POH once contract mechanics are stable. | Warehouse360 pilot accepted; Trace2 route inventory completed; high-risk joins and graph/ledger grains documented. |
| 4 | Quality / SPC | Quality and SPC share inspection-result semantics and should align on MIC, lot, decision, and chart data contracts before runtime migration. | Warehouse360 pilot accepted; Quality/SPC candidate contract names agreed; source-derived vs source-field classifications documented. |
| 5 | EnvMon | Uses SAP QM-derived inspection paths with partial field coverage and CAPA placeholders; should wait until Quality/SPC patterns settle. | Warehouse360 pilot accepted; EnvMon partial-coverage decisions accepted; CAPA placeholder handling reviewed. |

## Guardrails

- Do not repoint non-Warehouse360 apps to governed contracts until Warehouse360 DEV validation evidence is accepted.
- Do not create full non-Warehouse360 contracts in this planning step.
- Do not claim any app has passed DEV, UAT, or production validation without evidence.
- Do not connect to Databricks for this planning step.
- Do not replace existing app source views with candidate source views at runtime.
- Candidate contract IDs should be added only after route inventory, source object validation, source column validation, and grain review are ready.

## Candidate Naming Guidance

Use stable app-domain prefixes:

| App | Contract ID Pattern | Source View Pattern |
|---|---|---|
| Warehouse360 | `warehouse360.<capability>` | `vw_consumption_warehouse360_<capability>` |
| Process Order History | `process_order_history.<capability>` | `vw_consumption_process_order_history_<capability>` |
| Trace2 | `trace2.<capability>` | `vw_consumption_trace2_<capability>` |
| Quality / Connected Quality | `quality.<capability>` or `connected_quality.<capability>` | `vw_consumption_quality_<capability>` or `vw_consumption_connected_quality_<capability>` |
| SPC | `spc.<capability>` | `vw_consumption_spc_<capability>` |
| EnvMon | `envmon.<capability>` | `vw_consumption_envmon_<capability>` |

Prefer capability names that match route intent, not current table names. Example: use `trace2.batch_header`, not `trace2.gold_batch_stock_v`.

## Inventory Templates

Use the route-to-contract inventory templates in this folder before proposing non-Warehouse360 contracts:

- `trace2-route-contract-inventory-template.md`
- `processorderhistory-route-contract-inventory-template.md`
- `quality-connectedquality-route-contract-inventory-template.md`
- `spc-route-contract-inventory-template.md`
- `envmon-route-contract-inventory-template.md`

Evidence returned from a future Databricks-connected executor should be captured using:

```text
data-products/io-reporting/contracts/app-dev-profile-template.md
```
