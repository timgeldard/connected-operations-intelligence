# POH Functional Parity Matrix

**Date:** 2026-05-16
**Domain:** `di-operations` / `process-order-review`
**Reference:** `docs/migration/poh-functional-parity-audit.md`

---

## Parity Status Key

| Status | Meaning |
|---|---|
| `preserved` | V1 capability present in V2 at same or better fidelity |
| `partially-preserved` | V1 capability present but reduced (mock-only, unverified, or missing fields) |
| `improved` | V2 capability exceeds V1 (new architecture, richer model) |
| `degraded` | V1 capability present in V2 but with known regression |
| `missing` | V1 capability not yet implemented in V2 |

---

## Matrix

| V1 Capability | V1 Source | V2 Component | Parity Status | Notes |
|---|---|---|---|---|
| Order header (material, qty, status, dates) | `vw_gold_process_order` (AFKO) | `ProcessOrderHeaderPanel` | partially-preserved | Legacy-api wired but unverified; productionLine and scrapQuantity now added to schema |
| Operations / phase list | `vw_gold_process_order_phase` (AFPO) | `OrderOperationsPanel` | partially-preserved | Mock-only; schema correct; real data pending V1 wiring |
| Confirmations (yield, scrap, durations, variance) | `vw_gold_confirmation` (AFVC/AFVV) | `OrderConfirmationsPanel` | partially-preserved | Mock-only; schema covers V1 fields; variancePercent added |
| Goods movements (GI/GR per order) | `vw_gold_adp_movement` (MSEG) | `ProcessOrderGoodsMovementsPanel` | partially-preserved | Mock-only; direction field abstracts SAP movement type codes |
| Execution event timeline | Multiple sources | `ExecutionTimelinePanel` | preserved | Present; combined event feed |
| Order progress KPIs | `vw_gold_process_order` aggregate | `OrderProgressPanel` | preserved | progressPercent, riskLevel, operationsComplete, confirmationsComplete |
| Quality context (inspection lot, blockers) | `vw_gold_inspection_lot`, `vw_gold_inspection_usage_decision` | `OrderQualityContextPanel` | partially-preserved | Mock-only; inspection lot ID, usage decision, SPC signals, release blockers |
| Staging context (components staged, missing) | WH360 staging | `OrderStagingContextPanel` | preserved | Mock-only; componentsRequired, staged, missing, blocked |
| Related batches (input/output/rework) | `vw_gold_batch_material` | `RelatedBatchContextPanel` | preserved | traceRisk, qualityStatus, stockStatus, drillThroughTarget |
| Inspection characteristic results | `vw_gold_inspection_result` | — | missing | No results panel; only pass/fail summary |
| Usage decision detail | `vw_gold_inspection_usage_decision` | — | missing | Only qualityStatus enum; no UD code or signature |
| Downtime events per order | `vw_gold_downtime_and_issues` | — | missing | Covered at plan level in OPR workspace but not per-order |
| Operator notes / shift comments | `vw_gold_logs_notes_and_comments` | — | missing | No notes panel |
| Order list / search | FastAPI `/orders` + `vw_gold_order_summary` | — | missing | No order list or search surface in V2 |
| Planning board (weekly by line) | FastAPI `/planning` | — | missing | Not in Process Order Review scope |
| Day view (daily capacity by line) | FastAPI `/planning/day` | — | missing | Not in Process Order Review scope |
| Lineside monitor (current order, operator) | FastAPI `/lineside` | — | missing | Not in Process Order Review scope |
| OEE / yield analytics | FastAPI `/analytics` | `YieldLossesView`, `ScheduleAdherenceView` | partially-preserved | In Operations Plan Risk workspace, not Process Order Review |
| SPC signals per order | SPC integration | `OrderQualityContextPanel.spcSignals` | partially-preserved | Count only; no signal detail or chart |
| Equipment history per order | `vw_gold_equipment_history` | — | missing | Not implemented |
| Batch classification / release risk | `vw_gold_batch_material` + QM | `RelatedBatchContextPanel.traceRisk` | partially-preserved | traceRisk present; no classification detail |

---

## Summary

| Status | Count |
|---|---|
| preserved | 4 |
| partially-preserved | 9 |
| improved | 0 |
| degraded | 0 |
| missing | 8 |
| **Total capabilities** | **21** |

---

## Parity Score

**Preserved + Partially Preserved: 13 / 21 (62%)**  
**Missing: 8 / 21 (38%)**

The g.txt tranche moved operations, confirmations, and goods movements from `missing` to `partially-preserved`, closing the three largest functional gaps for daily order review use cases.

---

## Mock Data Consistency Check

| Mock constant | Value | Matches summary field |
|---|---|---|
| `mockOrderOperations.length` | 8 | `mockOrderProgressSummary.operationsTotal: 8` ✓ |
| `mockOrderOperations.filter(o => o.confirmed).length` | 6 | `mockOrderProgressSummary.operationsComplete: 6` ✓ |
| `mockOrderConfirmations.length` | 7 | `confirmationsComplete(5) + openConfirmations(2) = 7` ✓ |
| `mockOrderConfirmations.filter(c => c.isFinalConfirmation).length` | 5 | `mockOrderProgressSummary.confirmationsComplete: 5` ✓ |
| `mockOrderConfirmations.filter(c => !c.isFinalConfirmation).length` | 2 | `mockOrderProgressSummary.openConfirmations: 2` ✓ |
