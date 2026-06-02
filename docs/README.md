# Documentation index — Connected Plant / Integrated-Operations Reporting

Single entry point to the design records, specs and position papers for this data product
(SAP ECC → Silver SCD1 → Gold → snapshots). See the root `CLAUDE.md` for build/deploy workflow.

## Design specifications
- [`silver/design_spec.md`](../silver/design_spec.md) — Silver architecture & table catalogue (SCD1, CDC, RLS).
- [`gold/design_spec.md`](../gold/design_spec.md) — Gold architecture, table catalogue, warehouse metric
  dictionary, **pilot-grade** markers, and known limitations.

## Architecture Decision Records (`docs/adr/`)
| ADR | Title | Status / where |
|---|---|---|
| 001 | DAB bundle deployment | merged |
| 002 | Continuous pipeline mode | merged |
| 003 | Data-quality expectations strategy | merged |
| 004 | Bronze source parameterization | merged |
| 005 | Access tiers (plant RLS; Gold trusted layer) | merged |
| 006 | Warehouse snapshots | merged |
| 007 | Second bronze source (central_services) | merged |
| 008 | Shift calendar & shift-grain Gold | **PR #19** (planning) |
| 009 | Detailed IM↔WM stock reconciliation | **PR #19** (planning) |
| 010 | Living data dictionary & UC lineage | **PR #19** (planning) |
| 011 | SAP→Silver→Gold reconciliation control | **PR #20** |
| 012 | Gold & snapshot row-level security | **PR #22** |

## Hardening & roadmap
- [`hardening-plan.md`](hardening-plan.md) — active hardening-sprint scope guard (current objective +
  deferred items + sprint sequencing). **Read before adding scope.**
- [`source_dependency_map.md`](source_dependency_map.md) — per-Gold-table Silver/bronze dependencies,
  pipeline tier, and criticality.
- [`data-product-roadmap.md`](data-product-roadmap.md) — phased plan for the next-phase initiatives
  (shift calendar, reconciliation depth, data dictionary/lineage), file map, sequencing, effort.
- [`ingestion_requests.md`](ingestion_requests.md) — source dependencies to hand off to the
  replication/platform teams (WMA-E-50 Z-tables, MARM, second bronze source, CI secrets, etc.).

## Position papers & analysis
- [`position/unity-catalog-security.md`](position/unity-catalog-security.md) — should this repo adopt
  the platform **CSM consumption-view** approach? (Recommendation: hybrid — row-level enforcement as
  the primitive + CSM-style serving views + a single unified entitlement source.)
- [`plant_filtering_methodology_comparison.md`](plant_filtering_methodology_comparison.md) — the
  live-verified evidence behind the position paper: traced lineage/ownership of the UAT `csm_*`
  consumption model and `published_uat.security.model`, the "repo not deployed / zero row filters in
  UAT" reframing, the four competing entitlement sources, a bug found in the platform
  `user_has_plant_access` UDF, and a verification checklist.

## Requirements / traceability
- [`user_stories/warehouse-ops-user-stories.md`](user_stories/warehouse-ops-user-stories.md) — user
  stories from **WMA-E-50**, **PEX-E-35** and **COOISPI**, each with fulfilment commentary (✅/⚠️/❌),
  the table(s) that satisfy it, and whether the acceptance criteria are met today.

## Open cross-cutting decisions (tracked in the docs above)
- **Gold schema collision** — uat/prod write into the shared `connected_plant_<env>.gold`; decide a
  dedicated product schema vs coexistence before uat deploy (`ingestion_requests.md`).
- **`published_prod.central_services`** — confirm the prod second-source catalog/privileges (ADR 007).
- **Entitlement source of truth** — unify the repo's `allowed_plants` model with the platform/CSM
  model (position paper).
- **CI repo secrets** — set `DATABRICKS_HOST` / `DATABRICKS_TOKEN` to enable real bundle validation.
