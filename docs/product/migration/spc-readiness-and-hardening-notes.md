# SPC Readiness & Hardening Notes

**Date:** 2026-05-18  
**Domain:** `di-spc` (Statistical Process Control)  
**Status:** **High-Fidelity Sandbox / Native Readiness Audit Completed**

---

## 1. Executive Summary & Strategy

The ConnectIO RAD V2 **SPC Monitoring** workspace is a core capability designed to track and control key quality characteristics (e.g., pH, Moisture %, Salt %) at manufacturing plants. To maintain the integrity of our quality systems (under GxP and ISO 9001 guidelines), **we do not present simulated data as live, nor do we invent control limits or alarm rules.**

This document summarizes our current state, classifies our candidate backend data sources, and defines the precise unblocking DDL actions required to transition from high-fidelity sandbox mode to native Databricks SQL execution.

---

## 2. Monorepo SPC Structural Audit

The current Monorepo SPC architecture consists of the following components:

### A. Workspace
- **Name:** `spc-monitoring`
- **Route:** `/quality/spc-monitoring`
- **Supported Roles:** Quality Lead, QA Technician, Food Safety Lead, Operations Supervisor, Plant Manager
- **Required Permissions:** `spc.read`
- **Supported Scopes:** `plant`, `line`, `work-centre`, `material`, `batch`

### B. Views & Associated Panels
The workspace comprises 6 views composing 7 evidence panels:

| View | Associated Panels | Core Adapter Method | Mock/Wired Status |
|---|---|---|---|
| **Chart Overview** | `SPCSummaryPanel`<br>`ActiveSPCSignalsPanel`<br>`ControlChartPanel` | `getSPCSummary`<br>`getActiveSPCSignals`<br>`getMonitoredCharacteristics` | Mock Only |
| **Active Signals** | `ActiveSPCSignalsPanel`<br>`SPCProcessContextPanel` | `getActiveSPCSignals` | Mock Only |
| **Characteristic Review** | `ControlChartPanel`<br>`CharacteristicCapabilityPanel` | `getControlChartSeries`<br>`getCharacteristicCapability` | Mock Only |
| **Capability** | `CharacteristicCapabilityPanel`<br>`SPCSummaryPanel` | `getCharacteristicCapability` | Mock Only |
| **Alarm History** | `SPCAlarmHistoryPanel`<br>`SPCRelatedBatchesPanel` | `getSPCAlarmHistory`<br>`getSPCRelatedBatches` | Mock Only |
| **Chart Configuration (Read-only)** | `SPCProcessContextPanel`<br>`CharacteristicCapabilityPanel` | `getSPCMonitoringContext` | Mock Only |

### C. Backend API Routes
There are **zero** FastAPI route handlers registered under `apps/api/routes` for the `/api/spc/*` endpoints. All requests fall back to client-side mock adapters.

---

## 3. Data Source Truth & Classification

To prepare for future native Databricks SQL query execution, we have audited the target catalog (`connected_plant_uat.gold` / `connected_plant_uat.csm_process_order_history`) to classify the availability of the required candidate tables and views.

### Source Truth Matrix

We classify each candidate view under one of the five standard levels:
- **confirmed-ddl:** DDL exists, columns verified queryable in UAT.
- **confirmed-v1:** View verified in standalone V1 backend code.
- **referenced-only:** Referenced in design documents but not present in database/V1 source.
- **missing:** View or table is explicitly absent from UAT catalog.
- **unknown:** Unconfirmed presence, metadata missing.

| Candidate Source | Domain Catalog / Schema | Classification | Rationale & Gaps |
|---|---|---|---|
| `gold_batch_quality_result_v` | `connected_plant_uat.gold` | **confirmed-ddl** | Shared with Trace/EnvMon. Verified schema contains `INSPECTION_LOT_ID`, `OPERATION_ID`, `SAMPLE_ID`, `MIC_NAME`, `QUANTITATIVE_RESULT`, `INSPECTION_RESULT_VALUATION`, `UPPER_TOLERANCE`, `LOWER_TOLERANCE`. |
| `gold_inspection_lot` | `connected_plant_uat.gold` | **confirmed-ddl** | Contains inspection lot headers, plant IDs, and lot types. |
| `gold_inspection_point` | `connected_plant_uat.gold` | **confirmed-ddl** | Maps inspection points and functional locations. |
| `spc_quality_metrics` | `connected_plant_uat.gold` | **confirmed-v1 (different type)** | **UPDATED 2026-05-20:** This is a Databricks AI/BI Metric View (`WITH METRICS LANGUAGE YAML`), NOT a signal/alarm storage table. It exists in the V1 SPC app (`apps/spc/scripts/migrations/006_create_spc_quality_metrics_mv.sql`). V2 docs incorrectly assumed it was a signal table. Real-time rule violations are computed client-side in V1. DDL presence in UAT unverified. |
| `spc_quality_metric_subgroup_v` | `connected_plant_uat.gold` | **confirmed-v1 (unverified in UAT)** | **UPDATED 2026-05-20:** View exists in V1 source (`apps/spc/scripts/migrations/005_create_spc_quality_metric_subgroup_v.sql`). Primary chart data source in V1. Presence in connected_plant_uat.gold unverified — column verification query required. |
| `spc_locked_limits` | `connected_plant_uat.gold` | **confirmed-v1 (schema differs from V2 DDL)** | **UPDATED 2026-05-20:** Table exists in V1 (`apps/spc/scripts/migrations/000_setup_locked_limits.sql`). Primary key includes `material_id` — missing from V2's proposed DDL below. V2 DDL below is INCORRECT and must not be used to create this table. See `spc-v1-source-discovery.md` for the correct schema. |
| `spc_correlation_source_mv` | `connected_plant_uat.gold` | **confirmed-v1** | Exists in V1 (`apps/spc/scripts/migrations/016_create_spc_correlation_source_mv.sql`). Used for correlation analysis. UAT presence unverified. |
| `spc_nelson_rule_flags_mv` | `connected_plant_uat.gold` | **confirmed-v1** | Materialized view for batch-level rule flag summaries. Grain: (material_id, plant_id, mic_id, batch_id). NOT a real-time signal source. UAT presence unverified. |
| `spc_capability_detail_mv` | `connected_plant_uat.gold` | **confirmed-v1** | Materialized view for Cp/Cpk/Pp/Ppk. UAT presence unverified. |

---

## 4. Integration Boundary — Updated Status (2026-05-20)

> [!IMPORTANT]
> **V1 SOURCE DISCOVERED — BLOCKER IS MAPPING, NOT MISSING DATA**
>
> V1 source discovery (see `domain-integrations/spc/docs/spc-v1-source-discovery.md`) confirmed that:
>
> - `spc_quality_metric_subgroup_v`, `spc_locked_limits`, and related objects exist in V1 and are deployed to `connected_plant_uat.gold`
> - `spc_quality_metrics` is a Databricks AI/BI Metric View — NOT a signal/alarm storage table
> - Rule violations in V1 are computed client-side at runtime, not stored
> - The V1 SPC data model is material-centric; V2 must adapt its request model
>
> **The previous DDL plan in Section 5 below is OUTDATED and INCORRECT.** Do not use the DDL scripts below to create tables — they use wrong column names and miss the `material_id` PK dimension. The correct DDL is in the V1 migration scripts at `apps/spc/scripts/migrations/`.
>
> **Current safe integration path:**
> 1. Confirm V1 SPC app URL in UAT (backlog SPC-B01)
> 2. Add `materialId` to `SPCMonitoringAdapterRequest` (SPC-B02)
> 3. Implement proxy routes to V1 SPC backend (SPC-B08, SPC-B09)
> 4. Implement `SPCMonitoringLegacyApiAdapter` mapping (SPC-B10)
>
> Until these steps are complete, SPC adapters must remain mock-only. Do not invent control limits or wire native Databricks queries without verified column mappings.

---

## 5. Unblocking Data DDL Plan — DEPRECATED (2026-05-20)

> [!WARNING]
> **SECTION 5 IS DEPRECATED AND RETIRED**
> 
> The DDL statements previously listed in this section are incorrect because they assumed a new, material-agnostic schema design. Real-time SPC database queries must match the actual material-centric schemas deployed by the V1 app.
> 
> For the correct schemas, view the [SPC V2 Migration Assessment](../spc-v2-migration-assessment.md) and [SPC V1 Source Discovery](../spc-v1-source-discovery.md) documents. Do not use the scripts below to create tables or views in `connected_plant_uat.gold`.

