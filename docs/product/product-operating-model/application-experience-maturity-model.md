# Application Experience Maturity Model

To deliver premium user experiences, we track and evaluate our work across two distinct but related axes:
1. **Application Experience Maturity** (A0 - A6), described in this document.
2. **Data Product Maturity** (D0 - D6), described in [Data Product Maturity Model](../app-data-layer/data-product-maturity-model.md).

An application experience may progress visually, structurally, and workflow-wise even if some underlying data products are still pending live data integration or catalog validation, provided that all sandbox/simulated states are explicitly caveat-labeled and no unauthorized business claims are made.

---

## Maturity Levels

### A0 — Concept Journey Identified
- **Definition**: The primary user, job-to-be-done, and basic workspace requirements are documented.
- **Entry Criteria**: Proposal or request for a new user workflow.
- **Exit Criteria**: A basic app brief is established in `docs/apps/<app-name>/product-brief.md`.
- **Evidence**: Reusable App Brief file created.

### A1 — UX Prototype / Information Architecture
- **Definition**: Low-fidelity wireframes or layout maps illustrating panel arrangements and data flow.
- **Entry Criteria**: Completed A0 App Brief.
- **Exit Criteria**: Defined layout structure, visual hierarchy, and placeholder cards.
- **Evidence**: UI sketches, structural wireframe layout, or mock screenshots attached to the brief.

### A2 — Design-System Aligned Application Shell
- **Definition**: A static application shell built within the monorepo workspace conforming to Kerry Design System tokens and layouts.
- **Entry Criteria**: Completed A1 IA design.
- **Exit Criteria**: Responsive panels, layout grids, headers, and rails are implemented using design-system components.
- **Evidence**: Code compiling in `domain-integrations/`, showing design tokens (e.g. `--shell-surface`, `--shell-line`).

### A3 — Contract-Wired Consumer Application
- **Definition**: Frontend components are wired to client-facing TypeScript types and query hooks, utilizing static mock adapter data structures.
- **Entry Criteria**: Completed A2 shell.
- **Exit Criteria**: Data-fetching hooks (`useQuery`) return typed mock contracts. Zero TypeScript compilation errors.
- **Evidence**: Component code successfully imports from `@connectio/data-contracts` and mock adapters.

### A4 — Workflow-Complete Application
- **Definition**: The complete interactive workflow (state transitions, clicks, filter bars, exclusions, drawer overlays) is functional inside the application.
- **Entry Criteria**: Completed A3 wiring.
- **Exit Criteria**: All interactive buttons, modals, and conditional states are interactive and functional.
- **Evidence**: Unit/component tests verify click interactions, state changes, and modal launches.

### A5 — Browser-UAT Evidenced Application
- **Definition**: End-to-end user journeys have been verified in a browser test environment against the mock adapter and fastapi proxy routes.
- **Entry Criteria**: Completed A4 functionality.
- **Exit Criteria**: Automated Playwright/Vitest browser tests cover main user workflows.
- **Evidence**: JSON/Markdown UAT test evidence packs saved in `docs/app-data-layer/evidence/`.

### A6 — Operationally Ready Application
- **Definition**: The application is fully verified against live production Databricks/SAP backend databases and is validated for site operations.
- **Entry Criteria**: Completed A5 browser UAT.
- **Exit Criteria**: Underlying data products reach maturity level D6 (Governed). All sandbox/mock flags are disabled or transitioned to live secure OAuth contexts.
- **Evidence**: Signed off operational deployment manifests and production verification logs.

---

## Multi-Axis Matrix

An application's overall readiness is a combination of its App Experience (A) and Data Product (D) maturity levels:

- **A4 / D2 (High Visual Maturity, Low Data Maturity)**: Acceptable for sandbox validation and design reviews. Caveat labels MUST be visible in the UI indicating simulated data.
- **A6 / D6 (Fully Ready)**: Production-ready operational applications. No simulated warnings.
