# V2 Concepts Glossary

**Audience:** All pilot users  
**In-app page:** `?workspace=help-concepts`

This glossary covers the 11 key concepts used throughout ConnectIO-RAD V2. Understanding these terms helps you navigate the product and give more precise feedback during the pilot.

---

## Domain

A bounded area of business ownership. Each domain owns its source data, evidence panels, and action flows. Domains are the units of accountability in the V2 model.

Examples: Quality, Traceability, Operations, Warehouse, Maintenance.

Example: The Quality domain owns the `QualityResultsPanel` and the Batch Release action.

---

## Workspace

A purpose-built operational view that brings together evidence panels from one or more domains. A workspace answers a specific business question — "Is this batch safe to release?", "What is blocking today's production plan?" — rather than representing a system or application.

Workspaces replace the concept of "logging into an app." You navigate to a workspace by what you need to do, not by which system holds the data.

Example: The Quality Batch Release workspace brings together quality results, SPC signals, trace exposure, warehouse hold status, and process order data — from four different source systems — into a single view.

---

## View

A named perspective within a workspace. Workspaces can have multiple views that group panels by task or context. Views appear as tabs at the top of a workspace.

Example: The Batch Release workspace has views: Release Queue, Batch Decision, Evidence Summary.

---

## Evidence Panel

A reusable data card that shows information from a specific source system. Each panel is owned by a domain and carries freshness and confidence metadata. Panels can be shared across workspaces if the owning domain grants permission via `allowedConsumerWorkspaces`.

Example: The `QualityResultsPanel` is owned by the Quality domain and shows inspection results from LabWare.

---

## Action Flow

A structured workflow that allows users to perform a governed operation. Actions validate inputs, capture context, emit telemetry, and can trigger downstream events. Actions are the mechanism for doing something — not just viewing data.

Example: The "Release Batch" action validates release conditions, records the decision, and sends a release signal to the source system.

---

## Owner Badge

A label shown on evidence panels indicating which domain owns the data shown. This identifies who is accountable for the data quality and freshness.

Example: The `WarehouseHoldStatusPanel` shows "owner: warehouse" — meaning the Warehouse domain is responsible for this data. Data quality issues with this panel should be raised with the Warehouse domain team.

---

## Freshness

How recently the data in a panel was last updated from its source system. Each panel has a freshness policy that defines the expected update frequency and the threshold beyond which data is considered stale.

A stale panel shows a visual staleness indicator. In the pilot, some panels with mock data always show a staleness indicator because the data is never updated from a live source.

Example: An environmental monitoring panel with a freshness of 15 minutes means data older than 15 minutes triggers a staleness indicator.

---

## Confidence

A quality signal indicating how reliable the data in a panel is. Confidence may reflect data completeness, source availability, or validation status. Low confidence means the data should be interpreted with caution.

In the pilot, confidence is not wired for all panels — SPC and maintenance panels in particular have placeholder confidence values.

Example: A trace panel with low confidence may indicate the trace graph is incomplete due to missing upstream batch records.

---

## Drill-Through

A navigation action from one evidence panel to a related workspace, carrying the current context (such as `batchId`). Drill-throughs allow cross-domain investigation without losing context and without having to search for the same record in a different workspace.

Drill-throughs are declared in the workspace registration and auditable in the Governance Registry.

Example: Clicking "Open Trace Investigation" in Batch Release drills through to the Trace Investigation workspace with the batch pre-selected.

---

## Lifecycle

The maturity state of a workspace or evidence panel. Lifecycle controls whether a workspace appears in navigation.

| Value | Meaning |
|---|---|
| `live` | Production-deployed, visible to all authorised users |
| `pilot` | Available to pilot users only; pre-production |
| `concept-lab` | Prototype only; not visible in main navigation |
| `deprecated` | Superseded; preserved for existing deep links only |
| `hidden` | Never rendered |

Example: SPC Monitoring has `lifecycle: 'pilot'` — it is available in the pilot but not yet fully source-integrated or approved for general rollout.

---

## Scope

The contextual boundary for a workspace — the level at which data is filtered. Setting scope narrows all evidence panels to the relevant records. Scope dimensions include: `plant`, `line`, `work-centre`, `batch`, `process-order`, `warehouse`, `storage-location`, and others.

Each workspace declares which scope levels it supports in its `WorkspaceRegistration`. The shell resolves the default scope from the user's authorised scope.

Example: Setting scope to `plantId=IE10` shows data for Kerry Listowel only across all evidence panels in the workspace.
