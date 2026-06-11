# Phase 5 Workspaces — Pilot Onboarding Guide

## Overview

This guide covers onboarding the four Phase 5 pilot workspaces at Kerry Listowel (IE10):

1. **SPC Monitoring** — `spc-monitoring`
2. **Process Order Review** — `process-order-review`
3. **Warehouse 360 Overview** — `warehouse-360-overview`
4. **Maintenance & Reliability** — `maintenance-reliability`

All four carry `lifecycle: 'pilot'` and use mock data in Phase 5. They are navigable and visible in the nav rail and home screen from the Phase 5 release date.

---

## Prerequisites

- ConnectIO Phase 4 live at the target site (Trace Investigation, Quality Batch Release, Operations Plan Risk, Environmental Monitoring, Production Staging all operational)
- User accounts provisioned with appropriate roles (see per-workspace table below)
- Scope configuration for `plantId: 'IE10'` (and optionally `lineId` for SPC and Maintenance)

---

## Role Mapping

| Workspace | Required Roles |
|---|---|
| SPC Monitoring | `process-engineer`, `quality-technician`, `quality-lead` |
| Process Order Review | `production-supervisor`, `quality-lead`, `operations-manager` |
| Warehouse 360 Overview | `warehouse-manager`, `inventory-controller`, `logistics-coordinator` |
| Maintenance & Reliability | `maintenance-manager`, `reliability-engineer`, `maintenance-technician` |

---

## Permission Requirements

| Workspace | Required Permission |
|---|---|
| SPC Monitoring | `spc.monitoring.read` |
| Process Order Review | `operations.process-order.read` |
| Warehouse 360 Overview | `warehouse.overview.read` |
| Maintenance & Reliability | `maintenance.overview.read` |

---

## Phase 5 Mock Data Scope

All Phase 5 workspaces use mock data representing Kerry Listowel IE10 as of March 2024. The mock data includes:

| Workspace | Mock Data Summary |
|---|---|
| SPC Monitoring | 3 active signals, 4 characteristics, 6 control chart series, 3 related batches |
| Process Order Review | 1 process order (PO-IE10-2024-03127), 6 timeline steps, yield context, quality context |
| Warehouse 360 Overview | WH-IE10-MAIN: 347 stock lines, 4 zones, 3 open holds, 5 goods movements, 5 replenishment needs |
| Maintenance & Reliability | 14 open work orders, 5 PM tasks, 4 equipment availability records, 3 reliability metrics |

---

## Data Integration Roadmap (Post-Pilot)

| Workspace | Data Source | Integration Phase | Notes |
|---|---|---|---|
| SPC Monitoring | Historian / SPC Engine | Phase 6 | OPC-UA or REST adapter to be scoped |
| Process Order Review | SAP PP / MES | Phase 6 | Process order API available in existing ERP layer |
| Warehouse 360 Overview | SAP EWM / WMS | Phase 6 | EWM stock and movement APIs — design complete |
| Maintenance & Reliability | SAP PM / CMMS | Phase 6 | PM work order API — contract being finalised |

---

## Accessing the Workspaces

All four workspaces are accessible via the standard workspace navigation:

```
?workspace=spc-monitoring
?workspace=process-order-review
?workspace=warehouse-360-overview
?workspace=maintenance-reliability
```

Or navigate using the workspace grid on the home screen (`My Work`).

The admin **Legacy Retirement Readiness** dashboard is accessible at:
```
?workspace=admin-legacy-retirement
```

---

## Known Phase 5 Limitations

- All data is mock — changes made via action panels (raise maintenance request, request replenishment, etc.) log to the browser console only and do not persist
- The Process Order Review workspace is scope-agnostic in Phase 5 — it always shows the same mock order regardless of `processOrderId` in scope
- SPC control chart rendering is static — no interactive zoom or point inspection
- Maintenance backlog items are hardcoded — no filtering by equipment ID or priority

These limitations will be addressed in Phase 6 when live data integrations are connected.
