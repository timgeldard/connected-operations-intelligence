# ADR-013: Design System Mandate for Phase 6 Admin Pages

**Status:** Accepted  
**Date:** 2026-05-15  
**Author:** ConnectIO Platform Team

---

## Context

Phase 4 and 5 workspaces were built during a period when `@connectio/design-system` was still stabilising. Several pages use a mix of raw Radix primitives (`@radix-ui/react-*`), direct Tailwind class compositions, and occasional `clsx` utilities in place of design-system tokens. This was accepted as a pragmatic trade-off during early development.

By Phase 6, `@connectio/design-system` exposes a stable component set — `Card`, `Badge`, `Tabs`, `Button`, and `Separator` — sufficient to compose all admin pages without reaching into lower-level primitives. A consistent component layer is now a prerequisite for:

- Applying a planned customer-facing theme override (Kerry brand colours)
- Meeting WCAG 2.1 AA contrast and focus requirements without per-page audits
- Ensuring that future dark-mode or high-contrast mode support cascades automatically

---

## Decision

All Phase 6 admin pages (`ProductionReadinessPage`, `WorkspaceParityPage`, `CutoverSimulationPage`, `RoleScopePage`, `DesignSystemCompliancePage`, `TelemetryDashboardPage`) must use `@connectio/design-system` components exclusively. Direct imports from `@radix-ui/*`, `clsx`, or raw `className` string constructions are prohibited in these files.

The boundary is enforced at build time via an ESLint `no-restricted-imports` rule targeting the `apps/shell/src/pages/admin/**` glob. The rule treats violations as errors, not warnings.

Phase 4 and 5 pages are **exempt** from this rule but are **flagged** in the Design-System Compliance Report (`DesignSystemCompliancePage`) as `severity: 'warning'` findings with `blocksPilot: false` and `blocksProduction: false`. This gives the platform team visibility into the backlog without blocking current releases.

---

## Rationale

### Consistency and discoverability

Admin users moving between governance dashboards encounter a uniform card-and-tab layout. Using design-system primitives rather than ad hoc Tailwind classes means that layout changes (spacing, border radius, shadow) cascade from the token layer rather than requiring a grep-and-replace across page files.

### Accessibility by default

`@connectio/design-system` components are tested for keyboard navigability, focus ring visibility, and ARIA attributes as part of the design-system package's own test suite. Using them in Phase 6 pages inherits these properties without per-page accessibility audits.

### Future theme support

Kerry's brand guidelines require the ability to apply a colour override across the platform. A design-system mandate means the override point is the token layer in `@connectio/design-system`, not scattered `className` strings across 15+ page files.

### Why exempt Phase 4–5 pages rather than migrate them?

Retroactively migrating all Phase 4–5 pages introduces regression risk for workspaces that are currently live at production sites. The compliance report approach surfaces the gap without forcing a risky refactor during a production rollout cycle.

---

## Consequences

### Positive

- All Phase 6 admin pages are structurally consistent and theme-ready
- ESLint enforcement catches violations at development time, not in code review
- The Design-System Compliance Report provides an ongoing audit trail for pre-Phase-6 pages

### Negative

- Phase 4–5 pages accumulate compliance warnings in the report until they are migrated
- Developers working on Phase 6 pages cannot use some Radix primitives directly, even if the design-system component does not yet wrap the specific variant they need

### Mitigations

- The compliance report clearly marks Phase 4–5 findings as `severity: 'warning'` (not `blocker`) so they do not distort the go/no-go signal
- If a required design-system component is missing, the correct path is to add it to `@connectio/design-system` — not to bypass the rule with an inline implementation
