# Genie Readiness Index

**Date:** 2026-05-20  
**Status:** Living navigation document

---

## 1. Purpose

This index is the entry point for all V2 Genie-related discovery, readiness, and deferral decisions.

Use it to answer:

- where V1 Genie existed
- which V2 domains have an approved readiness pack
- which domains remain blocked
- whether a shell-wide assistant is allowed yet

---

## 2. Document map

| Document | Purpose | Current outcome |
|---|---|---|
| [`v1-genie-discovery-and-v2-parity-roadmap.md`](./v1-genie-discovery-and-v2-parity-roadmap.md) | Repo-wide V1 discovery and V2 parity strategy | V1 Genie found in Platform, POH, Trace2, and SPC; V2 should start domain-scoped |
| [`../../domain-integrations/operations/docs/poh-genie-readiness-pack.md`](../../domain-integrations/operations/docs/poh-genie-readiness-pack.md) | First POH-ready question pack and blocked scope | Narrow pilot scope implemented |
| [`../../domain-integrations/traceability/docs/traceability-genie-readiness-pack.md`](../../domain-integrations/traceability/docs/traceability-genie-readiness-pack.md) | First Traceability-ready question pack and blocked scope | Narrow pilot scope implemented |
| [`../../domain-integrations/spc/docs/spc-genie-readiness-pack.md`](../../domain-integrations/spc/docs/spc-genie-readiness-pack.md) | SPC-specific blocker record and future gates | No live scope approved yet |
| [`v2-shell-genie-decision-record.md`](./v2-shell-genie-decision-record.md) | Shell-wide/global assistant decision | Explicitly deferred |

---

## 3. Domain status summary

| Domain | V1 Genie evidence | V2 readiness status | Current decision |
|---|---|---|---|
| POH / Operations | Explicit semantic pack + runtime plumbing | Readiness pack drafted + pilot surface implemented | Narrow domain-scoped pilot now available |
| Traceability | Explicit assistant/runtime pattern | Readiness pack drafted + pilot surface implemented | Narrow domain-scoped pilot now available |
| SPC | Explicit assistant/runtime pattern | Readiness pack drafted | Blocked until source-model and rule-provenance alignment |
| Warehouse 360 | None found | No pack | Blocked |
| Quality Batch Release | None found | No pack | Blocked |
| EnvMon | None found | No pack | Blocked |
| Maintenance & Reliability | None found | No pack | Blocked |
| Production Staging | None found | No pack | Blocked |
| Shell-wide assistant | Explicit V1 platform assistant | Decision record drafted | Deferred |

---

## 4. Approved direction

The current approved sequence is:

1. maintain a repo-wide discovery baseline
2. create domain-scoped readiness packs
3. validate citation and refusal behavior at domain level
4. only then reconsider a shell-wide assistant

---

## 5. Current non-negotiable rules

- Genie is an **evidence assistant**, not a decision authority.
- Approved answers must cite the contributing evidence surface.
- `mock`, `legacy-api`, and `databricks-api` differences must remain visible.
- Missing or unavailable evidence must not be translated into false certainty.
- Blocked domains stay blocked until they have their own readiness pack and validation trail.

---

## 6. Recommended reading order

1. `v1-genie-discovery-and-v2-parity-roadmap.md`
2. `../../domain-integrations/operations/docs/poh-genie-readiness-pack.md`
3. `../../domain-integrations/traceability/docs/traceability-genie-readiness-pack.md`
4. `../../domain-integrations/spc/docs/spc-genie-readiness-pack.md`
5. `v2-shell-genie-decision-record.md`
