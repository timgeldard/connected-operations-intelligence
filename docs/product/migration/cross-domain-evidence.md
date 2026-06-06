# Cross-Domain Evidence Pattern

## Problem

Single-domain workspaces only expose evidence from their own domain integration package. A batch release decision requires SPC alarms, operations conformance, warehouse hold status, and trace exposure -- all owned by different domain integrations -- alongside quality results. Without a governed cross-domain pattern, this would require either reimplementing foreign domain logic inside di-quality or forcing users to navigate between workspaces.

---

## Solution -- allowedConsumerWorkspaces

Each EvidencePanelRegistration (defined in @connectio/product-model) carries an allowedConsumerWorkspaces array. A panel owned by di-spc can be legitimately hosted in the quality batch release workspace if 'quality-batch-release' appears in that array. An empty array means the panel is unrestricted.

Cross-domain panels are accessed via the owning package's public index.ts export surface only. Panels that are not exported from index.ts are not available for cross-domain consumption regardless of their allowedConsumerWorkspaces setting.

---

## Pattern -- View-Level Multi-Adapter Requests

BatchReleaseWorkspace derives four adapter request objects from scope and releaseCaseId and forwards them to every view. Each panel uses its own adapter hook; the workspace component is the orchestration point.

```
BatchReleaseWorkspace
  qualityRequest    (QualityReleaseAdapterRequest)
  traceRequest      (Trace2AdapterRequest)
  operationsRequest (OperationsEvidenceAdapterRequest)
  warehouseRequest  (WarehouseEvidenceAdapterRequest)
         |
         v
  di-quality views (orchestration layer)
    OperationsEvidenceView
      ProcessOrderEvidencePanel  <- @connectio/di-operations
      WarehouseHoldStatusPanel   <- @connectio/di-warehouse
      EventTimelinePanel         <- @connectio/di-traceability
    WarehouseTraceEvidenceView
      WarehouseHoldStatusPanel   <- @connectio/di-warehouse
      TraceExposureForReleasePanel <- @connectio/di-traceability
      SPCSignalsForReleasePanel  <- @connectio/di-spc
```

Views inside di-quality import cross-domain panels from the owning package's public surface. The panels themselves never import back -- the dependency is strictly one-way.

---

## Boundary Enforcement

NX enforce-module-boundaries with scope:* tags (configured in eslint.config.mjs) defines the intended isolation boundary between domain integration packages. The cross-domain view imports inside di-quality represent a deliberate exception: the consuming workspace's view layer is the governed integration point.

The governance gate is allowedConsumerWorkspaces at the panel registration level, not import-level prohibition. A panel that has not declared a workspace ID in allowedConsumerWorkspaces must not be rendered by that workspace even if the import is technically accessible.

---

## Adding a New Cross-Domain Panel

1. Create the panel in its owning di-* package. Add the target workspace ID to allowedConsumerWorkspaces:

   allowedConsumerWorkspaces: ['quality-batch-release']

2. Export from the owning package's index.ts:

   export { MyNewPanel } from './panels/my-new-panel.js'
   export type { MyNewPanelProps } from './panels/my-new-panel.js'

3. Import in the consuming workspace view inside di-quality/src/views/:

   import { MyNewPanel } from '@connectio/di-<owner>'

4. Forward the adapter request from BatchReleaseWorkspace to the view, and from the view to the panel as a prop.

5. Register the panel in batch-release-registration.ts under defaultPanels so it appears in the workspace manifest.

---

## What NOT To Do

- Do not add a workspace ID to allowedConsumerWorkspaces without also registering the panel in that workspace's WorkspaceRegistration.defaultPanels.
- Do not hardcode a workspaceId inside a panel's render logic. Panels must not be aware of which workspace is hosting them.
- Do not implement foreign domain logic (e.g. SPC alarm calculation) inside a consuming view. Adapter hooks from the owning package are the only data source.
- Do not expose internal panel sub-components from index.ts -- only the top-level panel component and its props type should be exported.
- Do not import directly between di-* packages (e.g. di-quality importing from di-spc directly at the adapter layer). Only the view orchestration layer in di-quality is the permitted consumer.
