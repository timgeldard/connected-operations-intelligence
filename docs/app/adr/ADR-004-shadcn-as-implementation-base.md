# ADR-004: shadcn/ui as Design-System Implementation Base

**Status**: Accepted
**Date**: 2026-05-15

## Context

The legacy ConnectIO shell had no shared component contract. Each app frontend maintained its own inline
styles and hand-rolled interactive components (dropdowns, dialogs, tooltips). Kerry brand colours were
expressed as scattered hex values with no token system. Accessible behaviour — focus management, keyboard
navigation, ARIA attributes — was inconsistently implemented across apps and not tested as a unit.

V2 required a single design-system package that could provide accessible primitives, enforce Kerry
branding, and be governed such that implementation details could not leak into consuming packages.

## Decision

`packages/design-system` uses shadcn/ui (Radix UI primitives composed with class-variance-authority) as
its implementation base, wrapped in Kerry brand CSS custom properties: `--valentia-slate`, `--forest`,
`--stone`, and related tokens. All `@radix-ui/*`, `clsx`, `tailwind-merge`, and `lucide-react` imports
are restricted to `packages/design-system` only. All other packages and applications import exclusively
from `@connectio/design-system`.

This boundary is enforced by a `no-restricted-imports` ESLint rule applied to all packages and apps
outside `packages/design-system`. The rule causes a typecheck-time error if any module outside the
boundary attempts to import directly from Radix or its dependencies.

## Consequences

**Positive**: Rich accessible primitives — dialog, dropdown, tooltip, tabs, select — are available without
rebuilding from scratch. Radix handles focus trapping, keyboard navigation, and ARIA semantics.

**Positive**: Kerry branding is applied once at the token layer. No scattered hex values remain in
application code. Rebranding or theming requires changes in a single file.

**Negative**: shadcn/ui is copy-paste architecture. Component source files are owned by the design-system
package, not managed as a versioned dependency. Updates from the shadcn upstream require manual
cherry-picking and review.

**Mitigation**: The `no-restricted-imports` rule prevents the boundary from leaking without a visible
linting failure. The cost of manual updates is bounded to `packages/design-system` alone.
