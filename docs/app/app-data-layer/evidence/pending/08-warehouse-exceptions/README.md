# Browser UAT Evidence — Warehouse: Exceptions

> **Status:** `not-started`
>
> This is a pending capture template. Fill in every field during the UAT
> session. Rename this folder to `YYYY-MM-DD/warehouse-exceptions/`
> before filing as evidence.

## Header

- **Title:** Warehouse — Exceptions & Alerts (Warehouse360 Cockpit)
- **Date / time:** _(fill in: ISO 8601 with explicit time zone)_
- **Tester:** _(fill in: name, role)_
- **Environment:** _(fill in: dev / uat / staging + Databricks host)_
- **Branch / commit:** _(fill in: branch-name @ SHA)_

## Subject

- **App / module:** Warehouse — Warehouse360 Cockpit view
- **Data product(s):**
  - Exceptions (`/api/warehouse360/exceptions`)
- **Route(s):**
  - `GET /api/warehouse360/exceptions`
- **Test input identifiers:**
  - Plant: _(fill in: e.g. C061)_
  - Warehouse: _(fill in: e.g. WH001)_
  - Date range: _(fill in: dateFrom, dateTo)_
  - Other: _(any additional scoping)_

## Preconditions

- [ ] Branch is up to date with `main`.
- [ ] Journeys 6 and 7 (Warehouse inbound and staging) already completed.
- [ ] Backend / databricks-api routes are reachable from the browser.
- [ ] OAuth identity / session is valid for the environment.
- [ ] No mock fallback flag is silently overriding the adapter mode.
- [ ] At least one exception record exists in the source for the date range.
- [ ] Severity mapping basis (integer → label) and `detected_date`
  semantics are known beforehand — these are governance-caveated.

## Steps executed

1. Open the Warehouse360 Cockpit view with the test warehouse / plant / date range.
2. Select the "Exceptions & Alerts" tab.
3. Verify the exceptions table loads with records.
4. Verify severity badges reflect the source severity value — no invented
   severity claims (e.g. "Exception resolved" without source backing).
5. Verify `expiryDate` and `daysToExpiry` render as "—" where null.
6. Verify `reason` renders as "—" where null, not as an empty string or
   manufactured reason text.
7. Click on an exception row and verify the diagnostic guidance is labelled
   as guidance only — not as a confirmed root cause.
8. Confirm network requests in DevTools.
9. Capture screenshots per naming convention.

## Expected result

- Exceptions table shows records with source-verbatim fields.
- Severity is source-mapped — not invented. The governance caveat for
  severity mapping must be visible where applicable.
- Null `expiryDate` and `daysToExpiry` render as "—".
- Null `reason` renders as "—".
- Exception diagnostic guidance (inspector panel) is labelled as
  guidance — not as a confirmed finding.
- No "Exception resolved" or "Severity confirmed" claims.
- Error state renders correctly if query fails (not silent empty table).

## Actual result

_(Fill in during session.)_

## Screenshots

| #   | Filename                                          | What it shows |
| --- | ------------------------------------------------- | ------------- |
| 01  | `screenshots/01-exceptions-table.png`             |               |
| 02  | `screenshots/02-severity-badge-rendering.png`     |               |
| 03  | `screenshots/03-null-expiry-rendering.png`        |               |
| 04  | `screenshots/04-exception-inspector-panel.png`    |               |
| 05  | `screenshots/05-severity-caveat-labelling.png`    |               |
| 06  | `screenshots/06-network-response.png`             |               |

## Network / API evidence

_(HAR file path, or hand-saved request/response JSON.)_

## Governed-state checks

- [ ] All `null` / `unknown` / `unavailable` / `not-evaluated` values
      from the backend rendered as such in the UI.
- [ ] Severity mapping caveat is visible where applicable.
- [ ] `detected_date` semantics are labelled where governance-pending.
- [ ] No invented reason or resolution status.
- [ ] Response data matches the expected contract.

## Forbidden-claim checks

The following phrases must **not** appear anywhere in the rendered UI
without direct source backing:

- "Exception resolved"
- "Severity confirmed"
- "Recall triggered"
- Any expiry or hold resolution claim without source

- [ ] Reviewed [`browser-uat-checklists/warehouse.md`](../../browser-uat-checklists/warehouse.md).
- [ ] None of the listed forbidden claims appeared in the rendered UI.

## Result

`not-started`

## Caveats

- Severity mapping, `detected_date` semantics, expiry linkage, and
  document linkage remain caveated (governance-pending).
- This is the most caveated warehouse route — exercise after inbound
  and staging sessions to ensure testers are familiar with the caveat
  framework.
- UAT priority: 8.

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
