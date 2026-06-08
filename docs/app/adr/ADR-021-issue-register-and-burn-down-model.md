# ADR-021: Issue Register and Burn-Down Model

**Status:** Accepted  
**Date:** 2026-05-15  
**Deciders:** pilot-lead, programme-manager  
**Phase:** 8

## Context

Phase 8 introduces a Pilot Issue Register as the canonical source of truth for all issues raised during pilot execution. We needed to decide the issue schema, severity model, blocking semantics, and how burn-down is derived.

## Decision

Issues are modelled as `PilotIssue` with two blocking flags: `blocksPilotExit` and `blocksProduction`. These are orthogonal — an issue can block production without blocking pilot exit (e.g., CoA API gap is known and accepted for pilot but must be resolved for production).

Severity uses the existing `ReadinessSeverity` type (`info | warning | blocker | critical`) rather than custom severity strings. This maintains alignment with the readiness model.

Burn-down is derived by `deriveBurnDownSummary` which aggregates open/resolved counts, category/workspace/owner breakdowns, and a trend calculation.

## Rationale

- Two blocking flags prevent premature pilot exit blocking on issues that are accepted-as-risk for the pilot phase.
- Reusing `ReadinessSeverity` avoids proliferating severity vocabularies across the product model.
- Derived burn-down (not stored) avoids stale summaries — the summary always reflects the current issue list.

## Consequences

- Issues must be kept in the register (not just in Jira or manual tracking) for the burn-down to be accurate.
- Daily triage of `critical` and `blocker` issues is required; the register supports this via status filtering.
