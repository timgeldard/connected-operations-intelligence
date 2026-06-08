# Browser UAT Evidence — Warehouse: Inbound

> **Status:** `not-started`
>
> This is a pending capture template. Fill in every field during the UAT
> session. Rename this folder to `YYYY-MM-DD/warehouse-inbound/`
> before filing as evidence.

## Header

- **Title:** Warehouse — Inbound Receipts (Warehouse360 Cockpit)
- **Date / time:** _(fill in: ISO 8601 with explicit time zone)_
- **Tester:** _(fill in: name, role)_
- **Environment:** _(fill in: dev / uat / staging + Databricks host)_
- **Branch / commit:** _(fill in: branch-name @ SHA)_

## Subject

- **App / module:** Warehouse — Warehouse360 Cockpit view
- **Data product(s):**
  - Inbound (`/api/warehouse360/inbound`)
- **Route(s):**
  - `GET /api/warehouse360/inbound`
- **Test input identifiers:**
  - Material: n/a
  - Batch: n/a
  - Plant: _(fill in: e.g. C061)_
  - Warehouse: _(fill in: e.g. WH001)_
  - Date range: _(fill in: dateFrom, dateTo)_
  - Other: _(any additional scoping)_

## Preconditions

- [ ] Branch is up to date with `main`.
- [ ] Backend / databricks-api routes are reachable from the browser.
- [ ] OAuth identity / session is valid for the environment.
- [ ] No mock fallback flag is silently overriding the adapter mode.
- [ ] The test warehouse ID and plant exist in the source.
- [ ] At least one inbound PO/STO is known to exist for the test date range.
- [ ] Warehouse Overview panel is **not** in scope — it is blocked (Gates 4+5).
  Verify it shows the governance-pending notice, not live KPI values.

## Steps executed

1. Open the Warehouse360 Cockpit view.
2. Enter the test warehouse ID, plant, and date range.
3. Click "Run Cockpit Queries".
4. Select the "Inbound Receipts" tab.
5. Verify the table loads with PO/STO records and correct columns.
6. Verify null material descriptions render as "—" not as blank.
7. Verify status badges reflect source values — not invented statuses.
8. Confirm the Metric 4 overview card shows the governance-pending
   blocking notice (not reconciliationExceptionCount / nearExpiryCount KPIs).
9. Confirm network requests in DevTools show the correct route and status.
10. Capture screenshots per naming convention.

## Expected result

- Inbound table shows PO/STO records matching the expected source data.
- Null fields render as "—" — no invented defaults.
- Status badges are source-verbatim. No "Stock confirmed" or "Receipt approved".
- Metric 4 overview card shows the governance-pending blocking notice
  (not live overview KPIs).
- Error state renders correctly if query fails (not silent empty table).

## Actual result

_(Fill in during session.)_

## Screenshots

| #   | Filename                                          | What it shows |
| --- | ------------------------------------------------- | ------------- |
| 01  | `screenshots/01-query-inputs.png`                 |               |
| 02  | `screenshots/02-inbound-table.png`                |               |
| 03  | `screenshots/03-null-field-rendering.png`         |               |
| 04  | `screenshots/04-status-badge-rendering.png`       |               |
| 05  | `screenshots/05-metric4-blocked-state.png`        |               |
| 06  | `screenshots/06-network-response.png`             |               |

## Network / API evidence

_(HAR file path, or hand-saved request/response JSON.)_

## Governed-state checks

- [ ] All `null` / `unknown` / `unavailable` / `not-evaluated` values
      from the backend rendered as such in the UI.
- [ ] No UOM was invented when the source returned `null`.
- [ ] Status values are source-verbatim.
- [ ] Metric 4 shows blocked state, not overview KPI values.
- [ ] Response data matches the expected contract.

## Forbidden-claim checks

The following phrases must **not** appear anywhere in the rendered UI:

- "Stock confirmed"
- "Storage verified"
- "Receipt approved"
- Any reconciliation or expiry KPI in the overview metric card

- [ ] Reviewed [`browser-uat-checklists/warehouse.md`](../../browser-uat-checklists/warehouse.md).
- [ ] None of the listed forbidden claims appeared in the rendered UI.

## Result

`not-started`

## Caveats

- Unavailable warehouse or storage-location fields remain unavailable.
- Warehouse overview panel (Metric 4) remains blocked — governance Gates 4+5 open.
- UAT priority: 6.

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
