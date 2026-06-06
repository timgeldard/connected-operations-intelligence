# Browser UAT Checklist — Warehouse

> Framework definition only. Nothing in this checklist asserts that any
> Warehouse journey has passed browser UAT. Use this checklist together
> with [`../browser-uat-evidence-template.md`](../browser-uat-evidence-template.md)
> when capturing evidence.

## Scope

Data products in scope:

- `WarehouseInboundEvidence`
- `WarehouseOutboundEvidence`
- `WarehouseStagingEvidence`
- `WarehouseExceptionEvidence`
- `WarehouseOperationalSnapshot` (overview)

`WarehouseOperationalSnapshot` is subject to the 5-Gate prerequisite
spec; see the
[catalog entry](../domain-data-product-catalog.md#10-warehouseoperationalsnapshot)
for current gate status before exercising the overview journey.

## Preconditions

- [ ] Adapter mode is set to the intended tier; the active source is
      visible in the panel header / network calls.
- [ ] Test warehouse / plant / material identifiers exist in the
      target environment.
- [ ] If running against a governed source, the OAuth identity used is
      the end user's.

## Journeys

### 1. Inbound

- [ ] Verify `warehouseNumber === null` remains _unavailable_ — the
      adapter must not collapse it to `''`.
- [ ] Verify `status === null` is **not** rendered as
      _healthy_ / _open_ / _OK_ unless the source explicitly returned
      that value.
- [ ] Verify no UOM is invented when `unitOfMeasure === null` —
      _unavailable_ or `'—'`, **not** `'KG'`.
- [ ] Verify `documentType === 'unknown'` is rendered as _unknown_.

### 2. Staging

- [ ] Verify fields derived from `wh360_process_orders_v` (process
      order, reservation IDs) display safely when the source row is
      sparse.
- [ ] Verify `stagingStatus` is labelled as a heuristic or otherwise
      not overclaimed (PR #109 introduced source-truthful staging
      semantics — see catalog).
- [ ] Verify missing `storageLocation` / `warehouseNumber` /
      `reservationItemId` display as _unavailable_.
- [ ] Verify no _due_ / _overdue_ claim is rendered unless governed.

### 3. Exceptions

- [ ] Verify `severity === null` is shown as _unavailable_ — **not**
      _low_. (The legacy adapter previously coerced unrecognised
      severity to `'low'`; a recent reference-consumer alignment PR
      fixed that adapter behaviour. The UI rendering must still be
      verified.)
- [ ] Verify `recommendedReviewAction === null` is **not** converted
      into a suggested action.
- [ ] Verify `detected_date` (when present) is not mislabelled as
      _expiry date_.
- [ ] Verify `expiryDate` / `daysToExpiry` remain _unavailable_ unless
      source-backed.
- [ ] Verify no root cause is inferred from the heuristic exception
      category.

### 4. Overview

- [ ] Verify the overview remains _blocked_ or clearly caveated until
      Warehouse Gates 4 and 5 are closed
      (`WarehouseOperationalSnapshot` 5-Gate prerequisite — see
      [catalog](../domain-data-product-catalog.md#10-warehouseoperationalsnapshot)).
- [ ] Verify `nearExpiryCount` and `reconciliationExceptionCount` are
      **not** shown as live governed metrics unless their underlying
      rules are governed.

## Forbidden Warehouse claims

The UI must **not** render any of these labels unless governed /
source-backed:

- `healthy`
- `no exceptions`
- `low severity`
- `due` / `overdue`
- `recommended action`
- `near-expiry count` (as a live governed metric)
- `reconciliation exception count` (as a live governed metric)

## Required network checks

- [ ] The route(s) called match the intended adapter tier — no silent
      mock fallback.
- [ ] Response status code(s) are recorded.
- [ ] Where applicable, the response body is captured and matches the
      `Warehouse360*Item` contracts.

## Result

Record one of: `not-started`, `evidence-captured`, `passed-with-caveats`,
`failed`, `blocked`, `not-applicable` — per
[`../browser-uat-evidence-standard.md`](../browser-uat-evidence-standard.md)
section 6.
