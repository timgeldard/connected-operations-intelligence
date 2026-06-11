# Browser UAT Checklist — SPC

> Framework definition only. Nothing in this checklist asserts that any
> SPC journey has passed browser UAT. Use this checklist together with
> [`../browser-uat-evidence-template.md`](../browser-uat-evidence-template.md)
> when capturing evidence.

## Scope

Data products in scope:

- `SPCSubgroupSeries`
- `SPCChartDataSeries`

## Preconditions

- [ ] Adapter mode is set to the intended tier; the active source is
      visible in the panel header / network calls.
- [ ] Test material / plant / MIC / operation / date range identifiers
      exist in the target environment.
- [ ] The 730-day date-window guard is honoured by the input form.
- [ ] If running against a governed source, the OAuth identity used is
      the end user's.

## Journeys

### 1. Chart data query

- [ ] Select material / plant / MIC / operation / date range / chart
      type.
- [ ] Verify `operationId` and date range are **required** by the
      form — a query without them must be rejected client-side.
- [ ] Verify a broad / wildcard scan is not possible from the UI
      (server-side guard exists; the UI must not bypass it).
- [ ] Verify the chart displays _not-evaluated_ points safely — they
      must be visible as not-evaluated, not as zero or omitted.

### 2. Locked limits

- [ ] Verify `lockedBy` is **not** rendered as an approval signal — it
      is the identity of the person who locked the limit, not an
      approver.
- [ ] Verify `approvalState === pending-validation` or `unavailable`
      is visible in the panel — not collapsed to "approved".
- [ ] Verify `limitProvenance === unknown` is preserved verbatim, not
      replaced with a friendlier label.
- [ ] Verify backend warnings / caveats are visible (e.g. the
      governance-pending banner for locked limits — see
      [catalog entry](../domain-data-product-catalog.md#2-spcchartdataseries)).

### 3. UOM and capability

- [ ] Verify `unitOfMeasure === null` renders as _unavailable_ or `'—'`
      — **not** `'KG'` or any other invented unit.
- [ ] Verify `capabilitySource === unavailable` is preserved.
- [ ] Verify `Cp` / `Cpk` / `Pp` / `Ppk` values are **not invented**
      — they appear only when the governed calculation has produced
      them.
- [ ] Verify Nelson flags are **not invented** —
      `nelsonStoredFlagsAvailable === false` must not produce a
      "Nelson signal" annotation.

## Forbidden SPC claims

The UI must **not** render any of these labels unless a
governed / calculated source exists:

- `in control`
- `out of control`
- `capability acceptable`
- `process capable`
- `limits approved`
- `Nelson signal detected`

## Required network checks

- [ ] The route(s) called match the intended adapter tier — no silent
      mock fallback.
- [ ] Response status code(s) are recorded; a P999 plant sentinel must
      return `422` before any Databricks call.
- [ ] Where applicable, the response body is captured and matches the
      `SPCSubgroupResponseSchema` contract.

## Result

Record one of: `not-started`, `evidence-captured`, `passed-with-caveats`,
`failed`, `blocked`, `not-applicable` — per
[`../browser-uat-evidence-standard.md`](../browser-uat-evidence-standard.md)
section 6.
