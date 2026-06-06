# Browser UAT Checklist — Quality

> Framework definition only. Nothing in this checklist asserts that any
> Quality journey has passed browser UAT. Use this checklist together
> with [`../browser-uat-evidence-template.md`](../browser-uat-evidence-template.md)
> when capturing evidence.

## Scope

Data products in scope:

- `QualityUsageDecisionEvidence`
- `BatchQualityPassport` (insofar as it surfaces quality-decision
  evidence)

## Preconditions

- [ ] Adapter mode is set to the intended tier; the active source is
      visible in the panel header / network calls.
- [ ] Test inspection-lot / batch identifiers exist in the target
      environment.
- [ ] If running against a governed source, the OAuth identity used is
      the end user's.

## Journeys

### 1. Usage decision evidence

- [ ] Verify the panel renders **one row per inspection lot**, not per
      decision history record.
- [ ] Verify only the **latest** usage decision per lot is shown.
- [ ] Verify `multipleLotsWarning` is rendered where applicable
      (multiple inspection lots for the same batch).
- [ ] Verify `usageDecisionMappingStatus` is shown or otherwise
      preserved. The status vocabulary is one of `verified`,
      `unverified`, `not-mapped`, `unavailable`, or
      `pending-source-verification`.
- [ ] Verify `Unknown(code)` is rendered as _unknown_ or _unverified_
      — **not** silently coerced to a friendly label.
- [ ] Verify an empty / `null` usage decision renders as
      _pending_ or _not-mapped_, **not** as released / approved.

## Forbidden Quality claims

The UI must **not** render any of these labels unless a governed source
exists:

- `batch released`
- `batch approved`
- `cleared for shipment`
- `signed off`
- `e-signature complete`
- `accepted at batch level`

The
[`QualityUsageDecisionEvidence` catalog entry](../domain-data-product-catalog.md#9-qualityusagedecisionevidence)
notes the lot-vs-batch governance gap — the UI must not claim
batch-level acceptance from lot-level evidence.

## Required network checks

- [ ] The route(s) called match the intended adapter tier — no silent
      mock fallback.
- [ ] Response status code(s) are recorded.
- [ ] Where applicable, the response body is captured (HAR or hand-saved
      JSON) and matches `QualityInspectionLotEvidence` /
      `QualityEvidenceSummary` contracts.

## Result

Record one of: `not-started`, `evidence-captured`, `passed-with-caveats`,
`failed`, `blocked`, `not-applicable` — per
[`../browser-uat-evidence-standard.md`](../browser-uat-evidence-standard.md)
section 6.
