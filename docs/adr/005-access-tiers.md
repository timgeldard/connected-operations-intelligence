# ADR-005: Warehouse access tiers

**Status:** Proposed  
**Date:** 2026-05-31

## Context

Warehouse reporting has three consumer tiers:

- Operatives need plant-scoped operational visibility.
- Supervisors need plant-scoped operational and exception visibility.
- Cluster leads need cross-plant visibility for a governed set of aggregate Gold KPIs.

Silver tables are protected by `plant_access_filter(plant_code)`, which uses the `allowed_plants` user attribute. Gold aggregate row filters are disabled by default to avoid forcing full materialized-view refreshes when row-filter metadata changes.

## Decision

- Keep Silver plant filtering as the authoritative data-access control for direct table reads.
- Keep Gold aggregate pipelines trusted and row-filter-off by default; enforce Gold access with Unity Catalog grants at the consumption boundary.
- Treat cluster-lead access as a separate tier from plant users. Cluster leads may receive SELECT on approved cross-plant Gold KPI tables only after the plant-to-cluster mapping source is approved.
- Do not infer cluster membership from warehouse or storage-location codes. A governed `plant_cluster` reference is required before cluster-scoped filters or grants can be automated.

## Open Source Decision

The plant-to-cluster source is not available in this repo. Approved options are:

- Derive the mapping from a replicated SAP organisational source, if Aecorsoft can provide one.
- Maintain a controlled seed mapping with named ownership and change review.

Until one option is chosen, cluster-lead access remains a documented governance tier, not an executable row-filter change.

## Consequences

- Operative and supervisor access remains plant-scoped through the existing `allowed_plants` model.
- Cluster-lead enablement is intentionally blocked on a governed mapping source, preventing accidental cross-plant data exposure.
- Gold warehouse KPI tables added for cluster-lead consumption can be granted later without refactoring their aggregation logic.
