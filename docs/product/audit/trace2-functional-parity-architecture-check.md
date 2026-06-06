# Architecture Regression Check — Trace2 Functional Parity Pass

**Audit date:** 2026-05-16  
**Triggered by:** Trace2 functional parity tranche (d.txt)

---

## Checklist

| # | Constraint | Status | Evidence |
|---|-----------|--------|----------|
| 1 | No direct shadcn/Radix imports outside design-system | **PASS** | No `@radix-ui/*` or shadcn imports in any new or modified file. Style is inline CSS only. |
| 2 | No new custom workspace shell | **PASS** | No new workspace created. All changes are within the existing `trace-investigation` workspace panels and views. |
| 3 | No panels rendering data outside EvidencePanel | **PASS** | `TraceGraphPanel` wraps all output in `<EvidencePanel>`. `MassBalancePanel` (view-local) likewise. |
| 4 | No new adapter bypassing AdapterResult | **PASS** | No new adapter files. `filterGraphByDirection` is a pure utility function operating on in-memory graph data. |
| 5 | No speculative APIs added | **PASS** | No new API proxy routes. Direction filtering and movements rendering are purely client-side against existing mock data. |
| 6 | No new phases, governance dashboards, or pilot tracking | **PASS** | All changes are UI additions within existing panels. |
| 7 | No claims of browser-verified data unless true | **PASS** | All panels remain `source: 'mock'` by default. No JSDoc claims browser verification for trace methods. |
| 8 | No replacement of working V1 behaviour with mock-only | **PASS** | `getBatchHeaderSummary()` legacy-api path is untouched. New features (direction toggle, edge detail, movements table) are additive. |
| 9 | No removal of the evidence-panel architecture | **PASS** | Both `TraceGraphPanel` and `MassBalancePanel` continue to use `useEvidencePanel` + `<EvidencePanel>` wrappers. |

---

## Files changed in this tranche

### Data contracts

| File | Change type | Regression surface |
|------|------------|-------------------|
| `packages/data-contracts/src/schemas/trace-investigation.ts` | Added `MassBalanceMovementSchema` + `movements` field on `MassBalanceSummarySchema` | Additive; existing schema fields unchanged; `movements` is optional |
| `packages/data-contracts/src/index.ts` | Added `MassBalanceMovement` + `MassBalanceMovementSchema` exports | Additive only |

### Traceability domain integration

| File | Change type | Regression surface |
|------|------------|-------------------|
| `domain-integrations/traceability/src/panels/trace-graph-utils.ts` | Added `filterGraphByDirection()`; strengthened `bfsLayout()` for empty/disconnected graphs | `bfsLayout` is backwards-compatible: existing callers get same output for connected graphs |
| `domain-integrations/traceability/src/panels/trace-graph-panel.tsx` | Added direction toggle, edge click + `SelectedEdgeDetail`, richer node detail, empty state | All additions; existing `SelectedNodeDetail` fields preserved |
| `domain-integrations/traceability/src/views/mass-balance-view.tsx` | Added `MovementsTable` component rendered when `data.movements` is present | Conditional; panels with no `movements` field are unaffected |
| `domain-integrations/traceability/src/adapters/trace2-mock-data.ts` | Added `movements` array to `mockMassBalance` | Mock data only; no adapter logic changed |

### Tests

| File | Change type |
|------|------------|
| `domain-integrations/traceability/src/panels/trace-graph-utils.test.ts` | Added 9 tests: `filterGraphByDirection` (7) + disconnected node BFS (2) |
| `domain-integrations/traceability/src/panels/trace-graph-panel.test.tsx` | Rewrote: 25 tests total covering node selection, edge selection, direction toggle, rendering states |

### Documentation

| File | Change type |
|------|------------|
| `docs/migration/trace2-functional-parity-audit.md` | New — full original Trace2 audit (pages, endpoints, gold views, gaps) |
| `docs/migration/trace2-functional-parity-matrix.md` | New — 40-capability parity matrix with status codes and remediation notes |
| `docs/migration/trace2-parity-remediation-backlog.md` | New — prioritised backlog (A/B/C tiers, 12 items) |
| `docs/domains/trace-investigation.md` | New — domain reference (views, adapters, data contracts, utilities, test coverage) |
| `docs/audit/trace2-functional-parity-architecture-check.md` | This file |

---

## Parity gaps closed in this pass

| Parity item | Matrix row | Before | After |
|-------------|-----------|--------|-------|
| Forward/reverse trace direction control | #3, #4, #5 | partially-preserved | improved — client-side direction filter + toggle UI |
| Mass balance per-day events | #13, #14 | missing | partially-preserved — schema + mock + movements table rendered |
| Edge detail / relationship | #9 | missing | improved — `onEdgeClick` + `SelectedEdgeDetail` with all fields |
| Richer node detail | #8 | degraded | improved — connected relationship list in `SelectedNodeDetail` |
| Cycle/disconnected node handling | #10 | partially-preserved | improved — disconnected nodes placed correctly; empty graph guard |

---

## Known limitations (not regressions)

- Direction filtering is client-side only; V1 used separate API calls per direction. Server-side direction filtering requires wiring the legacy-api adapter (Phase 2).
- Mass balance movements are mock-only; gold view `gold_batch_mass_balance_v` is required for live data.
- Depth control slider (#11, #37) is not yet implemented.
- Customer delivery detail table (#16) and supplier detail table (#19) remain missing.
