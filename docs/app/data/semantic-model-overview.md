# Data / Semantic Model Overview

All entity types in ConnectIO RAD V2 are defined as Zod schemas in `packages/data-contracts/src/schemas/`. TypeScript types are inferred from the schemas via `z.infer<typeof Schema>`. The schemas serve as the contract between adapters (which map raw V1/V2 API responses) and panels (which render typed data).

---

## Package

```
@connectio/data-contracts
packages/data-contracts/src/schemas/
```

All public types are re-exported from `packages/data-contracts/src/index.ts`.

---

## Domain entity groups

### Traceability (Trace2)

| Type | Schema | Description |
|---|---|---|
| `TraceInvestigationContext` | `TraceInvestigationContextSchema` | Active investigation record — status, severity, linked batch/material/order |
| `BatchHeaderSummary` | `BatchHeaderSummarySchema` | Batch master data — material, plant, quantities, dates, stock/quality/release status |
| `TraceGraph` | `TraceGraphSchema` | Upstream/downstream node-edge graph for a batch |
| `TraceNode` | `TraceNodeSchema` | Single node in the trace graph — type (raw-material, finished-good, supplier-lot, customer-delivery, process-order, semi-finished), risk level, status |
| `TraceEdge` | `TraceEdgeSchema` | Edge between nodes — relationship type (component-of, produced-from, delivered-to), quantity, document reference |
| `MassBalanceSummary` | `MassBalanceSummarySchema` | Input/output/variance quantities and confidence |
| `CustomerExposureSummary` | `CustomerExposureSummarySchema` | Downstream customer and delivery exposure |
| `SupplierExposureSummary` | `SupplierExposureSummarySchema` | Upstream supplier lot exposure |
| `TraceEvent` | `TraceEventSchema` | Timeline event (investigation-opened, batch-blocked, goods-issued, etc.) |
| `CoAReleaseStatus` | `CoAReleaseStatusSchema` | Certificate of Analysis and release decision state |
| `TraceRiskSignal` | `TraceRiskSignalSchema` | Environmental/quality signal with severity, source, confidence, recommended action |
| `RelatedInvestigation` | `RelatedInvestigationSchema` | Cross-referenced investigation (same plant, supplier, or material) |
| `TraceExposureForRelease` | `TraceExposureForReleaseSchema` | Release-decision view of trace risk — upstream/downstream risk levels, recall flag |

### Warehouse (Warehouse 360)

| Type | Schema | Description |
|---|---|---|
| `Warehouse360Summary` | `Warehouse360SummarySchema` | Warehouse-level stock summary — stock lines by status, open movements, capacity utilization |
| `StockOverview` | `StockOverviewSchema` | Aggregated stock positions |
| `GoodsMovementActivity` | (<!-- TODO: confirm schema name -->) | Recent goods issue/receipt activity |
| `LocationCapacity` | (<!-- TODO: confirm schema name -->) | Storage location utilization |
| `OpenHoldSummary` | (<!-- TODO: confirm schema name -->) | Batches under QM hold |
| `ReplenishmentNeed` | (<!-- TODO: confirm schema name -->) | Open replenishment transfer requirements |

### Operations (Process Order / POH)

| Type | Schema | Description |
|---|---|---|
| `ProcessOrderReviewContext` | `ProcessOrderReviewContextSchema` | Active process order context — order status, quality status, staging status |
| `ProcessOrderHeader` | `ProcessOrderHeaderSchema` | Order master data — material, plant, planned/confirmed quantities, dates, status |
| `OrderProgressSummary` | `OrderProgressSummarySchema` | Execution progress — ops complete/total, confirmations, delay, risk level, confidence |
| `ExecutionTimelineItem` | `ExecutionTimelineItemSchema` | Timeline event for a process order |
| `OrderQualityContext` | `OrderQualityContextSchema` | In-process quality state — inspection lot, deviations, SPC signals, release blockers |
| `OrderStagingContext` | `OrderStagingContextSchema` | Component staging readiness — staged/missing/blocked counts, open transfer requirements |
| `RelatedBatchContext` | `RelatedBatchContextSchema` | Input/output/co-product batch relationships |

### Operations (Plan Risk)

| Type | Schema | Description |
|---|---|---|
| `PlanRiskSummary` | (<!-- TODO: confirm schema name -->) | Plant-day plan KPIs — order counts by status, top risk reason |
| `LateOrder` | (<!-- TODO: confirm schema name -->) | Individual late order with delay, severity, owner |
| `MaterialShortage` | (<!-- TODO: confirm schema name -->) | Short material line — required-by time, procurement status |
| `LineStatus` | (<!-- TODO: confirm schema name -->) | Production line health — OEE, downtime, current material, risk |
| `ScheduleAdherenceSummary` | (<!-- TODO: confirm schema name -->) | Shift/day schedule adherence % and metrics |
| `YieldVarianceSummary` | (<!-- TODO: confirm schema name -->) | Order-level yield variance — planned vs. actual %, scrap, rework |
| `ShiftHandoverItem` | (<!-- TODO: confirm schema name -->) | Handover note with category, severity, linked orders |
| `OperationsActionQueueItem` | (<!-- TODO: confirm schema name -->) | Open action — owner role, due time, recommended action |

### Quality (QM / Batch Release)

| Type | Schema | Description |
|---|---|---|
| `ProcessOrderReleaseEvidence` | (<!-- TODO: confirm schema name -->) | Cross-domain evidence summary for a batch release decision |

### SPC, Maintenance, EnvMon

<!-- TODO: Document data contract types for SPC, Maintenance, and EnvMon domains once their schemas are stable. -->

---

## Key type conventions

### Identifiers

All entity identifiers use SAP-style strings matching production systems:
- Batch IDs: `CH-240308-0047`, `MILK-240308-022`
- Material IDs: `100023847`, `MAT-CH-EMMENTAL-BLOCK`
- Process orders: `PO-240308-1189`
- Plants: `IE10` (Kerry Listowel)

<!-- TODO: Confirm full plant code list for Kerry sites. -->

### Dates

All timestamps are ISO 8601 strings (`2024-03-08T00:00:00.000Z`). Date-only strings from V1 APIs are padded to ISO format in the adapter mapping layer.

### Status enums

Status fields use hyphen-separated lowercase strings matching the Zod enum definitions:
- `batchStatus`: `'active' | 'archived' | 'blocked' | 'deleted'`
- `stockStatus`: `'unrestricted' | 'quality-inspection' | 'blocked' | 'transit' | 'returns'`
- `qualityStatus`: `'released' | 'pending' | 'rejected' | 'not-applicable'`
- `releaseStatus`: `'released' | 'not-released' | 'blocked' | 'unknown'`
- `orderStatus`: `'created' | 'released' | 'in-process' | 'partially-confirmed' | 'confirmed' | 'closed' | 'cancelled'`

### Risk levels

`riskLevel`: `'none' | 'low' | 'medium' | 'high' | 'critical'`

Colour conventions across panels:
- `critical`: `#F24A00` (sunset)
- `high`: `#D97706` (amber)
- `medium`: `#D4A017` (dark amber)
- `low`: `#289BA2` (sage/teal)
- `none`: `var(--shell-fg-3)` (muted)

---

## Schema validation in adapters

The legacy-api adapter for Trace2 uses `BatchHeaderSummarySchema.parse()` to validate the mapped response before returning it. This catches field mapping errors at runtime and throws with a descriptive Zod error.

Other legacy adapters use manual mapping with `??` fallbacks for snake_case/camelCase variants without schema validation — this is a known gap. Future adapters should add Zod parsing for all mapped responses.
