# Evidence Pack Standard

An **Evidence Pack** is a composite app data product structured around a specific business question or workflow.

## Definition

Evidence packs provide source-backed facts, caveats, and derived indicators designed for human review. They are strictly informational tools intended to support governed decision-making processes. They **do not** make unsupported business decisions.

### Examples of Evidence Packs:

- `BatchQualityEvidencePack`
- `BatchRecallEvidencePack`
- `ProcessOrderExecutionEvidencePack`
- `SPCCharacteristicEvidencePack`
- `SupplierExposureEvidencePack`

## Forbidden Patterns

Evidence packs must not generate deterministic business labels where no governed rule or source data exists.

**Forbidden examples:**

- `recallRecommended: false` without a governed rule.
- `quality: released/approved` without explicit source governance backing it.
- `supplierRisk: low` without an explicit risk source calculation.
- `status: delivered` without an actual delivery lifecycle status in the source.
- `inControl: true` without a confirmed backend calculation or data source.
