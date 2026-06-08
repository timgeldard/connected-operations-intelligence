# Migration Guide: Quality Batch Release Workspace

## Overview

This document describes what changed for teams adopting the Quality Batch Release workspace in ConnectIO-RAD V2 Phase 2, and how to wire it into applications and shells.

---

## What Changed

In legacy ConnectIO, batch release required switching between four applications: the quality app for results and CoA, SPC for alarm review, process order history for operations conformance, and Warehouse360 for hold status. Each transition lost context and required manual cross-referencing.

The V2 Quality Batch Release workspace aggregates evidence from all four domains on a single screen. Panels from @connectio/di-spc, @connectio/di-operations, @connectio/di-warehouse, and @connectio/di-traceability are hosted alongside quality-owned panels under a single workspace ID.

---

## Workspace ID

| Field | Value |
|---|---|
| New workspace ID | quality-batch-release |
| Replaces | quality-workspace (lifecycle: concept-lab stub) |
| Registration export | batchReleaseRegistration from @connectio/di-quality |
| Package | domain-integrations/quality |

---

## URL Migration

| Old pattern | New URL |
|---|---|
| /quality (Phase 0 stub) | ?workspace=quality-batch-release&view=release-queue |
| Any link with a batch ID | ?workspace=quality-batch-release&releaseCaseId=RC-XXXX&view=batch-decision |
| ?workspace=quality-workspace | Replace quality-workspace with quality-batch-release |

---

## Adapter Migration

The adapter for this workspace is QualityReleaseAdapter in @connectio/di-quality.



Phase 2 adapter methods return mock data. Phase 3 replaces mock returns with real API calls without changing the request shape or panel interfaces.

---

## Panel Consumer Migration

Cross-domain panels declare their consumer whitelist via allowedConsumerWorkspaces on EvidencePanelRegistration. To permit a panel from another domain to be hosted in quality-batch-release, add the workspace ID to that panel's registration:



The panel must also be exported from the owning package's index.ts.

---

## Registry Wiring

Import batchReleaseRegistration from @connectio/di-quality and add it to the workspace registry:



---

## Shell Wiring

Use navigateToBatchRelease from useWorkspaceShellState to deep-link into a release case:



The default view is release-queue when viewId is omitted. WorkspaceViews.tsx in apps/web is already wired and requires no additional configuration.

---

## WorkspaceViews Routing

WorkspaceViews.tsx routes workspaceId === 'quality-batch-release' to BatchReleaseWorkspace.
The onSelectCase prop is wired to setReleaseCaseId so clicking a queue row updates the URL.

---

## RoleAwareHome Integration

batchReleaseRegistration has lifecycle: 'live' so it appears automatically in the workspace cards
on the home screen. A Priority Items section is also shown for quality users, surfacing the two
highest-priority mock cases with direct navigateToBatchRelease links.
