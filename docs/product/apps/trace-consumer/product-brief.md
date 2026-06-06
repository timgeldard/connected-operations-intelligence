# Product Brief — Trace Consumer Application

## 1. Executive Summary
- **App Name**: Trace Consumer
- **Domain**: Traceability / Food Safety
- **Primary Users**:
  - Food Safety Lead
  - Quality Lead
  - Traceability Analyst
  - Plant Manager / Operations Supervisor
- **Primary Jobs-to-be-Done (JTBD)**:
  - *As a Food Safety Lead, I have a material, batch, and plant ID, and I need to quickly understand its origin, transformation, downstream exposure, and production journey so that I can determine recall-relevant exposure and safety caveats.*

## 2. Scope & Operational Goals
- **Operational Decisions Supported**:
  - Scoping downstream recall exposure of raw materials.
  - Verifying the transformation chain and batch processing order history.
- **Non-Goals**:
  - **No SAP write-back** operations or system updates.
  - **No release / reject / e-signature workflows** inside the UI.
  - **No automatic recall recommendations** presented to the user unless a governed, audited rule model exists in the backend.

## 3. User Experience & Core Workflows
- **Core Workflow Description**:
  The user enters a material/batch selection, views the batch summary, reviews the visual genealogy graph (lineage), and inspects the processing history and downstream exposure lists.
- **Key Screens / Panels**:
  - **Trace Consumer Workspace**: Main layout wrapping the sub-views.
  - **Trace Graph Panel**: Visual representation of upstream/downstream genealogy.
  - **Timeline Panel**: Processing history events.
  - **Quality Passport Panel**: Quality parameters and test outcomes.
  - **Recall Panel**: Exposure list for safety actions.

## 4. Data Dependencies & Contracts
- **Data Products Consumed**:
  - `Trace2BatchHeader` / `TraceGraph`
  - `ProcessOrderHeader`
  - `ConnectedQualityLabFails`
- **App-Facing Contract Requirements**:
  - `Trace2BatchHeaderSchema` and `TraceGraphSchema` imported from `@connectio/data-contracts`.
- **Governance-Pending Semantics**:
  - Recall status and recommendations require catalog alignment before they are presented as verified statements.

## 5. UI Caveats & Edge States
- **User-Facing Caveats**:
  - Lineage, exposure, and timeline data must show source/caveat status clearly.
  - Demo/UAT candidate data (like mock values) must be visibly distinguished from live evidence via the `VerificationStatusBanner` or custom warning overlays.
- **Empty / Loading / Error / Stale / Partial State Requirements**:
  - Component renders loading skeletons or empty state panels if data is missing or loading.
  - Render a warning card if the backend returns partial data.

## 6. Maturity & Readiness Checklist
- **Target Application Maturity (A0-A6)**: A5 (Browser-UAT Evidenced).
- **Data Product Readiness Dependencies (D0-D6)**: D4 (Route Implemented) to D5 (Browser UAT).
- **Browser UAT Plan**: End-to-end journey tests verifying traceability tree rendering and node selection.
- **Production Blockers**: Catalog alignment for Databricks gold layer schemas.
