# ADR-023: Rollout Wave Model and Legacy Retirement Approach

**Status:** Accepted  
**Date:** 2026-05-15  
**Deciders:** pilot-lead, programme-manager, CTO office  
**Phase:** 8

## Context

Phase 8 introduces the production rollout plan. We needed to decide the wave structure, the relationship to legacy app retirement, and the rollback policy.

## Decision

The rollout follows 4 waves:
- **Wave 0:** Controlled pilot (IE10 only, no production writes from V2, legacy apps primary)
- **Wave 1:** Production go-live at IE10 (V2 primary, legacy apps in read-only fallback)
- **Wave 2:** Expansion to additional plants — scope TBD in Wave 1 exit review
- **Wave 3:** Broader rollout — scope TBD in Wave 2 exit review

Legacy apps are **not retired** during Wave 0 or Wave 1. Legacy app retirement is handled through the existing Legacy Retirement Readiness process, not through new screens introduced in Phase 8. No retirement actions are taken within the Rollout Wave Plan screen.

## Rationale

- Not retiring legacy apps prematurely is a non-negotiable project constraint.
- Maintaining legacy apps as read-only fallback in Wave 1 provides a safety net during the first live production period.
- Per-plant retirement (not global) aligns with the plant-by-plant rollout cadence and minimises blast radius.

## Consequences

- Legacy apps must remain maintained and accessible through at least Wave 1.
- The Cutover Simulation and Legacy Retirement Readiness admin pages remain relevant through Wave 2.
- Wave 2 and Wave 3 plant scope is not determined in this ADR — it is deferred to the respective exit reviews.
- Legacy app retirement schedule and per-plant approval is governed by the existing Legacy Retirement Readiness process, outside the scope of Phase 8 screens.
