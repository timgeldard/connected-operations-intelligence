# Feedback and Triage

**Phase:** 7  
**Last updated:** 2026-05-15  
**Admin view:** `?workspace=admin-pilot-feedback`

## Feedback Capture Mechanism

Pilot users submit feedback using the `FeedbackDrawer` component, which is accessible via the "Feedback" button available in every workspace during the pilot. When opened, the drawer is pre-populated with the current `workspaceId`, `viewId`, and `panelId`, so feedback is always attributed to the exact context where it was triggered.

### FeedbackProvider and localStorage Persistence

The `FeedbackProvider` component (in `apps/web/src/feedback/FeedbackContext.tsx`) wraps the entire application shell. It:

- Loads existing feedback items from `localStorage` under the key `connectio.feedback.v1` on mount
- Persists all items back to `localStorage` on every state change via a `useEffect`
- Exposes `submit()` and `updateStatus()` via the `useFeedbackContext()` hook

This means feedback survives page refresh but is scoped to the browser session and device. It is not shared across devices or users. For the pilot, the administrator reviews feedback by opening `?workspace=admin-pilot-feedback` in the same browser session used for piloting.

Seed items (FB-SEED-001, FB-SEED-002, FB-SEED-003) are hardcoded in `FeedbackTriagePage.tsx` and appear in every session regardless of localStorage state. These represent real findings from pre-pilot walkthroughs and are read-only in the triage UI.

---

## Feedback Categories

| Category | When to Use |
|---|---|
| `usability` | The interface is confusing, unclear, or requires too many steps |
| `data-quality` | Data shown is wrong, stale, or inconsistent with the source system |
| `missing-evidence` | A panel that should be present is absent |
| `wrong-owner` | The owner badge or attribution is incorrect |
| `performance` | The page or panel is slow to load or respond |
| `accessibility` | Cannot be used with keyboard, screen reader, or at high zoom |
| `navigation` | Cannot find a workspace, view, or feature |
| `terminology` | Labels or terms are confusing or domain-incorrect |
| `training` | Something is unclear and should be explained in the help docs |
| `defect` | A clear functional bug (action fails, panel errors, broken drill-through) |
| `enhancement` | A suggestion for a new capability or improvement |

---

## Severity and Priority

Severity and priority are set by the feedback submitter at the time of submission. The triage team may adjust during review.

**Severity** (from `ReadinessSeverity`):
- `info` — informational; no action required
- `warning` — should be fixed but does not block pilot
- `blocker` — blocks pilot progress; requires a remediation plan before pilot exit
- `critical` — blocks immediately; must be resolved before the pilot can continue

**Priority** (from `FeedbackPriority`):
- `low`, `medium`, `high`, `critical`

---

## Feedback Status Lifecycle

New feedback items start at `new` and move through the following statuses:

```
new → triaged → accepted → in-progress → resolved
                         → deferred
               → rejected
               → blocked
```

| Status | Meaning |
|---|---|
| `new` | Submitted; not yet reviewed by the pilot team |
| `triaged` | Reviewed; category, severity, owner confirmed |
| `accepted` | Accepted as valid; will be actioned |
| `rejected` | Rejected (not a defect, out of scope, duplicate) |
| `in-progress` | Being actively worked |
| `resolved` | Fix or workaround is in place |
| `deferred` | Valid but not being actioned this phase; target phase noted |
| `blocked` | Accepted but cannot proceed due to an external dependency |

---

## Triage Workflow

1. Open `?workspace=admin-pilot-feedback` to see all feedback items (seed + localStorage)
2. Filter to status `new` to see unreviewed items
3. For each new item:
   - Confirm the category, severity, and priority are appropriate
   - Assign an owner (domain team or `platform-engineering`)
   - Set the target phase for resolution
   - Move status to `triaged`
4. Review triaged items with domain leads and move to `accepted` or `rejected`
5. Link accepted items to open `ReadinessFinding` records where applicable (the `linkedFindingIds` field)
6. Items with `severity: 'blocker'` or `severity: 'critical'` must have a remediation plan before GATE-005 and GATE-006 can be passed

---

## Current Seed Items

| ID | Title | Category | Severity | Priority | Status | Owner |
|---|---|---|---|---|---|---|
| FB-SEED-001 | CoA panel shows placeholder text | data-quality | warning | high | triaged | quality-domain |
| FB-SEED-002 | Trace graph rendering slow on large batches | performance | warning | medium | accepted | platform-engineering |
| FB-SEED-003 | Missing keyboard navigation in OPR filters | accessibility | blocker | high | new | platform-engineering |

FB-SEED-003 is the only current item at `severity: 'blocker'`. It blocks PEC-008 (Accessibility Gate) and must be triaged before pilot exit.
