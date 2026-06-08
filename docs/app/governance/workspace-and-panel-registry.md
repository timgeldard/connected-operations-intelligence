# Workspace and Panel Registry

## Overview

ConnectIO-RAD V2 uses a static registry model. Every workspace and every evidence panel has a typed registration object that describes its identity, lifecycle, permissions, scope requirements, and personalisation policy. The registry is assembled at startup in `apps/web/src/registry/workspace-registry.ts`.

No dynamic service is required — the registry is a compile-time artifact. This makes it easy to audit, version-control, and test.

---

## Workspace Registry

Workspaces are registered in `apps/web/src/registry/workspace-registry.ts`. Each entry is a `WorkspaceRegistration` from `@connectio/product-model`.

### Adding a new workspace

1. Create a registration file in the owning domain integration, e.g. `domain-integrations/my-domain/src/my-workspace-registration.ts`
2. Export a `WorkspaceRegistration` object conforming to the type from `@connectio/product-model`
3. Import the registration in `apps/web/src/registry/workspace-registry.ts` and add it to the `workspaceRegistry` array
4. Add a branch in `apps/web/src/pages/WorkspaceViews.tsx` to render the workspace component
5. The workspace will automatically appear in the nav rail if its `lifecycle` is `'live'`

### WorkspaceRegistration fields

| Field | Type | Description |
|---|---|---|
| `workspaceId` | `string` | Unique kebab-case identifier |
| `displayName` | `string` | Human-readable name shown in nav and home |
| `description` | `string` | One-sentence description |
| `domainId` | `string` | Domain this workspace belongs to |
| `ownerDomain` | `string` | Domain integration package that owns this workspace |
| `lifecycle` | `LifecycleState` | `'live'` \| `'beta'` \| `'concept-lab'` \| `'deprecated'` |
| `supportedRoles` | `string[]` | Role IDs that can access this workspace |
| `requiredPermissions` | `PermissionDefinition[]` | Permissions checked before granting access |
| `supportedScopes` | `ScopeLevel[]` | Scope levels this workspace accepts |
| `scopePolicy` | `ScopePolicy` | Default scope level and auto-elevation policy |
| `defaultViews` | `ViewRegistration[]` | Ordered list of tabs/views with their panel lists |
| `defaultPanels` | `EvidencePanelReference[]` | All panels available in this workspace |
| `route` | `string` | URL path segment (informational, not used for routing) |
| `personalizationPolicy` | `WorkspacePersonalizationPolicy` | What the user can customise |
| `drillThroughDefinitions` | `DrillThroughDefinition[]` | Outbound drill-through targets |
| `telemetryId` | `string` | Dot-separated telemetry identifier |

---

## Evidence Panel Registry

Evidence panels are registered inside each panel component file via `EvidencePanelRegistration` from `@connectio/product-model`. The registration is passed as a prop to `EvidencePanel` from `@connectio/evidence-panel-runtime`.

Unlike workspace registrations, panel registrations are **not** assembled into a central array — they live with their component. The governance UI in `?workspace=admin-governance` derives the panel list by inspecting `defaultPanels` across all workspace registrations.

### EvidencePanelRegistration fields

| Field | Type | Description |
|---|---|---|
| `panelId` | `string` | Unique kebab-case identifier (matches panel references in workspace views) |
| `displayName` | `string` | Human-readable panel name shown in the panel header |
| `description` | `string` | One-sentence description |
| `ownerDomain` | `string` | Domain integration that implements this panel |
| `sourceOwnership` | `SourceOwnership` | Primary, contributing, or consuming domain classification |
| `lifecycle` | `LifecycleState` | Same options as workspace lifecycle |
| `allowedConsumerWorkspaces` | `string[]` | Workspace IDs permitted to host this panel. Empty = unrestricted |
| `requiredContext` | `EvidenceContextRequirement[]` | Context fields the panel requires from its host workspace |
| `freshnessPolicy` | `FreshnessPolicy` | Maximum acceptable data age |
| `confidencePolicy` | `ConfidencePolicy` | Confidence signalling rules |
| `drillThrough` | `DrillThroughDefinition \| undefined` | Optional outbound drill-through. **Omit entirely** (do not set `null`) when not used |
| `requiredPermissions` | `PermissionDefinition[]` | Permissions needed to view this panel |

### The `drillThrough` field

The `drillThrough` field is typed as `DrillThroughDefinition | undefined`, not nullable. When a panel has no drill-through destination, **omit the field entirely** from the registration object. Setting it to `null` will cause a TypeScript error.

---

## Lifecycle States

| State | Meaning | Visible in nav? |
|---|---|---|
| `live` | Production-ready, fully implemented | Yes |
| `beta` | Available but marked for feedback | Yes (with beta badge) |
| `concept-lab` | Under development or prototype | No |
| `deprecated` | Superseded, scheduled for removal | No |

`isNavigable(lifecycle)` from `@connectio/product-model` returns `true` for `'live'` and `'beta'`.

---

## Governance UI

The governance registry is accessible at `?workspace=admin-governance`. It is a read-only admin page (not in the workspace registry — handled as a special case in `MainBody.tsx`) with three tabs:

- **Registered Workspaces** — all workspace registrations with lifecycle, views, panels, roles, permissions, and drill-through targets
- **Panel Registry** — all distinct panel IDs referenced across workspace views, grouped by panel ID with usage list
- **Lifecycle & Source** — workspaces grouped by lifecycle state

The governance page is powered entirely by the static `workspaceRegistry` — no API call required.

---

## Registered Workspaces (Phase 1–3)

| Workspace ID | Display Name | Lifecycle | Owner Domain |
|---|---|---|---|
| `trace-investigation` | Trace Investigation | live | traceability |
| `quality-batch-release` | Quality Batch Release | live | quality |
| `operations-plan-risk` | Operations Plan Risk | live | operations |
| `traceability-workspace` | Traceability | concept-lab | traceability |
| `quality-workspace` | Quality | concept-lab | quality |
| `operations-workspace` | Operations | concept-lab | operations |
