# Browser UAT Evidence — Trace: Supplier Exposure + Mass Balance

> **Status:** `not-started`
>
> This is a pending capture template. Fill in every field during the UAT
> session. Rename this folder to `YYYY-MM-DD/trace-supplier-exposure-mass-balance/`
> before filing as evidence.

## Header

- **Title:** Trace — Supplier Exposure + Mass Balance Ledger
- **Date / time:** _(fill in: ISO 8601 with explicit time zone)_
- **Tester:** _(fill in: name, role)_
- **Environment:** _(fill in: dev / uat / staging + Databricks host)_
- **Branch / commit:** _(fill in: branch-name @ SHA)_

## Subject

- **App / module:** Trace — Supplier and Mass Balance views
- **Data product(s):**
  - Supplier Exposure Evidence (`/api/trace2/supplier-exposure`, `/api/trace2/supplier-batches`)
  - Mass Balance Ledger (`/api/trace2/mass-balance-ledger`)
- **Route(s):**
  - `GET /api/trace2/supplier-exposure`
  - `GET /api/trace2/supplier-batches`
  - `GET /api/trace2/mass-balance-ledger`
- **Test input identifiers:**
  - Material: _(fill in)_
  - Batch: _(fill in)_
  - Plant: _(fill in)_
  - Other: _(any additional scoping)_

## Preconditions

- [ ] Branch is up to date with `main`.
- [ ] Journey 1 (Trace batch header + customer exposure) already completed.
- [ ] Backend / databricks-api routes are reachable from the browser.
- [ ] OAuth identity / session is valid for the environment.
- [ ] No mock fallback flag is silently overriding the adapter mode.
- [ ] Test identifiers exist in the target environment.
- [ ] Supplier risk is confirmed as `unknown` / `unavailable` for the test
  batch — do not use a batch where supplier risk is governed.

## Steps executed

1. Open the Trace workspace, Supplier Exposure view.
2. Enter the test material, batch, and plant identifiers.
3. Verify supplier exposure panel loads without asserting supplier risk level.
4. Navigate to the Mass Balance view.
5. Verify mass balance shows application-heuristic / governance-pending
   labels on reconciliation fields.
6. Confirm network requests in DevTools match expected routes.
7. Capture screenshots per naming convention.

## Expected result

- Supplier Exposure shows supplier-side traceability data. Supplier risk
  renders as `unknown` or `unavailable` — never as "Low risk", "cleared",
  or a categorical risk level without a governed source.
- Mass Balance shows lot-level ledger entries with visible
  application-heuristic or governance-pending labels on reconciliation
  totals. Must not assert "Balanced" or "No discrepancy" without governed source.

## Actual result

_(Fill in during session.)_

## Screenshots

| #   | Filename                                        | What it shows |
| --- | ----------------------------------------------- | ------------- |
| 01  | `screenshots/01-supplier-exposure-panel.png`    |               |
| 02  | `screenshots/02-supplier-risk-null-state.png`   |               |
| 03  | `screenshots/03-mass-balance-ledger.png`        |               |
| 04  | `screenshots/04-heuristic-caveat-labels.png`    |               |
| 05  | `screenshots/05-network-response.png`           |               |

## Network / API evidence

_(HAR file path, or hand-saved request/response JSON.)_

## Governed-state checks

- [ ] All `null` / `unknown` / `unavailable` / `not-evaluated` values
      from the backend rendered as such in the UI.
- [ ] No UOM was invented when the source returned `null`.
- [ ] Supplier risk rendered as `unknown` / `unavailable`, not as a
      categorical label.
- [ ] Mass balance reconciliation status rendered as application-heuristic,
      not as "Balanced" or "No discrepancy".
- [ ] Response data matches the expected contract.

## Forbidden-claim checks

The following phrases must **not** appear anywhere in the rendered UI:

- "Low risk" (supplier risk)
- "No supplier risk"
- "Supplier cleared"
- "Balanced"
- "Reconciled"
- "No discrepancy"

- [ ] Reviewed [`browser-uat-checklists/trace.md`](../../browser-uat-checklists/trace.md).
- [ ] None of the listed forbidden claims appeared in the rendered UI.

## Result

`not-started`

## Caveats

- Supplier risk remains `unknown` / `unavailable` — no governed risk source.
- Mass balance reconciliation is application-heuristic / governance-pending.
- UAT priority: 2.

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
