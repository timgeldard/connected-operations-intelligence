# Browser UAT Evidence — Trace: Batch Header + Customer Exposure

> **Status:** `not-started`
>
> This is a pending capture template. Fill in every field during the UAT
> session. Rename this folder to `YYYY-MM-DD/trace-batch-header-customer-exposure/`
> before filing as evidence.

## Header

- **Title:** Trace — Batch Header + Customer Exposure Network Overview
- **Date / time:** _(fill in: ISO 8601 with explicit time zone)_
- **Tester:** _(fill in: name, role)_
- **Environment:** _(fill in: dev / uat / staging + Databricks host)_
- **Branch / commit:** _(fill in: branch-name @ SHA)_

## Subject

- **App / module:** Trace — Network Overview view
- **Data product(s):**
  - Batch Header (`/api/trace2/batch-header`)
  - Customer Exposure Evidence (`/api/trace2/customer-exposure`, `/api/trace2/customer-deliveries`)
- **Route(s):**
  - `GET /api/trace2/batch-header`
  - `GET /api/trace2/customer-exposure`
  - `GET /api/trace2/customer-deliveries`
- **Test input identifiers:**
  - Material: _(fill in)_
  - Batch: _(fill in)_
  - Plant: _(fill in)_
  - Order / Inspection lot / Warehouse: n/a
  - Other: _(any additional scoping)_

## Preconditions

- [ ] Branch is up to date with `main`.
- [ ] Backend / databricks-api routes are reachable from the browser.
- [ ] OAuth identity / session is valid for the environment.
- [ ] No mock fallback flag is silently overriding the adapter mode.
- [ ] Test identifiers exist in the target environment.
- [ ] `recallRecommended` is confirmed as `null` or `unavailable` for the
  test batch in the source (do not use a batch where recall is governed true/false).

## Steps executed

1. Open the Trace workspace, Network Overview view.
2. Enter the test material, batch, and plant identifiers.
3. Submit the query form.
4. Verify the Batch Header panel loads and displays source-truthful data.
5. Verify the Customer Exposure panel loads without asserting recall status.
6. Open Network DevTools. Confirm `GET /api/trace2/batch-header` returned
   200 with expected body.
7. Confirm `recallRecommended` is rendered as unavailable / not shown as
   a conclusion, not as "recall not required".
8. Capture screenshots per naming convention.

## Expected result

- Batch Header shows batch identity, status, and material exactly as
  returned from the source. No status invented where source is unknown.
- Customer Exposure shows delivery exposure data. `recallRecommended`
  renders as `unavailable` or is absent — it must not display
  "recall not required" or any equivalent phrase.
- `InvalidCombinationBanner` is not shown (the test batch exists in
  the source at the given plant).
- The Network Overview lineage graph renders nodes at the correct depth
  and risk level. `riskLevel` shows as `unknown` where source returned null.

## Actual result

_(Fill in during session.)_

## Screenshots

| #   | Filename                                      | What it shows |
| --- | --------------------------------------------- | ------------- |
| 01  | `screenshots/01-query-inputs.png`             |               |
| 02  | `screenshots/02-batch-header-panel.png`       |               |
| 03  | `screenshots/03-customer-exposure-panel.png`  |               |
| 04  | `screenshots/04-recall-null-state.png`        |               |
| 05  | `screenshots/05-network-response.png`         |               |

## Network / API evidence

_(HAR file path, or hand-saved request/response JSON.)_

## Governed-state checks

- [ ] All `null` / `unknown` / `unavailable` / `not-evaluated` values
      from the backend rendered as such in the UI.
- [ ] No UOM was invented when the source returned `null`.
- [ ] No status / severity / approval value was invented when the
      source returned `null`.
- [ ] `recallRecommended` is not rendered as "recall not required" or equivalent.
- [ ] Source quality and status states are source-verbatim.
- [ ] Response data matches the expected contract.

## Forbidden-claim checks

The following phrases must **not** appear anywhere in the rendered UI:

- "Batch is safe"
- "Recall not required"
- "No recall risk"
- "Recall recommended"
- "All trace links resolved"

- [ ] Reviewed the relevant per-app forbidden-claim list in
  [`browser-uat-checklists/trace.md`](../../browser-uat-checklists/trace.md).
- [ ] None of the listed forbidden claims appeared in the rendered UI.

## Result

`not-started`

## Caveats

- `recallRecommended` remains `null` / `unavailable` — governed recall-rule
  source not implemented. This is expected and must be labelled.
- UAT priority: 1.

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
