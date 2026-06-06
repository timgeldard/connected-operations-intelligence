# ADR-022: Go / No-Go Recommendation Model

**Status:** Accepted  
**Date:** 2026-05-15  
**Deciders:** pilot-lead, programme-manager, CTO office  
**Phase:** 8

## Context

The Go / No-Go Assessment page and Cutover Recommendation page needed to derive a production cutover recommendation from pilot evidence. The recommendation must be conservative: no speculative `go` verdict should appear while blockers or critical deficiencies exist.

## Decision

The `deriveGoNoGo` function applies conservative logic:
1. If `recommendation.blockers.length > 0` → `'no-go'`
2. If `recommendation.conditions.length > 0` → `'go-with-conditions'`
3. Otherwise → `'go'`

The 12-dimension Go / No-Go Assessment provides a structured evidence base. Each dimension has a `blockerIfNotMet` flag that aggregates into the recommendation's `blockers` array.

The recommendation is **never hardcoded** to `'go'` or `'go-with-conditions'` in mock data — it always reflects the current state of blockers.

## Rationale

- Conservative logic prevents premature go signals that could mislead stakeholders.
- Separating `blockers` (mandatory to resolve) from `conditions` (must-do-but-not-blocking) gives the programme manager meaningful differentiation.
- The 12-dimension model provides auditable evidence for the steering committee review.

## Consequences

- The recommendation will remain `no-go` until all blockers in `CutoverRecommendation.blockers` are cleared.
- Stakeholders must not treat the recommendation as a substitute for the formal sign-off process.
- The product model `deriveGoNoGo` helper must not be changed to relax the blocker check without steering committee approval.
