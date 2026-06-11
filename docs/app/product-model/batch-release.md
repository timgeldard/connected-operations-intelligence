# Quality Batch Release Workspace

## Purpose

The **Quality Batch Release** workspace is the primary interface for reviewing batch release evidence and recording release decisions in ConnectIO-RAD V2. It is the Phase 2 flagship feature demonstrating cross-domain evidence consumption: a single workspace aggregates quality results, SPC alarms, operations conformance, and warehouse hold status from four independent domain integrations.

A quality analyst working a release case should think:

> "I need to make a release decision on this batch" — not "I need to open four different apps."

---

## Workspace Metadata

| Field | Value |
|---|---|
| workspaceId | quality-batch-release |
| displayName | Quality Batch Release |
| domainId | quality |
| ownerDomain | quality |
| lifecycle | live |
| route | /quality/batch-release |
| telemetryId | quality.batch-release |

---

## Supported Roles

- quality-lead
- quality-analyst
- quality-manager
- food-safety-lead
- plant-manager

---

## Required Permissions

| Permission ID | Description |
|---|---|
| quality.release.read | View batch release cases and quality evidence |
| quality.release.write | Submit release decisions, hold requests, and retest requests |

---

## Supported Scopes

| Scope Level | Notes |
|---|---|
| batch | Primary scope — release case is batch-scoped |
| process-order | Derived from batch when not explicitly provided |
| plant | Plant-level queue view |

Default level: batch. Auto-elevate: false.

---

## Views

| View ID | Display Name | Source Domains | Panels |
|---|---|---|---|
| release-queue | Release Queue | quality | ReleaseQueuePanel, ReleaseSummaryPanel |
| batch-decision | Batch Decision | quality | ReleaseSummaryPanel (full-width), QualityResultsPanel, CoAReadinessPanel, DeviationsPanel |
| quality-evidence | Quality Evidence | quality, traceability | QualityResultsPanel, CoAReadinessPanel, CoAReleaseStatusPanel, RiskSignalsPanel |
| operations-evidence | Operations Evidence | quality, operations, warehouse, traceability | ProcessOrderEvidencePanel, WarehouseHoldStatusPanel, EventTimelinePanel, DeviationsPanel |
| warehouse-trace-evidence | Warehouse and Trace | warehouse, traceability, spc | WarehouseHoldStatusPanel, TraceExposureForReleasePanel, RelatedInvestigationsPanel, SPCSignalsForReleasePanel |
| decision-history | Decision History | quality | DecisionHistoryPanel (full-width), DeviationsPanel, ReleaseSummaryPanel |

---

## Evidence Panels

| Panel ID | Display Name | Owner Domain | Description |
|---|---|---|---|
| release-queue | Release Queue | quality | All release cases for the plant sorted by priority |
| batch-release-summary | Release Summary | quality | Consolidated readiness across quality, SPC, CoA, holds, deviations, and trace |
| quality-results-summary | Quality Results | quality | MIC, chemical, sensory, and physical inspection results |
| coa-readiness | CoA Readiness | quality | CoA document completeness and missing field summary |
| deviations | Deviations | quality | Open and resolved deviations, highlighting those that block release |
| decision-history | Decision History | quality | Audit trail of release decisions |
| coa-release-status | CoA and Release Status | traceability | SAP QM usage decision and open quality lots |
| risk-signals | Risk Signals | traceability | Active Trace2 risk signals |
| event-timeline | Event Timeline | traceability | Ordered timeline of batch and investigation events |
| related-investigations | Related Investigations | traceability | Investigations linked by batch, material, supplier, or customer |
| trace-exposure-for-release | Trace Exposure | traceability | Upstream and downstream trace risk relevant to the release decision |
| process-order-evidence | Process Order Evidence | operations | Yield, status, deviations, and NCRs from the manufacturing process order |
| warehouse-hold-status | Warehouse Hold Status | warehouse | Batch stock status and active warehouse holds |
| spc-signals-for-release | SPC Signals | spc | Active and resolved SPC control chart alarms |

---

## Actions

| Action ID | Display Name | Description |
|---|---|---|
| release-batch | Release Batch | Record a release or conditional-release decision |
| place-on-hold | Place on Hold | Place a quality hold blocking distribution |
| request-retest | Request Retest | Raise a retest request for a specific parameter |
| escalate-deviation | Escalate Deviation | Escalate an open deviation to a named role |
| open-trace-investigation | Open Trace Investigation | Navigate to the Trace Investigation workspace for the batch |

---

## Cross-Domain Panel Ownership Rules

Panels from spc, operations, warehouse, and traceability declare quality-batch-release in their allowedConsumerWorkspaces array on EvidencePanelRegistration. This is the governance contract defined in ADR-003.

| Panel ID | Owner Domain | allowedConsumerWorkspaces |
|---|---|---|
| spc-signals-for-release | spc | quality-batch-release |
| process-order-evidence | operations | quality-batch-release |
| warehouse-hold-status | warehouse | quality-batch-release |
| trace-exposure-for-release | traceability | quality-batch-release |
| coa-release-status | traceability | trace-investigation, quality-batch-release |
| risk-signals | traceability | trace-investigation, quality-batch-release |
| event-timeline | traceability | trace-investigation, quality-batch-release |
| related-investigations | traceability | trace-investigation, quality-batch-release |

---

## Routing

URL: ?workspace=quality-batch-release&releaseCaseId=RC-2024-001847&view=batch-decision

| Param | Description | Default |
|---|---|---|
| workspace | Always quality-batch-release | — |
| releaseCaseId | Release case record ID | RC-2024-001847 (mock) |
| view | Active view tab | release-queue |

---

## Personalization Policy

| Setting | Value |
|---|---|
| Allow panel reorder | Yes |
| Allow panel hide | Yes |
| Allow saved filters | No |
| Max pinned panels | 8 |

---

## Drill-Through

| Label | Target Workspace | Target View |
|---|---|---|
| Open Trace Investigation | trace-investigation | overview |
| Open in Traceability | traceability-workspace | trace |

---

## Mock Data

The Phase 2 mock scenario represents a critical release case at Kerry Listowel:

- **Release case**: RC-2024-001847 — Kerry Listowel Emmental 10kg Block, batch CH-240308-0047, process order PO-240308-3847
- **Status**: under-review, priority critical, assigned to sarah.byrne@kerry.com, due 2024-03-09T12:00
- **Blockers**: MIC failure (Listeria monocytogenes); CoA incomplete; open warehouse quality hold; SPC X-bar rule violation on pH
- **Deviations**: Two open — DEV-2024-001 (critical, MIC), DEV-2024-002 (major, environmental monitoring)
- **Recommended action**: reject

All adapter methods return typed mock data from quality-release-mock-data.ts. No real backend connection is required in Phase 2.
