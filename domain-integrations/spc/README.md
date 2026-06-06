# Statistical Process Control (SPC) Domain Integration

This directory houses the SPC domain-integration components, including adapters, queries, views, workspaces, and Evidence Panels.

## Current Readiness & Source Status (Read-Only UAT)

- **Current Source Mode**: High-Fidelity Sandbox / Read-Only UAT.
- **Data Veracity**: Simulated data for workflow and UI layout validation. All control limits and signals are marked as **unverified**.
- **Regulatory Status**: Do **not** use the limits, centrelines, or warning signals rendered in this sandbox for regulatory decisions.

## UAT Readiness Documentation

- [SPC UAT Acceptance Script](./docs/spc-uat-acceptance-script.md)
- [SPC Known Limitations](./docs/spc-known-limitations.md)
- [SPC Readiness & Hardening Notes](../../docs/migration/spc-readiness-and-hardening-notes.md)
- [V1 Genie Discovery and V2 Parity Roadmap](../../docs/migration/v1-genie-discovery-and-v2-parity-roadmap.md)
- [SPC Genie Readiness Pack](./docs/spc-genie-readiness-pack.md)

## Databricks Verification Pack

- [Databricks Source Verification](./docs/spc-databricks-source-verification.md) — SQL queries and handoff checklist
- [Databricks Verification Results Summary](./docs/spc-databricks-verification-results-summary.md) — PR #65 results
- [Data Model Grain Assessment](./docs/spc-data-model-grain-assessment.md) — grain verification queries
- [Navigation Model Verification](./docs/spc-navigation-model-verification.md) — material→plant→MIC hierarchy
- [Control Limit Provenance Verification](./docs/spc-control-limit-provenance-verification.md) — locked limits DDL
- [Rule / Signal Source Verification](./docs/spc-rule-signal-source-verification.md) — frontend vs stored
- [Capability Verification](./docs/spc-capability-verification.md) — Cp/Cpk/Pp/Ppk source
- [Golden SPC Candidates](./docs/golden-spc-candidates.md) — PR #65 partially-verified candidates
- [V2 Contract Mapping](./docs/spc-v2-contract-mapping.md) — field-by-field mapping aligned to verified schema
- [Native Migration Readiness Checklist](./docs/spc-native-migration-readiness-checklist.md) — go/no-go gate

## Semantic-Model Functional Parity Audit

- [SPC Semantic-Model Functional Parity Audit](./docs/spc-semantic-model-functional-parity.md) — compares standalone `timgeldard/spc` app, ConnectIO-RAD, and Databricks `spc_*` objects; identifies surfacing gaps vs. true missing features; recommends a safe 7-phase migration sequence

## Native Contract Alignment (post-PR #65)

After PR #65, the [contract-alignment tranche](./docs/spc-native-contract-alignment-audit.md)
re-checked every V2 SPC contract field against the verified Databricks schema.
The result is that V2 contracts, fixtures, helper mappings, and an
implementation plan are aligned to the verified Databricks schema. The native `GET /api/spc/subgroups` is wired, but **browser UAT is pending**. The legacy V1 bridge remains the
recommended short-term path. The following sit on this branch
(`feature/spc-native-contract-alignment`):

- [Native Contract Alignment Audit](./docs/spc-native-contract-alignment-audit.md) — 25 outdated V2 assumptions reconciled to the verified schema
- [V2 Contract Mapping (verified-aligned)](./docs/spc-v2-contract-mapping.md) — every V2 SPC field classified against verified columns
- [Native Route Prerequisite Plan](./docs/spc-native-route-prerequisite-plan.md) — proposed `POST /api/spc/chart-data` shape, SQL, exclusions, and go/no-go checklist
- `src/fixtures/verified-databricks-spc.ts` — verified Databricks row fixtures (PR #65-derived, not live data)
- `src/utils/native-databricks-mapping.ts` — pure mapper helpers (`isEligibleSpcProductionRow`, `deriveSubgroupPoint(s)`, `mapLockedLimitRow`, `deriveSpecificationLimits`, `classifySignalSource`, `classifyCapabilitySource`)
- `src/utils/native-databricks-mapping.test.ts` — 55 mapper tests including type-level + runtime field-name guards

**What this changes for SPC consumers right now: nothing.** No panel, route,
adapter, or generated artefact relies on the new helpers; they are
import-only for tests and the future native route.

## V1 SPC Source Status

A full V1 SPC application exists at `apps/spc/` in the ConnectIO-RAD V1 monorepo. It deploys
gold-layer objects to `connected_plant_uat.gold` and has a live FastAPI backend. SPC data exists
in Databricks per V1 migration scripts, but the authoritative V2 app-serving SPC data model is
not yet established.

Object types, columns, grains, keys, control-limit provenance, rule-signal source, capability
calculations, and golden candidates require Databricks verification before native V2 SPC live
UAT. Specifically:

- V2 has not yet been mapped to the V1 source model
- V1 is material-centric (not plant/work-centre-centric) — V2 navigation model must change
- `spc_quality_metrics` is a Databricks AI/BI Metric View, not a signal table
- Rule violations are computed client-side in V1 frontend — no stored signal table exists
- `spc_locked_limits` primary key requires `material_id` as a required PK dimension
- Locked-limit column names have a documented discrepancy that requires DDL verification

Current V2 SPC remains mock/sandbox until the V1 Databricks source mapping is verified and
native V2 routes/mappers are implemented.

See [SPC V1 Source Discovery](./docs/spc-v1-source-discovery.md) for the full V1 analysis.
See [SPC Databricks Source Verification](./docs/spc-databricks-source-verification.md) for the
Databricks verification pack (SQL queries, evidence tables, handoff checklist).

## Integration Gates & Out-of-Scope Items

1. **V1 Proxy Routes**: `SPCMonitoringLegacyApiAdapter` exists but is not wired. V2 proxy routes
   in `apps/api/routes/spc.py` now exist (added in 2026-05), but are not yet browser-verified
   against a live V1 backend. The V1 SPC app URL in UAT must be confirmed before these routes
   can be tested end-to-end.
2. **Navigation Model**: V2's `SPCMonitoringAdapterRequest` is plant/work-centre-centric. V1 is
   material-centric. This must be reconciled before any wiring.
3. **Adapter Factory**: A factory pattern is implemented to support `mock`, `legacy-api`, and
   `databricks-api` modes; the latter two currently return unavailable status.
4. **Evidence Completeness**: Section-level completeness summaries are visible in the Chart
   Overview view.
5. **Databricks Verification**: Object types, columns, grain, navigation model, control-limit
   provenance, rule/signal source, capability source, and golden candidates all require
   Databricks verification before any live route is enabled. See
   [Native Migration Readiness Checklist](./docs/spc-native-migration-readiness-checklist.md).

## Remaining Production Readiness Milestones

To migrate from sandbox mock mode to a production-ready state:

- **V1 App URL Confirmation**: Confirm the V1 SPC Databricks App URL is accessible in the UAT environment (if using the optional legacy bridge).
- **Navigation Model Fix**: Update `SPCMonitoringAdapterRequest` to use `materialId` as the primary entry-point parameter.
- **Native Route Verification**: The native `GET /api/spc/subgroups` is implemented; browser UAT is outstanding.
- **Optional Legacy Bridge**: The V1 legacy bridge remains an optional short-term fallback if native UAT reveals schema gaps.
- **Column Verification**: Verify `spc_quality_metric_subgroup_v` and `spc_locked_limits` column names in UAT for the native route.
- **UAT Candidate Identification**: Confirm a real plant/material/MIC combination with SPC data in `connected_plant_uat.gold`.
- **Source Badge Verification**: Verify `<EvidencePanel>` badge updates to `source: 'databricks-api'` (or `legacy-api`).
- **Control-Rule Semantics**: Confirm whether rule detection should remain frontend-computed (per V1) or move to API layer.
- **i18n Support**: Introduce localization support for titles and warning strings if required.
