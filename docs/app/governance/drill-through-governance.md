# Drill-Through Governance

## Overview

**Drill-through definitions** declare cross-workspace navigation links that source workspaces can offer to users. They are defined in each workspace's `WorkspaceRegistration` and are enforced as part of the product model.

A drill-through definition is distinct from a link action in an action panel:

| | Drill-through Definition | Link Action |
|---|---|---|
| Location | `WorkspaceRegistration.drillThroughDefinitions` | Action panel component |
| Visibility | Governance Registry, ADR | Source code only |
| Context | Declared (`contextScopes`) | Ad-hoc |
| Enforcement | Registered and auditable | Not tracked |

All cross-workspace navigation that is part of the product UX (not a debug tool or admin shortcut) should be declared as a drill-through definition.

---

## Drill-Through Definition Schema

```typescript
interface DrillThroughDefinition {
  label: string             // Human-readable link label
  targetWorkspaceId: string // workspaceId of the target workspace
  targetViewId?: string     // Optional: specific view to open in the target
  contextScopes: ScopeLevel[] // Scope levels that carry across the navigation
}
```

---

## Current Drill-Through Map

The `AdminGovernancePage` **Drill-through Map** tab renders this table live from the registry. The authoritative source is the workspace registration files; the table below is a summary as of Phase 5.

| Source Workspace | Label | Target Workspace | Target View | Context |
|---|---|---|---|---|
| Trace Investigation | Open Quality Batch Release | quality-batch-release | batch-decision | batch, plant |
| Quality Batch Release | Open Trace Investigation | trace-investigation | overview | batch |
| Quality Batch Release | Open SPC Monitoring | spc-monitoring | chart-overview | batch, line |
| Operations Plan Risk | Open Trace Investigation | trace-investigation | overview | batch |
| Operations Plan Risk | Open Quality Batch Release | quality-batch-release | batch-decision | batch |
| Operations Plan Risk | Open Production Staging | production-staging | staging-overview | plant |
| Environmental Monitoring | Open Quality Batch Release | quality-batch-release | batch-decision | batch, plant |
| Environmental Monitoring | Open Trace Investigation | trace-investigation | overview | batch, plant |
| Production Staging | Open Warehouse 360 | warehouse-360-overview | holds-management | warehouse |
| Production Staging | Open Quality Batch Release | quality-batch-release | batch-decision | batch |
| SPC Monitoring | Open Quality Batch Release | quality-batch-release | batch-decision | batch, plant |
| Warehouse 360 Overview | Open Batch Release | quality-batch-release | batch-decision | batch, warehouse |
| Warehouse 360 Overview | Open Production Staging | production-staging | staging-overview | warehouse |
| Warehouse 360 Overview | Open Trace Investigation | trace-investigation | overview | batch |
| Maintenance & Reliability | Open Operations Plan Risk | operations-plan-risk | plan-overview | plant |

---

## Adding a Drill-Through Definition

1. Identify the source and target workspaces
2. Confirm the target workspace is registered and navigable (`lifecycle` is not `deprecated` or `hidden`)
3. Add the definition to the source workspace's `drillThroughDefinitions` array in its registration file
4. The Governance Registry (`AdminGovernancePage`) will automatically reflect the new link
5. Wire the navigation in the relevant action panel or workspace component using the `useWorkspaceShellState` navigate helper

---

## Governance Rules

- **Declared before wired**: The drill-through definition must be in the registration file before the UI link is added
- **One-way dependency**: Drill-through definitions are owned by the source workspace. The target workspace does not need to know about them.
- **No cross-domain circular links at the same scope**: `workspace A → workspace B → workspace A` is allowed if the context scope changes (e.g. from plant to batch), but circular links at the same scope should be reviewed for UX coherence.
- **Target view validation**: If `targetViewId` is specified, the target workspace must have that viewId in its `defaultViews`
