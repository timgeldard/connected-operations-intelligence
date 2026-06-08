# Process Order Review Workspace

## Purpose

The **Process Order Review** workspace is a Phase 5 addition to the operations domain. It gives production supervisors, quality leads, and operations managers a complete, order-centric view of a process order's execution: planned vs. actual timelines, yield losses, quality context, staging status, and related batches.

A production supervisor should think:

> "Show me everything about this process order — how it ran, what happened at each stage, where yield was lost, and whether the quality and warehouse context is clean for release." — not "Check the MES for execution data, LIMS for quality results, WMS for staging status."

The workspace is owned by `di-operations` within the `operations` domain. In Phase 5 it connects to mock data representing Kerry Listowel (IE10) process orders.

---

## Workspace Metadata

| Field | Value |
|---|---|
| workspaceId | process-order-review |
| displayName | Process Order Review |
| domainId | operations |
| ownerDomain | operations |
| lifecycle | pilot |
| route | /operations/process-order-review |
| telemetryId | operations.process-order-review |

---

## Supported Roles

- production-supervisor
- quality-lead
- operations-manager
- plant-manager
- process-engineer

---

## Required Permissions

| Permission ID | Description |
|---|---|
| `operations.process-order.read` | View process order header, execution timeline, yield losses, and quality context |

---

## Supported Scopes

- `plant` (default)
- `line`
- `processOrder` — scoped directly to a specific process order

---

## Views

### 1. Order Overview (`order-overview`)

Default landing view. Shows the process order header with key execution metrics alongside the execution progress summary.

**Panels:** Process Order Header, Order Progress Summary

### 2. Execution Timeline (`execution-timeline`)

Step-by-step execution record with planned vs. actual timestamps, duration, and status for each process step.

**Panels:** Execution Timeline, Process Order Header

### 3. Yield & Losses (`yield-losses`)

Yield summary broken down by loss category — trim, waste, rework, and unaccounted variance.

**Panels:** Order Progress Summary, Execution Timeline

### 4. Quality Context (`quality-context`)

All quality results linked to this order: MIC status, SPC signals, deviations, and CoA readiness.

**Panels:** Order Quality Context, Process Order Header

### 5. Staging Context (`staging-context`)

Material staging status for this order — components issued, shortfalls, and warehouse holds.

**Panels:** Order Staging Context, Process Order Header

### 6. Related Batches (`related-batches`)

Batches produced by this order with disposition status and traceability links.

**Panels:** Related Batches Context, Order Progress Summary

---

## Panels

| Panel ID | Owner Domain | Description |
|---|---|---|
| `process-order-header` | operations | Order ID, material, plant, line, planned vs. actual dates, status, batch yield |
| `order-progress-summary` | operations | Completion %, yield %, planned vs. actual duration, deviation count, confidence |
| `execution-timeline` | operations | Timestamped execution steps with planned/actual times and status badges |
| `order-quality-context` | operations | MIC results, SPC signal count, deviation count, CoA readiness, quality disposition |
| `order-staging-context` | operations | Component staging status, shortfall count, open holds, warehouse reference |
| `related-batches-context` | operations | Batches produced by this order with disposition and trace link |

---

## Action Flows

| Action | Trigger | Description |
|---|---|---|
| Raise Deviation | Raise Deviation button | Records a process deviation against this order with category, description, and impact |
| Request Quality Review | Request Quality Review button | Escalates quality context for formal QA review |
| Open Batch Release | Link action | Navigates to Quality Batch Release workspace for the linked batch |
| Open Trace Investigation | Link action | Navigates to Trace Investigation workspace for a related batch |

---

## Drill-Through Targets

| Label | Target Workspace | Target View | Context |
|---|---|---|---|
| Open Batch Release | quality-batch-release | batch-decision | batch, processOrder |
| Open Trace Investigation | trace-investigation | overview | batch |

---

## Data Source

**MES / ERP** (mock data in Phase 5) — `systemName: mes`. Represents process order execution data for Kerry Listowel IE10.
