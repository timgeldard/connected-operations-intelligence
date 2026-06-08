# ADR-006: Governance Registry and Lifecycle Administration

**Status:** Accepted  
**Date:** 2024-03-08  
**Author:** ConnectIO Platform Team

---

## Context

As ConnectIO-RAD V2 grows from 1 workspace (Phase 1) to 3 live workspaces and 12+ evidence panels (Phase 3), we need a way to answer governance questions without digging through source code:

- Which workspaces are live? Which are in concept-lab?
- Which panels does each workspace use, and who owns them?
- Which panels have drill-through to other workspaces?
- What permissions are required for each workspace?

Additionally, as cross-domain evidence panels proliferate (panels from di-warehouse consumed by di-operations, panels from di-quality consumed by multiple workspaces), we need a clear contract for how panels declare their allowed consumers and context requirements.

---

## Decision

### 1. Static registry model (no service)

All workspace and panel registrations are **compile-time TypeScript objects**. The workspace registry (`apps/web/src/registry/workspace-registry.ts`) is a simple array of typed `WorkspaceRegistration` objects imported from domain-integration packages. No service, no database, no API.

**Why static:** The V2 model is a RAD prototype for proving product model decisions. A dynamic registry service would add substantial complexity with no benefit at this stage. The static model can be migrated to a service in a later phase if needed.

### 2. Panel registrations live with their components

`EvidencePanelRegistration` objects live inside each panel's `.tsx` file (passed to `EvidencePanel` as a prop). They are **not** assembled into a central panel registry array. The governance UI derives the panel list by inspecting `defaultPanels` across all workspace registrations.

**Why:** Keeping the registration co-located with the component means a developer adding a panel touches one file, not two. The downside is that panels not referenced by any workspace are invisible to the governance UI — acceptable at this stage since we control the registry.

### 3. Governance route as a special case (not in registry)

The governance page (`?workspace=admin-governance`) is handled as a named exception in `MainBody.tsx` before the workspace registry lookup. It does not have a `WorkspaceRegistration` entry.

**Why:** The governance page is not a workspace in the product model sense — it has no evidence panels, no scope context, no action sidebar, and no telemetry. Forcing it into a `WorkspaceRegistration` would require fabricating fields that don't apply (scopePolicy, defaultViews, drillThroughDefinitions, etc.). A special case is cleaner.

### 4. `drillThrough` must be omitted (not null) when absent

`EvidencePanelRegistration.drillThrough` is typed as `DrillThroughDefinition | undefined` (not nullable). Panels with no drill-through must **omit the field** from their registration object.

**Why:** TypeScript structural typing means a literal `null` value fails the type check. The `undefined` sentinel is idiomatic for optional object fields in TypeScript. This rule must be enforced by code review since TypeScript's error message ("type null is not assignable to type DrillThroughDefinition | undefined") is not obvious to a first-time panel author.

### 5. Lifecycle states drive navigation visibility

The `lifecycle` field on workspace registrations is the single source of truth for whether a workspace appears in the nav rail and home screen. `isNavigable(lifecycle)` from `@connectio/product-model` returns `true` for `'live'` and `'beta'`. Phase 0 stubs are kept in the registry with `lifecycle: 'concept-lab'` for backward compatibility.

---

## Consequences

### Positive

- Governance questions can be answered by inspecting source code or the `?workspace=admin-governance` UI without production access
- New workspaces follow a mechanical registration flow: write registration → add to registry → add WorkspaceViews branch → done
- The compile-time registry catches missing fields and type errors at build time
- Panel ownership and consumer relationships are visible in the governance UI

### Negative

- The governance UI shows only panels referenced in workspace views — standalone panels (if any are created) are invisible
- The static model does not support runtime registration from plugins or tenant-specific workspaces
- Adding a panel to multiple workspaces requires adding it to each workspace's `defaultPanels` and each view's `defaultPanels` — there is no shared panel catalogue at this stage

### Risks

- The `drillThrough: null` footgun (see Decision 4) will catch new panel authors. Mitigated by: TypeScript error, this ADR, and the panel authoring docs.

---

## Alternatives Considered

### Dynamic service registry

A backend API for workspace and panel registration was considered and rejected for Phase 3. The added complexity (API design, auth, deployment) is not justified for a RAD prototype. Revisit in Phase 5+ if multi-tenant deployment is required.

### Central panel array (like workspace-registry.ts)

A `panel-registry.ts` assembling all `EvidencePanelRegistration` objects was considered. Rejected because it creates a second file to update when adding a panel, and the governance UI's need for panel data can be satisfied by inspecting workspace registrations.
