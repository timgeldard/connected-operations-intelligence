# Trace2 Functional Parity Audit

**Date:** 2026-05-16
**Source repos inspected:**
- `C:/Users/tgeldard/Documents/GitHub/trace2` — original standalone Trace2 app
- `C:/Users/tgeldard/Documents/GitHub/ConnectIO-RAD/apps/trace2` — V1 monorepo refactor (DDD version)
- `C:/Users/tgeldard/Documents/GitHub/connectio-rad-v2` — current V2 workspace

---

## 1. Original Trace2 — Routes and Entry Points

### Frontend pages (9 total)

| # | Page | Route/tab | Description |
|---|------|-----------|-------------|
| 01 | Recall Readiness | default | Full blast radius: countries, customers, deliveries, exposure table, event timeline |
| 02 | Bottom-Up Trace | sidebar tab 2 | Upstream lineage to supplier lots |
| 03 | Top-Down Trace | sidebar tab 3 | Downstream lineage to customers/deliveries |
| 04 | Mass Balance | sidebar tab 4 | Per-day delta + running cumulative balance |
| 05 | Quality | sidebar tab 5 | Inspection lots + MIC results |
| 06 | Production History | sidebar tab 6 | Recent batches for material (default 24) |
| 07 | Batch Comparison | sidebar tab 7 | Production + quality rollup across batches |
| 08 | Supplier Risk | sidebar tab 8 | Suppliers in ancestor chain, failure rates |
| 09 | Certificate of Analysis | sidebar tab 9 | CoA MIC results with spec compliance |

**Batch picker:** Material ID + Batch ID at top of every page (default: `20582002` / `0008898869`)

**Depth controls:** "Trace depth ↓" (upstream depth) and "Input depth ↑" (downstream depth) in top bar

---

## 2. Original Trace2 — Backend API Routes

**All POST, rate-limited, return `{ payload, freshness }`:**

| Endpoint | Rate limit | Input | Gold views |
|----------|-----------|-------|-----------|
| `POST /api/trace` | 30/min | material_id, batch_id | gold_batch_lineage, gold_material, gold_plant, gold_batch_quality_summary_v, gold_batch_stock_v |
| `POST /api/summary` | 60/min | batch_id | gold_batch_stock_v, gold_batch_mass_balance_v |
| `POST /api/batch-details` | 30/min | material_id, batch_id | gold_batch_stock_v, gold_batch_mass_balance_v, gold_batch_quality_result_v, gold_batch_quality_lot_v, gold_batch_delivery_v, gold_batch_lineage |
| `POST /api/impact` | 60/min | batch_id | gold_batch_delivery_v, gold_batch_lineage |
| `POST /api/recall-readiness` | 30/min | material_id, batch_id | gold_batch_lineage, gold_batch_stock_v, gold_batch_mass_balance_v, gold_batch_delivery_v, gold_batch_summary_v, gold_plant |
| `POST /api/bottom-up` | 30/min | material_id, batch_id | gold_batch_lineage, gold_material, gold_plant, gold_supplier, gold_batch_summary_v |
| `POST /api/top-down` | 30/min | material_id, batch_id | gold_batch_lineage, gold_material, gold_plant, gold_batch_delivery_v, gold_batch_summary_v |
| `POST /api/mass-balance` | 30/min | material_id, batch_id | gold_batch_mass_balance_v, gold_batch_summary_v, gold_batch_stock_v, gold_batch_delivery_v, gold_batch_lineage, gold_plant |
| `POST /api/quality` | 30/min | material_id, batch_id | gold_batch_quality_lot_v, gold_batch_quality_result_v, gold_batch_quality_summary_v, gold_batch_summary_v |
| `POST /api/production-history` | 30/min | material_id, batch_id | gold_batch_production_history_v, gold_batch_summary_v |
| `POST /api/batch-compare` | 30/min | material_id, batch_id | gold_batch_production_history_v, gold_batch_quality_summary_v, gold_batch_summary_v |
| `POST /api/supplier-risk` | 30/min | material_id, batch_id | gold_batch_lineage, gold_supplier, gold_material, gold_batch_summary_v, gold_batch_quality_summary_v |
| `POST /api/coa` | 30/min | material_id, batch_id | gold_batch_coa_results_v, gold_batch_summary_v, gold_batch_mass_balance_v, gold_batch_stock_v, gold_plant |

---

## 3. Original Trace2 — Databricks Gold Views (13 total)

| View | Key columns | Used by |
|------|------------|---------|
| `gold_batch_lineage` | PARENT/CHILD_MATERIAL_ID, PARENT/CHILD_BATCH_ID, PARENT/CHILD_PLANT_ID, LINK_TYPE | trace tree, recall, bottom-up, top-down, supplier risk |
| `gold_material` | MATERIAL_ID, MATERIAL_NAME, LANGUAGE_ID | trace tree, bottom-up, top-down |
| `gold_plant` | PLANT_ID, PLANT_NAME | trace tree, recall |
| `gold_supplier` | SUPPLIER_ID, SUPPLIER_NAME, COUNTRY_ID | bottom-up, supplier risk |
| `gold_batch_summary_v` | manufacture/expiry dates, shelf-life status | all pages (batch header) |
| `gold_batch_stock_v` | MATERIAL_ID, BATCH_ID, UNRESTRICTED, BLOCKED, QUALITY_INSPECTION, RESTRICTED, TOTAL_STOCK | summary, details, recall, mass balance |
| `gold_batch_mass_balance_v` | POSTING_DATE, MOVEMENT_TYPE, MOVEMENT_CATEGORY, ABS_QUANTITY, UOM, BALANCE_QTY | mass balance |
| `gold_batch_delivery_v` | DELIVERY, CUSTOMER_ID, CUSTOMER_NAME, COUNTRY_ID, CITY, ABS_QUANTITY | impact, recall, top-down |
| `gold_batch_production_history_v` | PROCESS_ORDER_ID, BATCH_ID, POSTING_DATE, BATCH_QTY, UOM, quality_status | production history, batch compare |
| `gold_batch_quality_lot_v` | INSPECTION_LOT_ID, INSPECTION_TYPE, CREATED_DATE, USAGE_DECISION_LONG_TEXT | quality |
| `gold_batch_quality_result_v` | MIC_ID, MIC_CODE, MIC_NAME, TARGET_VALUE, TOLERANCE, QUANTITATIVE_RESULT, INSPECTION_RESULT_VALUATION | quality |
| `gold_batch_quality_summary_v` | lot_count, accepted_result_count, rejected_result_count, failed_mic_count | trace tree, supplier risk |
| `gold_batch_coa_results_v` | mic_code, target_value, tolerance_range, actual_result, within_spec, deviation_from_target | CoA |

---

## 4. Original Trace2 — Input Parameters

| Parameter | Scope | Used by |
|-----------|-------|---------|
| `material_id` | Required for most queries | Batch picker at top of every page |
| `batch_id` | Required for most queries | Batch picker at top of every page |
| `max_levels` | Trace depth (default 10, env: MAX_TRACE_LEVELS) | Trace tree recursion |
| Upstream depth | UI depth control "↓" | Bottom-up, supplier risk |
| Downstream depth | UI depth control "↑" | Top-down, recall readiness exposure |

---

## 5. Original Trace2 — Trace Direction Support

| Direction | Endpoints | Notes |
|-----------|-----------|-------|
| Upstream (reverse) | `/api/trace`, `/api/bottom-up`, `/api/supplier-risk` | Recursive CTE walks upstream via PARENT_* fields |
| Downstream (forward) | `/api/top-down`, `/api/recall-readiness` (exposure) | Recursive CTE walks downstream via CHILD_* fields |
| Bidirectional | Not a single query — requires separate upstream + downstream calls | `/api/trace` is upstream only |

**Depth control in UI:** Separate sliders / counters for upstream depth and downstream/input depth in top bar.

---

## 6. Original Trace2 — Graph/Tree Behaviour

**Algorithm:** Recursive SQL CTE with cycle detection via path string INSTR check.

**Cycle detection:** Path = `,material|batch|plant,` delimiter; INSTR check prevents revisiting nodes.

**Node status:**
- Blocked: BLOCKED qty > 0 OR rejected results > 0
- QI Hold: QUALITY_INSPECTION qty > 0 OR failed MICs > 0
- Released: accepted results > 0 OR UNRESTRICTED qty > 0
- Unknown: else

**Node colour:** Green (Released), Red (Blocked), Amber (QI Hold), Gray (Unknown)

**Tree building (`_build_tree`):**
1. Group rows by (material_id, batch_id), keep shallowest depth per key
2. Roots: rows with parent = NULL
3. Recursively attach children to parents, tracking ancestors for cycle detection
4. Output: nested JSON tree `{ name, status, riskTier, nodeColor, attributes, children[] }`

**LINK_TYPE values in `gold_batch_lineage`:**
- `PRODUCTION` — produced from
- `BATCH_TRANSFER` — batch transfer between plants
- `STO_TRANSFER` — stock transfer order
- `VENDOR_RECEIPT` — goods receipt from supplier

---

## 7. Original Trace2 — Mass Balance Behaviour

**Per-day delta calculation:**
```sql
delta = CASE
  WHEN MOVEMENT_CATEGORY = 'Production' THEN +ABS_QUANTITY
  WHEN MOVEMENT_CATEGORY = 'Shipment'   THEN -ABS_QUANTITY
  WHEN MOVEMENT_TYPE IN ('261','262','201','202') THEN -ABS_QUANTITY  -- consumption
  WHEN MOVEMENT_TYPE IN ('701','702','711','712','531','532') THEN -ABS_QUANTITY  -- adjustment
  ELSE BALANCE_QTY
END
```

**Running cumulative:** `SUM(daily_delta) OVER (ORDER BY POSTING_DATE)` (window function)

**Filters:** Excludes STO% movement categories.

**Frontend:** Timeline chart per day showing delta + cumulative balance. Not just totals.

---

## 8. Original Trace2 — Customer Exposure Behaviour

**Recall Readiness page surfaces:**
- **Countries:** Distinct COUNTRY_ID from deliveries, grouped with SUM(ABS_QUANTITY), COUNT(DELIVERY)
- **Customers:** Per customer, share of total shipped quantity
- **Deliveries:** Per delivery ID with status (PLANNED / IN_TRANSIT / DELIVERED based on POSTING_DATE)
- **Exposure table:** Downstream batches, per-batch stock status, shipped qty, risk tier (CRITICAL/HIGH/MEDIUM/LOW)

**Risk tier calculation:**
- CRITICAL: depth 1 from focal batch
- HIGH: depth 2 AND shipped > 0
- MEDIUM: depth 2 AND shipped = 0
- LOW: depth > 2

**Cross-batch exposure:** Batches sharing ≥3 production inputs = High risk, ≥2 = Medium, <2 = Low.

---

## 9. Original Trace2 — Supplier Exposure Behaviour

**`fetch_supplier_risk` algorithm:**
1. Recursive upstream walk (level < 4) from focal batch
2. Find all intermediate ancestors
3. Find VENDOR_RECEIPT edges where supplier is NOT NULL
4. Aggregate per supplier: received qty, batch count, first/last dates
5. Quality aggregate: accepted/rejected/failed MIC counts, failure rate
6. Sort by received qty DESC, limit 50

**Output:** Supplier table with columns: supplier ID, name, country, material, received qty, batch count, first/last dates, failure rate.

---

## 10. Original Trace2 — Inventory/Stock Behaviour

Aggregated per-batch from `gold_batch_stock_v`:
- UNRESTRICTED, BLOCKED, QUALITY_INSPECTION, RESTRICTED, TRANSIT, TOTAL_STOCK

Shown in batch header and recall readiness exposure table.

---

## 11. Original Trace2 — Quality Behaviour

**Quality page:**
- Inspection lots table: lot ID, type, dates, inspector, origin, usage decision
- MIC results table: lot, MIC code/name, target, tolerance, actual result, deviation, valuation (A/R)
- Summary: total lots, accepted/rejected/failed counts, latest date

**Batch status rules from quality data:**
- failed_mic_count > 0 → QI Hold
- rejected_result_count > 0 → Blocked

---

## 12. Original Trace2 — Production History

**`fetch_production_history`:**
- Recent 24 batches for same material
- Per batch: process order, plant, manufacture date, quantity, UOM, quality status, yield%
- Used to show production trends for the material

---

## 13. Original Trace2 — Batch Comparison

**`fetch_batch_compare`:**
- Recent 24 batches for same material
- Per batch: production data + quality rollup (lot count, accepted/rejected/failed)
- Allows comparison of quality performance across batches

---

## 14. Original Trace2 — Certificate of Analysis

**CoA page:**
- Batch header
- MIC results table: MIC code, name, target value, tolerance, actual result, result status, within_spec, deviation
- Source: `gold_batch_coa_results_v`

---

## 15. Original Trace2 — Drill-Through and Export

**Drill-through:** Clicking a batch in any table navigates to that batch's pages (material_id + batch_id change in URL/state).

**Export:** "Export dossier" button on Recall Readiness page — **mock only in original**, no actual export implemented.

---

## 16. Current V2 Trace Investigation — Implementation

See comprehensive V2 exploration report. Summary:

**Workspace:** `trace-investigation` (lifecycle: live)

**Views (7):** overview, trace-tree, mass-balance, customer-exposure, supplier-exposure, timeline-events, recall-readiness

**Panels (10):** BatchHeaderPanel, TraceGraphPanel, CustomerImpactPanel, CoAReleaseStatusPanel, MaterialSupplierExposurePanel, EventTimelinePanel, RelatedInvestigationsPanel, RiskSignalsPanel, TraceExposureForReleasePanel, MassBalancePanel (inline)

**Adapter methods (11):** All return mock data. `getBatchHeaderSummary` is the only legacy-api wired + browser-verified method.

**FastAPI proxy:** Only `POST /api/trace2/batch-header` — 1 of ~14 original endpoints.

**Request model:** `Trace2AdapterRequest { investigationId, batchId?, materialId?, plantId? }` — investigationId is primary key, batch/material optional and not yet used.

**Key architectural difference:** V2 uses an investigation abstraction (`investigationId`) rather than direct `material_id + batch_id` entry. The original Trace2 is batch-first; V2 is investigation-first.

---

## 17. Parity Gaps Summary

| Gap | Original | V2 Status |
|-----|---------|-----------|
| Batch/material entry form | Material ID + Batch ID picker | No batch picker — fixed mock investigation |
| Trace direction controls | Separate forward/reverse/both with depth sliders | Direction in mock data only — no UI control |
| Trace tree connected to real data | Real recursive SQL query | Mock graph (7 nodes) |
| Mass balance per-day events | Per-day delta + cumulative chart | Totals only (input/output/variance) |
| Customer delivery table | Countries, customers, deliveries, risk tier | Summary counts only |
| Supplier detail table | Per-supplier with failure rates | Summary counts only |
| Quality inspection lots | Lot table + MIC results table | CoA status summary only |
| Production history | Recent 24 batches for material | No panel |
| Batch comparison | Cross-batch quality rollup | No panel |
| CoA MIC results | Detailed results table | Release status only |
| Cross-batch exposure | Shared-input risk calculation | No panel |
| Recall readiness detail | Countries + customers + deliveries + exposure table | Summary panels only |
| Depth controls | UI depth sliders (upstream/downstream) | No depth control |
| Edge detail in graph | Click edge → edge type, qty, document reference | No edge click handler |
| Cross-workspace drill-through | Material/batch → other pages | Phase 2 — not wired |
| Export/report | Recall readiness dossier (mock) | Not implemented |
