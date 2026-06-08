# Browser UAT Evidence — SPC: Chart Data Series

> **Status:** `not-started`
>
> This is a pending capture template. Fill in every field during the UAT
> session. Rename this folder to `YYYY-MM-DD/spc-chart-data-series/`
> before filing as evidence.

## Header

- **Title:** SPC — Control Chart Data Series + Monitoring Overview
- **Date / time:** _(fill in: ISO 8601 with explicit time zone)_
- **Tester:** _(fill in: name, role)_
- **Environment:** _(fill in: dev / uat / staging + Databricks host)_
- **Branch / commit:** _(fill in: branch-name @ SHA)_

## Subject

- **App / module:** SPC — Chart Overview view (SPC monitoring workspace)
- **Data product(s):**
  - SPC Chart Data Series (`/api/spc/chart-data`)
  - SPC Summary (`/api/spc/summary`)
  - Active SPC Signals (`/api/spc/active-signals`)
  - Monitored Characteristics (`/api/spc/monitored-characteristics`)
- **Route(s):**
  - `GET /api/spc/chart-data`
  - `GET /api/spc/summary`
  - `GET /api/spc/active-signals`
  - `GET /api/spc/monitored-characteristics`
- **Test input identifiers:**
  - Material: _(fill in)_
  - Batch: _(fill in)_
  - Plant: _(fill in)_
  - Characteristic ID: _(fill in — at least one monitored characteristic)_
  - Other: _(any additional scoping)_

## Preconditions

- [ ] Branch is up to date with `main`.
- [ ] Backend / databricks-api routes are reachable from the browser.
- [ ] OAuth identity / session is valid for the environment.
- [ ] No mock fallback flag is silently overriding the adapter mode.
- [ ] At least one monitored characteristic exists for the test scope.
- [ ] The control chart approval state and `lockedBy` value are known
  beforehand — `lockedBy` must NOT be interpreted as approval.
- [ ] No capability indices or Nelson rule violation labels are expected in UI.

## Steps executed

1. Open the SPC workspace, Chart Overview view.
2. The Sandbox mode banner should be visible (if adapter is mock) or
   source strip should confirm databricks-api source.
3. Wait for monitored characteristics to load (not "No monitored
   characteristics found" during loading — check loading state renders).
4. For each control chart that renders, verify:
   a. UCL / LCL / CL show em-dash (—) where null, not "N/A".
   b. Point status `not-evaluated` renders as grey, distinct from `in-control`.
   c. `approvalState !== 'approved'` renders the approval warning banner.
5. Confirm no capability index, Nelson rule violation count, or process
   capability claim appears.
6. Capture screenshots per naming convention.

## Expected result

- Loading state renders correctly (no premature "no characteristics" message).
- Control chart SVG renders with UCL, CL, LCL where available; em-dash
  where null (not "N/A").
- `not-evaluated` points are distinctly coloured (grey), not green.
- Approval warning is shown for any chart where `approvalState !== 'approved'`.
- No capability index, Nelson rule signal count, or "In control" claim
  appears without source backing.
- Active SPC Signals panel lists signals by rule without interpreting
  them as "process failed" or "process approved".

## Actual result

_(Fill in during session.)_

## Screenshots

| #   | Filename                                            | What it shows |
| --- | --------------------------------------------------- | ------------- |
| 01  | `screenshots/01-chart-overview-loading.png`         |               |
| 02  | `screenshots/02-control-chart-panel.png`            |               |
| 03  | `screenshots/03-null-limit-em-dash.png`             |               |
| 04  | `screenshots/04-not-evaluated-point.png`            |               |
| 05  | `screenshots/05-approval-warning-banner.png`        |               |
| 06  | `screenshots/06-active-signals-panel.png`           |               |
| 07  | `screenshots/07-network-response.png`               |               |

## Network / API evidence

_(HAR file path, or hand-saved request/response JSON.)_

## Governed-state checks

- [ ] All `null` / `unknown` / `unavailable` / `not-evaluated` values
      from the backend rendered as such in the UI.
- [ ] `not-evaluated` point status is NOT collapsed into `in-control`.
- [ ] UCL / CL / LCL null values render as em-dash, not "N/A".
- [ ] `lockedBy` is not presented as an approval.
- [ ] No capability index or Nelson rule signal appears.
- [ ] Response data matches the expected contract.

## Forbidden-claim checks

The following phrases must **not** appear anywhere in the rendered UI:

- "In control" (as a conclusion without source data)
- "Process capable"
- "Nelson rule violation" (unless explicitly in scope and sourced)
- "Process approved"
- "N/A" (use em-dash instead)

- [ ] Reviewed [`browser-uat-checklists/spc.md`](../../browser-uat-checklists/spc.md).
- [ ] None of the listed forbidden claims appeared in the rendered UI.

## Result

`not-started`

## Caveats

- `lockedBy` is not an approval — it records which control-limit set is
  active, not who approved process performance.
- Point status `not-evaluated` must be visually distinct from `in-control`.
- Capability indices and Nelson rule signals are out of scope.
- UAT priority: 5.

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
