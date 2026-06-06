# Data-Layer Completion Audit

> **Warning:** This audit describes the current state of the V2 data layer. It is not a production-readiness sign-off. No domain has passed live UAT. No domain is production-ready.

## Purpose

This folder contains a cross-domain audit of the ConnectIO RAD V2 data layer. It maps every significant domain capability to its adapter method, backend route, data contract, source object, verification state, UAT candidate, and current blocker.

The audit was created on 2026-05-21 to support planning of the next 5–10 implementation PRs after major domain documentation and code work completed across Traceability, POH, Quality, SPC, and Genie.

## Scope

The audit covers:

- **Adapter coverage** — which frontend adapter methods exist and what mode they use (mock / legacy-api / databricks-api / unavailable)
- **Backend route coverage** — which FastAPI routes exist, whether they are mode-gated, and whether they have been browser-verified
- **Data-contract coverage** — which Zod schemas exist, which have generated Python models, and which are ahead of any live route
- **Source object coverage** — which gold views and metric views are referenced, and which have been verified for object existence, schema, grain, joins, and semantics
- **UAT candidate state** — which capabilities have identified test candidates
- **Blocker inventory** — what Databricks access, governance, or implementation gaps prevent each capability from advancing

## Relationship to Readiness Docs

This audit complements but does not replace the readiness documentation:

| Doc | Purpose |
|-----|---------|
| [docs/readiness/domain-readiness-index.md](../readiness/domain-readiness-index.md) | High-level domain status summary and UAT blockers |
| [docs/readiness/current-main-readiness-review.md](../readiness/current-main-readiness-review.md) | Post-merge snapshot of current main branch state |
| [docs/readiness/next-action-plan.md](../readiness/next-action-plan.md) | Ranked next actions by owner and dependency |
| [docs/adapters/mock-legacy-databricks-modes.md](../adapters/mock-legacy-databricks-modes.md) | Authoritative guide to adapter modes and environment variables |

The data-layer audit adds **cross-domain horizontal visibility** — it answers "what is the state of every capability?" rather than "what should we do next for a single domain?".

## Domain Coverage

| Domain | Audit coverage |
|--------|---------------|
| Traceability | Full |
| POH / Operations | Full |
| Quality | Full |
| SPC | Full |
| Warehouse360 | Full |
| EnvMon | Full |
| Maintenance & Reliability | Partial (mock-only, no source objects) |
| Production Staging | Partial (mock-only, no source objects) |
| Genie / Assistant | Full (pilots and shell state) |

## Status Keys

### Source / Data State

These values describe the live state of the data source for a given capability:

| Status | Meaning |
|--------|---------|
| `live-databricks` | Native Databricks route wired and browser-verified |
| `live-legacy-bridge` | Proxied via V1 API, browser-verified |
| `mock-only` | No live route; adapter returns fixture data |
| `unavailable-state` | Capability intentionally surfaced as unavailable to the user |
| `planned` | Route or source planned but not implemented |
| `not-implemented` | No implementation; not yet planned in detail |
| `source-verified` | Source object confirmed to exist with schema, grain, and join keys verified |
| `source-semantics-pending` | Object verified but business meaning of fields is unresolved |
| `governance-pending` | Source exists but display rule or business decision required before wiring |
| `browser-uat-pending` | Code and route exist; live browser validation has not been performed |
| `production-blocked` | Hard constraint (governance, GxP, SAP write-back, etc.) prevents implementation |

### Capability Completion State

These values describe how complete a capability's data layer is relative to the definition in [`minimum-complete-data-layer-definition.md`](./minimum-complete-data-layer-definition.md):

| Status | Meaning |
|--------|---------|
| `complete-for-controlled-uat` | All 12 criteria met |
| `browser-uat-pending` | All criteria met except live browser validation |
| `source-verification-pending` | Source object not yet verified |
| `source-semantics-pending` | Object verified; field semantics unresolved |
| `governance-pending` | Awaiting business/governance decision |
| `contract-only` | Schema exists but no live route |
| `mock-only` | Adapter exists but returns fixture data only |
| `legacy-bridge-pending` | V1 proxy route exists but not browser-verified |
| `unavailable-state-only` | Capability intentionally unavailable; no live path planned |
| `not-started` | No adapter, route, contract, or source work done |
| `production-blocked` | Hard constraint prevents current-phase implementation |

## How to Use This Audit

1. **Planning next PRs:** Read [`data-layer-implementation-backlog.md`](./data-layer-implementation-backlog.md) for ranked work packages.
2. **Finding contract gaps:** Read [`contract-route-coverage-matrix.md`](./contract-route-coverage-matrix.md) for schemas without routes and routes without contracts.
3. **Reviewing adapter risk:** Read [`adapter-coverage-audit.md`](./adapter-coverage-audit.md) for unsafe fallback patterns and missing source badges.
4. **Checking source verification:** Read [`source-verification-coverage.md`](./source-verification-coverage.md) for the master source object ledger.
5. **Full capability inventory:** Read [`data-layer-completion-inventory.md`](./data-layer-completion-inventory.md) for the complete cross-domain table.

## Warning

This audit is a snapshot taken on 2026-05-21. It will go stale as PRs are merged. The audit should be updated or re-run after:

- Any PR that wires a new live route
- Any PR that verifies a new source object
- Any governance decision that unblocks a capability
- Any UAT evidence capture that advances a domain's state

**This audit does not constitute production-readiness sign-off for any domain.**
