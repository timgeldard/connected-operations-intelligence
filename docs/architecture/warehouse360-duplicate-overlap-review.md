# Warehouse360 — Duplicate / Overlap Review & Governed-Path Status

**Date:** 2026-06-07 · **Scope:** Warehouse360 (the most-migrated domain) · **Status:** PR 1 deliverable
(documentation + duplicate matrix). Live validation is **read-only**; no repo logic, resolver, or
Databricks object was changed.

## Evidence grades

Every claim below is tagged:

- **[DBX]** confirmed first-hand by a read-only query this session (UAT warehouse `e76480b94bea6ed5`
  / DEV warehouse `8fae28f1808dbf75`, 2026-06-07).
- **[REPO]** confirmed first-hand by reading the file (path:line given).
- **[SUB]** reported by an exploration subagent, **not yet personally verified** — treat as a lead.
- **[INF]** inference from the above, not directly observed.

---

## 1. Executive summary

The Warehouse360 "duplicate problem" is **not a cleanup task — it is that the governed path was never
built**. The app serves today entirely from the **legacy `connected_plant_uat.wh360` schema** (15 live
views); the governed `vw_consumption_warehouse360_*` views and the `gold_io_reporting` serving schema
**do not exist in UAT at all**. So the two "duplicates" (legacy vs governed) never co-exist at runtime —
one is live, the other is repo-only.

- **Can the app run fully in governed contract mode today? No. [DBX]** Zero `vw_consumption_warehouse360_*`
  views exist in UAT (or DEV); `WAREHOUSE360_SOURCE_MODE=governed_contracts` would fail at query time.
  Only `legacy_wh360` works, reading `connected_plant_uat.wh360.*`.
- **State of the duplicate problem:** legacy-vs-governed overlap is **specification-only** and gated by
  the existing **0/7 gold blocker** (gold pipeline won't compile — see §4). Two *genuine in-repo*
  duplicates do exist and are independently actionable (duplicate gold dataset definitions, §4).
- **Biggest risks:** (1) the duplicate gold definitions block the entire gold build, which blocks the
  governed views, which blocks contract validation — a single chain; (2) the governed `overview` view is
  a **re-grain** of the legacy KPI snapshot (global → per-plant+snapshot), i.e. real modelling work, not
  a rename; (3) the legacy adapter's plant filter is **conditional on the request**, not a server-enforced
  entitlement join — an entitlement gap to validate before any production claim.

---

## 2. Databricks live validation (Phase 3) — governed path vs the legacy reality

### 2.1 Governed objects — absent

| Object family | UAT | DEV | Evidence |
|---|---|---|---|
| `gold_io_reporting` schema | **absent** (only `gold`, `gold_test`, `silver`, `wh360`) | present (bootstrap) | [DBX] |
| `vw_consumption_warehouse360_*` views | **0 found** | **0 found** | [DBX] |
| `vw_genie_*` views | 0 found | — | [DBX] (also: no `CREATE vw_genie_*` anywhere in repo [SUB]) |

⟹ All 8 `warehouse360.*` contracts resolve to a `source_view` that **does not exist**. No column/PK/
freshness profiling of the governed views is possible until they are built. This is consistent with the
prior-session finding that WH360 is **0/7** (gold not built; consumption views not deployed).

### 2.2 Legacy views the app actually reads (`connected_plant_uat.wh360`, 15 views) [DBX]

The five backing the route-covered contracts, profiled 2026-06-07:

| Legacy view | Backs contract | Rows | Distinct plants | plant_id | Note |
|---|---|---:|---:|---|---|
| `wh360_kpi_snapshot_v` | `warehouse360.overview` | 1 | — | **no plant_id / no snapshot_ts** | global single-row KPI |
| `wh360_inbound_v` | `warehouse360.inbound_backlog` | 18,834 | 1 | yes | pilot-plant scoped |
| `wh360_deliveries_v` | `warehouse360.outbound_backlog` | 1 | 1 | yes | nearly empty |
| `wh360_process_orders_v` | `warehouse360.staging_workload` | 23 | 1 | yes | pilot-plant scoped |
| `imwm_exceptions_v` | `warehouse360.im_wm_reconciliation` | 1,051,919 | **331** | yes | **unfiltered across all plants** |

Full legacy schema (15): `wh360_kpi_snapshot_v, wh360_inbound_v, wh360_deliveries_v,
wh360_process_orders_v, wh360_transfer_orders_v, wh360_transfer_requirements_v, wh360_bin_stock_v,
wh360_lineside_stock_v, wh360_near_expiry_batches_v, wh360_dispensary_tasks_v, wh360_handling_units_v,
imwm_exceptions_v, imwm_movements_v, imwm_stock_comparison_v, imwm_analytics_aging_v`. [DBX]

### 2.3 Two findings that change the migration shape

- **`overview` is a re-grain, not a rename. [DBX]** `wh360_kpi_snapshot_v` is a single global row with no
  `plant_id`/`snapshot_ts`; contract `warehouse360.overview` declares PK `[plant_id, snapshot_ts]`. The
  governed view must compute per-plant snapshots — genuine modelling, must be validated against the
  legacy global totals.
- **Entitlement is request-conditional, not enforced. [REPO]**
  `warehouse360_databricks_adapter.py` adds `WHERE plant_id = :plant_id` **only when `request.plant_id`
  is supplied** (lines 258-260, 475-477, 636-638, 843-845). `imwm_exceptions_v` spans 331 plants /
  ~1.05M rows; a request omitting `plant_id` returns all of them. The governed contracts specify
  row-level entitlement via `published.central_services.user_plant_access`, but the legacy serving path
  does not join it. **Validate whether an upstream layer enforces plant scope before any prod claim.**

---

## 3. Route → data access map (Phase 4, condensed) [SUB + REPO]

`WAREHOUSE360_SOURCE_MODE` (mandatory; `legacy_wh360` | `governed_contracts`) selects the source per
QuerySpec. Resolver: `apps/api/shared/query_service/object_resolver.py` (`wh360` domain →
`WH360_CATALOG`/`WH360_SCHEMA`, default schema `wh360`, **no fallback**).

| Route family | QuerySpec | Governed source_view (absent) | Legacy view (live) | Source mode that works |
|---|---|---|---|---|
| overview | `get_warehouse_overview_spec` | `vw_consumption_warehouse360_overview` | `wh360_kpi_snapshot_v` | legacy only [DBX] |
| inbound | `get_warehouse_inbound_spec` | `…_inbound_backlog` | `wh360_inbound_v` | legacy only |
| outbound | `get_warehouse_outbound_spec` | `…_outbound_backlog` | `wh360_deliveries_v` | legacy only |
| staging | `get_warehouse_staging_spec` | `…_staging_workload` | `wh360_process_orders_v` | legacy only |
| exceptions | `get_warehouse_exceptions_spec` | `…_im_wm_reconciliation` | `imwm_exceptions_v` | legacy only |

Contract coverage [SUB]: 5 contracts route-covered (above); `stock_exceptions` + `shortfalls` are
**contract-only** (no route); `dispensary_queue` is a **placeholder (not runtime-ready)**. All 8
contracts are `lifecycle: draft`.

Answers to the Phase-4 questions:
1. **App fully governed?** No — governed views absent [DBX].
2. **Routes still on legacy?** All 5 (it is the only working mode) [DBX].
3. **Partially migrated?** None at runtime; the *adapter code* is migration-ready (branches both modes) [SUB].
4. **Contracts defined but not runtime-covered?** 3 (`stock_exceptions`, `shortfalls`, `dispensary_queue`) [SUB].
5. **Routes returning uncontracted fields?** Legacy views expose extras absent from contracts (e.g.
   `wh360_inbound_v.doc_cat/delivery_complete/qa_lot_id`); the governed-mode adapter is reported to drop
   them to match the contract [SUB — verify when governed mode is exercised].

---

## 4. Duplicate / overlap matrix

| # | Domain | Concept | Legacy / duplicate path | Governed / canonical path | Evidence | Risk | Recommendation | Needs DBX validation? |
|---|---|---|---|---|---|---|---|---|
| 1 | WH360 | Whole serving layer | `connected_plant_uat.wh360.*` (15 views, live) | `vw_consumption_warehouse360_*` in `gold_io_reporting` (repo-only, **absent**) | [DBX] views absent; legacy live | High (governed path unbuilt) | **Build governed, validate vs legacy, then deprecate legacy.** Do not touch legacy/resolver now. | Yes — after gold builds |
| 2 | Gold pipeline | Duplicate dataset `gold_storage_type_role_coverage_status` | `gold/warehouse_flow_gold.py:536` | `gold/readiness_validation.py:13` | [REPO] both defs confirmed | **Critical** — DLT duplicate-dataset → gold won't compile | Pick one canonical owner; remove/rename the other. Gold-architecture decision. | No (code) |
| 3 | Gold pipeline | Duplicate dataset `gold_process_order_staging_validation` | `gold/warehouse_flow_gold.py:436` | `gold/readiness_validation.py:140` | [REPO] both defs confirmed | **Critical** — same compile blocker | Same as #2; resolve together. | No (code) |
| 4 | WH360 | `overview` grain | `wh360_kpi_snapshot_v` (global, 1 row, no plant) | contract PK `[plant_id, snapshot_ts]` | [DBX] | Medium — re-grain, not rename | Treat governed overview as new modelling; validate per-plant totals vs legacy global. | Yes |
| 5 | WH360 | IM/WM variance logic | implemented 3× in gold (`warehouse_flow_gold.py` v1 ~189 + v2 ~652; `warehouse_exceptions.py` branch) | one canonical reconciliation model | [SUB] | Medium — accidental logic duplication | Consolidate behind one model; verify the three before acting. | No (code) — verify first |
| 6 | WH360 | `Warehouse360Overview` type | generated contract DTO vs Zod service schema vs Python mapper | one source-of-truth per layer | [SUB] | Low/Medium — **possibly intentional layering** | **Potential overlap, needs confirmation** — read the 3 files before recommending consolidation. | No |
| 7 | Contracts | Dual codegen (manifest→TS, TS→Pydantic) name drift (`*Backlog` vs `*Item`) | `apps/api/contracts/generated.py` | manifest + `packages/data-contracts` | [SUB] | Low/Medium | Add traceability/CI on the Python codegen step. | No |
| 8 | SPC | Manual contract bridge (not in manifest) | `apps/api/contracts/spc.py` | manifest-generated contract | [SUB] | Low | Fold into manifest pipeline when codegen supports nested types. | No |
| 9 | Cross-domain | `vw_gold_batch_material` defined in two schemas | `csm_batch_traceability` + `csm_process_order_history` | TBD (out of WH360 scope) | [DBX] | Low | Note only; separate domain review. | Maybe |

---

## 5. Recommended canonical target state (forward-build, sequenced)

The WH360 resolution is **build-then-validate-then-deprecate**, *behind* the gold compile blocker:

| Business concept | Canonical serving view (to build) | Canonical contract | Legacy to deprecate (later) | Migration step |
|---|---|---|---|---|
| Overview | `vw_consumption_warehouse360_overview` (per-plant+snapshot re-grain) | `warehouse360.overview` | `wh360_kpi_snapshot_v` | after gold builds + parity check |
| Inbound backlog | `…_inbound_backlog` | `warehouse360.inbound_backlog` | `wh360_inbound_v` | after parity check |
| Outbound backlog | `…_outbound_backlog` | `warehouse360.outbound_backlog` | `wh360_deliveries_v` | after parity check |
| Staging workload | `…_staging_workload` | `warehouse360.staging_workload` | `wh360_process_orders_v` | after parity check |
| IM/WM reconciliation | `…_im_wm_reconciliation` (+ enforce plant entitlement) | `warehouse360.im_wm_reconciliation` | `imwm_exceptions_v` | after parity + entitlement validation |

**Prerequisite (blocks everything above):** resolve the duplicate gold datasets (#2, #3) so the gold
pipeline compiles; only then can the consumption views and contract validation run.

Decision rules applied (from the prompt): legacy `wh360_*` may stay as an internal/serving source until
the governed view is built and validated; once a `vw_consumption_*` view reproduces a legacy view and
adds contract shape + entitlement, it becomes the **only** app-facing object; contracts stay `draft`
until validated against live data, then promote to pilot.

---

## 6. Repo changes in this PR

- This document.
- `data-products/io-reporting/validation/warehouse360_governed_vs_legacy_validation.sql` — read-only,
  repeatable: checks governed-view existence, profiles the legacy views the governed must reproduce, and
  templates per-contract PK / plant-scope / freshness checks (to run once the governed views exist).

No code, resolver, bundle, or Databricks object was modified.

## 7. Remaining Databricks actions & next-PR plan

**To run once gold compiles + governed views deploy** (SQL provided in the validation script): per
`warehouse360.*` contract — `DESCRIBE` the view, compare columns to contract fields, row count, PK
duplicate count, `plant_id` null count, freshness, visible plants, and **parity vs the legacy view**.

**Open questions for data owners:** (a) which of the duplicate gold datasets (#2/#3) is canonical;
(b) is plant entitlement enforced upstream of the WH360 adapter, or must the governed views join
`user_plant_access` (#2.3); (c) intended per-plant grain + snapshot semantics for `overview`.

**Next-PR plan:**
- **PR 1 (this):** documentation + duplicate matrix + read-only validation SQL.
- **PR 2:** resolve duplicate gold datasets (#2, #3) so gold compiles — unblocks the governed build.
- **PR 3:** verify & consolidate in-repo duplicates (#5 variance logic, #6 types) after first-hand review.
- **PR 4:** CI hardening (Python-codegen traceability #7; optional check that every `draft` contract's
  `source_view` is profiled before promotion).
- **PR 5:** after governed views are built + validated, deprecate the legacy `wh360_*` path (resolver
  default + adapter `legacy_wh360` branch).
