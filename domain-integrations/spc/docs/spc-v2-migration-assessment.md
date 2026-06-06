# Statistical Process Control (SPC) — V2 Migration Assessment

**Date:** 2026-05-20  
**Status:** Under Review / Planning  
**Target Architecture:** V2 Hybrid (FastAPI Proxy + React-Client Rule Engine)  

---

## 1. Executive Summary & Strategy Recommendation

This assessment addresses the migration of the Statistical Process Control (SPC) module from ConnectIO-RAD V1 (`apps/spc/` in the V1 repository) to ConnectIO RAD V2 (`domain-integrations/spc/` in the V2 repository). 

Discovery has revealed that V1 contains a mature, fully deployed SPC implementation utilizing a FastAPI backend and a React/TypeScript frontend querying Databricks gold-layer tables. However, architectural differences between V2's initial design assumptions and V1's physical realities present significant integration blockers.

### Decision Matrix: Reuse, Wrap, or Rebuild

| Dimension | Option A: Full Rebuild in V2 | Option B: Direct Databricks SQL in V2 | Option C: Wrap & Proxy V1 Backend (Recommended) |
|---|---|---|---|
| **Description** | Re-implement all SQL composition, capability, and rule checking in V2 FastAPI. | Port V1's Databricks SQL statements directly into V2 Node/Go/Python adapters. | Add V2 FastAPI proxy routes targeting the V1 backend; map payloads in V2 React adapters. |
| **Effort** | 🔴 Extremely High (4–6 weeks) | 🟡 High (2–3 weeks) | 🟢 Low-Medium (5–7 days) |
| **Risk of Drift** | 🔴 High (re-implementing complex SPC maths / Nelson rules). | 🟡 Medium (copying SQL query templates / cursor logic). | 🟢 Low (uses the exact same verified backend logic as V1). |
| **GxP Impact** | 🔴 High (requires full validation of all re-coded algorithms). | 🟡 Medium (requires validation of SQL transformations). | 🟢 Low-Medium (reuses existing validated V1 backend math). |
| **Performance** | 🟢 Optimal (native V2 execution). | 🟢 Optimal (direct DB connections). | 🟡 Sub-optimal (adds one extra REST hop, but well within budgets). |

### Recommended Strategy: Wrap & Proxy (Option C)
We recommend **wrapping and proxying the existing V1 FastAPI backend endpoints** through V2's FastAPI api gateway (`apps/api`), combined with a **client-side rule computation engine** in the V2 React frontend (reusing V1's audited `calculations.runtime.ts` code). 

This strategy maximizes code reuse, preserves the verified V1 SQL query structures, and eliminates the risk of introducing statistical calculation discrepancies.

---

## 2. V1 vs. V2 Architectural Mapping

The core misalignment between V2's initial design assumptions and V1's deployed reality lies in the navigation model and the location of the rule engine.

```mermaid
graph TD
    subgraph V1 Architecture (Material-Centric)
        V1_UI[React UI: Material -> Plant -> MIC]
        V1_API[FastAPI Backend: spc_backend]
        V1_DB[(Databricks SQL: gold_batch_quality_result_v)]
        V1_UI -->|Auth Token Passthrough| V1_API
        V1_API -->|Parameterized SQL Query| V1_DB
        V1_UI -->|Client-Side Rules| V1_Rules[calculations.runtime.ts]
    end

    subgraph Proposed V2 Integration (Wrapped & Proxied)
        V2_UI[React UI: updated to Material-First]
        V2_Gateway[FastAPI Proxy: apps/api/routes/spc.py]
        V2_UI -->|V2 Adapters| V2_Gateway
        V2_Gateway -->|OIDC Token Passthrough| V1_API
    end
    
    style V1_Rules fill:#e1f5fe,stroke:#0288d1,stroke-width:2px
    style V2_Gateway fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
```

### A. Navigation & Entry Point: Material-Centric vs. Material-Agnostic
*   **V2 Original Assumption:** Plant/Work-Centre entry. The V2 `SPCMonitoringAdapterRequest` assumed that plant-level scopes are the primary entry key, and that material constraints are optional.
*   **V1 Deployed Reality:** The V1 SPC database indexes and queries are highly **material-centric**. In Databricks, querying quantitative results across an entire plant without filtering by `material_id` is a full table scan that violates SQL resource limits and triggers 504 timeouts.
*   **Reconciliation:** V2 must update its UI navigation and `SPCMonitoringAdapterRequest` to make `materialId` a **first-class required parameter** for all primary SPC endpoints.

### B. Rule Engine: Client-Side vs. Database Alarm Store
*   **V2 Original Assumption:** The `spc_quality_metrics` table is a persistent database store containing active rule violations and alarm histories.
*   **V1 Deployed Reality:** Violations of Western Electric and Nelson rules are **calculated on the fly** in the frontend client (`calculations.runtime.ts`) using the raw points retrieved from `spc_quality_metric_subgroup_v`. The table `spc_quality_metrics` is actually a Databricks *AI/BI Metric View* with YAML-defined semantic definitions used for aggregate BI scorecards, not a transaction log.
*   **Reconciliation:** V2 should adopt V1's client-side calculation strategy by porting the `calculations.runtime.ts` file to `@connectio/evidence-panel-runtime` or the `di-spc` package. This allows real-time rendering of warning and out-of-control states without introducing db write latency.

---

## 3. Delta Table Schema Reconciliations

V2's previous documentation proposed DDL statements that do not match V1's deployed Delta tables. These misalignments must be resolved before executing any direct database queries or writes.

### DDL Comparison: `spc_locked_limits`

```sql
-- OUTDATED V2 PROPOSAL (INCORRECT - DO NOT DEPLOY)
CREATE TABLE `connected_plant_uat`.`gold`.`spc_locked_limits` (
    `MIC_ID` STRING NOT NULL,
    `MIC_NAME` STRING NOT NULL,
    `PLANT_ID` STRING NOT NULL,
    `WORK_CENTRE_ID` STRING,
    `CL` DOUBLE NOT NULL,
    `UCL` DOUBLE NOT NULL,
    `LCL` DOUBLE NOT NULL
    -- Missing material_id
);

-- ACTUAL V1 SCHEMA (DEPLOYED - USE FOR SOURCE TRUTH)
CREATE TABLE `connected_plant_uat`.`gold`.`spc_locked_limits` (
  material_id    STRING  NOT NULL  COMMENT 'SAP material number',
  mic_id         STRING  NOT NULL  COMMENT 'Inspection characteristic code',
  plant_id       STRING            COMMENT 'Plant ID (NULL = all plants)',
  operation_id   STRING            COMMENT 'Inspection operation step',
  chart_type     STRING  NOT NULL  COMMENT 'imr, xbar_r, xbar_s, or attribute chart type',
  cl             DOUBLE            COMMENT 'Centre line (grand mean or mean of means)',
  ucl            DOUBLE            COMMENT 'Upper control limit (individuals / Xbar)',
  lcl            DOUBLE            COMMENT 'Lower control limit (individuals / Xbar)',
  ucl_r          DOUBLE            COMMENT 'UCL for the secondary chart (moving range, range, or sigma)',
  lcl_r          DOUBLE            COMMENT 'LCL for the secondary chart (moving range, range, or sigma)',
  sigma_within   DOUBLE            COMMENT 'Estimated within-subgroup sigma',
  baseline_from  STRING            COMMENT 'Start of the baseline period used to lock limits',
  baseline_to    STRING            COMMENT 'End of the baseline period used to lock limits',
  unified_mic_key STRING           COMMENT 'Populated for cross-plant mapped MICs',
  mic_origin     STRING            COMMENT 'GENERIC | LOCAL | MIXED',
  spec_signature STRING            COMMENT 'LSL|USL|Nominal spec fingerprint at lock time',
  locking_note   STRING            COMMENT 'User justification note',
  locked_by      STRING  NOT NULL  COMMENT 'Databricks identity who locked limits',
  locked_at      TIMESTAMP NOT NULL COMMENT 'Timestamp when limits were locked'
) USING DELTA;
```

### DDL Comparison: `spc_exclusions`

```sql
-- DEPLOYED V1 SCHEMA (USE FOR SOURCE TRUTH)
CREATE TABLE `connected_plant_uat`.`gold`.`spc_exclusions` (
  event_id            STRING    NOT NULL  COMMENT 'UUID event identifier',
  material_id         STRING    NOT NULL  COMMENT 'SAP material number',
  mic_id              STRING    NOT NULL  COMMENT 'Inspection characteristic code',
  mic_name            STRING              COMMENT 'Inspection characteristic name',
  operation_id        STRING              COMMENT 'Inspection operation step',
  plant_id            STRING              COMMENT 'Plant ID',
  stratify_all        BOOLEAN             COMMENT 'True if exclusion applies to all strata',
  stratify_by         STRING              COMMENT 'Field used to stratify data (e.g. plant_id)',
  chart_type          STRING    NOT NULL  COMMENT 'imr, xbar_r, etc.',
  date_from           STRING              COMMENT 'Start of exclusion window',
  date_to             STRING              COMMENT 'End of exclusion window',
  rule_set            STRING              COMMENT 'WECO | NELSON',
  justification       STRING    NOT NULL  COMMENT 'Reasoning for point exclusion',
  action              STRING              COMMENT 'Exclusion action code',
  excluded_count      INT       NOT NULL  COMMENT 'Number of points excluded',
  excluded_points_json STRING   NOT NULL  COMMENT 'JSON array of excluded points (sample/batch IDs)',
  before_limits_json  STRING              COMMENT 'UCL/LCL/CL state prior to exclusion',
  after_limits_json   STRING              COMMENT 'UCL/LCL/CL state after exclusion',
  user_id             STRING    NOT NULL  COMMENT 'Databricks user ID',
  event_ts            TIMESTAMP NOT NULL  COMMENT 'Timestamp when exclusion was saved'
) USING DELTA;
```

---

## 4. API Endpoint & Data Contract Mapping Matrix

To support the proxy strategy, V2's domain adapters (`packages/data-contracts/src/schemas/spc-monitoring.ts`) must map properties returned by V1 FastAPI endpoints (`spc_backend`).

| V2 React Adapter Method | V1 FastAPI Route | Request Model Map | Response Contract Mapping & Transformations |
|---|---|---|---|
| `getSPCMonitoringContext` | (Client-side local UI state) | N/A | Combines active material/plant selection details. |
| `getSPCSummary` | `/api/spc/scorecard` (derived) | `{ material_id, plant_id }` | Calculate totals of out-of-spec batches to derive summary stats. |
| `getActiveSPCSignals` | `/api/spc/chart-data` (derived) | `{ material_id, mic_id, plant_id }` | Call `chart-data`, run Nelson/WECO rule engine on the client, return active signals list. |
| `getMonitoredCharacteristics` | `/api/spc/characteristics` | `{ material_id, plant_id }` | Maps V1 characteristic list to V2 `MonitoredSPCCharacteristic` schema. |
| `getControlChartSeries` | `/api/spc/chart-data` | `{ material_id, mic_id, plant_id, operation_id }` | Maps V1 observation points array to V2 `ControlChartSeries` and `ControlChartPoint`. |
| `getCharacteristicCapability` | `/api/spc/scorecard` (filter) | `{ material_id, plant_id }` | Extracts Cpk, Ppk, Pp, Cp from the scorecard row matching the target `mic_id`. |
| `getSPCAlarmHistory` | `/api/spc/exclusions` (audit) | `{ material_id, mic_id }` | List persistent exclusions as audit log events. |
| `getSPCRelatedBatches` | `/api/spc/chart-data` (derived) | `{ material_id, mic_id }` | Extracts unique batch IDs and valuation flags (`A`/`R`) from the series. |

---

## 5. UAT Data Verification Strategy

Before validating UAT candidates, we must verify that UAT databases contain realistic data in `spc_quality_metric_subgroup_v` and that column names match the DDL contracts.

### Verification Queries (To be executed via Databricks Workspace)

#### 1. Column Check DDL Verification
```sql
DESCRIBE TABLE connected_plant_uat.gold.spc_locked_limits;
DESCRIBE TABLE connected_plant_uat.gold.spc_exclusions;
DESCRIBE TABLE connected_plant_uat.gold.spc_quality_metric_subgroup_v;
```

#### 2. Candidate Discovery (Retrieve High-Volume Combinations)
```sql
SELECT
  material_id,
  plant_id,
  mic_id,
  COUNT(DISTINCT batch_id) AS batch_count,
  COUNT(*) AS sample_points
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
WHERE sample_timestamp >= DATEADD(day, -90, CURRENT_TIMESTAMP())
GROUP BY material_id, plant_id, mic_id
HAVING COUNT(DISTINCT batch_id) >= 15
ORDER BY sample_points DESC
LIMIT 5;
```

---

## 6. Implementation Backlog & Roadmap

The roadmap to transition SPC from Sandbox to Live data execution consists of 12 discrete backlog items:

### Phase 1: Request Model & UI Alignment (Estimated: 2 days)
*   **SPC-B01: UI Navigation Refactor**
    *   *Description:* Change V2 SPC workspace navigation from plant-first to material-first, matching the V1 user entry flow.
    *   *Files:* `domain-integrations/spc/src/spc-monitoring-workspace.tsx`
*   **SPC-B02: Adapter Request Updates**
    *   *Description:* Make `materialId` a required parameter in `SPCMonitoringAdapterRequest`.
    *   *Files:* `domain-integrations/spc/src/adapters/spc-monitoring-adapter.ts`

### Phase 2: Gateway Proxy Configuration (Estimated: 2 days)
*   **SPC-B03: Backend Router Creation**
    *   *Description:* Create a new FastAPI router file `apps/api/routes/spc.py` that handles proxy requests to V1 backend endpoints.
    *   *Files:* `apps/api/routes/spc.py` (New), `apps/api/main.py`
*   **SPC-B04: Token Forwarding & Auth Headers**
    *   *Description:* Ensure the end-user's Bearer token is safely extracted and forwarded to the V1 target in all proxy requests.
    *   *Files:* `apps/api/routes/spc.py`

### Phase 3: Adapter Implementation & Mapping (Estimated: 2 days)
*   **SPC-B05: Legacy API Adapter**
    *   *Description:* Complete the `SPCMonitoringLegacyApiAdapter` to call the V2 gateway proxy and map response payloads.
    *   *Files:* `domain-integrations/spc/src/adapters/spc-monitoring-legacy-api-adapter.ts`
*   **SPC-B06: Client-Side Rule Engine Porting**
    *   *Description:* Port V1's `calculations.runtime.ts` rule calculations into V2 frontend libraries to evaluate Nelson/WECO rules dynamically.
    *   *Files:* `domain-integrations/spc/src/utils/calculations.runtime.ts` (New)

---

> [!CAUTION]
> **GxP regulatory warning:** The SPC module renders parameters critical to product safety and regulatory compliance (e.g. moisture limits, pasteurisation pH). Any calculation of control limits or validation of rules must be verified against analytical verification datasets before the module can be marked ready for production decision-support.
