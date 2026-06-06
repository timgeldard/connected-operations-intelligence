# Browser UAT Checklist — POH (Process Order Header / Review)

> Framework definition only. Nothing in this checklist asserts that any
> POH journey has passed browser UAT. Use this checklist together with
> [`../browser-uat-evidence-template.md`](../browser-uat-evidence-template.md)
> when capturing evidence.

## Scope

Data products in scope:

- `ProcessOrderHeader` (header view)
- `ProcessOrderExecutionEvidence` (operations / confirmations / goods
  movements context)

## Preconditions

- [ ] Adapter mode is set to the intended tier (`databricks-api`,
      `legacy-api`, or `mock`); the active source is visible in the
      panel header / network calls.
- [ ] Test process-order / plant / batch identifiers exist in the
      target environment.
- [ ] If running against a governed source, the OAuth identity used is
      the end user's.

## Journeys

### 1. Process-order header

- [ ] Verify order identity (process-order ID, material, plant) matches
      the test inputs.
- [ ] Verify `orderStatus === 'unknown'` is rendered as
      _unknown_ — **not** silently converted to
      `created` / `released` / `complete`.
- [ ] Verify missing `plannedStart` / `plannedFinish` /
      `actualStart` / `actualFinish` render as _unavailable_ — **not**
      as the current date or some other synthetic timestamp.
- [ ] Verify missing quantities are not defaulted to zero unless the
      source returned zero. (The contract still requires non-null
      `plannedQuantity` / `confirmedQuantity`; the _catalogue follow-up_
      is to relax this — until then, capture the caveat in the
      evidence pack.)

### 2. Process-order context

- [ ] Verify no completion / confirmation / on-time state is inferred
      from the header alone — those are derived from operations /
      confirmations evidence, not from `orderStatus`.
- [ ] Verify quality / inspection evidence remains separate from the
      order header — the POH panel must not claim batch acceptance.

## Forbidden POH claims

The UI must **not** render any of these labels unless directly
source-backed:

- `released`
- `complete`
- `confirmed`
- `closed`
- `on time`
- `safe`

The
[`ProcessOrderExecutionEvidence` catalog entry](../domain-data-product-catalog.md#8-processorderexecutionevidence)
notes the partial-classification caveat for legacy-bridge fields — the
UI must not paper over that.

## Required network checks

- [ ] The route(s) called match the intended adapter tier — no silent
      mock fallback.
- [ ] Response status code(s) are recorded.
- [ ] Where applicable, the response body is captured (HAR or hand-saved
      JSON) and matches the `ProcessOrderHeader` contract.

## Result

Record one of: `not-started`, `evidence-captured`, `passed-with-caveats`,
`failed`, `blocked`, `not-applicable` — per
[`../browser-uat-evidence-standard.md`](../browser-uat-evidence-standard.md)
section 6.
