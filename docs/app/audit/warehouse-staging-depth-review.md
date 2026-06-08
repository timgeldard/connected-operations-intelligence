# Warehouse360 and Production Staging — Functional Depth Review

**Audit date:** 2026-05-16
**Scope:** Warehouse360 Overview workspace (`warehouse-360-overview`) and Production Staging workspace (`production-staging`).

---

## Warehouse360 Overview

| Capability | Current V2 panel/view | Data source tier | Gap | Remediation |
|---|---|---|---|---|
| High-level KPI summary | `Warehouse360SummaryPanel` | mock — `Warehouse360Summary` | Shows holdLines and QI Lines totals but no zone-level hold breakdown; blocked locations count not visible in overview | Add `ExceptionStockSummaryPanel` using `StockOverview.blockedLocations` + per-zone hold% |
| Zone capacity & stock breakdown | `StockOverviewPanel` | mock — `StockOverview.zones` | Shows capacity% per zone but no hold% column; blocked locations not highlighted | Update `ExceptionStockSummaryPanel` to show hold% per zone with alert colouring |
| Blocked / restricted stock | None in overview | — | `blockedLocations: 47` is in `StockOverview` but never surfaced in overview view | New `ExceptionStockSummaryPanel` |
| Inbound workload summary | `GoodsMovementActivityPanel` | mock — `GoodsMovementEvent[]` | Panel shows raw movement list; no aggregate count of inbound receipts vs outbound issues | New `InboundOutboundSummaryPanel` aggregating by `movementType` |
| Outbound workload summary | `GoodsMovementActivityPanel` | mock — `GoodsMovementEvent[]` | Same — no outbound tile separate from raw list | New `InboundOutboundSummaryPanel` |
| Open holds with drill-through | `OpenHoldsPanel` | mock — `OpenHoldItem[]` | Done — `onHoldNavigate` wired in prior tranche; links to `quality-batch-release` and `trace-investigation` | Complete |
| Replenishment needs | `ReplenishmentNeedsPanel` (zone/shortfalls view) | mock — `ReplenishmentNeed[]` | Not in overview view | Already visible in dedicated view; acceptable gap for overview depth |
| Expiry / shelf-life risk | None | — | **Gap: `OpenHoldItem` and `StockOverview` have no `expiresAt`, `bestBeforeDate`, or `shelfLifeRemainingDays` field.** Cannot implement without contract extension. | Document gap — do not invent fake fields |
| WM/IM stock mismatch | None | — | **Gap: no stock reconciliation or discrepancy type in `StockOverview`, `Warehouse360Summary`, or `GoodsMovementEvent`.** Cannot implement without contract extension. | Document gap |

---

## Production Staging

| Capability | Current V2 panel/view | Data source tier | Gap | Remediation |
|---|---|---|---|---|
| Overall readiness summary | `StagingReadinessSummaryPanel` | mock — `StagingReadinessSummary` | Complete — shows %, totals, shortfalls, pick tasks | Complete |
| What needs staging next | `StagingOrderListPanel` | mock — `StagingOrderSummary[]` | Shows all orders with status; no drill-through to Process Order Review | Add `onProcessOrderClick` to shortfalls panel; order list already shows order status |
| What is short | `StagingShortfallsPanel` (exists, shortfalls view only) | mock — `StagingShortfall[]` | Panel not shown in staging overview; no affectedOrders drill-through; `source` not passed | Add to `StagingOverviewView`; add chip-per-order drill-through → `process-order-review` |
| What is blocked | `StagingAlertsPanel` | mock — `StagingAlert[]` | `source` not passed; no navigation action from blocked-order alerts to WH360 holds | Add `source`, add `onNavigateToWorkspace` for blocked-order alert type |
| What is late | `StagingOrderListPanel` | mock — `StagingOrderSummary[]` | Orders with `urgency: critical` and `status: not-staged`/`blocked` visible; no explicit late/overdue flag in contract | Acceptable — `StagingReadinessSummary.riskStatus: 'at-risk'` and alerts cover this |
| What needs escalation | `StagingAlertsPanel` | mock — `StagingAlert[]` | `recommendedAction` shown; no escalation action button wired | `StagingAlertsPanel` improved with navigation callback |
| Which process order / batch | `StagingOrderListPanel`, `StagingShortfallsPanel` | mock | Shortfall `affectedOrders` shows order count only; not clickable | Chip-per-order with drill-through |
| Source status | `StagingShortfallsPanel`, `StagingAlertsPanel` | mock | `source={result?.source}` missing from both panels | Add to both panels in this tranche |

---

## Remaining gaps after this tranche

- **Expiry / shelf-life risk**: requires `expiresAt` or `shelfLifeRemainingDays` field on `OpenHoldItem` or a new `ExpiryRiskSummary` contract. Not implementable from current schema.
- **WM / IM stock mismatch**: requires a discrepancy or reconciliation object in data contracts. No existing field supports this.
- **Staging order late flag**: `StagingOrderSummary` has `plannedStart` and `urgency` but no explicit `isLate` or `overdue` boolean. A derived `isLate` (plannedStart < now && status != staged) could be added in a future contract pass.
- **Process order context → Production Staging drill-through from WH360**: `OpenHoldItem` does not have a `processOrderId` field; cannot link to Production Staging from a hold without contract change.
