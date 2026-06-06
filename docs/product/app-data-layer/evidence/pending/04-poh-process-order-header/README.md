# Browser UAT Evidence — POH: Process Order Header

> **Status:** `not-started`
>
> This is a pending capture template. Fill in every field during the UAT
> session. Rename this folder to `YYYY-MM-DD/poh-process-order-header/`
> before filing as evidence.

## Header

- **Title:** POH — Process Order Header (Process Order Review workspace)
- **Date / time:** _(fill in: ISO 8601 with explicit time zone)_
- **Tester:** _(fill in: name, role)_
- **Environment:** _(fill in: dev / uat / staging + Databricks host)_
- **Branch / commit:** _(fill in: branch-name @ SHA)_

## Subject

- **App / module:** Operations — Process Order Review workspace
- **Data product(s):**
  - Process Order Header (`/api/por/order-header`)
  - Order Confirmations (`/api/por/confirmations` — if route exists)
- **Route(s):**
  - `GET /api/por/order-header`
  - `GET /api/por/confirmations`
- **Test input identifiers:**
  - Material: _(fill in)_
  - Batch: _(fill in)_
  - Plant: _(fill in)_
  - Order: _(fill in — process order ID)_
  - Other: _(any additional scoping)_

## Preconditions

- [ ] Branch is up to date with `main`.
- [ ] Backend / databricks-api routes are reachable from the browser.
- [ ] OAuth identity / session is valid for the environment.
- [ ] No mock fallback flag is silently overriding the adapter mode.
- [ ] Test process order ID exists in the source environment.
- [ ] `orderStatus` value in source is known beforehand.

## Steps executed

1. Open the Operations / Process Order Review workspace.
2. Enter the test process order identifier.
3. Verify the Order Header panel loads with correct identity data.
4. Verify `orderStatus` is rendered source-verbatim.
5. Verify Order Confirmations panel loads (if route active) and shows
   confirmed yield / scrap / timestamps without invented defaults.
6. Confirm null `confirmedAt` timestamps render as "Timestamp not
   recorded" — not as "-" or a blank.
7. Confirm network requests in DevTools.
8. Capture screenshots per naming convention.

## Expected result

- Order Header shows process order identity: order ID, material,
  planned quantity, status, dates — source-verbatim.
- `orderStatus` is rendered as-is from the source. If `unknown`, must
  render as unknown — not as "complete" or "on time".
- Order Confirmations shows yield, scrap, and duration actuals. Null
  `confirmedAt` renders as "Timestamp not recorded".
- No completion, on-time, or approval inference where source is unknown.

## Actual result

_(Fill in during session.)_

## Screenshots

| #   | Filename                                          | What it shows |
| --- | ------------------------------------------------- | ------------- |
| 01  | `screenshots/01-order-header-panel.png`           |               |
| 02  | `screenshots/02-order-status-rendering.png`       |               |
| 03  | `screenshots/03-confirmations-panel.png`          |               |
| 04  | `screenshots/04-null-timestamp-state.png`         |               |
| 05  | `screenshots/05-network-response.png`             |               |

## Network / API evidence

_(HAR file path, or hand-saved request/response JSON.)_

## Governed-state checks

- [ ] All `null` / `unknown` / `unavailable` / `not-evaluated` values
      from the backend rendered as such in the UI.
- [ ] `orderStatus` is rendered source-verbatim.
- [ ] Null `confirmedAt` renders as "Timestamp not recorded".
- [ ] No on-time or completion inference where source is unknown.
- [ ] Response data matches the expected contract.

## Forbidden-claim checks

The following phrases must **not** appear anywhere in the rendered UI:

- "Order complete"
- "Order on time"
- "Order approved"
- Any status inference beyond what the source provides

- [ ] Reviewed [`browser-uat-checklists/poh.md`](../../browser-uat-checklists/poh.md).
- [ ] None of the listed forbidden claims appeared in the rendered UI.

## Result

`not-started`

## Caveats

- `orderStatus` is source-verbatim from SAP. Unknown status must remain
  unknown.
- No completion or on-time inference is in scope.
- UAT priority: 4.

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
