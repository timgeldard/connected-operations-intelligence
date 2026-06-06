# ADR-017: Feedback Capture and Triage Model

**Status:** Accepted  
**Date:** 2026-05-15  
**Author:** ConnectIO Platform Team

---

## Context

The ConnectIO-RAD V2 pilot requires a mechanism for pilot users to capture feedback — usability issues, data quality problems, missing evidence, accessibility gaps, defects — and for the pilot team to triage, prioritise, and track that feedback through to resolution.

Three approaches were considered:

1. **External tool (Jira, Azure DevOps, ServiceNow)** — feedback submitted via a link to an external tracker. Familiar to the IT team but requires a separate login, breaks the user's flow, and loses context (which workspace, view, and panel the user was looking at).
2. **Email/form submission** — low friction for users but creates an unstructured data dump with no automatic context capture and no visible triage workflow.
3. **In-shell feedback with localStorage persistence** — feedback captured within the ConnectIO shell using a `FeedbackDrawer` component, with items persisted to the browser's `localStorage` and reviewable via an admin triage page within the same shell.

The pilot is a controlled engagement with a small group of named users at a single site (Kerry IE10). A lightweight, session-local mechanism is sufficient for this phase.

---

## Decision

### FeedbackProvider and localStorage

A `FeedbackProvider` React context (in `apps/web/src/feedback/FeedbackContext.tsx`) wraps the application shell. It:

- Persists all feedback items to `localStorage` under the key `connectio.feedback.v1`
- Loads items from `localStorage` on mount so feedback survives page refresh
- Exposes `submit()` and `updateStatus()` via the `useFeedbackContext()` hook

Storage format is a JSON array of `FeedbackItem` objects (typed in `packages/product-model/src/types/pilot.ts`). The `STORAGE_KEY` is `connectio.feedback.v1`.

### FeedbackItem Type Design

`FeedbackItem` captures:
- `feedbackId` (auto-generated: `FB-<timestamp>`)
- `workspaceId`, `viewId`, `panelId`, `actionId` — the exact context where feedback was triggered
- `route` — the URL search string at submission time
- `category` — one of 11 values: `usability | data-quality | missing-evidence | wrong-owner | performance | accessibility | navigation | terminology | training | defect | enhancement`
- `severity` — from `ReadinessSeverity`: `info | warning | blocker | critical`
- `priority` — `low | medium | high | critical`
- `status` — lifecycle: `new | triaged | accepted | rejected | in-progress | resolved | deferred | blocked`
- `submittedBy`, `submittedRole`, `owner`, `targetPhase`, `linkedFindingIds`

### FeedbackDrawer

The `FeedbackDrawer` component is a Dialog (using `@connectio/design-system`) that opens when the user clicks the "Feedback" button in a workspace. It pre-populates `workspaceId`, `viewId`, and `panelId` from the current shell state. This ensures every feedback item is attributed to the exact context where it was triggered.

### Triage in FeedbackTriagePage

`FeedbackTriagePage.tsx` merges seed items (hardcoded in the component: FB-SEED-001, FB-SEED-002, FB-SEED-003) with items from `FeedbackContext`. Seed items represent real pre-pilot findings and are read-only in the triage UI. The triage page provides status filters and status update buttons for non-seed items.

---

## Rationale

### Why localStorage rather than a backend API?

The pilot is a RAD prototype. A backend feedback API would require schema design, authentication, a database, and a deployment pipeline — significant overhead for a controlled engagement with a small group of named users at one site. localStorage is sufficient for a controlled pilot where the administrator reviews feedback in the same browser session used for piloting.

The `FeedbackItem` type is already in `packages/product-model`, so migration to a backend API in a later phase requires only a replacement of the `FeedbackProvider`'s storage implementation — the type design and UI are compatible with a server-backed model.

### Why 11 feedback categories?

The category list is designed to produce actionable signal for different parts of the team:
- `usability`, `navigation`, `terminology` → UX and content design team
- `data-quality`, `wrong-owner`, `missing-evidence` → domain data team
- `performance`, `defect` → platform engineering
- `accessibility` → platform engineering with WCAG compliance requirement
- `training` → documentation and training content team
- `enhancement` → product backlog

A smaller category list would conflate signal from different teams. A larger list would confuse users.

### Why seed items in the component rather than localStorage?

Seed items are real pre-pilot findings that should appear in every session for every pilot reviewer. They cannot be in localStorage because localStorage is session-local. Hardcoding them in the component ensures they are always visible and always represent the programme's known issues as of the pilot release.

---

## Consequences

### Positive

- Feedback is captured with full context (workspace, view, panel) automatically
- No external tool login required — feedback is captured in the flow of use
- `FeedbackItem` type is compatible with a future backend API — migration is a provider swap
- Seed items ensure known issues are always visible to administrators
- The `category` and `severity` fields produce actionable signal for different team functions

### Negative

- Feedback is scoped to one browser session and device — a user who switches devices loses their submitted feedback from the previous session
- localStorage has a 5–10 MB limit depending on browser — with rich feedback items, this could be reached in an extended pilot
- No notification or alert when new feedback is submitted — the administrator must check the triage page regularly

### Mitigations

- Pilot users are advised to submit feedback in the same session they use for piloting — the pilot is a guided, time-bounded event
- The localStorage limit is not a concern for a controlled pilot with a small group of users and a bounded engagement window
- The pilot lead is responsible for checking the triage page daily during the validation period
