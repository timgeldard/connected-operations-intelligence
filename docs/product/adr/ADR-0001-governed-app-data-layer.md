# ADR-0001 — Adopt a governed app-facing data product layer

## Status

Proposed

## Date

2026-05-23

## Context

- ConnectIO-RAD currently contains prototype/reference apps for Traceability, SPC, Quality, Warehouse360, POH, EnvMon, and related domains.
- These apps are not production systems and have no production users to migrate.
- The mature durable asset is the Databricks SAP manufacturing and quality semantic model.
- The goal is to create an equally mature app-facing data layer so future apps can consume governed, source-truthful domain data products.
- Recent agent-generated work has shown risk when UI/routes/contracts are created before the source semantics, field classification, and readiness rules are explicit.
- The project therefore needs an explicit operating model that makes the data layer the centre, and apps reference consumers.

## Decision

ConnectIO-RAD will be developed as a governed app-facing data product layer over the Databricks SAP manufacturing and quality semantic model.

Apps are reference consumers of this layer.
Prototype app parity is not a primary goal.
Future work must be framed around business objects, data product patterns, source mappings, contracts, field classification, readiness levels, and governance boundaries.

The standard model is:

Databricks semantic model
→ Business object model
→ App data products
→ Contract-first APIs
→ Reference consumers / apps / agents

## Consequences

Positive:

- clearer separation between durable data layer and replaceable apps
- safer agent contributions
- better source truthfulness
- reusable data products across multiple future apps
- less prototype-driven route/contract drift
- improved governance for quality, traceability, SPC, and operational evidence

Trade-offs:

- slower feature delivery in the short term
- more documentation/specification before implementation
- more PR discipline
- less freedom for agents to generate broad app features
- some current prototype code may remain inconsistent until reclassified

## Non-goals

- This ADR does not implement new runtime functionality.
- This ADR does not migrate existing prototype apps.
- This ADR does not declare production readiness.
- This ADR does not approve SAP write-back, release/reject workflows, recall decisions, QA signoff, or e-signature workflows.
- This ADR does not require every business object to expose the same fixed Summary/Evidence/Investigation shape.

## Rules established by this ADR

- No new route without a data-product spec.
- No new app-facing field without field classification.
- No business decision inferred from missing or ambiguous data.
- Apps consume contracts, not raw Databricks quirks.
- Reference apps do not define source semantics.
- Prototype parity is secondary to source truthfulness.
- Browser UAT and production readiness cannot be claimed without evidence.
- Generated static assets may not be included in feature/data-product PRs unless the PR category is deployment-assets.
- PRs should be single-category where possible.

## Follow-up work

- Add PR template enforcing data-product fields and readiness labels.
- Catalogue current data products.
- Audit existing routes against the new standard.
- Rebuild data-layer backlog around data products and maturity levels.
- Harden first priority data products.
