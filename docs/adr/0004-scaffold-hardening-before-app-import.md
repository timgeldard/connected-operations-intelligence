# ADR 0004 — Scaffold hardening before app import

## Status

Accepted

## Context

PR 2 restructured the repository into the intended monorepo shape. Before importing `connectio-rad-v2`, the scaffold needs to be hardened so the application code lands into a stable structure with clear boundaries.

The remaining issues are documentation accuracy, contract manifest metadata, weak contract validation, incomplete generated contract metadata, and local command pathing.

## Decision

We will harden the monorepo scaffold before importing `connectio-rad-v2`.

This includes:
- correcting the root README,
- strengthening the IOReporting app contract manifest,
- enforcing stricter contract validation,
- generating app-facing TypeScript interfaces and contract metadata,
- fixing local Makefile commands,
- preserving the data boundary rule.

`connectio-rad-v2` import is intentionally deferred until this scaffold is stable.

## Consequences

The app import will target a stable monorepo structure:

- `apps/web`
- `apps/api`
- `packages/data-contracts`
- `packages/queryspecs`
- `domain-integrations/*`

Application code must consume IOReporting data only through approved contract-backed `vw_consumption_*` or `vw_genie_*` views.

No IOReporting pipeline logic is changed by this decision.
