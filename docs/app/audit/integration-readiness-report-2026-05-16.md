# Integration-Readiness Audit Report

**Date:** 2026-05-16  
**Scope:** Post-commit consistency audit covering Trace2, SPC, Warehouse, POH, ADR-024, and OAuth-rule commits  
**Auditor:** h.txt task

---

## 1. Contradictions Found and Fixed

### 1.1 `docs/adapters/adapter-migration-strategy.md` — current state table

| Field | Was | Fixed to |
|-------|-----|---------|
| Column header | "Verified methods" | "Legacy-api overrides" (verified conflated wired with tested) |
| Quality row | "none — no legacy adapter yet" | `ConnectedQualityLabLegacyApiAdapter` with `getLabFailures`, `getLabPlants` |
| Operations (POR) "remaining on mock" | 6 methods | 9 methods (g.txt added 3 new mock methods) |
| Warehouse "remaining on mock" | 6 methods | 8 methods (adapter has 9 total methods, 1 wired) |
| Trace "remaining on mock" | 9 methods | 10 methods (adapter has 11 total methods, 1 verified) |
| Databricks-api TODO comment | No ADR reference | Added reference to ADR-024 + module migration order |
| Footnote | absent | Added: only `getBatchHeaderSummary` is browser-verified; all others are wired |

### 1.2 `docs/adapters/mock-legacy-databricks-modes.md` — overridden methods table

| Field | Was | Fixed to |
|-------|-----|---------|
| Section header | "Currently overridden methods (browser-verified)" | Split into "Browser-verified" and "Wired but not browser-verified" sections |
| CQ lab methods | absent | Added `getLabFailures` (`GET /api/cq/lab/fails`) and `getLabPlants` (`GET /api/cq/lab/plants`) to wired section |
| Env var `V1_CQ_API_BASE_URL` | absent from table | Added to environment variable reference table |

### 1.3 `AGENTS.md` — FastAPI proxy section

| Field | Was | Fixed to |
|-------|-----|---------|
| Route list header | "Currently verified proxy routes (browser-tested against V1)" — implied all 3 routes were verified | Split into "Browser-verified" (1 route: Trace) and "Wired but not browser-verified" (4 routes: WH360, POH, CQ ×2) |
| CQ routes | absent | Added both CQ routes to wired section |

### 1.4 `CLAUDE.md` — missing Claude-facing rules

| Rule | Was | Fixed to |
|------|-----|---------|
| Functional preservation first | absent | Added to new "Code Modification Rules" section |
| No speculative proxy routes | absent | Added (with wired-not-verified clarification) |
| No mock-only parity claims | absent | Added |
| No hardcoded mature-domain behaviour | absent | Added |

---

## 2. Final Verified Route List

Only one proxy route is browser-verified (tested end-to-end against a live V1 backend):

| Route | Method | Domain | Verified |
|-------|--------|--------|---------|
| `/api/trace2/batch-header` | POST | Traceability | ✓ 2024-03-08 |

Wired routes (proxy + adapter exist but not browser-verified):

| Route | Method | Domain |
|-------|--------|--------|
| `/api/wh360/warehouse-summary` | POST | Warehouse360 |
| `/api/por/order-header` | POST | POH |
| `/api/cq/lab/fails` | GET | Quality/Lab |
| `/api/cq/lab/plants` | GET | Quality/Lab |

---

## 3. Final Adapter Status Matrix

See `docs/audit/adapter-source-status-matrix.md` for the complete per-method matrix.

Summary across all domains:
- **Total methods:** 50
- **Browser-verified legacy-api:** 1 (`getBatchHeaderSummary`)
- **Wired legacy-api (not verified):** 4 (`getWarehouse360Summary`, `getProcessOrderHeader`, `getLabFailures`, `getLabPlants`)
- **Mock only:** 45
- **Databricks-api:** 0

---

## 4. Databricks-API Implementation Readiness

From ADR-024 analysis:

| Prerequisite | Location / Decision | Status |
|---|---|---|
| **QuerySpec package** | `apps/api/` — extend `shared_db` wheel already deployed as a wheel in the V2 backend | Pending implementation |
| **QueryExecutor package** | `apps/api/` — extend `shared_db` with caching, tagging, and metrics | Pending implementation |
| **User OAuth token access path** | `UserIdentity.raw_token` forwarded from Databricks Apps OAuth proxy → FastAPI → QueryExecutor | Architecture confirmed in ADR-024; implementation pending |
| **Cache backend decision** | ADR-024 open question #7: in-process LRU dict vs. external Redis (Lakebase). In-process is simpler for first implementation | **Open — decision needed before implementation** |
| **Statement API vs SQL Connector** | ADR-024 open question #1: Statement API is async-native (10MB limit); Connector is synchronous (larger results, server-side cursors) | **Open — decision needed before implementation** |
| **First module candidate** | Trace batch header (see section 5 below) | Recommended |
| **Required gold views — Trace** | `gold_batch_material`, `gold_process_order`, `gold_adp_movement` — all available in `connected_plant_uat` | ✓ Available |
| **Required gold views — POH** | `vw_gold_order_summary`, `metric_yield_per_order`, `metric_yield_daily`, `vw_gold_day_view_blocks` — all available | ✓ Available |
| **Required gold views — Quality/Lab (partial)** | `vw_gold_quality_result_enriched` available; `vw_gold_process_order_plan` **missing** | ⛔ Blocked |

**Hard blockers before any databricks-api implementation:**
1. Decide Statement API vs SQL Connector (open question #1)
2. Decide in-process vs external cache (open question #7)
3. Define and locate the QuerySpec dataclass
4. Define and locate the QueryExecutor class (likely `apps/api/shared_db_v2/`)

---

## 5. Recommended First Native Databricks Vertical Slice

**Recommendation: Trace batch header (`getBatchHeaderSummary`)**

Ranking of the five candidates:

| Candidate | Complexity | Semantic clarity | Gold view availability | Value | Risk | Parallel validation | Score |
|---|---|---|---|---|---|---|---|
| **Trace batch header** | Low | High | ✓ All available | High | **Low** | ✓ Verified leg-api exists | **1st** |
| POH order header | Medium | High | ✓ All available | High | Medium | Partial (leg-api wired, not verified) | 2nd |
| SPC active signals | High | Medium | ✓ MVs exist | Medium | Medium | None (no legacy-api) | 3rd |
| CQ Lab failures | Medium | Medium | ⛔ Blocked (`vw_gold_process_order_plan` missing) | Medium | High (blocker) | Partial | 4th |
| Warehouse summary | High | Low | ✓ Complex view stack | Medium | High (separate schema) | Partial | 5th |

**Why Trace batch header:**

1. **Lowest risk** — `getBatchHeaderSummary` is the only browser-verified legacy-api method. A live V1 response exists to compare against during parallel validation. All other candidates lack a verified baseline.
2. **Simplest queries** — ADR-024 describes Trace as "lookups and graph traversals. Minimal refactoring needed beyond wrapping in QuerySpec."
3. **Gold tables available** — `gold_batch_material`, `gold_process_order`, `gold_adp_movement` are all in `connected_plant_uat`. No missing views.
4. **Builds QuerySpec/QueryExecutor infrastructure** — once Trace is live, the shared infrastructure serves all subsequent modules with zero additional framework work.
5. **Validates parallel testing harness** — the verified legacy-api makes it the ideal module to confirm that the parity test framework (ADR-024 §7) correctly catches response shape regressions.

**POH is the highest-value target** (ADR-024 migration priority #1 by business value) but its legacy-api has never been browser-verified, making parallel validation harder. Deliver Trace first to prove the infrastructure, then POH.

---

## 6. Remaining Doc Drift Risks

| Risk | Affected docs | Severity |
|---|---|---|
| Wired routes may be promoted to "verified" without testing | `AGENTS.md`, `adapter-migration-strategy.md` | Medium — mitigated by explicit "wired" label added in this audit |
| `adapter-migration-strategy.md` method counts drift as new methods are added | `adapter-migration-strategy.md` | Low — the matrix in `adapter-source-status-matrix.md` is now the authoritative count |
| `docs/adapters/poh-adapter-migration-strategy.md` still refers to POR as having "6 remaining on mock" (pre-g.txt) | `poh-adapter-migration-strategy.md` | Low — superseded by this audit matrix |
| If `vw_gold_process_order_plan` is created, the Quality/Lab blocker row in this document and the matrix will become stale | This report, matrix | Low — reader should re-check before starting Quality/Lab databricks-api slice |
| ADR-024 open questions #1 (Statement API vs Connector) and #7 (cache backend) will produce new constraints; those decisions must be reflected in `mock-legacy-databricks-modes.md` when made | `mock-legacy-databricks-modes.md` | Medium |
| `docs/adapters/warehouse-adapter-migration-strategy.md` and `docs/adapters/spc-adapter-migration-strategy.md` do not reference ADR-024 | Domain-level adapter docs | Low — add ADR-024 reference when those modules enter databricks-api planning |

---

## 7. Blockers Before First databricks-api Implementation

In priority order:

1. **Decide Statement API vs SQL Connector** (ADR-024 open question #1) — this decision gates the QueryExecutor implementation.
2. **Decide cache backend** (ADR-024 open question #7) — in-process LRU vs Redis/Lakebase.
3. **Implement `QuerySpec` dataclass** in `apps/api/` (extend `shared_db` wheel).
4. **Implement `QueryExecutor` class** in `apps/api/` with execution, caching, and tagging.
5. **Write integration test harness** — confirms databricks-api adapter returns shapes matching legacy-api (parity tests per ADR-024 §7).
6. **Browser-verify `getWarehouse360Summary` and `getProcessOrderHeader`** — not required for Trace, but needed before Warehouse and POH can use parallel validation.
7. **Create `vw_gold_process_order_plan`** in `csm_process_order_history` — required before Quality/Lab databricks-api adapter can go live for `getLabFailures`.

Items 1–5 are required before ANY databricks-api adapter method can be implemented. Items 6–7 are module-specific prerequisites.
