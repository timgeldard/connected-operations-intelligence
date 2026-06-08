# ADR-008: Role-Aware Home Screen as Multi-Domain Priority Surface

**Status:** Accepted  
**Date:** 2026-05-15  
**Author:** ConnectIO Platform Team

---

## Context

As Phase 4 brings the total live workspace count to five (Trace Investigation, Quality Batch Release, Operations Plan Risk, Environmental Monitoring, Production Staging), the home screen (`RoleAwareHome`) needs to evolve beyond a simple list of workspace cards.

The Phase 3 home screen had:
- A grid of workspace cards (pinned workspaces or all navigable workspaces)
- A "Priority Items — Batch Release" section surfacing the two highest-priority mock release cases
- A "Plan Risk — Operations" section surfacing today's two plan risk items

With five live workspaces, the home screen must surface actionable priority items from multiple domains without becoming a wall of data.

---

## Decision

The home screen uses **per-domain priority sections** that surface the most urgent items from each domain's workspace, shown conditionally only when the workspace is live and navigable.

Each section follows the same structure:
- A section heading with the domain context (e.g. "Active Alerts — Environmental Monitoring")
- 1–2 priority items rendered as clickable cards with a colour-coded left border (severity or risk status)
- A footnote explaining the scope and item count
- Clicking a card navigates directly to the relevant workspace and view

For Phase 4, two new sections are added:
1. **Active Alerts — Environmental Monitoring** — shows the 2 highest-severity active envmon alerts; clicking navigates to `envmon-monitoring?view=alerts`
2. **Staging Readiness — Production** — shows today's staging readiness summary card; clicking navigates to `production-staging?view=staging-overview`

The full workspace card grid remains above all priority sections for users who want to navigate directly.

---

## Rationale

### Why conditional sections instead of a unified priority feed?

A unified feed would require a cross-domain priority ranking algorithm (how do you compare a critical envmon alert to a blocked staging order?). That ranking is business logic that belongs in the product, not the RAD prototype. Separate sections make the domain boundary explicit and let each domain team own their priority surface independently.

### Why only 1–2 items per section?

The home screen is a starting point, not a reporting tool. 1–2 items is enough to tell the user "there's something here that needs your attention" without replicating the full workspace. The footnote makes clear that the workspace shows the full picture.

### Why use mock data in the home screen rather than live queries?

The home screen mounts before any workspace is selected. Running N adapter queries on mount would slow initial page load and consume server capacity for data the user may not act on. Mock data in Phase 4 validates the UX pattern; real query hooks are a Phase 5 concern once the API layer is defined.

### Why navigate to a specific view when clicking a priority item?

A domain expert clicking on a critical envmon alert wants to land directly on the Alerts view, not the Overview. The deeplink preserves intent and reduces click depth from 3 (home → workspace → view) to 1.

---

## Consequences

### Positive

- Each domain team can own and evolve their home screen section independently
- Priority items are discoverable without navigating into each workspace
- The click-to-deeplink pattern reduces time-to-action for urgent items
- Sections are conditionally rendered — adding a new workspace does not break the home screen for users without access to it

### Negative

- The home screen mock data must be kept in sync with the adapter mock data; drift is possible
- There is no cross-domain ordering of priority items (a blocked staging order and a critical envmon alert appear in separate sections with no relative priority signal)
- The home screen will grow longer as more workspaces are added; a personalized "pin sections" feature would be needed at scale

### Mitigations

- Mock data constants in `RoleAwareHome.tsx` are annotated with references to their adapter equivalents so drift is visible in code review
- Cross-domain priority ranking is deferred to Phase 5 when the product team can define the business rules
- The workspace card grid at the top gives users a fast escape to any workspace regardless of the priority sections below
