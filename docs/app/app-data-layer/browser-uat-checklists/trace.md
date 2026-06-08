# Browser UAT Checklist — Trace

> Framework definition only. Nothing in this checklist asserts that any
> Trace journey has passed browser UAT. Use this checklist together with
> [`../browser-uat-evidence-template.md`](../browser-uat-evidence-template.md)
> when capturing evidence.

## Scope

Data products in scope:

- `TraceGraph`
- `BatchQualityPassport`
- `CustomerExposureEvidence`
- `SupplierExposureEvidence`
- `MassBalanceLedger`

## Preconditions

- [ ] Adapter mode is set to the intended tier (`databricks-api`,
      `legacy-api`, or `mock`); the active source is visible in the
      panel header / network calls.
- [ ] Test material / batch / plant identifiers exist in the target
      environment.
- [ ] If the journey is being run against a governed source, the
      OAuth identity used is the end user's, not a service principal.

## Journeys

### 1. Batch header

- [ ] Enter material / batch / plant and submit the query.
- [ ] Verify the batch identity (material, plant, plant-region, batch
      number) matches the test inputs.
- [ ] Verify `unknown`, `restricted`, `blocked`, and `qualityInspection`
      states are displayed safely — labelled as such, not collapsed
      into "OK" or hidden.
- [ ] Verify no `released` / `approved` / `safe` claim is rendered
      unless directly source-backed and governed.
- [ ] Capture screenshot of the rendered header panel + the
      network response.

### 2. Customer exposure

- [ ] Verify `recallRecommended === null` renders as
      _unavailable / governance-pending_ — **not** as
      "recall not required".
- [ ] Verify `affectedCustomers`, `affectedDeliveries`, and
      `shippedQuantity` are rendered verbatim from the source.
- [ ] Verify customer / delivery exposure does not claim _delivered_
      unless source-backed.
- [ ] Verify backend warnings / caveats are visible (e.g.
      governance-pending banner for the recall-recommendation rule).

### 3. Supplier exposure

- [ ] Verify `supplierRisk === unknown` is not rendered as `low`.
- [ ] Verify no supplier-risk label appears unless source-backed.
- [ ] Verify the
      `SupplierExposureEvidence` source-coverage caveat (no QM source)
      from the
      [catalog entry](../domain-data-product-catalog.md#7-supplierexposureevidence)
      is visible in the panel.

### 4. Mass balance

- [ ] Verify `kpi.uom === null` renders as _unavailable_ or `'—'`.
- [ ] Verify UOM is **not** defaulted to `'KG'`.
- [ ] Verify variance is not hidden as zero when source is null /
      unavailable.
- [ ] Verify no _reconciled_ claim is rendered unless the governed
      reconciliation rule is in place
      (`MassBalanceLedger` is `reconciliation governance-pending` in
      the [catalog](../domain-data-product-catalog.md#4-massbalanceledger)).

## Forbidden Trace claims

The UI must **not** render any of these labels unless directly
source-backed and governed:

- `recall not required`
- `low risk`
- `safe`
- `approved`
- `released`
- `no issue found`
- `reconciled`

## Required network checks

- [ ] The route(s) called match the intended adapter tier — no silent
      mock fallback.
- [ ] Response status code(s) are recorded.
- [ ] Where applicable, the response body is captured (HAR or hand-saved
      JSON) and matches the contract.

## Result

Record one of: `not-started`, `evidence-captured`, `passed-with-caveats`,
`failed`, `blocked`, `not-applicable` — per
[`../browser-uat-evidence-standard.md`](../browser-uat-evidence-standard.md)
section 6.
