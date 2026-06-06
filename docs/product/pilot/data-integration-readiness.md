# Data Integration Readiness

**Phase:** 7  
**Last updated:** 2026-05-15  
**Admin view:** `?workspace=admin-pilot-data-integration`

## Overview

The Data Integration Readiness Matrix tracks the status of each source capability feeding the pilot workspaces. Status values follow `DataIntegrationStatus`: `mocked | adapter-backed | source-integrated | not-started | blocked`. No source capability has reached `source-integrated` status; the pilot runs on `adapter-backed` and `mocked` data.

---

## The 10 Source Capabilities

| Source Capability | Source System | Adapter | Status | Contract Coverage | Freshness | Confidence |
|---|---|---|---|---|---|---|
| Trace2 source | Intelex / Trace2 | TraceAdapter | adapter-backed | full | Yes | Yes |
| SPC source | SPC Platform (TBD) | SPCAdapter (mock) | mocked | partial | No | No |
| EnvMon source | EnvMon Platform | EnvMonAdapter | adapter-backed | partial | Yes | No |
| POH / Process Order source | SAP ERP (POH) | OperationsAdapter | adapter-backed | partial | Yes | No |
| Warehouse360 / WM source | Manhattan WM | WarehouseAdapter (partial) | adapter-backed | partial | Yes | No |
| Quality / inspection source | LabWare LIMS | QualityAdapter | adapter-backed | full | Yes | Yes |
| Maintenance source | SAP PM | MaintenanceAdapter (mock) | mocked | partial | No | No |
| Dashboard / query source | Internal API Gateway | QueryAdapter | adapter-backed | full | Yes | No |
| Auth / session / scope source | Azure AD | AuthScopeProvider | adapter-backed | full | No | No |
| Telemetry source | Internal Telemetry (mock) | TelemetryHandler | mocked | partial | No | No |

**Breakdown:** 0 source-integrated, 7 adapter-backed, 3 mocked.

---

## Known Gaps by Source

**Trace2 source** — Trace graph depth beyond 3 levels causes performance degradation. Owner: traceability-domain.

**SPC source** — SPC source connector not available; control chart data is static mock only; freshness/confidence not wired. Owner: quality-domain. Next action: Confirm SPC source system and begin connector development.

**EnvMon source** — Threshold config hardcoded — no source-driven override; confidence scoring not available from source. Owner: quality-domain. Next action: Request threshold config API from EnvMon platform team.

**POH / Process Order source** — PhaseManager integration pending for operations actions; action audit log not persisted. Owner: operations-domain. Next action: Confirm PhaseManager integration scope and timeline.

**Warehouse360 / WM source** — Warehouse 360 full inventory integration pending; hold release approval not yet implemented. Owner: warehouse-domain. Next action: Complete Warehouse 360 full integration contract with WM team.

**Quality / inspection source** — CoA generation API not wired — returns mock data; deviation tracking partial. Owner: quality-domain. Next action: Wire CoA generation API from LabWare before production.

**Maintenance source** — SAP PM source contract not signed; all maintenance data is mock-only; no live work order feed. Owner: maintenance-domain. Next action: Sign SAP PM source contract and begin adapter development.

**Dashboard / query source** — Cross-domain query aggregation not yet optimised for plant-scope queries. Owner: platform-engineering.

**Auth / session / scope source** — Role claims not yet enforced at API level — client-only in pilot. Owner: platform-engineering. Next action: Implement server-side role claim enforcement before production.

**Telemetry source** — Telemetry events not persisted to backend; aggregation is front-end mock only; no real analytics pipeline. Owner: platform-engineering. Next action: Design telemetry pipeline for pilot event capture.

---

## What Needs to Happen for Production

The following integrations must advance from `mocked` or `adapter-backed` to `source-integrated` before production:

1. **SPC source** — Source system must be identified and connector development completed. Data contract must reach `full` coverage. Freshness and confidence wiring required.
2. **Maintenance source** — SAP PM contract must be signed. Adapter development can begin only after contract is in place.
3. **Telemetry source** — Backend pipeline must be designed and deployed. Front-end mock telemetry is not suitable for production monitoring.
4. **Auth / scope source** — Server-side role claim enforcement must replace the current client-only model.
5. **Quality / inspection source** — CoA generation API must be wired from LabWare; deviation tracking must be completed.
6. **Warehouse360 / WM source** — Full inventory integration contract must be finalised with the Manhattan WM team.

The `DataIntegrationStatus` value `source-integrated` is the production-ready state. All sources must reach `source-integrated` before GATE-003 (Data Contract Gate) can pass.
