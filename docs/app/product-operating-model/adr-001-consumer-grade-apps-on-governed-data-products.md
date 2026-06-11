# ADR-001: Consumer-Grade Applications on Governed Data Products

**Status**: Accepted
**Date**: 2026-05-26

## Context

The repository has established a highly disciplined app-facing data-product governance model. This governance manages schema schemas, field classifications, mock fallbacks, and verification evidence to guarantee that no untruthful or silent-fallback values are presented to operational users. 

However, by treating the frontend primarily as a "reference consumer" of this governed data layer, there is a risk of treating data product catalog entries as the final deliverable. This risks stalling the delivery of polished, workflow-led interfaces for plant operators, safety leads, and quality lead roles. We need a model that permits rapid, premium consumer-grade user experience iteration while preserving strict backend data-layer governance controls.

## Decision

We will reposition the primary focus of this repository to delivering consumer-grade manufacturing applications built on top of a governed app-facing data product layer.

To support this decision, we will track and evaluate development across two distinct maturity axes:
1. **Application Experience Maturity** (A0 - A6): Measures visual fidelity, workflow completeness, design system consistency, and end-to-end browser-UAT evidence.
2. **Data Product Maturity** (D0 - D6): Measures backend gold object verification, schema typing, row mapper coverage, and catalog governance.

Consumer application feature branches may progress through maturity stages (such as UX prototyping and contract wiring) and be merged to the main branch, provided they explicitly surface warning caveat banners and do not present unverified heuristic data as governed release decisions.

## Consequences

**Positive**: Developers and designers can build, test, and merge polished, user-facing workspaces and interactive SVG charts without being blocked by backend catalog cataloging.
**Positive**: Terminologies such as "reference consumer" are retired in favor of first-class "consumer applications", improving ownership and delivery standards.
**Negative**: All user-facing code must now handle edge states (empty, loading, stale, and partial) as first-class states, which increases the initial frontend component design overhead.

## Non-Goals
- Bypassing or weakening route readiness audits, UAT evidence standards, or mock fallback checks.
- Introducing service-principal fallbacks or raw backend structures directly into UI components without typed contracts.

## Migration Guidance
1. Move the repository's documentation references from an "API reference consumer model" to a "consumer application model".
2. Update the PR templates to enforce declarations on both the Application and Data Product maturity axes.
3. Review and classify existing workspaces against the new Application Experience Maturity levels.
