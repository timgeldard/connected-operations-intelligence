# Recommended Roadmap — Next Normal Development Cycle

**Audit date:** 2026-05-16  
**Basis:** Phase 9 audit findings from `08-technical-debt-register.md`, `09-operational-remediation-backlog.md`, and `10-architecture-remediation-backlog.md`

---

## Framing

This roadmap covers the work needed to move ConnectIO-RAD V2 from **prototype** (all mock data, zero backend calls, anonymous auth) to **production-credible pilot** (real auth, one wired domain, functional action flows, genuine telemetry). It does not plan a production rollout, hypercare, or wave deployment.

The roadmap is structured in three cycles. Each cycle produces a demonstrably better product.

---

## Cycle 1 — Foundation Wiring (6–8 weeks)

**Goal:** Replace the three critical blockers (auth, telemetry, one wired domain) and fix the highest-visibility placeholders.

| Item | Ref | Effort | Owner hint |
|------|-----|--------|------------|
| AR-006: Audit `apps/api` and document endpoint status | AR-006 | Low | Backend lead |
| AR-001: Implement Databricks Apps IdP auth | AR-001 | High | Platform / Security |
| AR-003: Register real telemetry handler | AR-003 | Low | Frontend |
| OP-007: Connect TelemetryDashboard to live events | OP-007 | Low | Frontend |
| OP-009: Switch navigation to `pushState` | OP-009 | Low | Frontend |
| OP-001: Wire RoleAwareHome to adapter data | OP-001 | Low | Frontend |
| OP-002: Replace TraceGraphPanel with React Flow | OP-002 | Medium | Frontend |
| OP-004: Replace BatchLineagePanel with tree graph | OP-004 | Medium | Frontend |
| AR-002: Wire Traceability adapter to FastAPI backend | AR-002 | Medium | Full stack |

**End state after Cycle 1:**
- Users log in with real identity; pilot-access group controls workspace visibility
- RoleAwareHome shows data consistent with workspace views (still mock, but consistent)
- Trace investigation displays a real interactive graph
- Traceability workspace fetches from a real FastAPI endpoint (or confirms the endpoint needs building)
- Telemetry is collected from real user navigation

---

## Cycle 2 — Operational Depth (6–8 weeks)

**Goal:** Upgrade the four remaining placeholder panels, wire the quality action flows, and begin wiring a second domain.

| Item | Ref | Effort | Owner hint |
|------|-----|--------|------------|
| OP-003: Wire batch release action flows to backend | OP-003 | Medium | Full stack |
| OP-005: Replace ControlChartPanel with recharts/nivo | OP-005 | Medium | Frontend |
| OP-006: Replace EnvMonHeatmapPanel with spatial layout | OP-006 | Medium | Frontend |
| AR-004: Implement remote feature flag source | AR-004 | Medium | Platform |
| AR-007: ESLint rule for design system boundary | AR-007 | Low | Frontend |
| AR-008: Retry and timeout in API client | AR-008 | Low | Frontend |
| Wire Quality domain adapter to FastAPI backend | AR-002 follow-on | Medium | Full stack |
| AR-009: Add adapter test coverage | AR-009 | Medium | Frontend / QA |

**End state after Cycle 2:**
- Batch release actions POST to backend; decision record created
- SPC control chart is interactive with tooltips and rule annotations
- EnvMon heatmap shows a spatial zone layout
- Feature flags are remotely configurable without a redeploy
- Quality workspace fetches from real data
- All adapters have test coverage

---

## Cycle 3 — Full Domain Coverage (12–16 weeks)

**Goal:** Wire all remaining domains; implement server-side personalisation; complete analytics domain definition.

| Item | Ref | Effort | Owner hint |
|------|-----|--------|------------|
| Wire Operations domain (plan risk + order review) | AR-002 follow-on | High | Full stack + SAP |
| Wire SPC domain | AR-002 follow-on | Medium | Full stack + Historian |
| Wire EnvMon domain | AR-002 follow-on | Medium | Full stack |
| Wire Warehouse domain (staging + 360) | AR-002 follow-on | High | Full stack + WMS |
| Wire Maintenance domain (SAP PM contract required) | AR-002 follow-on | High | Full stack + SAP PM |
| AR-005: Server-side personalisation persistence | AR-005 | Medium | Platform |
| AR-010: Define and implement analytics domain | AR-010 | High | Product + Full stack |
| OP-008: Replace parity/readiness page hardcoded data | OP-008 | Medium | Frontend |

**End state after Cycle 3:**
- All 9 workspaces fetch from real data sources
- Personalisation is durable across sessions and devices
- Analytics domain has a defined scope and pilot workspace
- Parity and readiness pages reflect live workspace state

---

## What this roadmap does NOT include

Consistent with Phase 9 rules, this roadmap explicitly excludes:

- Production launch planning
- Hypercare or decommission scheduling
- Wave rollout execution
- Release governance dashboards
- Enterprise operating model

These belong in a separate programme management track, not in the product roadmap.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| `apps/api` backend may not exist or may be a stub | Audit immediately (AR-006); do not assume endpoints are ready |
| SAP PM contract pending | Do not start Maintenance adapter wiring until contract is signed; keep adapter as mock |
| Manhattan WMS API varies by site | Plan for a per-site adapter configuration layer |
| Analytics domain scope undefined | Product decision required before any implementation starts |
| Auth integration complexity may delay Cycle 1 | Start AR-001 immediately; parallelise with other Cycle 1 items |
