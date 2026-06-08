# Browser UAT Evidence — Warehouse: Production Staging

> **Status:** `not-started`
>
> This is a pending capture template. Fill in every field during the UAT
> session. Rename this folder to `YYYY-MM-DD/warehouse-staging/`
> before filing as evidence.

## Header

- **Title:** Warehouse — Production Staging (Warehouse360 Cockpit)
- **Date / time:** _(fill in: ISO 8601 with explicit time zone)_
- **Tester:** _(fill in: name, role)_
- **Environment:** _(fill in: dev / uat / staging + Databricks host)_
- **Branch / commit:** _(fill in: branch-name @ SHA)_

## Subject

- **App / module:** Warehouse — Warehouse360 Cockpit view
- **Data product(s):**
  - Staging (`/api/warehouse360/staging`)
- **Route(s):**
  - `GET /api/warehouse360/staging`
- **Test input identifiers:**
  - Plant: _(fill in: e.g. C061)_
  - Warehouse: _(fill in: e.g. WH001)_
  - Date range: _(fill in: dateFrom, dateTo)_
  - Order: _(fill in: at least one process order with staging data)_
  - Other: _(any additional scoping)_

## Preconditions

- [ ] Branch is up to date with `main`.
- [ ] Journey 6 (Warehouse inbound) already completed.
- [ ] Backend / databricks-api routes are reachable from the browser.
- [ ] OAuth identity / session is valid for the environment.
- [ ] No mock fallback flag is silently overriding the adapter mode.
- [ ] At least one process order with staging data exists for the date range.
- [ ] `stagingStatus` source values and derivation basis are known beforehand.

## Steps executed

1. Open the Warehouse360 Cockpit view with the test warehouse / plant / date range.
2. Select the "Production Staging" tab.
3. Verify the staging table loads with process order reservation records.
4. Verify `stagingStatus` renders as the source value — no "Staged" / "Confirmed"
   claim beyond what the source field says.
5. Verify `stagedQuantity` and `openQuantity` show as application-heuristic
   / caveated where applicable.
6. Verify null fields render as "—".
7. Confirm network requests in DevTools.
8. Capture screenshots per naming convention.

## Expected result

- Staging table shows process order / reservation records.
- `stagingStatus` is source-verbatim. No "Staging confirmed" assertion.
- `stagedQuantity` and `openQuantity` are labelled as application-derived
  or heuristic where the derivation is not a direct source field.
- Null requirement dates render as "—".
- Error state renders correctly if query fails.

## Actual result

_(Fill in during session.)_

## Screenshots

| #   | Filename                                          | What it shows |
| --- | ------------------------------------------------- | ------------- |
| 01  | `screenshots/01-staging-table.png`                |               |
| 02  | `screenshots/02-staging-status-rendering.png`     |               |
| 03  | `screenshots/03-quantity-heuristic-caveat.png`    |               |
| 04  | `screenshots/04-null-field-rendering.png`         |               |
| 05  | `screenshots/05-network-response.png`             |               |

## Network / API evidence

_(HAR file path, or hand-saved request/response JSON.)_

## Governed-state checks

- [ ] All `null` / `unknown` / `unavailable` / `not-evaluated` values
      from the backend rendered as such in the UI.
- [ ] `stagingStatus` is source-verbatim.
- [ ] `stagedQuantity` and `openQuantity` labelled where application-derived.
- [ ] Response data matches the expected contract.

## Forbidden-claim checks

The following phrases must **not** appear anywhere in the rendered UI
without direct source backing:

- "Staged"
- "Staging confirmed"
- "Quantity verified"
- Any completion or on-time inference

- [ ] Reviewed [`browser-uat-checklists/warehouse.md`](../../browser-uat-checklists/warehouse.md).
- [ ] None of the listed forbidden claims appeared in the rendered UI.

## Result

`not-started`

## Caveats

- `stagingStatus`, `stagedQuantity`, `openQuantity` may be
  application-derived or heuristic where direct source is absent.
  Visible labelling required.
- UAT priority: 7.

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
