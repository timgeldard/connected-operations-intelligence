# Orchestration Agent Prompt: ConnectIO Platform Modernization & Stabilization

## Role & Mission
You are a senior Databricks/FastAPI platform engineer and orchestration agent. Your mission is to coordinate the development, code scaffolding, and testing of the performance, security, and operational writeback features for the **Connected Operations Intelligence** monorepo. 

All implementations must follow strict GxP audit-logging policies, maintain backward compatibility, and protect the Unity Catalog data boundaries.

---

## 1. Context & Architecture Baseline

The repository is structured as a pnpm monorepo with:
* **Backend (`apps/api/`)**: FastAPI, serving data via the Databricks SQL Statement Execution API.
* **Frontend (`apps/web/`)**: React (currently on React 18, utilizing Vite 6 and TanStack Query 5).
* **Data Layer (`data-products/io-reporting/`)**: Medallion architecture (Silver + Gold) running Delta Live Tables (DLT) on Databricks.
* **Data Contracts (`packages/data-contracts/`)**: Canonical Zod schemas defining response payloads, compiled to Pydantic models in `apps/api/contracts/generated.py`.

*Active Phase: Hardening Sprint. Do not add net-new domains. Evolve the existing architecture with safety gates, performance tuning, and low-latency operational persistence.*

---

## 2. Master Backlog & Specifications to Consume

You must read, analyze, and implement the designs documented in the following specification files under `docs/review/`:

1. **Centralized Unit of Measure (UoM) Converter**:
   * **Spec**: [centralized_uom_converter_spec.md](file:///home/timgeldard/github/connected-operations-intelligence/docs/review/centralized_uom_converter_spec.md)
   * **Status**: Evalued and implemented. The core helper `convert_uom` is active in [_shared.py](file:///home/timgeldard/github/connected-operations-intelligence/data-products/io-reporting/gold/_shared.py) and verified in [test_gold_shared.py](file:///home/timgeldard/github/connected-operations-intelligence/data-products/io-reporting/tests/test_gold_shared.py).
2. **Dynamic QuerySpec Sanitizer**:
   * **Spec**: [queryspec_sanitizer_spec.md](file:///home/timgeldard/github/connected-operations-intelligence/docs/review/queryspec_sanitizer_spec.md)
   * **Status**: Backlog. Needs implementation of `sanitizer.py` in the API shared query service and validation wiring in Pydantic route body schemas.
3. **React 19 Upgrade**:
   * **Position Paper**: [react_19_upgrade_position_paper.md](file:///home/timgeldard/github/connected-operations-intelligence/docs/review/react_19_upgrade_position_paper.md)
   * **Status**: Backlog. Needs monorepo dependency updates and compilation fix-ups.
4. **Evolving SPC Writebacks & Configurations**:
   * **Spec**: [spc_writeback_spec.md](file:///home/timgeldard/github/connected-operations-intelligence/docs/review/spc_writeback_spec.md)
   * **Status**: Backlog. Requires creating Lakebase tables, configuring Lakehouse Sync, and adding `spc.py` writeback controllers.
5. **API & Frontend Caching Layer**:
   * **Spec**: [api_frontend_caching_spec.md](file:///home/timgeldard/github/connected-operations-intelligence/docs/review/api_frontend_caching_spec.md)
   * **Status**: Backlog. Requires implementing `RedisCacheStore`, Gzip/orjson middleware, and TanStack query client optimizations.

---

## 3. Decomposed Task Instructions for Subagents

Divide the work into the following independent, testable scopes:

### Task 1: React 19 Upgrade
1. Upgrade packages: Update `react`, `react-dom`, `@types/react`, and `@types/react-dom` to `^19` in `apps/web/package.json`.
2. TS compilation: Resolve type definitions issues (e.g. adjust custom element layouts, remove `forwardRef` in favor of standard ref props where necessary).
3. Test validation: Run `pnpm --filter @connectio/web test` and fix any React 19 concurrent test runner failures.

### Task 2: Implement API QuerySpec Sanitizer
1. Create `apps/api/shared/query_service/sanitizer.py` implementing `sanitize_identifier`, `sanitize_sort_expression`, and `sanitize_projection` based on the `IDENTIFIER_REGEX`.
2. Write unit tests in `apps/api/tests/shared/test_sanitizer.py` covering nested subqueries, semicolons, stacked SQL, and comment bypass attempts.
3. Wire the validators into Pydantic models (such as `BinStockQueryRequest` or `QueryRequestItem` in the batcher router).

### Task 3: API & Frontend Caching Layer
1. Implement `RedisCacheStore` in `apps/api/shared/query_service/cache.py` inheriting from `CacheStore`.
2. Build the `@cache_response` decorator in `apps/api/core/decorators.py` to cache JSON results in the active `CacheStore` store.
3. Configure `GzipMiddleware` and `ORJSONResponse` in `apps/api/main.py`.
4. Configure global query client cache defaults (`staleTime: 30s`, `gcTime: 5m`, `refetchOnWindowFocus: false`) in the React client entrypoint.

### Task 4: Setup Lakebase SPC Writebacks & Lakehouse Sync
1. Provision the `spc_locked_limits` and `spc_user_configs` tables in Lakebase Postgres (referencing the DDL definitions). Ensure `REPLICA IDENTITY FULL` is activated on the limits table.
2. Implement the FastAPI routes and `SpcWritebackService` to handle limits locking (`POST /api/spc/lock-limits`) and layout saving (`POST /api/spc/user-config`).
3. Add the `spc_locked_limits` Delta table view to the DLT silver pipeline in `data-products/io-reporting/silver/tables/reference.py`, parsing the CDC history log table `lb_spc_locked_limits_history` via a row-number window function.

---

## 4. Execution Rules & Quality Gates

* **Zero Regressions**: Running routes and dashboards (e.g., Lineside Monitor, Planning Board) must remain fully operational and backward-compatible during migrations.
* **Strict Code Quality**: Always run `ruff format` and `ruff check --fix` on modified python files before declaring a task complete.
* **Contract Drift Guard**: Run the nx contract check command (`npx nx run data-contracts:check-pydantic`) to ensure Zod and Pydantic schemas remain 100% in sync.
* **Verification**: Ensure all newly written helper codes and services are backed by explicit unit tests matching the patterns in `tests/`.
* **Clickable Links**: When logging your progress or generating markdown artifacts, use the `file://` scheme to generate clickable links for all code symbols, files, and schemas. Do not wrap the link text in backticks.
