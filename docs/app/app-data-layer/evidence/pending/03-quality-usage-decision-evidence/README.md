# Browser UAT Evidence — Quality: Usage Decision Evidence

> **Status:** `not-started`
>
> This is a pending capture template. Fill in every field during the UAT
> session. Rename this folder to `YYYY-MM-DD/quality-usage-decision-evidence/`
> before filing as evidence.

## Header

- **Title:** Quality — Usage Decision Evidence (Lot-Level)
- **Date / time:** _(fill in: ISO 8601 with explicit time zone)_
- **Tester:** _(fill in: name, role)_
- **Environment:** _(fill in: dev / uat / staging + Databricks host)_
- **Branch / commit:** _(fill in: branch-name @ SHA)_

## Subject

- **App / module:** Quality — Quality Evidence view / Quality Batch Release workspace
- **Data product(s):**
  - Usage Decision Evidence (`/api/quality/read-only-evidence`)
- **Route(s):**
  - `GET /api/quality/read-only-evidence`
- **Test input identifiers:**
  - Material: _(fill in)_
  - Batch: _(fill in)_
  - Plant: _(fill in)_
  - Inspection lot: _(fill in)_
  - Other: _(any additional scoping)_

## Preconditions

- [ ] Branch is up to date with `main`.
- [ ] Backend / databricks-api routes are reachable from the browser.
- [ ] OAuth identity / session is valid for the environment.
- [ ] No mock fallback flag is silently overriding the adapter mode.
- [ ] Test identifiers exist in the target environment.
- [ ] Test batch has at least one inspection lot in the source.
- [ ] `usageDecision` value in source is known beforehand to verify
  source-verbatim rendering.

## Steps executed

1. Open the Quality workspace, Evidence or Batch Release view.
2. Navigate to the test batch / inspection lot.
3. Verify the Quality Evidence panel loads and displays lot-level data.
4. Verify the `usageDecision` value is rendered source-verbatim — not
   mapped to "approved", "released", or "rejected" without the exact source value.
5. If multiple lots exist, verify the multi-lot warning is displayed.
6. Confirm no batch-level release claim is presented.
7. Confirm network request in DevTools shows the correct route.
8. Capture screenshots per naming convention.

## Expected result

- Panel shows lot-level evidence only — no batch-level release, approval,
  or rejection conclusion unless directly sourced.
- `usageDecision` is rendered source-verbatim. If source says "accepted",
  the UI says "accepted" — not "released" or "approved".
- If `usageDecision` is `null` or `unknown`, it renders as unavailable —
  not as a positive or negative conclusion.
- If multiple inspection lots are present, the multi-lot warning is visible.

## Actual result

_(Fill in during session.)_

## Screenshots

| #   | Filename                                          | What it shows |
| --- | ------------------------------------------------- | ------------- |
| 01  | `screenshots/01-quality-evidence-panel.png`       |               |
| 02  | `screenshots/02-usage-decision-rendering.png`     |               |
| 03  | `screenshots/03-null-decision-state.png`          |               |
| 04  | `screenshots/04-multi-lot-warning.png`            |               |
| 05  | `screenshots/05-network-response.png`             |               |

## Network / API evidence

_(HAR file path, or hand-saved request/response JSON.)_

## Governed-state checks

- [ ] All `null` / `unknown` / `unavailable` / `not-evaluated` values
      from the backend rendered as such in the UI.
- [ ] `usageDecision` is rendered source-verbatim.
- [ ] No batch-level release claim appears.
- [ ] Multi-lot warning is shown where applicable.
- [ ] Response data matches the expected contract.

## Forbidden-claim checks

The following phrases must **not** appear anywhere in the rendered UI
unless directly source-backed:

- "Batch approved"
- "Batch released"
- "Batch rejected"
- "Usage decision made" (as a conclusion without the source value)
- Any release or approval statement at batch level

- [ ] Reviewed [`browser-uat-checklists/quality.md`](../../browser-uat-checklists/quality.md).
- [ ] None of the listed forbidden claims appeared in the rendered UI.

## Result

`not-started`

## Caveats

- Evidence is strictly lot-level. No batch-level release claim is in scope.
- `usageDecisionMappingStatus` must be preserved — if governance-pending
  it must be labelled as such.
- UAT priority: 3.

## Follow-up actions

_(Fill in during session.)_

## Reviewer notes

_(To be filled in by reviewer.)_

## Standard self-check

- [ ] Browser was run against the intended environment (not local mock).
- [ ] Mock mode was not silently used.
- [ ] API route called is recorded.
- [ ] Contract / source caveats are visible where required.
- [ ] Null / unknown / unavailable states are not rendered as
      reassuring defaults.
- [ ] No production-readiness claim is made in this evidence pack.
