# POH V1 to V2 Functional Parity

**Last updated:** 2026-05-21
**V1 repo inspected:** `https://github.com/timgeldard/ConnectIO-RAD`
**V2 repo inspected:** `https://github.com/timgeldard/connectio-rad-v2`

This review compares the V1 Process Order History app with the V2 Operations
Process Order History slice. It is intentionally conservative: unknown source
coverage is labelled unknown, and no-record sections are not treated as proof
that source events do not exist.

## Files Inspected

### V1

| File | Purpose |
|---|---|
| `apps/processorderhistory/README.md` | App scope, source inventory, POH schema notes |
| `apps/processorderhistory/docs/api.md` | V1 endpoint contracts and response shapes |
| `apps/processorderhistory/docs/architecture.md` | V1 bounded contexts, pages, DAL/source model |
| `apps/processorderhistory/frontend/src/pages/OrderList.tsx` | Order list UI, filters, KPIs, drill-through |
| `apps/processorderhistory/frontend/src/pages/OrderDetail.tsx` | Order detail UI: summary, phases, materials, inspections, downtime/equipment |
| `apps/processorderhistory/frontend/src/api/orders.ts` | Frontend order list/detail mappers |
| `apps/processorderhistory/backend/processorderhistory_backend/order_execution/router_orders.py` | `POST /api/orders` list route |
| `apps/processorderhistory/backend/processorderhistory_backend/order_execution/router_order_detail.py` | `GET /api/orders/{order_id}` detail route |
| `apps/processorderhistory/backend/processorderhistory_backend/order_execution/dal/orders_dal.py` | Order list SQL against `vw_gold_order_summary` |
| `apps/processorderhistory/backend/processorderhistory_backend/order_execution/dal/order_detail_dal.py` | Eight-query detail DAL and derived materials/movement summary |
| `apps/processorderhistory/backend/processorderhistory_backend/order_execution/domain/movements.py` | Movement quantity, 261/262 and 101/102 netting rules |
| `apps/processorderhistory/backend/processorderhistory_backend/db.py` | `POH_CATALOG`, `POH_SCHEMA`, table helpers, status mapping |
| `apps/processorderhistory/genie/instructions/03_table_rules.md` | Source grain and semantic rules |
| `apps/processorderhistory/genie/joins/joins.yaml` | Approved source joins |

### V2

| File | Purpose |
|---|---|
| `domain-integrations/operations/src/views/order-history-view.tsx` | Current POH read-only screen |
| `domain-integrations/operations/src/adapters/process-order-review-databricks-api-adapter.ts` | Frontend Databricks adapter |
| `domain-integrations/operations/src/adapters/process-order-review-queries.ts` | React Query hooks |
| `apps/api/routes/process_order.py` | Native/legacy POH API routes |
| `apps/api/adapters/poh/poh_databricks_adapter.py` | QuerySpec factories and mappers |
| `packages/data-contracts/src/schemas/process-order-review.ts` | V2 POH Zod contracts |
| `apps/api/contracts/generated.py` | Generated Pydantic contracts |
| `domain-integrations/operations/docs/poh-uat-readiness-notes.md` | Current UAT readiness notes |
| `domain-integrations/operations/docs/golden-process-orders.md` | UAT candidate evidence |

## V1 Screens And Components

| V1 Screen / Component | File Path | Purpose | Inputs / Filters | Sections Shown | Empty / Evidence Behaviour |
|---|---|---|---|---|---|
| Order list | `frontend/src/pages/OrderList.tsx` | Search and filter process orders, then drill into detail | Plant context, search, status, product category, line, date range, sort, pagination | KPI strip, orders table, status/product/line/date filters | Loading and fetch error states; no V2-style evidence badges |
| Order detail | `frontend/src/pages/OrderDetail.tsx` | Full order execution detail | Process order ID from selected row or URL navigation | Header summary, quantity issued/received/yield, DOM/expiry/inspection lot, activity/comments, downtime, phases/timing, equipment, component materials, inspections, usage decision | Loading/error states; several "no records" messages but no section-level source status |
| Pours analytics | `frontend/src/pages/PourAnalytics.tsx` | MT-261 pour volume and events | Plant/date/timezone | KPI cards, daily/hourly series, events | Data-backed analytics endpoint; not equivalent to V2 POH detail |
| Yield analytics | `frontend/src/pages/YieldAnalytics.tsx` | Yield by order/material over time | Plant/date/timezone | Yield KPIs, per-order rows, trends | Uses derived movement rules, useful for V2 parity but outside detail slice |
| Quality analytics | `frontend/src/pages/QualityAnalytics.tsx` | Inspection/usage-decision analytics | Plant/date/timezone | Inspection rows, RFT series | Quality context richer than current V2 POH |

## V1 POH Data Sources

| V1 Source | File Path | Grain | Key Columns | V2 Equivalent | Gap |
|---|---|---|---|---|---|
| `vw_gold_order_summary` | `order_execution/dal/orders_dal.py` | One row per process order | `PROCESS_ORDER_ID`, `INSPECTION_LOT_ID`, `MATERIAL_ID`, `material_name`, `MATERIAL_CATEGORY`, `PLANT_ID`, `STATUS`, `start_ts`, `end_ts`, `duration_h`, `actual_qty_kg` | No V2 order-list route; V2 focuses on entered order detail | v2-missing for list/search workflow |
| `vw_gold_process_order` | `order_execution/dal/order_detail_dal.py`; Genie table rules | One row per process order | `PROCESS_ORDER_ID`, `INSPECTION_LOT_ID`, `MATERIAL_ID`, `PLANT_ID`, `STATUS`, `MATERIAL_DESCRIPTION` | `POST /api/por/order-header` via `poh.get_process_order_header` | partial-parity; V2 confirmed view lacks quantities/dates/batch in current route |
| `vw_gold_material` | V1 header/movement joins; Genie join rules | One row per material/language | `MATERIAL_ID`, `MATERIAL_NAME`, `LANGUAGE_ID`, `MATERIAL_CATEGORY` | Not joined in V2 POH native routes | source-blocked until join/source is confirmed in V2 route scope |
| `vw_gold_process_order_material` | V1 header batch/date join | Order/material component relationship | `PROCESS_ORDER_ID`, `MATERIAL_ID`, `BATCH_ID`, `DATE_OF_MANUFACTURING`, `EXPIRY_DATE` | No V2 native equivalent | v2-missing/source-blocked |
| `vw_gold_batch_material` | V1 header supplier batch join | Batch/material relationship | `BATCH_ID`, `MATERIAL_ID`, `SUPPLIER_BATCH_ID` | No V2 native equivalent | v2-missing/source-blocked |
| `vw_gold_process_order_phase` | V1 phases query; V2 operations route | One row per phase/operation | `PROCESS_ORDER_PHASE_ID`, `PHASE_ID`, `PHASE_DESCRIPTION`, `PHASE_TEXT`, `OPERATION_QUANTITY`, `OPERATION_QUANTITY_UOM`, `SORT_NUMBER`, `START_USER`, `END_USER` | `GET /api/por/order-operations` | partial-parity; V2 lacks V1 aggregated setup/machine/cleaning per phase unless confirmations are cross-summarised |
| `vw_gold_confirmation` | V1 phases timing aggregation; V2 confirmations route | Confirmation row | `CONFIRMATION_ID`, `PROCESS_ORDER_ID`, `PHASE_ID`, `CONFIRMED_QUANTITY`, `CONFIRMED_QUANTITY_UOM`, timestamps, setup/machine/cleaning seconds | `GET /api/por/order-confirmations` | partial-parity; V2 exposes rows but not phase-level time summary |
| `vw_gold_adp_movement` | V1 movements/materials/movement summary; V2 goods movements route | One row per goods movement line | `ID`, `PROCESS_ORDER_ID`, `MATERIAL_ID`, `BATCH_ID`, `MOVEMENT_TYPE`, `QUANTITY`, `UOM`, `DATE_TIME_OF_ENTRY`, `USER`, `MATERIAL_DOCUMENT`, `STORAGE_ID` | `GET /api/por/order-goods-movements` | v2-improved after this slice: raw rows plus movement-derived component consumption |
| `vw_gold_logs_notes_and_comments` | V1 detail comments query | Comment/log row | `CREATED`, `SENDER`, `NOTES`, `PHASE_ID`, `PROCESS_ORDER_ID` | No V2 native equivalent | v2-missing/source-blocked |
| `vw_gold_downtime_and_issues` | V1 detail downtime query | Downtime/issue row | `START_TIME`, `DURATION`, `REASON_CODE`, `SUB_REASON_CODE`, `ISSUE_TYPE`, `ISSUE_TITLE` | No V2 native equivalent | v2-missing/source-blocked |
| `vw_gold_equipment_history` | V1 equipment query; Genie joins | Equipment state-change event | `INSTRUMENT_ID`, `STATUS_FROM`, `STATUS_TO`, `CHANGE_AT`, `PROCESS_ORDER_ID`, `MATERIAL_ID`, `PLANT_ID` | No V2 native equivalent | v2-missing/source-blocked |
| `vw_gold_inspection_result` + spec/lot/UD views | V1 inspection and usage decision queries | MIC result and usage decision | MIC/result/specification/UD columns | Quality/EnvMon domains have QM slices; POH V2 does not expose order-linked QM detail | deferred to cross-domain Quality/EnvMon integration |

## Functional Capability Matrix

| Capability | V1 Behaviour | V1 Files / Sources | V2 Current State | Gap | Priority | Recommendation |
|---|---|---|---|---|---|---|
| Order header | Header card with status/material/plant/inspection lot; joins material/batch dates/supplier batch | `OrderDetail.tsx`, `order_detail_dal.py`, `vw_gold_process_order`, `vw_gold_material`, `vw_gold_process_order_material`, `vw_gold_batch_material` | Native header route exists with confirmed fields only | partial-parity | P0 | Keep current truthful blanks; only add batch/date fields after source confirmation |
| Material/batch context | Header and material section show material name/category, batch, supplier batch, DOM/expiry | Same as above | Material ID/description shown; output/input batches visible from movements | partial-parity | P1 | Source-map batch/date/supplier batch before adding contract fields |
| Plant | List/detail plant context | `OrderList.tsx`, `orders_dal.py`, `order_detail_dal.py` | Header route supports plant filter; UI input supports plant | parity-achieved | P0 | Keep SAP IDs as strings |
| Order status | Text status mapped to UI status | `ORDER_STATUS_EXPR`, `orders_dal.py`, `order_detail_dal.py` | V2 status mapping exists in `poh_databricks_adapter.py` | partial-parity | P0 | Validate live status values during UAT |
| Planned dates | V1 table rules mention `START_TIMESTAMP`/`END_TIMESTAMP`; list uses summary `start_ts`/`end_ts` | `orders_dal.py`, Genie rules | V2 header route does not have confirmed date columns | source-blocked | P1 | Do not invent; wait for confirmed view/summary source |
| Actual dates | List uses summary actual timing; detail derives event dates from confirmations/movements | `vw_gold_order_summary`, `vw_gold_confirmation`, `vw_gold_adp_movement` | V2 timeline derives from returned confirmations/movements | partial-parity | P1 | Improve timeline once route browser validation is complete |
| Operations/phases | Phase table with quantities and setup/machine/cleaning timing | `OrderDetail.tsx`, `_q_phases` | Operations route/table exists; confirmations route separately exposes durations | partial-parity | P0 | Consider a derived phase timing summary from existing V2 operation + confirmation rows |
| Resources/work centres | V1 phase has start/end users; broader planning may have line/resource | `_q_phases`, planning DALs | V2 operation contract has `workCentre`, but confirmed view does not provide it | source-blocked | P1 | Keep blank until source exposes resource/work centre |
| Confirmations | Row-level yield/time/confirmed user; phase timing aggregation | `_q_phases`, `_q_confirmations` through `vw_gold_confirmation` | V2 confirmation table exists with durations and confirmed user | partial-parity | P0 | Avoid interpreting empty rows as no confirmations |
| Yields/scrap/rework | Yield analytics and movement summary calculate issued vs received; detail shows yield | `movement_summary`, `yield_analytics_dal.py` | V2 shows confirmations and movement summaries; no yield card from net movements | partial-parity | P1 | Add net issued/received yield only after UOM/source rules are agreed |
| Goods movements | Full movement log with material, batch, movement type, quantity, storage, user, date | `_q_movements`, `vw_gold_adp_movement` | V2 movement table exists | parity-achieved | P0 | Keep unknown movement types visible |
| Component consumption | V1 derives `materials` from MT-261 minus MT-262, excludes EA, normalises G to KG | `derive_materials`, `OrderDetail.tsx` Materials section | V2 now derives Component Consumption Evidence from returned movements | v2-improved | P0 | Validate candidate component rows during UAT |
| Produced batches | V1 summary derives received quantity from MT-101 minus MT-102; output batches appear in movements | `movement_summary`, movement rows | V2 now derives Produced Output Evidence from 101/102/531 returned movements | v2-improved | P1 | Validate candidate produced-output rows during UAT |
| Material documents | V1 movements expose movement rows; mock included `MATERIAL_DOCUMENT`; API docs did not show doc/year in frontend model | `_q_movements`, `api/orders.ts` | V2 exposes `referenceDocument` from `MATERIAL_DOCUMENT` | parity-achieved | P0 | Keep in movement table/UAT payload where visible |
| Reservations | V1 detail did not expose RESB directly; Warehouse docs reference RESB for staging | Warehouse docs/components | V2 POH has staging context panels but native POH detail route does not source reservations | deferred | P2 | Keep as Warehouse/staging integration, not POH native assumption |
| Order timeline | V1 detail uses section anchors and timestamped lists; Genie has order milestones query | `OrderDetail.tsx`, `genie/queries/08_order_milestones.sql` | V2 derives chronological timeline from returned operations/confirmations/movements | v2-improved | P1 | Add source labels and continue avoiding invented events |
| Status history | V1 equipment/status changes exist for equipment, not full SAP order status history | `vw_gold_equipment_history` | V2 has current order status only | unknown | P2 | Do not add without a confirmed order-status-history source |
| Exceptions/delays | V1 downtime/issues card; planning/day views have delays | `_q_downtime`, day/planning DALs | V2 POH detail has warnings/data-quality exceptions only | v2-missing | P1 | Candidate later slice if downtime source is confirmed in V2 |
| Links to traceability | V1/Platform had cross-app URL patterns in CQ/Platform | CQ `crossApp.ts`, platform tests | V2 cross-domain context exists separately; POH screen does not deep-link trace here | partial-parity | P2 | Defer to cross-domain coherence branch/feature flag |
| Links to quality | V1 detail includes inspections and usage decision | `_q_inspections`, `_q_usage_decision` | V2 POH does not include QM detail in POH slice | v2-missing/deferred | P1 | Link to Quality/EnvMon once source contract is settled |
| Links to warehouse/staging | V1 POH had planning/lineside views; Warehouse app had order staging details | V1 POH planning/lineside, Warehouse components | V2 has staging context panels but not native POH route parity | partial-parity | P2 | Treat as cross-domain, not POH backend expansion |

## V1 To V2 Field Mapping

| V2 Field / Concept | V1 Source | V1 Column / Expression | Transform Needed | Confidence | Gap / Risk |
|---|---|---|---|---|---|
| `processOrderId` | `vw_gold_process_order`, `vw_gold_order_summary`, movements/confirmations | `PROCESS_ORDER_ID` | Preserve as string | High | None |
| `plantId` | `vw_gold_process_order` | `PLANT_ID` | Preserve as string | High | None |
| `materialId` | `vw_gold_process_order` | `MATERIAL_ID` | Preserve leading zeros | High | None |
| `materialDescription` | V1 joined `vw_gold_material` or used `MATERIAL_DESCRIPTION` | `MATERIAL_NAME` / `MATERIAL_DESCRIPTION` | `COALESCE` in V1 | Medium | V2 native movement route does not join material master |
| `batchId` | `vw_gold_process_order_material`, `vw_gold_adp_movement` | `BATCH_ID` | Optional string | Medium | Header batch source not yet wired in V2 |
| `plannedQuantity` | V1 Genie rules | `QUANTITY` planned output | Numeric | Low | Not confirmed in current V2 header DDL |
| `confirmedQuantity` | `vw_gold_order_summary` / movement summary | `actual_qty_kg` or MT-101 minus MT-102 | Aggregate | Medium | V2 header currently defaults to zero |
| `plannedStart` / `plannedFinish` | `vw_gold_process_order` table rules or summary | `START_TIMESTAMP`, `END_TIMESTAMP`, `start_ts`, `end_ts` | Timestamp to ISO | Low | Not confirmed in current V2 header route |
| Operation ID | `vw_gold_process_order_phase` | `PROCESS_ORDER_PHASE_ID` | Preserve string | High | None |
| Operation number | `vw_gold_process_order_phase` | `PHASE_ID` | Preserve string | High | None |
| Operation text | `vw_gold_process_order_phase` | `PHASE_DESCRIPTION`, `PHASE_TEXT` | Display description/text | High | None |
| Work centre/resource | Not in V1 detail phase query; planning may have line | Unknown | Unknown | Missing | Keep blank in V2 |
| Confirmation ID | `vw_gold_confirmation` | `CONFIRMATION_ID` | Preserve string | High | None |
| Confirmation yield | `vw_gold_confirmation` | `CONFIRMED_QUANTITY`, `CONFIRMED_QUANTITY_UOM` | Numeric + UOM | High | None |
| Confirmation durations | `vw_gold_confirmation` | `SET_UP_DURATION_S`, `MACHINE_DURATION_S`, `CLEANING_DURATION_S` | Seconds to minutes in V2 | High | Verify units in UAT |
| Movement ID | `vw_gold_adp_movement` | `ID` | Preserve string | High | None |
| Movement type | `vw_gold_adp_movement` | `MOVEMENT_TYPE` | Preserve string | High | Unknown codes must stay visible |
| Movement direction | V1 domain rules | 261/262 input, 101/102/531 output/byproduct | Map known codes only | Medium | 711/712/999 remain unknown |
| Material document | `vw_gold_adp_movement` | `MATERIAL_DOCUMENT`, `MATERIAL_DOCUMENT_YEAR` | String reference | High | V2 only exposes reference document |
| Component consumption | V1 `derive_materials` | 261 minus 262, exclude EA, G to KG | Derived from movement rows | High | Not BOM/reservation coverage |
| Produced output quantity | V1 `movement_summary` | 101 minus 102, with 531 as by-product receipt in V2 movement map | Derived from movement rows | Medium | Not a production completion or full yield claim |
| Inspection result | V1 QM joins | inspection result/spec/UD fields | MIC mapping | Medium | Defer to Quality/EnvMon source strategy |

## Selected Implementation Slice

Selected slice: **component consumption evidence derived from returned goods
movements**.

Rationale:

- V1 had a clear, tested domain rule for component materials from MT-261/262.
- V2 already returns native Databricks goods movements with movement type,
  material, batch, quantity, UOM, and posting metadata.
- The slice does not require a new Databricks route, new source columns, SQL in
  React, or any SAP write-back.
- It improves credible read-only UAT by making component consumption visible
  while explicitly stating it is not BOM/reservation coverage.

Implemented behaviour:

- Adds a Component Consumption Evidence section to the V2 POH screen when goods
  movement rows are available.
- Derives rows from `MOVEMENT_TYPE` 261 and 262 only.
- Subtracts 262 reversal quantities from 261 quantities.
- Excludes EA rows.
- Normalises G to KG.
- Groups by material, batch, and normalised UOM (hardened 2026-05-21 — see note below).
- Adds `componentMaterials` to the Copy UAT Evidence counts.

> **Hardening note (2026-05-21, branch poh-hardening):** The initial implementation
> grouped by `materialId` only, keeping only the first batch encountered. This was
> incorrect: multiple batches for the same material, or the same material in different
> UOMs, were collapsed into a single row. The grouping key is now
> `materialId :: batchId :: normalised UOM`, matching the produced-output grouping
> already in place. The post-aggregation filter that silently dropped zero and
> negative net rows was also removed from both component consumption and produced
> output. Regression tests (TC-1 through TC-8) were added. No Databricks columns
> were invented and no UOM conversions were added.

Follow-on implemented slice: **produced output evidence derived from returned
goods movements**.

Implemented behaviour:

- Adds a Produced Output Evidence section to the V2 POH screen when goods
  movement rows are available.
- Derives rows from `MOVEMENT_TYPE` 101, 102, and 531 only.
- Subtracts 102 reversal quantities from 101/531 receipt quantities.
- Excludes EA rows.
- Normalises G to KG.
- Groups by material, batch, and normalised UOM.
- Keeps movement types, source row count, and first returned reference document.
- Adds `producedBatches` to the Copy UAT Evidence counts.

## Highest-Priority Remaining Gaps

| Gap | Priority | Recommendation |
|---|---|---|
| Browser/UAT validation for candidate `7006965038 / C113` | P0 | Capture API and UI evidence against SAP/Databricks source |
| Header planned/actual quantity/date enrichment | P1 | Confirm richer header/source view before adding fields |
| Confirmation phase timing summary | P1 | Derive from existing confirmation durations by operation/phase |
| Quality inspection/usage decision parity | P1 | Coordinate with Quality/EnvMon source model; avoid duplicate mock claims |
| Downtime/equipment activity parity | P2 | Add only after V2 source routes are confirmed |

## Safety Confirmation

- No SAP write-back is part of this parity slice.
- No source columns are invented.
- No mock fallback is added to Databricks mode.
- No-record sections are not treated as complete absence.
- Production readiness is not claimed.
