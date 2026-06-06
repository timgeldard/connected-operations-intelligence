# SPC V1 Source Discovery — V2 Mapping Plan

**Date:** 2026-05-20
**Branch:** `feature/spc-v1-source-migration-assessment`
**Status:** Discovery complete — Migration Assessment drafted in [spc-v2-migration-assessment.md](./spc-v2-migration-assessment.md)

---

## 1. Executive Summary

The V2 SPC domain has been operating under two incorrect assumptions:

1. **"No legacy V1 backend currently exists for SPC"** — INCORRECT. A full-featured SPC application exists at `apps/spc/` within the ConnectIO-RAD V1 monorepo. It has a FastAPI backend, a React/TypeScript frontend, Databricks SQL queries, 20+ SQL migration scripts, and deployed gold-layer objects.

2. **"SPC data does not exist in Databricks"** — INCORRECT. The V1 SPC app is deployed to `connected_plant_uat.gold` and actively queries gold views. Multiple source tables and views exist in this catalog.

The real blockers for V2 live SPC UAT are:

- V2's data model is **material-agnostic** (plant + work-centre entry) but V1 is **material-centric** (material → plant → MIC entry). V2's `SPCMonitoringAdapterRequest` is missing `materialId` as a required first-class parameter.
- V2 assumes a **signal-storage table** (`spc_quality_metrics` as an alarm store) but V1 signals/violations are **computed at runtime in the frontend** from raw subgroup data.
- V2's proposed `spc_locked_limits` DDL uses incorrect column names and misses the `material_id` primary key dimension.
- V2 has no proxy routes to the V1 SPC FastAPI backend and no databricks-api adapter implementation.

The path to live SPC UAT is clear: map V1's material-centric API to V2's adapter layer. The Databricks data exists; the source contract is well-documented. V2 needs route wiring and adapter rewrite, not new data engineering.

**Current V2 SPC remains mock/sandbox until the V1 Databricks source mapping is verified and native V2 routes/adapters are implemented.**

---

## 2. V1 SPC Functionality Inventory

**Source:** `timgeldard/ConnectIO-RAD` repository, `apps/spc/` directory.

### 2.1 Application Structure

The V1 SPC is a standalone Databricks App (FastAPI backend + React/TypeScript frontend) within the ConnectIO-RAD monorepo at `apps/spc/`.

```
apps/spc/
├── backend/
│   └── spc_backend/
│       ├── main.py                       # FastAPI app entry point
│       ├── manifest.py                   # Module manifest (moduleId: "spc")
│       ├── process_control/
│       │   ├── router_metadata.py        # Plant/material/MIC discovery endpoints
│       │   ├── router_charts.py          # Chart data, limits, quality endpoints
│       │   ├── router_analysis.py        # Scorecard, MSA, correlation, multivariate
│       │   ├── dal/                      # Database access layer
│       │   │   ├── charts.py             # Chart queries (spc_quality_metric_subgroup_v)
│       │   │   ├── metadata.py           # MIC/plant/material queries
│       │   │   ├── analysis.py           # Scorecard, capability, process flow queries
│       │   │   ├── authorized_scope.py   # Plant authorization (gold_plant)
│       │   │   └── _chart_cursor.py      # Keyset pagination for chart data
│       │   ├── application/              # Application service layer
│       │   └── domain/
│       │       ├── control_charts.py     # Pure SPC maths (no DB)
│       │       ├── capability.py         # Cp/Cpk/Pp/Ppk calculation
│       │       ├── msa.py                # Gauge R&R (Average & Range + ANOVA)
│       │       └── multivariate.py       # Hotelling's T² calculation
│       ├── chart_config/
│       │   ├── router.py                 # Locked limits + exclusions write endpoints
│       │   └── dal/
│       │       ├── locked_limits.py      # spc_locked_limits read/write
│       │       └── exclusions.py         # spc_exclusions snapshot
│       ├── routers/
│       │   ├── export.py                 # POST /api/spc/export (Excel/CSV)
│       │   ├── genie.py                  # POST /api/spc/genie/message (Databricks Genie AI)
│       │   └── trace.py                  # GET /api/spc/trace/* (lineage endpoints)
│       ├── schemas/
│       │   └── spc_gold_views.v1.json    # Machine-readable gold view schema contracts
│       └── utils/
│           └── db.py                     # Databricks SQL connector utilities
├── frontend/src/spc/
│   ├── SPCPage.tsx                       # Main page (tab routing)
│   ├── SPCContext.tsx                    # Shared state (material, plant, MIC, preferences)
│   ├── SPCFilterBar.tsx                  # Material / plant / MIC / date filter bar
│   ├── SPCPageHeader.tsx                 # Tab header with breadcrumb
│   ├── calculations.runtime.ts           # WECO + Nelson rule detection (frontend-computed)
│   ├── computeAnalytics.ts               # Control limits + capability computation
│   ├── spcConstants.ts                   # AIAG SPC constants (d2, d3, c4, A2, A3, D3, D4)
│   ├── exclusions.ts                     # Exclusion application logic
│   ├── types.ts                          # TypeScript types (SPCComputationResult, etc.)
│   ├── queryKeys.ts                      # React Query cache keys
│   ├── api/spc.ts                        # API client (fetch wrappers)
│   ├── overview/OverviewPage.tsx         # Overview tab
│   ├── scorecard/ScorecardView.tsx       # Scorecard tab
│   ├── genie/GenieView.tsx               # Databricks Genie AI tab
│   ├── charts/
│   │   ├── XbarChart.tsx                 # X̄-R / X̄-S chart
│   │   ├── RangeChart.tsx                # R / MR range chart
│   │   ├── CapabilityPanel.tsx           # Cp/Cpk/Pp/Ppk panel
│   │   └── ...                           # IMR, attribute, EWMA, CUSUM charts
│   ├── components/StatusPill.tsx         # in-control / warning / out-of-control pill
│   └── hooks/
│       ├── useMaterials.ts               # GET /api/spc/materials
│       ├── usePChartData.ts              # POST /api/spc/p-chart-data
│       └── useCountChartData.ts          # POST /api/spc/count-chart-data
└── scripts/migrations/                   # 20 numbered SQL migration files
```

**File:** `apps/spc/backend/spc_backend/manifest.py`
```
moduleId: "spc"
displayName: "Statistical Process Control"
shortName: "SPC"
tagline: "Real-time process capability and control charts."
```

### 2.2 V1 SPC Tabs / Screens

From `apps/spc/frontend/src/spc/SPCPageHeader.tsx`:

| Tab | Route key | Description |
|-----|-----------|-------------|
| Overview | `overview` | KPI tiles: active signals, charts monitored, Cpk trend |
| Control Charts | `charts` | Per-MIC chart selection + interactive chart |
| Alarm History | `alarms` | Rule breaches table (historical) |
| Capability Analysis | `capability` | Cp/Cpk/Pp/Ppk per MIC with trend sparkline |
| Related Batches | `batches` | Batches produced during signal windows |
| MIC Discovery | `mic-discovery` | Discover monitored MICs from gold views |
| MSA | `msa` | Measurement System Analysis (Gauge R&R) |
| Correlation | `correlation` | Cross-MIC Pearson correlation heatmap |
| Multivariate SPC | `multivariate` | Hotelling's T² chart |
| Scorecard | `scorecard` | Per-material process health scorecard |
| Process Flow | `process-flow` | DAG of upstream/downstream material lineage with health colouring |
| Databricks Genie | `genie` | AI-powered SPC analysis (Genie chat) |

**Top-level filter bar** (all tabs): material picker → plant picker → MIC dropdown → date range.  
Navigation order: material first, then plant, then MIC.

### 2.3 V1 SPC API Endpoints

All routes are registered under `/api/spc`. OAuth user identity is forwarded as `x-forwarded-access-token`.

**Metadata router** (`router_metadata.py`):

| Endpoint | Method | Params | Source | Notes |
|----------|--------|--------|--------|-------|
| `/api/spc/materials` | GET | — | `spc_material_dim_mv` | Lists all materials with SPC data |
| `/api/spc/validate-material` | POST | body: `{material_id}` | `spc_material_dim_mv` | Validates material ID |
| `/api/spc/plants` | GET | `material_id` | `spc_plant_material_dim_mv` | Plants for a material with SPC data |
| `/api/spc/characteristics` | GET | `material_id, plant_id?` | `spc_characteristic_dim_mv` | Quantitative MICs |
| `/api/spc/attribute-characteristics` | GET | `material_id, plant_id?` | attribute source | p/np/c/u chart MICs |

**Charts router** (`router_charts.py`):

| Endpoint | Method | Params | Source | Notes |
|----------|--------|--------|--------|-------|
| `/api/spc/chart-data` | POST | body: `{material_id, mic_id, plant_id?, operation_id?, ...}` | `spc_quality_metric_subgroup_v` + `spc_locked_limits` | Primary chart data |
| `/api/spc/p-chart-data` | POST | body: `{material_id, mic_id, plant_id?}` | `spc_attribute_metric_source_v` | p-chart (proportion nonconforming) |
| `/api/spc/count-chart-data` | POST | body | attribute source | c/np/u chart data |
| `/api/spc/locked-limits` | GET | `material_id, mic_id` | `spc_locked_limits` | Fetch active locked limits |
| `/api/spc/locked-limits` | POST | body | `spc_locked_limits` | Save locked limits |
| `/api/spc/exclusions` | GET | `material_id, mic_id` | `spc_exclusions` | Fetch exclusion snapshot |
| `/api/spc/exclusions` | POST | body | `spc_exclusions` | Save exclusion snapshot |
| `/api/spc/data-quality` | GET | `material_id, mic_id` | `spc_quality_metric_subgroup_v` | Posting-date gap statistics |

**Analysis router** (`router_analysis.py`):

| Endpoint | Method | Params | Source | Notes |
|----------|--------|--------|--------|-------|
| `/api/spc/scorecard` | POST | body: `{material_id, plant_id?}` | `spc_capability_detail_mv` | Per-material Cpk scorecard |
| `/api/spc/process-flow` | POST | body | `spc_process_flow_metrics` | Process flow DAG |
| `/api/spc/correlation` | POST | body | `spc_correlation_source_mv` | Pearson correlation matrix |
| `/api/spc/multivariate` | POST | body | `spc_correlation_source_mv` | Hotelling's T² analysis |
| `/api/spc/msa` | POST | body | gold MSA source | Gauge R&R analysis |
| `/api/spc/compare-scorecard` | POST | body | `spc_capability_detail_mv` | Scorecard comparison (two periods) |

**Other routers**:

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/api/spc/export` | POST | Excel / CSV export (scorecard + chart data + signals) |
| `/api/spc/genie/message` | POST | Databricks Genie AI chat |
| `/api/spc/trace/*` | GET | Material lineage trace |

### 2.4 V1 SPC User Workflow

**Entry flow:**
1. User arrives at SPC app — sees material picker (no context yet)
2. User types or selects a material ID → app calls `GET /api/spc/materials` for autocomplete
3. After material selected, app calls `GET /api/spc/plants?material_id=...` → plant dropdown populates
4. After plant selected, app calls `GET /api/spc/characteristics?material_id=...&plant_id=...` → MIC list populates
5. User selects MIC → control chart tab renders using `POST /api/spc/chart-data`

**Key user actions:**
- Switch between chart types (X̄-R, I-MR, X̄-S, EWMA, CUSUM, p, np, c, u) via UI dropdown
- Toggle rule set between WECO (4 rules) and Nelson (8 rules) — persisted in localStorage
- Toggle limits mode between `live` (computed) and `locked` (from `spc_locked_limits`) — persisted in localStorage
- Lock/save control limits via `POST /api/spc/locked-limits`
- Exclude individual data points via `POST /api/spc/exclusions`
- View capability metrics on Capability tab
- View scorecard across all MICs for a material
- View related batches produced during out-of-control periods
- Export data to Excel/CSV
- Chat with Databricks Genie AI about process data

---

## 3. V1 Databricks Data Source Inventory

**Deployment configuration** (from `apps/spc/Makefile` and `apps/spc/backend/tests/test_db.py`):

```
TRACE_CATALOG = connected_plant_uat
TRACE_SCHEMA = gold
WAREHOUSE_HTTP_PATH = /sql/1.0/warehouses/e76480b94bea6ed5
WAREHOUSE_ID = e76480b94bea6ed5
```

All objects below live in `connected_plant_uat.gold` unless otherwise noted.

### 3.1 User-Managed Tables (permanent, write-accessible)

| Object | Key columns | Notes |
|--------|-------------|-------|
| `spc_locked_limits` | material_id (PK), mic_id (PK), plant_id (PK), operation_id (PK), chart_type (PK), cl, ucl, lcl, ucl_r, lcl_r, sigma_within, usl, lsl, effective_from, effective_to, locked_by, locked_at, unified_mic_key, provenance | Phase II frozen control limits. **material_id is a required PK dimension** (absent from V2 schema). Includes range chart limits (ucl_r/lcl_r). |
| `spc_exclusions` | event_id, material_id, mic_id, mic_name, plant_id, operation_id, stratify_all | Sample/batch exclusion snapshots |
| `spc_mic_chart_config` | mic_id, plant_id, material_id, chart_type | Per-MIC chart type override |
| `spc_query_audit` | audit_id, event_type, sql_hash, error_id, request_path, detail_json | Query audit log (90-day retention) |

**Migration source:** `apps/spc/scripts/migrations/000_setup_locked_limits.sql` through `019_create_spc_mic_chart_config.sql`.

### 3.2 Gold Base Views (regular views, read-only)

| Object | Source | Key columns | Notes |
|--------|--------|-------------|-------|
| `spc_quality_metric_subgroup_v` | `gold_batch_quality_result_v`, `gold_inspection_lot` | material_id, plant_id, mic_id, operation_id, batch_id, sample_id, inspection_lot_id, result_value, sample_timestamp, subgroup_mean, subgroup_range, subgroup_sd, unit_of_measure, usl_spec, lsl_spec | Primary chart data source. Subgroup stats computed via window functions. **This is the primary source for control chart rendering.** |
| `spc_attribute_metric_source_v` | `gold_batch_quality_result_v` | material_id, plant_id, mic_id, operation_id, batch_id, sample_timestamp, nonconforming_count, sample_size | Attribute (p/np/c/u chart) source |
| `spc_process_flow_source_v` | `gold_batch_quality_result_v` + mass balance | material_id, batch_id, mic_id | Process flow health source |
| `spc_correlation_source_v` | `gold_batch_quality_result_v` | material_id, batch_id, mic_id | Correlation analysis source |

**Migration source:** `apps/spc/scripts/migrations/005_create_spc_quality_metric_subgroup_v.sql` through `011_create_spc_correlation_source_v.sql`.

### 3.3 Metric Views (WITH METRICS LANGUAGE YAML — Databricks AI/BI governance)

> **IMPORTANT:** These are NOT alarm/signal storage tables. They are Databricks AI/BI Metric Views for monitoring and governance dashboards.

| Object | Source | Notes |
|--------|--------|-------|
| `spc_quality_metrics` | `spc_quality_metric_subgroup_v` | Quantitative SPC metric view (AIBI governance). **The V2 docs incorrectly assumed this is a signal table with alarm rows.** |
| `spc_attribute_quality_metrics` | `spc_attribute_metric_source_v` | Attribute SPC metric view |
| `spc_process_flow_metrics` | `spc_process_flow_source_mv` | Process flow health metric view |

**Migration source:** `apps/spc/scripts/migrations/006_create_spc_quality_metrics_mv.sql`, `008_create_spc_attribute_quality_metrics_mv.sql`, `010_create_spc_process_flow_metrics_mv.sql`.

### 3.4 Materialized Views (4h pipeline refresh)

| Object | Grain | Clustering | Notes |
|--------|-------|------------|-------|
| `spc_material_dim_mv` | material_id | material_id | Materials with SPC data (powers material picker) |
| `spc_plant_material_dim_mv` | plant_id, material_id | plant_id, material_id | Plant-material pairs with SPC data (powers plant picker) |
| `spc_characteristic_dim_mv` | material_id, plant_id, mic_id | material_id, mic_id | MIC dimension (powers characteristic picker) |
| `spc_batch_dim_mv` | material_id, plant_id, batch_id | material_id, mic_id | Batch dimension |
| `spc_nelson_rule_flags_mv` | material_id, plant_id, mic_id, batch_id | material_id, mic_id | Aggregated rule flag summary per batch (used for scorecard colouring, not real-time rule detection) |
| `spc_capability_detail_mv` | material_id, plant_id, mic_id | material_id, mic_id | Cp/Cpk/Pp/Ppk computed values |
| `spc_correlation_source_mv` | material_id, batch_id, mic_id | material_id, mic_id | Materialized correlation source |
| `spc_process_flow_source_mv` | material_id, batch_id | material_id | Materialized process flow source |

**SPC UDF:** `spc_normal_cdf(z)` — polynomial approximation of Φ(z) for DPMO calculations.

### 3.5 Shared Gold Views (not SPC-owned)

| Object | Owned by | Used by SPC for |
|--------|----------|-----------------|
| `gold_batch_quality_result_v` | Platform / Trace | Chart data, capability, MIC discovery |
| `gold_inspection_lot` | Platform | Sample timestamps, lot types |
| `gold_plant` | Platform | Plant authorization, plant picker |
| `gold_batch_mass_balance_v` | Platform | Process flow source |

---

## 4. Control-Limit Source Discovery

### Finding

**Control limits in V1 are DUAL-MODE, user-switchable:**

| Mode | Source | Mechanism |
|------|--------|-----------|
| `live` (default) | `spc_quality_metric_subgroup_v` subgroup data | Computed at runtime in frontend using AIAG control chart constants from `spc_constants.ts`. UCL = X̄̄ + A₂R̄ (xbar-r), CL = X̄̄, LCL = X̄̄ − A₂R̄. |
| `locked` | `spc_locked_limits` table | Stored frozen limits per (material_id, mic_id, plant_id, operation_id, chart_type). Loaded via `GET /api/spc/locked-limits`. |

The user toggles between modes via a `limitsMode: 'live' | 'locked'` preference stored in localStorage (`apps/spc/frontend/src/spc/SPCContext.tsx`).

### `spc_locked_limits` — Actual Column Schema

From `apps/spc/backend/spc_backend/chart_config/dal/locked_limits.py` and `apps/spc/scripts/migrations/000_setup_locked_limits.sql`:

```
PRIMARY KEY: (material_id, mic_id, plant_id, operation_id, chart_type)

Columns:
  material_id     STRING   NOT NULL  -- SAP material number
  mic_id          STRING   NOT NULL  -- Inspection characteristic (MIC) code
  plant_id        STRING             -- Plant ID (NULL = all plants)
  operation_id    STRING             -- Operation (NULL = no operation scope)
  chart_type      STRING             -- 'imr' | 'xbar_r' | 'xbar_s' | 'p_chart' | ...
  cl              DOUBLE             -- Centre line (mean)
  ucl             DOUBLE             -- Upper control limit (X-bar chart)
  lcl             DOUBLE             -- Lower control limit (X-bar chart)
  ucl_r           DOUBLE             -- UCL for range (R) chart
  lcl_r           DOUBLE             -- LCL for range (R) chart
  sigma_within    DOUBLE             -- Within-subgroup standard deviation
  usl             DOUBLE             -- Upper specification limit
  lsl             DOUBLE             -- Lower specification limit
  effective_from  TIMESTAMP          -- Lock validity start
  effective_to    TIMESTAMP          -- Lock validity end (NULL = no expiry)
  locked_by       STRING             -- User who locked
  locked_at       TIMESTAMP          -- When locked
  unified_mic_key STRING             -- Plant-scoped unified MIC key (added migration 014)
  provenance      STRING             -- Lock provenance / justification note
```

### Classification

| Aspect | Classification |
|--------|---------------|
| Control limit source | **Dual: stored (locked) + calculated (live)** |
| Stored limits | `spc_locked_limits` table — confirmed in V1 source code |
| Calculated limits | AIAG constants applied in frontend `calculations.runtime.ts` to subgroup data from `spc_quality_metric_subgroup_v` |
| Approval state | `locked_by` + `locked_at` fields in `spc_locked_limits`; no formal approval workflow |
| Effective dates | `effective_from` / `effective_to` in `spc_locked_limits` |
| Spec limits | `usl` / `lsl` in `spc_locked_limits` or derived from `gold_batch_quality_result_v` via view |

---

## 5. Rule / Signal Source Discovery

### Finding

**Rule detection in V1 is FRONTEND-COMPUTED, not stored in a signal table.**

From `apps/spc/frontend/src/spc/calculations.runtime.ts`:

```typescript
export function detectRules(values: number[], limits: Limits, ruleSet: RuleSet = 'weco'): SPCSignal[] {
  return ruleSet === 'nelson' ? detectNelsonRules(values, limits) : detectWECORules(values, limits)
}
```

Both `detectWECORules` and `detectNelsonRules` are pure functions operating on the chart data returned by `POST /api/spc/chart-data`. They receive the numeric values and limits, produce `SPCSignal[]` objects with rule codes.

**Rule sets:**

| Set | Rules | User-configurable |
|-----|-------|------------------|
| WECO (Western Electric) | 4 rules | Yes — localStorage `spc_rule_set = 'weco'` |
| Nelson | 8 rules | Yes — localStorage `spc_rule_set = 'nelson'` |

**No alarm storage table exists for real-time SPC signals.** The V2 assumption that `spc_quality_metrics` stores alarm rows is WRONG — `spc_quality_metrics` is a Databricks AI/BI Metric View for monitoring governance dashboards, not a signal table.

**`spc_nelson_rule_flags_mv`** — This materialized view pre-computes batch-level rule flag summaries for the scorecard and overview colouring. Its grain is `(material_id, plant_id, mic_id, batch_id)`. It is refreshed every 4 hours and is used for batch-level status colouring in the scorecard tab, not for real-time chart signal detection.

### Classification

| Aspect | Classification |
|--------|---------------|
| Real-time signal detection | **Frontend-computed** from subgroup data at render time |
| Batch-level signal summaries | **`spc_nelson_rule_flags_mv`** (MV, 4h refresh) — for scorecard/overview colouring |
| Rule set | WECO (4 rules) or Nelson (8 rules), user-selectable per session |
| Rule configurable per site/MIC | No site-level rule configuration found in V1; user preference only |
| Alarm acknowledgement | No persistent alarm acknowledgement mechanism in V1 source found |
| Alarm history table | None found — V1 does not store individual alarm events |

---

## 6. V1 → V2 Contract Mapping Matrix

### Mapping conventions

- **High** — exact V1 field/source found
- **Medium** — derivable with simple transform
- **Low** — inferred but not proven
- **Missing** — not found in V1

### 6.1 SPCMonitoringContext

| V2 Field | V1 Source | V1 Column / Expression | Transform | Confidence | Gap / Risk |
|----------|-----------|----------------------|-----------|------------|------------|
| `plantId` | `SPCContext` state | `state.selectedPlant.plant_id` | Direct | High | — |
| `plantName` | `SPCContext` state | `state.selectedPlant.plant_name` | Direct | High | — |
| `materialId` | `SPCContext` state | `state.selectedMaterial.material_id` | Direct | High | Present in V2 schema; not yet populated in mock adapter |
| `materialDescription` | `SPCContext` state | `state.selectedMaterial.material_name` | Direct | High | Present in V2 schema; not yet populated in mock adapter |
| `batchId` | N/A | Not a primary filter in V1 | N/A | Missing | V1 is material+plant not batch scoped |
| `workCentreId` | N/A | V1 uses `operation_id`, not work-centre | Rename | Low | V2 uses workCentreId; V1 uses operation_id |
| `characteristicId` | `SPCContext` state | `state.selectedMic.mic_id` | Direct | High | — |
| `activeSignals` | Computed | `detectRules()` count on current data | Requires chart data | Low | Not a stored value |
| `highestSeverity` | Computed | Derived from rule violations | Requires chart data | Low | Not a stored value |
| `lastUpdatedAt` | `spc_quality_metric_subgroup_v` | Latest `sample_timestamp` | Direct | Medium | — |

### 6.2 MonitoredSPCCharacteristic

| V2 Field | V1 Source | V1 Column / Expression | Transform | Confidence | Gap / Risk |
|----------|-----------|----------------------|-----------|------------|------------|
| `characteristicId` | `spc_characteristic_dim_mv` | `mic_id` | Direct | High | — |
| `characteristicName` | `spc_characteristic_dim_mv` | `mic_name` | Direct | High | — |
| `micId` | `spc_characteristic_dim_mv` | `mic_id` (same as characteristicId) | Direct | High | — |
| `chartType` | `spc_characteristic_dim_mv` or `spc_mic_chart_config` | `chart_type` (override or heuristic) | Direct | High | V1 uses `imr`, `xbar_r` etc.; V2 uses `individuals`, `xbar-r` etc. |
| `batchCount` | `spc_characteristic_dim_mv` | `batch_count` | Direct | High | — |
| `avgSamplesPerBatch` | `spc_characteristic_dim_mv` | Derived from batch count | Medium | Medium | — |
| `hasActiveSignal` | `spc_nelson_rule_flags_mv` | Presence of rule flag for most recent batches | Derived | Medium | MV is 4h stale |
| `highestSignalSeverity` | Not directly stored | Derived from rule flag severity | Low | Low | Not a V1 stored field |
| `operationId` | `spc_characteristic_dim_mv` | `operation_id` | Direct | High | — |
| `chartTypeSource` | `spc_mic_chart_config` | `'override'` if present, else `'heuristic'` | Logic | High | — |

### 6.3 ControlChartSeries

| V2 Field | V1 Source | V1 Column / Expression | Transform | Confidence | Gap / Risk |
|----------|-----------|----------------------|-----------|------------|------------|
| `chartId` | N/A | Generated | Generate | Medium | — |
| `chartType` | `chart-data` response | `chart_type` field | Rename enum | High | V1: `imr` → V2: `individuals`; `xbar_r` → `xbar-r` |
| `characteristicId` | `chart-data` response | `mic_id` | Direct | High | — |
| `characteristicName` | `chart-data` response | `mic_name` | Direct | High | — |
| `points[].timestamp` | `spc_quality_metric_subgroup_v` | `sample_timestamp` | Direct | High | — |
| `points[].value` | `spc_quality_metric_subgroup_v` | `subgroup_mean` (xbar-r) or `result_value` (imr) | Conditional | High | — |
| `points[].batchId` | `spc_quality_metric_subgroup_v` | `batch_id` | Direct | High | — |
| `points[].sampleId` | `spc_quality_metric_subgroup_v` | `sample_id` | Direct | High | — |
| `points[].status` | Computed client-side | `detectRules()` output | Must be computed | Medium | No stored status in V1 |
| `points[].signalIds` | Computed client-side | Rule violation codes | Must be computed | Medium | No stored signal IDs |
| `centerLine` | Computed or `spc_locked_limits.cl` | `cl` | Direct | High | Mode-dependent |
| `upperControlLimit` | Computed or `spc_locked_limits.ucl` | `ucl` | Direct | High | Mode-dependent |
| `lowerControlLimit` | Computed or `spc_locked_limits.lcl` | `lcl` | Direct | High | Mode-dependent |
| `upperSpecLimit` | `spc_quality_metric_subgroup_v.usl_spec` or `spc_locked_limits.usl` | `usl_spec` / `usl` | Direct | High | — |
| `lowerSpecLimit` | `spc_quality_metric_subgroup_v.lsl_spec` or `spc_locked_limits.lsl` | `lsl_spec` / `lsl` | Direct | High | — |
| `unitOfMeasure` | `spc_quality_metric_subgroup_v` | `unit_of_measure` | Direct | High | — |
| `limitProvenance` | `spc_locked_limits` existence check | `'imported-from-approved-source'` if locked, `'calculated-from-sample'` if live | Logic | High | — |
| `approvalState` | `spc_locked_limits.locked_by` | `'approved'` if locked_by present, else `'not-approved'` | Derived | Medium | No formal approval workflow in V1 |

**V2 fields NOT in V1:**
- `confidence` — scalar not used in V1; recommend `1.0` when source is present
- `lockedLimits` / `lockedFrom` / `lockedTo` — not in current V2 schema; should be added (see backlog)

### 6.4 CharacteristicCapability

| V2 Field | V1 Source | V1 Column / Expression | Transform | Confidence | Gap / Risk |
|----------|-----------|----------------------|-----------|------------|------------|
| `characteristicId` | `spc_capability_detail_mv` | `mic_id` | Direct | High | — |
| `characteristicName` | `spc_capability_detail_mv` | `mic_name` | Direct | High | — |
| `cp` | `spc_capability_detail_mv` | `cp` | Direct | High | — |
| `cpk` | `spc_capability_detail_mv` | `cpk` | Direct | High | — |
| `pp` | `spc_capability_detail_mv` | `pp` | Direct | High | — |
| `ppk` | `spc_capability_detail_mv` | `ppk` | Direct | High | — |
| `sampleCount` | `spc_capability_detail_mv` | `sample_count` | Direct | High | — |
| `mean` | `spc_capability_detail_mv` | `mean` | Direct | High | — |
| `standardDeviation` | `spc_capability_detail_mv` | `sigma_within` | Direct | High | — |
| `interpretation` | Derived | `capable` (Cpk≥1.33), `marginal` (1.0≤Cpk<1.33), `not-capable` (<1.0) | Threshold logic | High | V1 thresholds: CAPABLE=1.33, HIGHLY_CAPABLE=1.67, MARGINAL threshold in `capability.py` |
| `limitProvenance` | `spc_locked_limits` | As above | Derived | High | — |
| `approvalState` | `spc_locked_limits` | As above | Derived | Medium | — |

**V2 fields not in V1:** `confidence` (recommend data completeness ratio), `cpkLower`/`cpkUpper` CI bounds.

### 6.5 SPCSignal

| V2 Field | V1 Source | V1 Column / Expression | Transform | Confidence | Gap / Risk |
|----------|-----------|----------------------|-----------|------------|------------|
| `signalId` | Computed client-side | Generated from rule code + point index | Must generate | Low | No stored signal IDs in V1 |
| `characteristicId` | Chart context | `mic_id` | Direct | High | — |
| `characteristicName` | Chart context | `mic_name` | Direct | High | — |
| `materialId` | Chart context | `material_id` | Direct | High | — |
| `batchId` | Chart data point | `batch_id` | Direct | High | — |
| `plantId` | Chart context | `plant_id` | Direct | High | — |
| `chartType` | Chart context | `chart_type` | Rename enum | High | — |
| `rule` | `detectWECORules` / `detectNelsonRules` | Rule description string | Direct | High | — |
| `ruleCode` | `detectWECORules` / `detectNelsonRules` | `WE1`–`WE4` or `N1`–`N8` | Direct | High | **V2 SPCSignal schema has `ruleCode` as optional — it exists in V1** |
| `severity` | Derived | Rule-based: `critical` (N1/WE1), `high`, `medium`, `low` | Mapping | Medium | V1 severity derived from rule type |
| `detectedAt` | Chart data point | `sample_timestamp` | Direct | High | — |
| `samplePointId` | Chart data point | `sample_id` | Direct | High | — |
| `resultValue` | Chart data point | `result_value` or `subgroup_mean` | Direct | High | — |
| `recommendedAction` | Derived | SOP guidance text | Manual | Low | Not stored in V1 — must be statically defined |
| `status` | Computed | Always `active` when in current data | Hardcode | Medium | No alarm lifecycle in V1 |

**Major gap:** V2 `SPCSignal` represents a stored alarm record. V1 has no such table. Signals are ephemeral, computed from raw data at render time. V2's signal model requires a fundamental design decision: (a) compute signals from chart data like V1, or (b) pre-compute and store them in a new V2 signal table.

### 6.6 SPCAlarmHistoryItem

| V2 Field | V1 Source | Confidence | Gap |
|----------|-----------|------------|-----|
| `alarmId` | None | Missing | V1 has no alarm history table |
| `timestamp` | None | Missing | — |
| `characteristicId` | None | Missing | — |
| `rule` / `ruleCode` | None | Missing | — |
| `severity` | None | Missing | — |
| `status` | None | Missing | — |
| `acknowledgedBy` | None | Missing | — |
| `acknowledgedAt` | None | Missing | — |
| `linkedBatchId` | `spc_nelson_rule_flags_mv` | Low | Could derive from MV batches with flags |

**Finding:** V1 does not have an alarm history store. Historical signals can be approximated by re-running rule detection over archived data from `spc_quality_metric_subgroup_v` filtered by date, but this is not the same as a stored alarm log. V2's `SPCAlarmHistoryPanel` has no direct V1 equivalent as a persistent data source.

### 6.7 SPCRelatedBatch

| V2 Field | V1 Source | V1 Column / Expression | Confidence | Gap |
|----------|-----------|----------------------|------------|-----|
| `batchId` | `spc_nelson_rule_flags_mv` | `batch_id` | High | — |
| `materialId` | `spc_nelson_rule_flags_mv` | `material_id` | High | — |
| `plantId` | `spc_nelson_rule_flags_mv` | `plant_id` | High | — |
| `status` | `gold_batch_quality_result_v` | Batch disposition | Medium | Requires join to batch status |
| `relatedSignalCount` | `spc_nelson_rule_flags_mv` | Sum of rule flags for batch | Medium | — |
| `releaseImpact` | Derived | `blocking`/`risk`/`none` from signal count ratio | Low | Classification logic needs definition |
| `drillThroughTarget` | V2 internal | Static `'quality-batch-release'` | High | — |

### 6.8 SPCSummary

| V2 Field | V1 Source | Confidence | Gap |
|----------|-----------|------------|-----|
| `chartsMonitored` | `spc_characteristic_dim_mv` count | High | — |
| `activeSignals` | Computed from current chart data | Low | No stored aggregate; must compute |
| `outOfControlSignals` | Computed | Low | — |
| `warningSignals` | Computed | Low | — |
| `characteristicsAtRisk` | `spc_nelson_rule_flags_mv` with recent flags | Medium | 4h stale |
| `highestSeverity` | Derived from rule flags | Medium | — |
| `recommendedAction` | Static text | Low | Not stored in V1 |
| `confidence` | Derived | Low | Not a V1 concept |

---

## 7. V1 → V2 Navigation Model Gap

**Critical structural gap:** V2's `SPCMonitoringAdapterRequest` uses `plantId + workCentreId` as primary scope. V1 uses `material_id → plant_id → mic_id` navigation hierarchy.

| V2 Request Param | V1 Equivalent | Notes |
|-----------------|---------------|-------|
| `plantId` | `plant_id` | Correct but secondary in V1 |
| `workCentreId` | `operation_id` | Different concept — V2 "work centre" ≠ V1 "operation" |
| `materialId` | `material_id` | **Present in V2 request interface but not used as primary key in V2 context schema** |
| `batchId` | N/A | Not a primary V1 filter |
| `characteristicId` | `mic_id` | Direct match |

**V1 entry point:** user first picks `material_id`, then `plant_id`. V2 currently assumes plant is primary. This must be resolved before V1 API wiring.

---

## 8. V1 Chart Type Naming Differences

| V1 chart_type | V2 ChartTypeSchema | Notes |
|---------------|-------------------|-------|
| `imr` | `individuals` | Rename required |
| `xbar_r` | `xbar-r` | Rename required |
| `xbar_s` | `xbar-s` | Rename required |
| `p_chart` | `p-chart` | Rename required |
| `np_chart` | `np-chart` | Rename required |
| `c_chart` | `c-chart` | Rename required |
| `u_chart` | `u-chart` | Rename required |
| `ewma` | Not in V2 schema | Missing from V2 ChartTypeSchema |
| `cusum` | Not in V2 schema | Missing from V2 ChartTypeSchema |

---

## 9. V2 Implementation Options

### Option 1 — Proxy to V1 SPC FastAPI backend (legacy-api tier)

Wire V2's `SPCMonitoringLegacyApiAdapter` to call the V1 SPC FastAPI backend at `apps/spc/`.

- **Effort:** Medium (8–12 days): FastAPI proxy routes + adapter mapping + navigation model change + contract tests
- **Risk:** Medium — V1 API uses POST bodies and material-centric navigation; V2 must adapt request/response shapes
- **UAT suitability:** High — uses live V1 Databricks data in `connected_plant_uat.gold`
- **Production suitability:** Medium — depends on V1 SPC app remaining deployed
- **Test approach:** Mock V1 responses in proxy adapter tests; E2E against V1 app in UAT

**Required work before this option:**
1. Confirm V1 SPC app URL and OAuth routing in the deployed UAT environment
2. Add `materialId` as a required field to `SPCMonitoringAdapterRequest`
3. Implement `GET /api/spc/materials`, `GET /api/spc/plants`, `GET /api/spc/characteristics` proxy routes
4. Implement `POST /api/spc/chart-data` proxy route
5. Map V1 response shape to V2 `ControlChartSeries` contract (enum rename, compute-derived fields)
6. Update V2 workspace entry flow to be material-first

### Option 2 — Direct Databricks API (databricks-api tier, bypass V1 FastAPI)

Wire V2's `SPCMonitoringDatabricksApiAdapter` to query `connected_plant_uat.gold` directly.

- **Effort:** High (15–20 days): SQL queries + signal computation logic + full adapter implementation
- **Risk:** Medium — gold views exist; column verification needed; signal computation must be re-implemented in Python or frontend
- **UAT suitability:** High once verified
- **Production suitability:** High — V1 FastAPI not needed long-term
- **Test approach:** Column verification queries; contract tests with mock Databricks responses

**Required work before this option:**
1. Verify gold view column names match V1 documentation (run verification queries)
2. Decide on signal computation approach (Python domain layer or frontend-only)
3. Implement DAL queries for each adapter method
4. Port V1 AIAG constants and control limit calculation to Python or preserve frontend computation

### Option 3 — Keep SPC sandbox; create V1-to-V2 adapter skeleton only

Keep current mock adapter. Add typed adapter skeleton with documented V1 field mappings as TODO comments. Do not implement live endpoints.

- **Effort:** Low (2–3 days): skeleton + documentation
- **Risk:** Very low
- **UAT suitability:** No (mock only)
- **Production suitability:** No

### Recommendation

**Option 1 first, Option 2 later.** Proxy to V1 SPC FastAPI backend provides the fastest path to live SPC UAT with minimal data engineering risk. Option 2 (native Databricks) should follow after pilot sign-off, when V1 SPC backend is scheduled for retirement.

**Prerequisite before either option:** Confirm V1 SPC app is deployed and reachable from V2 in the UAT Databricks Apps environment. Check if the SPC app has a stable URL accessible to the ConnectIO-RAD V2 app's OAuth context.

---

## 10. Open Questions

1. **Is the V1 SPC app currently deployed in the UAT Databricks workspace?** The Makefile shows `TRACE_CATALOG=connected_plant_uat` and Warehouse ID `e76480b94bea6ed5`. Is this app still running and accessible?

2. **Is the V1 SPC app deployed at a known URL (Databricks Apps URL)?** If so, V2 legacy-api adapter can proxy to it.

3. **Are all 20 SQL migrations applied in UAT?** Some migrations (e.g., `spc_nelson_rule_flags_mv`, `spc_capability_detail_mv`) may not be deployed if the V1 app was not fully migrated.

4. **What is the V1 SPC frontend chart library?** From the ADR (`docs/adr/002-spc-interactive-chart-not-migrated-to-shared-reporting.md`), V1 uses `apps/spc/frontend` with bespoke chart components. V2 uses SVG. This affects any chart rendering decisions.

5. **Does V1 SPC have any UAT candidate data (real plant/material/MIC combinations with existing SPC data)?** No confirmed candidate found in V1 source code. UAT data validation needed.

6. **What is the `GENIE_SPACE_ID` for the V1 SPC Genie integration?** V1 has Genie chat configured but V2 does not need this at pilot stage.

7. **How should V2 handle the signal computation decision?** V1 computes signals client-side at render time. V2's `SPCSignal` and `SPCAlarmHistoryItem` contracts assume stored signals. Should V2 also compute signals client-side and not model them as stored objects?

8. **Is `spc_quality_metrics` (WITH METRICS LANGUAGE YAML) accessible via SQL warehouse queries?** Or does it require a different execution path (Lakehouse Monitoring API)?

9. **Has any UAT SPC data been verified in `connected_plant_uat.gold.spc_quality_metric_subgroup_v`?** The view exists per V1 migration code but column verification against UAT has not been done.

10. **What is the `operation_id` → work-centre mapping?** V1 uses `operation_id` from SAP QM inspection operations. V2 uses `workCentreId`. These may not map 1:1.

---

## 11. Backlog Items

| ID | Item | Priority | Effort | Prerequisite |
|----|------|----------|--------|--------------|
| SPC-B01 | Confirm V1 SPC app deployment URL and OAuth accessibility | Critical | 0.5d | None |
| SPC-B02 | Add `materialId` as first-class required field to `SPCMonitoringAdapterRequest` | Critical | 0.5d | None |
| SPC-B03 | Update V2 SPC workspace entry flow to material-first navigation | High | 2d | SPC-B02 |
| SPC-B04 | Add `material_id` primary key dimension to V2 `spc_locked_limits` DDL notes | High | 0.5d | None |
| SPC-B05 | Correct `spc_quality_metrics` description (it is an AI/BI Metric View, not a signal table) | High | 0.5d | None |
| SPC-B06 | Add chart type enum rename mapping to V2 contract notes (imr→individuals, xbar_r→xbar-r) | High | 0.5d | None |
| SPC-B07 | Run V1 gold view column verification queries in UAT (`spc_quality_metric_subgroup_v`) | High | 1d | V1 UAT access |
| SPC-B08 | Implement FastAPI proxy routes for V1 SPC metadata endpoints | High | 2d | SPC-B01 |
| SPC-B09 | Implement FastAPI proxy routes for V1 SPC chart-data endpoint | High | 3d | SPC-B01, SPC-B08 |
| SPC-B10 | Implement `SPCMonitoringLegacyApiAdapter` with V1 field mapping | High | 3d | SPC-B09 |
| SPC-B11 | Update V2 `spc_locked_limits` DDL schema to match V1 actual schema | Medium | 1d | None |
| SPC-B12 | Decide signal computation model (frontend-computed vs stored) | Medium | 1d design | None |
| SPC-B13 | Add `lockedLimits` flag + effective date range to `ControlChartSeries` schema | Medium | 1d | None |
| SPC-B14 | Verify `spc_nelson_rule_flags_mv` exists and is queryable in connected_plant_uat | Medium | 0.5d | V1 UAT access |
| SPC-B15 | Add EWMA and CUSUM to V2 `ChartTypeSchema` | Low | 0.5d | None |
| SPC-B16 | Add UAT candidate discovery (confirmed plant/material/MIC combination with live SPC data) | Medium | 1d | V1 UAT access |
| SPC-B17 | Make `ruleCode` required in `SPCSignal` schema (field already exists as optional; V1 always provides it) | Medium | 0.5d | None |

---

## 12. Confirmed Findings Summary

| Claim | Finding | Source |
|-------|---------|--------|
| "No V1 SPC backend exists" | **FALSE** — full SPC app at `apps/spc/` in ConnectIO-RAD | `apps/spc/backend/spc_backend/main.py` |
| "SPC data does not exist in Databricks" | **FALSE** — `spc_quality_metric_subgroup_v`, `spc_locked_limits` etc. deployed to `connected_plant_uat.gold` | `apps/spc/Makefile`, `apps/spc/scripts/migrations/` |
| "spc_quality_metrics is a signal table" | **FALSE** — it is a Databricks AI/BI Metric View (WITH METRICS LANGUAGE YAML) | `apps/spc/scripts/migrations/006_create_spc_quality_metrics_mv.sql` |
| "Rule violations are stored in spc_quality_metrics" | **FALSE** — signals are computed at runtime in frontend by `detectWECORules()` / `detectNelsonRules()` | `apps/spc/frontend/src/spc/calculations.runtime.ts` |
| "spc_locked_limits primary key is (PLANT_ID, MIC_ID)" | **FALSE** — actual PK is (material_id, mic_id, plant_id, operation_id, chart_type) | `apps/spc/backend/spc_backend/chart_config/dal/locked_limits.py` |
| "V1 entry point is plantId + workCentreId" | **PARTIALLY FALSE** — V1 entry is material_id → plant_id; workCentreId is NOT a V1 concept (V1 uses operation_id) | `apps/spc/frontend/src/spc/SPCFilterBar.tsx`, `queryKeys.ts` |
| "No legacy-api adapter mode is supported" | **OUTDATED** — a legacy-api adapter exists but returns unavailable(); V1 endpoint shapes are now known | `domain-integrations/spc/src/adapters/spc-monitoring-legacy-api-adapter.ts` |

---

## Confirmation

- No Databricks SQL was invented or assumed in this document.
- No fake UAT candidate data was created.
- No production SPC readiness is claimed.
- V2 SPC remains mock/sandbox until the V1 source mapping is verified and live routes/adapters are implemented and tested.
- No write-back or live route was added.
- No existing V2 tests, panels, or Zod schemas were modified.
