# POH UAT Readiness Notes

**Status:** Read-only UAT hardening complete (code-fixed); browser UAT pending  
**Last updated:** 2026-05-21  
**Known UAT candidate:** process order `7006965038`, plant `C113`

Next build prompt:
`domain-integrations/operations/docs/poh-next-build-prompt.md`. The next POH
tranche must inspect V1 Process Order History first and document V1 to V2
functional parity before selecting a bounded implementation slice.

Process Order History is a read-only workspace. It does not perform SAP
write-back, order confirmations, goods movement posting, release, TECO, or
change actions. Native Databricks evidence must still be validated against
SAP/Databricks source evidence during UAT.

No-record sections must not be interpreted as complete absence until source
coverage is validated.

| Section | Current source | Current state | Gap | Recommendation |
|---|---|---|---|---|
| Header | `POST /api/por/order-header`; V1 proxy in legacy mode or Databricks `vw_gold_process_order` when `BACKEND_ADAPTER_MODE=databricks-api` | Databricks mapper and generated Pydantic response validation exist. Frontend can call through same-origin POH API. | Header view lacks quantities/dates in confirmed Databricks source, so some contract fields are defaults/nulls. Browser UI validation remains pending. | Keep header read-only, display source/status, and validate candidate against source evidence before UAT sign-off. |
| Operations | `GET /api/por/order-operations`; Databricks `vw_gold_process_order_phase` | Native route and mapper exist. Candidate `7006965038` has SQL-probed operation rows. | Work centre and planned/actual dates are not present in confirmed source view. | Keep missing fields visibly blank/default and avoid deriving unavailable timestamps. |
| Confirmations | `GET /api/por/order-confirmations`; Databricks `vw_gold_confirmation` | Native route and mapper exist with nullable timestamp handling. | `operationText` and final-confirmation flag are not present in confirmed source view. No-record responses are not proof that no confirmations exist. | Preserve nulls, show no-record state cautiously, and validate counts in UAT. |
| Goods movements | `GET /api/por/order-goods-movements`; Databricks `vw_gold_adp_movement` | Native route and mapper exist. Movement direction is mapped from confirmed movement types and can be `unknown`. | `materialDescription` is not present in confirmed source view. Some movement types remain direction-ambiguous. No-record responses are not proof that no movement history exists. | Preserve SAP IDs as strings, show unknown direction rows, and validate source coverage before business conclusions. |
| Component consumption | Derived in the POH UI from returned goods-movement rows | **Hardened 2026-05-21:** Grouping key is now `materialId + batchId + normalised UOM`. Multiple batches remain separate. Mixed UOMs are not summed. Zero and negative net rows are preserved (full and over-reversals visible). Uses V1 parity rule: 261 adds, 262 subtracts, EA excluded, G normalised to KG. | This is movement-derived evidence only, not BOM or reservation coverage. | Validate candidate component rows during UAT and add BOM/reservation sources only after source confirmation. |
| Produced output | Derived in the POH UI from returned goods-movement rows | **Hardened 2026-05-21:** Zero and negative net rows are now preserved (full reversal of 101 by 102 is visible). Grouping by `materialId + batchId + normalised UOM` was already correct. | This is output evidence only, not production completion or full yield coverage. | Validate candidate produced-output rows during UAT before drawing batch/yield conclusions. |
| Section source badges | Frontend `AdapterResult.source` per section | Source/status badges are visible in the evidence summary and section panels. | Mixed same-origin frontend/backend modes can confuse interpretation without copy guidance. | Keep section-level source/state in UAT evidence payload. |
| Section completeness | Derived in `OrderHistoryView` from query state and row counts | Sections distinguish loaded, no-records-returned, unavailable, error, mock-only, and pending-validation. | Completeness is UI-derived, not a source-certified completeness metric. | Treat partial/no-record states as UAT follow-up items. |
| UAT candidate loading | UI button loads `7006965038 / C113` | Candidate is easy to load from the query form. | Expected results require UAT validation and comparison to source evidence. | Keep candidate labelled as UAT-only and pending/SQL-probed unless browser evidence is captured. |
| Copy UAT evidence | `Copy UAT Evidence` button in POH screen | Payload includes adapter mode, inputs, section source summary, section completeness, counts, and warnings. | Clipboard payload depends on the currently rendered query state. | Paste payload into UAT ledger with source screenshots/API evidence. |
| Error/unavailable states | Per-route adapter and React Query states | Route errors render explicit section error cards; partial banner appears when not all sections are complete. | Browser validation of exact deployed auth/config failure paths remains pending. | Validate 401/403/502/503/504 paths in UAT where possible. |

## Evidence Hardening Summary (poh-hardening branch, 2026-05-21)

The following items from PR #52 deferred list have been code-fixed:

| Item | Status |
|---|---|
| Component consumption grouped by material only | Fixed — now groups by `materialId + batchId + normalised UOM` |
| Multiple batches collapsed into one row | Fixed — separate rows per batch |
| Mixed UOMs summed together | Fixed — separate rows per UOM |
| Zero/negative net rows silently filtered | Fixed — all rows visible including full reversals |
| Source attribution hardcoded rather than derived | Confirmed correct — `getSectionSource` reads `AdapterResult.source`; tests added |
| Regression tests for multi-batch and mixed-UOM cases | Added — TC-1 through TC-8 in `order-history-view.test.tsx` |

These are code-level fixes. Browser UAT against the live Databricks source is still required before business sign-off.

## Remaining UAT Blockers

- Browser-level validation of the four POH routes inside the deployed UI.
- Confirmation that candidate counts match SAP/Databricks source evidence.
- Source enrichment for unavailable header quantities/dates and operation work-centre/timestamps, if required by UAT scope.
- Business confirmation for ambiguous ADP movement direction codes.
- Produced-output and component-consumption summaries need UAT comparison against source movement evidence.
