# Route → Contract Inventory

> **Plan reference:** Hardening Plan — Phase 2.3 / Practical Task 1.
> **Scope:** Read-only architecture map. No runtime code is changed by this document.
> **Survey basis:** Static code survey of branch `feature/import-connectio-rad-v2` on **2026-06-06**.
> Route paths/prefixes and source-object names are taken from the FastAPI route handlers,
> the adapter `resolve_domain_object(...)` calls, and `apps/api/main.py` router registration.
> Source-object names are **code-authoritative** (read directly from adapter source); they have
> **not** been verified against live Unity Catalog DDL. Treat "Source object" as "what the code
> queries", not "what exists in UC".

---

## 1. Executive summary

The FastAPI layer has a **strong structural foundation** but is **not yet contract-bound**.

**What is good (already in place):**

- Every Databricks-backed route goes through the `QuerySpec` + `object_resolver` abstraction
  (`apps/api/shared/query_service/`). There is **no hard-coded SQL in route handlers**.
- Catalog/schema names are resolved from environment variables per domain
  (`object_resolver.py`), never hard-coded in adapters.
- **No raw SAP table names** (MSEG, AFKO, AFPO, AUFK, JEST, LTAP, LTAK, LQUA, MCH1, MCHA,
  MARA, CHVW) and **no bronze/silver references** appear in any adapter.

**The three structural gaps (this is the work the rest of the plan addresses):**

1. **No route queries an approved consumption view.** Measured against the repository's *own*
   rule — `scripts/contracts/validate_contracts.py:132` requires `source_view` to start with
   `vw_consumption_` or `vw_genie_`, and the manifest `rules` block sets
   `application_must_use_approved_consumption_views: true` — **0 of the ~30 data-backed routes**
   query a `vw_consumption_*` / `vw_genie_*` object. They query `wh360_*_v`, `vw_gold_*`,
   `gold_*`, and `*_mv` objects instead.

2. **Contracts are not wired to code.** The `QuerySpec` dataclass (`query_spec.py:35-46`) has
   **no `contract_id` field**. The manifest's single contract (`warehouse360.overview`) is not
   referenced anywhere in the application. Contracts and adapters are entirely disconnected — and
   the one contract that exists declares `source_view: vw_consumption_warehouse360_overview`
   while the adapter backing that route actually queries `wh360_kpi_snapshot_v`
   (`warehouse360_databricks_adapter.py:141`).

3. **The app reaches the `gold` schema directly.** trace2, envmon, spc, and quality adapters
   resolve objects in schema `gold` (or `schema_override="gold"`), contrary to the manifest rule
   `raw_silver_gold_access_from_app_forbidden: true`. **Severity is not yet determinable from
   names alone:** `*_v`-suffixed objects (e.g. `gold_batch_stock_v`) are clearly views, but bare
   names (`gold_material`, `gold_plant`, `gold_batch_lineage`, `gold_batch_material`,
   `gold_supplier`) could be governed views *or* internal tables. **→ Flag for UC schema
   verification.**

**Coverage:** 1 contract exists; ~30 data-backed routes. Almost everything is *not yet assessed*
against a contract.

---

## 2. Compliance status vocabulary

Per Hardening Plan §2.3:

| Status | Meaning in this inventory |
|---|---|
| **compliant** | Route queries a `vw_consumption_*`/`vw_genie_*` view **and** is backed by a manifest contract. **Currently: none.** |
| **partially compliant** | Uses the `QuerySpec`/`object_resolver` abstraction and avoids raw/SAP/bronze/silver, but queries a non-approved object name and/or has no manifest contract. |
| **legacy / mock mode** | Returns static data or proxies to the V1 backend; no native governed access. |
| **blocked** | Cannot be made compliant without upstream work (e.g. source object confirmed to be an internal gold table). |
| **not yet assessed** | Source object not yet verified against UC / no contract proposed yet. |
| **N/A** | Not a data-backed route (system/auth/static). |

---

## 3. Router registration

From `apps/api/main.py` (all routers mounted under `/api` except health):

| Router | Prefix | Source file |
|---|---|---|
| health | *(none)* | `routes/health.py` |
| workspaces | `/api/workspaces` | `routes/workspaces.py` |
| auth | `/api/auth` | `routes/auth.py` |
| auth diagnostics | `/api/diagnostics` | `routes/auth_diagnostics.py` |
| trace2 | `/api/trace2` | `routes/trace2.py` |
| warehouse360 | `/api/warehouse360` + `/api/wh360` | `routes/warehouse360.py` |
| process order | `/api/por` | `routes/process_order.py` |
| connected quality lab | `/api/cq` | `routes/connected_quality_lab.py` |
| envmon | `/api/envmon` | `routes/envmon.py` |
| spc | `/api/spc` | `routes/spc.py` |
| quality | `/api/quality` | `routes/quality.py` |

---

## 4. Inventory by domain

Legend for **Contract ID**: `(exists)` = present in `app_contract_manifest.yml`; `(proposed)` =
recommended name from Hardening Plan §3.2 Wave 1–5; `(needs mapping)` = no plan name yet.

### 4.1 Warehouse360 — domain `wh360` (Plan Wave 1)

Catalog `WH360_CATALOG`, schema `WH360_SCHEMA` (default `wh360`).

| Route | Adapter | Source object (code) | Expected contract ID | Status |
|---|---|---|---|---|
| `GET /api/warehouse360/overview` | warehouse360 | `wh360_kpi_snapshot_v` | `warehouse360.overview` **(exists)** | partially compliant — contract declares `vw_consumption_warehouse360_overview` but code queries `wh360_kpi_snapshot_v`; contract not wired |
| `GET /api/warehouse360/inbound` | warehouse360 | `wh360_inbound_v` | `warehouse360.inbound_backlog` (proposed) | partially compliant |
| `GET /api/warehouse360/outbound` | warehouse360 | `wh360_deliveries_v` | `warehouse360.outbound_backlog` (proposed) | partially compliant |
| `GET /api/warehouse360/staging` | warehouse360 | `wh360_process_orders_v` | `warehouse360.staging_workload` (proposed) | partially compliant |
| `GET /api/warehouse360/exceptions` | warehouse360 | `imwm_exceptions_v` | `warehouse360.im_wm_reconciliation` (proposed) | partially compliant |
| `POST /api/wh360/warehouse-summary` | *(V1 proxy)* | — (proxies to V1 backend) | — | legacy / mock mode |

### 4.2 Process Order History — domain `poh` (Plan Wave 2)

Catalog `POH_CATALOG`, schema `POH_SCHEMA` (default `csm_process_order_history`).

| Route | Adapter | Source object (code) | Expected contract ID | Status |
|---|---|---|---|---|
| `POST /api/por/order-header` | poh | `vw_gold_process_order` | `operations.process_order_overview` (proposed) | partially compliant — dual-mode (V1 fallback) |
| `GET /api/por/order-operations` | poh | `vw_gold_process_order_phase` | `operations.operation_progress` (proposed) | partially compliant |
| `GET /api/por/order-confirmations` | poh | `vw_gold_confirmation` | `operations.confirmation_history` (proposed) | partially compliant |
| `GET /api/por/order-goods-movements` | poh | `vw_gold_adp_movement` | (needs mapping — no Wave 2 name) | partially compliant |
| `POST /api/por/order-search` | poh | `vw_gold_process_order` | (needs mapping — search variant of overview) | partially compliant |

> Note: `poh` `vw_gold_*` objects live in schema `csm_process_order_history`, **not** the `gold`
> schema. They are views (`vw_` prefix) but not `vw_consumption_*`-named.

### 4.3 Traceability — domain `trace2` (Plan Wave 3)

Catalog `TRACE_CATALOG`, schema `TRACE_SCHEMA` (default `gold`). **All objects resolve into the
`gold` schema** — see Gap 3.

| Route | Adapter | Source object(s) (code) | Expected contract ID | Status |
|---|---|---|---|---|
| `POST /api/trace2/batch-header` | batch_header | `gold_batch_stock_v`, `gold_batch_summary_v`, `gold_material`, `gold_plant`, `gold_batch_material` | `traceability.batch_header` (proposed) | partially compliant — dual-mode; bare `gold_*` need verification |
| `POST /api/trace2/batch-search` | batch_header | `gold_batch_stock_v`, `gold_material`, `gold_plant`, `gold_batch_production_history_v` | (needs mapping — search variant) | partially compliant |
| `POST /api/trace2/trace-graph` | trace_graph | `gold_batch_lineage`, `gold_material` | `traceability.trace_graph` (proposed) | partially compliant — recursive; `gold_batch_lineage` needs verification |
| `POST /api/trace2/customer-exposure` | customer | `gold_batch_lineage` | `traceability.customer_exposure` (proposed) | partially compliant |
| `POST /api/trace2/customer-deliveries` | customer | `gold_batch_delivery_v` | (needs mapping — delivery variant) | partially compliant |
| `POST /api/trace2/supplier-exposure` | supplier | `gold_batch_lineage`, `gold_supplier` | `traceability.supplier_exposure` (proposed) | partially compliant |
| `POST /api/trace2/supplier-batches` | supplier | `gold_batch_lineage` (×2 queries) | (needs mapping — supplier variant) | partially compliant |
| `POST /api/trace2/production-history` | production_history | `gold_batch_production_history_v` | `traceability.production_history` (proposed) | partially compliant |
| `POST /api/trace2/mass-balance` | mass_balance | `gold_batch_mass_balance_v` | `traceability.mass_balance` (proposed) | partially compliant |
| `POST /api/trace2/mass-balance-ledger` | mass_balance | `gold_batch_mass_balance_v` | (needs mapping — ledger variant) | partially compliant |
| `POST /api/trace2/recall-readiness` | recall_readiness | `gold_batch_delivery_v` | `traceability.recall_readiness` (proposed) | partially compliant |
| `POST /api/trace2/batch-quality-passport` | quality_passport | `gold_batch_stock_v`, `gold_batch_summary_v`, `gold_material`, `gold_plant`, `gold_batch_production_history_v`, `gold_batch_quality_result_v`, `gold_batch_quality_lot_v`, `gold_batch_quality_summary_v`, `gold_batch_mass_balance_v` | `traceability.quality_passport` (proposed) | partially compliant — 5-query fanout |
| `POST /api/trace2/investigation-timeline` | investigation_timeline | `gold_batch_mass_balance_v`, `gold_batch_quality_lot_v`, `gold_batch_delivery_v` | (needs mapping — no Wave 3 name) | partially compliant |
| `POST /api/trace2/holds-ledger` | holds_ledger | `gold_batch_stock_v`, `gold_batch_quality_lot_v` | `traceability.holds_ledger` (proposed) | partially compliant |

### 4.4 Connected Quality Lab — domain `cq` (Plan Wave 4)

Catalog `CQ_CATALOG` (falls back to `TRACE_CATALOG`), schema `CQ_SCHEMA`
(default `csm_process_order_history`).

| Route | Adapter | Source object(s) (code) | Expected contract ID | Status |
|---|---|---|---|---|
| `GET /api/cq/lab/fails` | cq | `vw_gold_inspection_result`, `vw_gold_process_order`, `vw_gold_inspection_usage_decision`, `vw_gold_inspection_lot`, `vw_gold_inspection_specification`, `vw_gold_material` | `quality.mic_failure_pareto` (proposed — verify intent) | partially compliant — dual-mode |
| `GET /api/cq/lab/plants` | cq | `gold_plant` (`schema_override="gold"`) | (reference/dimension lookup — likely no standalone contract) | partially compliant — direct `gold` access |

### 4.5 Quality evidence — domain `quality` (resolves via `cq`) (Plan Wave 4)

| Route | Adapter | Source object(s) (code) | Expected contract ID | Status |
|---|---|---|---|---|
| `POST /api/quality/read-only-evidence` | quality | `gold_inspection_usage_decision`, `gold_inspection_lot` | `quality.batch_release_queue` (proposed — verify intent) | partially compliant — falls back to `pending-source-verification` skeleton if not in `databricks-api` mode; bare `gold_*` need verification |

### 4.6 SPC — domain `spc` (Plan Wave 4)

Catalog `SPC_CATALOG` (falls back to `TRACE_CATALOG`), schema `SPC_SCHEMA` (default `gold`).

| Route | Adapter | Source object(s) (code) | Expected contract ID | Status |
|---|---|---|---|---|
| `POST /api/spc/chart-data` | spc chart | `spc_quality_metric_subgroup_mv`, `spc_locked_limits_mv` | `spc.chart_series` (proposed) | partially compliant — dual-mode |
| `GET /api/spc/subgroups` | spc | `spc_quality_metric_subgroup_mv` | `spc.chart_series` (proposed — subgroup variant) | partially compliant |
| `GET /api/spc/materials` | spc | `gold_batch_quality_result_v`, `gold_material` | (reference/search lookup) | partially compliant |
| `GET /api/spc/plants` | spc | `spc_quality_metric_subgroup_mv`, `gold_plant` | (reference/dimension lookup) | partially compliant |
| `GET /api/spc/search` | spc | `spc_quality_metric_subgroup_mv`, `gold_material` | (reference/search lookup) | partially compliant |
| `GET /api/spc/characteristics` | spc | `spc_quality_metric_subgroup_mv` | (reference/search lookup) | partially compliant |
| `GET /api/spc/capability` | *(V1 proxy)* | — (proxies to V1 backend) | `spc.capability_summary` (proposed) | legacy / mock mode |

### 4.7 Environmental Monitoring — domain `envmon` (shares trace2 catalog/schema)

Catalog `TRACE_CATALOG`, schema `TRACE_SCHEMA` (default `gold`).

| Route | Adapter | Source object(s) (code) | Expected contract ID | Status |
|---|---|---|---|---|
| `GET /api/envmon/site-summary` | envmon | `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` | (needs mapping — no plan wave) | partially compliant — bare `gold_*` need verification |
| `GET /api/envmon/swab-results` | envmon | `gold_inspection_lot`, `gold_inspection_point`, `gold_batch_quality_result_v` | (needs mapping — no plan wave) | partially compliant |

### 4.8 System / non-data routes

| Route | Source file | Status |
|---|---|---|
| `GET /health` | `routes/health.py` | N/A — static health payload |
| `GET /api/auth/session` | `routes/auth.py` | N/A — OAuth header parsing (dev fallback) |
| `GET /api/diagnostics/auth-headers` | `routes/auth_diagnostics.py` | N/A — header inspection |
| `GET /api/workspaces/manifest` | `routes/workspaces.py` | N/A — static workspace manifest |

---

## 5. Source-object naming families

| Family | Example | Domains | Looks like | Approved-prefix? |
|---|---|---|---|---|
| `wh360_*_v`, `imwm_exceptions_v` | `wh360_kpi_snapshot_v` | wh360 | view in `wh360` schema | ❌ |
| `vw_gold_*` | `vw_gold_process_order` | poh, cq | view (`vw_` prefix) | ❌ |
| `gold_*_v` | `gold_batch_stock_v` | trace2, envmon, spc | view in `gold` schema | ❌ |
| `gold_*` (bare) | `gold_material`, `gold_batch_lineage` | trace2, envmon, quality, spc | **view OR internal table — unknown** | ❌ |
| `*_mv` | `spc_quality_metric_subgroup_mv` | spc | materialized view | ❌ |

None match the mandated `vw_consumption_*` / `vw_genie_*` convention.

---

## 6. Findings that feed later plan tasks

These are **observations only** — no code is changed here.

**→ Task 2 (make the boundary scanner blocking & complete):** the current scanner
(`scripts/ci/check_forbidden_data_access.py`) has blind spots that let the gold-schema access
above pass silently:

- It matches the literal substring `.gold.`, but resolved references are backtick-quoted
  (`` `catalog`.`gold`.`object` ``), so `.gold.` never appears literally — **not caught**.
- Object names are passed as string-literal arguments
  (`resolve_domain_object("trace2", "gold_batch_lineage")`), so `\bfrom\s+gold_` never matches the
  source line either — **not caught**.
- It does not contain the named SAP tables from Plan §2.2 (MSEG, AFKO, LTAP, MARA, …). A literal
  `SELECT * FROM MSEG` would pass today.
- The `boundary-check` CI job is currently `continue-on-error: true` (`.github/workflows/ci.yml`),
  i.e. **non-blocking**.

**→ Task 3 (expand Warehouse360 contracts):** the `(proposed)` contract IDs above map each route
to a Wave 1–5 contract name and can seed the manifest.

**→ Task 4 (standardise adapter contract usage):** add a `contract_id` to `QuerySpec` so adapters
reference a contract instead of an ad-hoc query name, closing the declared-vs-actual gap.

**→ Schema verification (UC):** confirm whether the bare `gold_*` objects (`gold_material`,
`gold_plant`, `gold_batch_lineage`, `gold_batch_material`, `gold_supplier`,
`gold_inspection_lot`, `gold_inspection_point`, `gold_inspection_usage_decision`) are governed
views or internal tables. This determines whether the gold-schema access is a naming issue
(partially compliant) or a true boundary violation (blocked).

---

## 7. Caveats

- Source-object names are read from adapter source on 2026-06-06; they have not been checked
  against live Unity Catalog DDL.
- Route paths combine `main.py` router prefixes with handler paths; exact path spellings should be
  reconfirmed against the running OpenAPI schema before being treated as canonical.
- "Expected contract ID" values marked `(proposed)` are suggestions aligned to Hardening Plan
  §3.2 and are **not** yet present in the manifest.
