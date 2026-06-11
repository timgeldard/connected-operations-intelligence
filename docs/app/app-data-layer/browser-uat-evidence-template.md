# Browser UAT Evidence — `<title>`

> Fill in every field. If a field is genuinely not applicable, write
> `n/a` with a one-line reason. Do not delete sections — empty sections
> are part of the audit trail.

## Header

- **Title:**
- **Date / time:** (ISO 8601 with explicit time zone)
- **Tester:** (name, role)
- **Environment:** (e.g. `dev`, `uat`, `staging` + V1 / Databricks host)
- **Branch / commit:** (`branch-name` @ `<SHA>`)

## Subject

- **App / module:** (e.g. Trace, Quality, SPC, POH, Warehouse)
- **Data product(s):** (catalogue names from
  [`domain-data-product-catalog.md`](./domain-data-product-catalog.md))
- **Route(s):** (URL path + HTTP method)
- **Test input identifiers:**
  - Material:
  - Batch:
  - Plant:
  - Order / Inspection lot / Warehouse:
  - Other:

## Preconditions

- [ ] Branch is up to date with `main`.
- [ ] Backend / databricks-api routes are reachable from the browser.
- [ ] OAuth identity / session is valid for the environment.
- [ ] No mock fallback flag is silently overriding the adapter mode.
- [ ] Test identifiers exist in the target environment.

## Steps executed

(Numbered list. One step per action. Reference screenshot filenames
inline.)

1.
2.
3.

## Expected result

(Describe the governed-state outcome — for example: "`recallRecommended`
is `null` for the test batch; the panel must render the recall row as
_unavailable / governance-pending_ and must not display
'recall not required'.")

## Actual result

(Describe what the browser actually rendered, point-by-point against
the expected list.)

## Screenshots

| #   | Filename                                      | What it shows |
| --- | --------------------------------------------- | ------------- |
| 01  | `screenshots/01-query-inputs.png`             |               |
| 02  | `screenshots/02-summary-panel.png`            |               |
| 03  | `screenshots/03-null-state-rendering.png`     |               |
| 04  | `screenshots/04-network-response.png`         |               |
| 05  | `screenshots/05-warning-caveat-rendering.png` |               |

## Network / API evidence

(HAR file path, or hand-saved request/response JSON. Note response
status codes and source headers if applicable.)

## Governed-state checks

- [ ] All `null` / `unknown` / `unavailable` / `not-evaluated` values
      from the backend rendered as such in the UI.
- [ ] No UOM was invented when the source returned `null`.
- [ ] No status / severity / approval value was invented when the
      source returned `null`.
- [ ] Warnings / caveats from the backend (e.g.
      `multipleLotsWarning`, `usageDecisionMappingStatus`,
      `governance-pending`) are preserved in the UI.
- [ ] Response data matches the expected contract.

## Forbidden-claim checks

Apply the per-app forbidden-claim list from
`browser-uat-checklists/<app>.md`. The UI must not render any of those
labels unless they are directly source-backed and governed.

- [ ] Reviewed the relevant per-app forbidden-claim list.
- [ ] None of the listed forbidden claims appeared in the rendered UI.

## Result

(One of: `not-started`, `evidence-captured`, `passed-with-caveats`,
`failed`, `blocked`, `not-applicable`. See
[`browser-uat-evidence-standard.md`](./browser-uat-evidence-standard.md)
section 6.)

## Caveats

(Anything that affects how the result should be interpreted — mock
fixtures, partially-governed fields, pending source verification, etc.)

## Follow-up actions

(Linked tickets / PRs / TODOs.)

## Reviewer notes

(To be filled in by the reviewer. Confirm the evidence pack is
sufficient for the claimed result.)

## Standard self-check

- [ ] Browser was run against the intended environment (not local mock).
- [ ] Mock mode was not silently used.
- [ ] API route called is recorded.
- [ ] Contract / source caveats are visible where required.
- [ ] Null / unknown / unavailable states are not rendered as
      reassuring defaults.
- [ ] No production-readiness claim is made in this evidence pack.
