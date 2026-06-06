# Trace Investigation Workspace

## Purpose

The **Trace Investigation** workspace is the primary interface for conducting batch traceability investigations in ConnectIO-RAD V2. It replaces the need to navigate to the legacy Trace2 application by surfacing all traceability, quality, and exposure evidence in a single governed workspace.

A user conducting a trace investigation should think:

> "I need to investigate this batch trace" — not "I need to open Trace2."

---

## Workspace Metadata

| Field | Value |
|---|---|
| `workspaceId` | `trace-investigation` |
| `displayName` | Trace Investigation |
| `domainId` | `traceability` |
| `ownerDomain` | `traceability` |
| `lifecycle` | `live` |
| `route` | `/quality/trace-investigation` |
| `telemetryId` | `quality-food-safety.trace-investigation` |

---

## Supported Roles

- `quality-lead`
- `food-safety-lead`
- `traceability-analyst`
- `plant-manager`
- `operations-supervisor`

---

## Required Permissions

| Permission ID | Description |
|---|---|
| `trace.read` | Permission to view trace investigation data |

---

## Supported Scopes

| Scope Level | Notes |
|---|---|
| `batch` | Primary scope — investigation is typically batch-scoped |
| `material` | Investigate all batches for a material |
| `process-order` | Investigate a production order |
| `plant` | Plant-level trace overview |
| `region` | Regional exposure view |
| `global` | Global supply chain view |

**Default level**: `batch`  
**Auto-elevate**: `true` — workspace adapts to the user's broadest authorised scope.

---

## Views

| View ID | Display Name | Purpose |
|---|---|---|
| `overview` | Overview | First-glance investigation summary |
| `trace-tree` | Trace Tree | Upstream/downstream node graph |
| `mass-balance` | Mass Balance | Input/output quantity reconciliation |
| `customer-exposure` | Customer Exposure | Downstream delivery and customer risk |
| `supplier-exposure` | Supplier Exposure | Upstream supplier lot exposure |
| `timeline-events` | Timeline & Events | Ordered event and decision audit trail |
| `recall-readiness` | Recall Readiness | Recall posture assessment |

---

## Evidence Panels

| Panel ID | Display Name | Owner Domain | Source System |
|---|---|---|---|
| `batch-header` | Batch Header | traceability | trace2 |
| `trace-graph` | Trace Graph | traceability | trace2 |
| `material-supplier-exposure` | Supplier Exposure | traceability | trace2 |
| `customer-impact` | Customer Impact | traceability | trace2 |
| `event-timeline` | Event Timeline | traceability | trace2 |
| `coa-release-status` | CoA & Release Status | quality | sap-qm |
| `related-investigations` | Related Investigations | traceability | trace2 |
| `risk-signals` | Risk Signals | traceability | trace2 |

### Panel Freshness Policies

| Panel | Stale After | Error After | Refresh on Focus |
|---|---|---|---|
| `batch-header` | 5 min | 15 min | Yes |
| `trace-graph` | 5 min | 15 min | Yes |
| `material-supplier-exposure` | 5 min | 15 min | Yes |
| `customer-impact` | 5 min | 15 min | Yes |
| `event-timeline` | 2 min | 10 min | Yes |
| `coa-release-status` | 3 min | 10 min | Yes |
| `related-investigations` | 5 min | 15 min | No |
| `risk-signals` | 2 min | 10 min | Yes |

---

## Source Adapter

**Adapter**: `Trace2Adapter` (`domain-integrations/traceability/src/adapters/trace2-adapter.ts`)

**Query hooks**: `domain-integrations/traceability/src/adapters/trace2-queries.ts`

Phase 1 uses realistic mock data from `trace2-mock-data.ts`. All adapter methods are async and return typed `AdapterResult<T>` values — no untyped throws.

### Adapter Methods

| Method | Returns |
|---|---|
| `getInvestigationContext` | `TraceInvestigationContext` |
| `getBatchHeaderSummary` | `BatchHeaderSummary` |
| `getTraceGraph` | `TraceGraph` |
| `getMassBalanceSummary` | `MassBalanceSummary` |
| `getCustomerExposureSummary` | `CustomerExposureSummary` |
| `getSupplierExposureSummary` | `SupplierExposureSummary` |
| `getEventTimeline` | `readonly TraceEvent[]` |
| `getCoAReleaseStatus` | `CoAReleaseStatus` |
| `getRiskSignals` | `readonly TraceRiskSignal[]` |
| `getRelatedInvestigations` | `readonly RelatedInvestigation[]` |

---

## Action Flows

| Action | Purpose | Phase |
|---|---|---|
| New Investigation | Raise a new investigation record | Phase 1 (mock) |
| Add Evidence | Attach evidence to an investigation | Phase 1 (mock) |
| Escalate | Escalate to a target role | Phase 1 (mock) |
| Resolve | Close an investigation with a resolution summary | Phase 1 (mock) |

All action flows validate required fields client-side and emit console telemetry in Phase 1. Real API mutation and notification dispatch are Phase 2 work.

---

## Drill-Through

| Label | Target Workspace | Target View |
|---|---|---|
| Open in Trace2 | `traceability-workspace` | `trace` |

---

## Personalization Policy

| Setting | Value |
|---|---|
| Allow panel reorder | Yes |
| Allow panel hide | Yes |
| Allow saved filters | Yes |
| Allow scope override | No |
| Max pinned panels | 6 |

---

## Routing

URL: `?workspace=trace-investigation&investigationId=INV-XXX&view=overview`

| Param | Description | Default |
|---|---|---|
| `workspace` | Always `trace-investigation` | — |
| `investigationId` | Investigation record ID | `INV-2024-003847` (mock) |
| `view` | Active view tab | `overview` |

---

## Assumptions

1. `investigationId` is a ConnectIO-RAD V2 concept mapping to a batch + reason code + initiator. In Phase 1 this is mock-only.
2. The Trace2 backend remains the system of record for batch lineage data. The adapter wraps it without replicating business logic.
3. CoA release status is sourced from SAP QM — `coa-release-status` panel is owned by the `quality` domain, not `traceability`.
4. Graph visualisation (React Flow) is deferred to Phase 2. Phase 1 renders a structured node list with risk indicators.
5. Recall workflow (approval routing, notification dispatch) is Phase 2.
6. User identity and permission checks are mocked — the real gate is enforced by the Databricks App proxy in production.
