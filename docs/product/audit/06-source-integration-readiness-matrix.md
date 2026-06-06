# Source Integration Readiness Matrix — ConnectIO-RAD V2

**Audit date:** 2026-05-16

---

## Readiness scale

| Level | Description |
|-------|-------------|
| **Ready to wire** | Async adapter pattern complete, data contracts defined, FastAPI endpoint implemented in backend |
| **Backend not built** | Adapter pattern complete, data contracts defined, endpoint path referenced in adapter comments; FastAPI route file does not exist |
| **Partially ready** | Adapter pattern complete, data contracts defined; FastAPI endpoint not documented or named |
| **Contract pending** | Adapter pattern complete; real source system contractual or access dependency outstanding |
| **Not started** | Domain is a Phase 0 stub; no adapter, no data contract |

---

## Integration readiness by domain

| Domain | Target Source System(s) | Data Contract (Zod schema) | Adapter Pattern | FastAPI Endpoint Referenced | Real-World Dependency | Readiness |
|--------|------------------------|---------------------------|-----------------|-----------------------------|-----------------------|-----------|
| Traceability | SAP-based lineage system / Intelex | `data-contracts/src/trace-investigation.ts` | `Trace2Adapter` — 10 async methods; `simulatedDelayMs` option | `/api/trace2/*` (referenced in `trace2-adapter.ts` lines 77–87; route file `apps/api/routes/trace2.py` does **not exist**) | Intelex access or SAP lineage API; FastAPI route must be built first | **Backend not built** |
| Quality | LabWare LIMS | `data-contracts/src/batch-release.ts` | `QualityReleaseAdapter` (7 methods) + `QualityBlockersAdapter` (2 methods); `simulatedDelayMs` option | None named; comment: "will replace each method body with a `fetchJson` call to the FastAPI backend" | LabWare LIMS API access | **Partially ready** |
| Operations (plan risk) | SAP ERP + Rockwell PhaseManager | `data-contracts/src/operations-plan-risk.ts` | `OperationsPlanRiskAdapter` — 9 async methods | None named | SAP ERP RFC/API and PhaseManager API access | **Partially ready** |
| Operations (evidence) | SAP ERP / POH backend | `data-contracts/src/operations-plan-risk.ts` | `OperationsEvidenceAdapter` — 1 method; comment: "Phase 2 will query the POH backend using `processOrderId` and `batchId`" | POH backend (named in comment `operations-evidence-adapter.ts` lines 8–10) | POH backend availability | **Partially ready** |
| Operations (order review) | SAP ERP + Rockwell PhaseManager | `data-contracts/src/process-order-review.ts` | `ProcessOrderReviewAdapter` — 7 async methods | None named | Same as plan risk | **Partially ready** |
| SPC | Historian / LabWare SPC | `data-contracts/src/spc-monitoring.ts` | `SPCMonitoringAdapter` (7 methods) + `SPCSignalsAdapter` (1 method) | None named | Historian OPC/API access; LabWare SPC API | **Partially ready** |
| EnvMon | Existing EnvMon system / Excel-SharePoint (to be retired) | `data-contracts/src/environmental-monitoring.ts` | `EnvMonAdapter` — 9 async methods | None named | Source system access; Excel retirement plan | **Partially ready** |
| Warehouse (evidence + staging + 360) | Manhattan WMS / SAP EWM | `data-contracts/src/production-staging.ts` + `warehouse-360-overview.ts` | 4 adapters — 18 total methods | None named | Manhattan WMS API or SAP EWM API; contract pending for some sites | **Contract pending** |
| Maintenance | SAP PM | `data-contracts/src/maintenance-reliability.ts` | `MaintenanceReliabilityAdapter` (7 methods) + `MaintenanceConstraintsAdapter` (1 method) | None named | SAP PM API contract not yet finalised (per `StakeholderSignoffPage` mock data: SO-004 not-requested due to contract) | **Contract pending** |
| Analytics | N/A — undefined | None | None (lifecycle: `concept-lab`) | None | None | **Not started** |

---

## FastAPI backend assessment

The `apps/api` FastAPI backend has been audited. It has **three stub endpoints** and **zero domain-specific routes**.

| Backend component | Status |
|---|---|
| FastAPI app (`apps/api/main.py`) | Running; CORS configured for localhost:4200; mounts 3 routers |
| `GET /health` | Stub — returns `{"status": "ok", "service": "connectio-api"}` |
| `GET /api/auth/session` | Stub — returns a hardcoded user identity from a request header; no token validation |
| `GET /api/workspaces/manifest` | Stub — returns `_STATIC_MANIFEST`, a hardcoded fixture |
| `/api/trace2/*` | **Does not exist** — route file `apps/api/routes/trace2.py` is absent |
| All other domain endpoints | **Do not exist** — no routes for quality, operations, SPC, EnvMon, warehouse, or maintenance |
| `packages/python-db` (shared_db) | Imported as a dependency in the FastAPI app; never used by any route handler |
| API client (`data-contracts/src/client.ts`) | Implemented (`fetchJson`, `createApiClient`); zero callers in the entire codebase |
| Adapter-to-API wiring | Zero connections; all 79 adapter methods return mock fixtures |

**Critical finding:** The backend is a near-empty stub. Wiring any domain adapter requires building the FastAPI routes from scratch. The adapter comments referencing endpoint paths (e.g. `/api/trace2/*`) describe the intended design, not implemented routes.

---

## Prerequisite dependencies for each domain

| Domain | Prerequisite | Current status |
|--------|-------------|----------------|
| Traceability | `/api/trace2/*` FastAPI endpoints; Intelex or SAP lineage credentials | Endpoint path referenced in adapter comments; route file does not exist — must be built |
| Quality | LabWare LIMS API credentials and endpoint mapping | Not documented |
| Operations | SAP ERP RFC or REST; PhaseManager API | Not documented |
| SPC | Historian endpoint; control chart data model | Not documented |
| EnvMon | Source system API or ETL pipeline from Excel | Not documented; Excel retirement planned |
| Warehouse | Manhattan WMS or SAP EWM API; site-specific config | Contract status variable by site |
| Maintenance | SAP PM API contract | Explicitly pending (per mock data) |
| Analytics | Source system not defined | Undefined |

---

## Integration effort estimates

| Domain | Adapter method count | Estimated wiring effort | Key risk |
|--------|---------------------|------------------------|----------|
| Traceability | 10 | Medium-High — FastAPI route must be built from scratch; adapter surface ready; backend does not exist | `/api/trace2/*.py` must be authored before any wiring; data model alignment with Intelex |
| Quality | 9 | Medium — no endpoint named; LabWare API complexity | CoA data completeness |
| Operations (plan risk) | 9 | Medium-High — two source systems; SAP ERP RFC complexity | PhaseManager integration stability |
| Operations (evidence) | 1 | Low — single method; POH backend named | POH backend availability |
| Operations (order review) | 7 | Medium — same source systems as plan risk | Batch-level data granularity |
| SPC | 8 | Medium — Historian access; control chart data serialisation | Rule engine implementation |
| EnvMon | 9 | Medium — depends on source system; may require ETL | Excel migration path |
| Warehouse | 18 | High — 4 adapters, 2 possible source systems, site variance | WMS contract and API stability |
| Maintenance | 8 | High — SAP PM contract outstanding | Contract timeline |
| Analytics | 0 | Very high — undefined domain | Scope definition required |
