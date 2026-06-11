# ADR-019: Training and Support Model

**Status:** Accepted  
**Date:** 2026-05-15  
**Author:** ConnectIO Platform Team

---

## Context

Phase 7 requires a training and support model for the ConnectIO-RAD V2 pilot. Two questions needed answering:

1. Where and how do pilot users access training and help content?
2. How does the pilot support team access operational runbooks and troubleshooting guidance?

For training, three options were considered:
1. **External LMS (SuccessFactors, Cornerstone)** — formal learning management system with completion tracking, certification, and structured courses.
2. **Confluence/SharePoint page** — written documentation in the existing Kerry knowledge management platform.
3. **In-shell help pages** — training and glossary content served as workspace routes within the ConnectIO shell itself.

For support, the question was whether runbooks should live in the ConnectIO shell (as admin workspace routes) or in the engineering documentation (`docs/runbooks/`).

---

## Decision

### In-Shell Help Pages as Workspace Routes

Three help pages are implemented as workspace routes within the ConnectIO shell, accessible via `?workspace=help-*`:

| Route | Title | Content |
|---|---|---|
| `?workspace=help-getting-started` | Getting Started | V2 model overview, navigation guide, pilot workspaces, mock vs real data, feedback instructions |
| `?workspace=help-concepts` | V2 Concepts Glossary | 11 key concepts: Domain, Workspace, View, Evidence Panel, Action Flow, Owner Badge, Freshness, Confidence, Drill-Through, Lifecycle, Scope |
| `?workspace=help-scenarios` | Scenario Review Guide | 6 step-by-step training scenarios (TRN-001 through TRN-006) with direct navigation buttons to each primary workspace |

Help pages are wired as named exceptions in `MainBody.tsx` (the same pattern as admin pages) — they do not have `WorkspaceRegistration` entries in the workspace registry.

The help pages are discoverable via the command palette (Ctrl+K search) and may be linked from the home screen help section.

### Scenario-Linked Training

Each training scenario (TRN-001 through TRN-006) is linked to a formal validation scenario (SCN-001 through SCN-006) from the Scenario Validation Centre. The training scenario provides step-by-step instructions for the same journey that the validation scenario tests. A "Open Workspace" button in each training scenario card navigates directly to the primary workspace, lowering the barrier to starting.

Training scenarios are defined as `TrainingScenarioLink` constants in `HelpScenariosPage.tsx`. They are not `ValidationScenario` records — they are lighter-weight objects designed for end-user consumption rather than governance tracking.

### Runbook Documentation in docs/runbooks/

Operational runbooks for the pilot support team live in `docs/runbooks/`:

- `pilot-support-runbook.md` — support roles, feedback triage, panel failures, telemetry, access issues, escalation
- `workspace-troubleshooting.md` — workspace/panel/action/drill-through failure diagnosis
- `cutover-simulation-troubleshooting.md` — simulation modes, blockers, rollback

Runbooks are markdown documents in the engineering repository. They are the authoritative source for support procedures and are updated via the normal code review process.

---

## Rationale

### Why in-shell help pages rather than an LMS or Confluence?

**LMS (SuccessFactors/Cornerstone):** The pilot is a controlled, time-bounded engagement with a small group of named users at one site. A full LMS integration would require content authoring, course design, SCORM packages, and system integration — significant investment for a RAD prototype where the content will change rapidly as the pilot proceeds. The pilot does not require LMS completion records.

**Confluence/SharePoint:** External documentation requires users to context-switch. A pilot user who encounters confusion mid-workflow must leave ConnectIO, open Confluence, find the relevant page, read it, and return. In-shell help eliminates this context switch.

**In-shell help pages:** The help content is directly accessible within the product. The step-by-step scenario guide includes a button that navigates directly to the relevant workspace. This is the lowest-friction help experience for a pilot user. The command palette (Ctrl+K) makes help pages discoverable without a dedicated help button in the UI.

### Why `?workspace=help-*` routes rather than a sidebar or modal?

Help pages benefit from being addressable URLs — they can be linked directly from the home screen, from email invitations, and from the command palette. A sidebar or modal would require a separate trigger mechanism and would not be independently linkable. The workspace route pattern is already established in the shell; using it for help pages is consistent and requires no new routing infrastructure.

### Why TRN-NNN scenarios rather than using the SCN-NNN scenarios directly in the help page?

`ValidationScenario` records (SCN-NNN) are governance artefacts — they include owner assignments, status tracking, findings, and `blocksPilotExit` flags. Exposing these directly to end users would create a confusing mix of governance metadata and training guidance. `TrainingScenarioLink` objects strip the governance fields and replace them with user-facing attributes (difficulty level, estimated time, step list, direct navigation button) appropriate for a training guide.

### Why runbooks in docs/ rather than in-shell admin pages?

Runbooks are technical operational guidance for the support team and platform engineering — not for pilot end users. The target audience has access to the engineering repository and is comfortable with markdown. Putting runbooks in `docs/runbooks/` keeps them in version control with the same review and update process as other engineering documentation, and avoids adding admin complexity to the shell for content that is not user-facing.

---

## Consequences

### Positive

- Help is accessible in-context without leaving the product
- Training scenarios link directly to the workspaces they cover — one click from reading to doing
- The `?workspace=help-*` URL pattern is consistent with admin pages and requires no new shell infrastructure
- Runbooks in `docs/runbooks/` are version-controlled and reviewable via the normal PR process
- Content can be updated via a code change and deployment without LMS or CMS publishing workflow

### Negative

- Help content is not personalised — all users see the same three help pages regardless of role
- There is no completion tracking — the pilot team cannot confirm which users have read the getting-started guide or completed the training scenarios
- `HelpScenariosPage.tsx` and `HelpConceptsPage.tsx` are not in the workspace registry — they will not appear in the Governance Registry's workspace list

### Mitigations

- Role-specific help pages can be added in Phase 8 if the pilot reveals that the generic content is insufficient
- Completion tracking can be approximated by reviewing telemetry for `?workspace=help-*` navigation events
- The admin governance page's "special cases" pattern (`MainBody.tsx` named exceptions) already accommodates non-registry pages; help pages follow the same convention
