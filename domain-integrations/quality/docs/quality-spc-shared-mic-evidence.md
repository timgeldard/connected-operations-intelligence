# Quality / SPC Shared MIC Evidence Boundaries

**Status:** design reference only; no SPC runtime behaviour changed.
**Created:** 2026-05-21.

## Purpose

Quality and SPC both touch inspection lot, MIC, result, specification, material, plant, and batch concepts. They do not use those concepts for the same decision.

This document defines the shared evidence vocabulary that a future SPC tranche can reference when aligning with read-only Quality evidence contracts. It also defines the boundaries that must remain explicit so Quality evidence does not become an implied SPC signal, and SPC advisory output does not become an implied Quality release decision.

## Current Source Context

V1 Quality discovery identified read-only candidate sources for inspection lot, MIC result, specification/tolerance, usage-decision code/text, and CoA-like result evidence. These candidate sources still require UAT Databricks verification before native V2 Quality implementation.

V1 SPC discovery identified SPC-specific sources and navigation around `material_id -> plant_id -> mic_id`, with `gold_batch_quality_result_v` feeding chart data through SPC views such as `spc_quality_metric_subgroup_v`. SPC also depends on SPC-specific locked limits, exclusions, chart configuration, and rule calculation semantics that are not provided by Quality evidence alone.

## Shared Concepts

| Concept | Quality Evidence Meaning | SPC Relevance | Boundary |
|---|---|---|---|
| `materialId` | SAP material identifier associated with inspection lot, MIC result, batch, or CoA-like evidence. | Primary SPC navigation dimension in V1. | Preserve as string; do not infer product family or approved SPC scope from Quality alone. |
| `plantId` | Plant associated with the inspection lot/result/source row. | SPC filtering and locked-limit key dimension. | Plant visibility must still be enforced by Databricks/Unity Catalog, not app-side assumptions. |
| `batchId` | Batch associated with Quality result evidence. | Useful for chart points, batch scorecards, drill-through, and trace context. | Batch result evidence is not batch release approval. |
| `inspectionLotId` | SAP QM inspection lot identifier. | Useful provenance for measurement rows and drill-through. | An inspection lot does not define SPC subgrouping by itself. |
| `processOrderId` | Manufacturing order associated with an inspection lot/result when sourced. | Useful for POH/SPC cross-linking and operational context. | Missing process order does not invalidate a Quality result row. |
| `micId` | Source MIC or inspection characteristic identifier. | Candidate SPC characteristic identifier. | MIC naming differs across sources; keep raw IDs and map deliberately. |
| `characteristicId` | V2-normalised characteristic identifier when available. | V2 SPC currently uses `characteristicId`; V1 often uses `mic_id`. | Do not collapse distinct MIC/code/name fields without a verified mapping. |
| `micCode` | Source MIC code when available. | Useful label and possible bridge to SPC characteristic config. | MIC code is not guaranteed globally unique. |
| `micName` | Human-readable MIC/characteristic name. | Chart title and picker label candidate. | Name changes must not be used as stable identity. |
| `resultValue` | Numeric result value when available. | Candidate measurement input for SPC charting. | Numeric value alone does not establish subgroup, control limits, or rule signal. |
| `resultText` | Qualitative or text result evidence. | May be relevant for attribute charts only after source and chart model verification. | Text results are not numeric SPC measurements. |
| `resultUnit` | Source unit of measure. | Required for chart readability and cross-source comparability. | Unit conversion must be explicit and source-backed. |
| `sampleId` | Source sample identifier when available. | Candidate point/sample provenance. | Sample ID does not guarantee subgroup membership. |
| `sampleDate` | Sample timestamp/date when sourced. | Candidate chart timestamp. | Query time is not sample freshness. |
| `resultDate` | Result timestamp/date when sourced. | Useful for ordering and late-result checks. | Result date may differ from sample or posting date. |
| `lowerSpecificationLimit` | Product/inspection lower specification limit. | Context line or capability input candidate. | This is not SPC lower control limit. |
| `upperSpecificationLimit` | Product/inspection upper specification limit. | Context line or capability input candidate. | This is not SPC upper control limit. |
| `targetValue` | Product/inspection target value. | Reference context candidate. | Target is not SPC center line unless separately validated. |
| `valuationCode` | Source result valuation/status code. | May help label out-of-spec Quality evidence. | Result valuation is not a Western Electric/Nelson signal. |
| `usageDecisionCode` | SAP QM usage-decision source code when verified. | Advisory context only. | Usage decision is not SPC control status and not release approval without governed mapping. |

## Must Not Be Confused

| Shared Concept | Quality Evidence Source Candidate | SPC Relevance | Must Not Be Confused With | Verification Needed |
|---|---|---|---|---|
| MIC result value | `gold_batch_quality_result_v`, `vw_gold_inspection_result` | Candidate chart point measurement. | SPC signal, rule violation, capability result, or approved process adjustment. | Numeric field, unit, timestamp, subgroup grain, null handling. |
| Specification limits | `gold_batch_quality_result_v`, `vw_gold_inspection_specification`, CoA-like result rows | Context limits and possible capability inputs. | SPC control limits (`UCL`, `LCL`, center line) or locked limits. | Source columns, effective dates, material/plant/MIC applicability. |
| Result valuation | `INSPECTION_RESULT_VALUATION`, source judgement fields, CoA-like result status | Advisory status label. | Western Electric/Nelson rule signal or SAP release decision. | Governed valuation-code mapping and source ownership. |
| Usage decision | `vw_gold_inspection_usage_decision`, lot usage decision joins | Quality context visible next to SPC evidence. | SPC control status, batch release approval, or acceptance guarantee. | Source object, join key, code/text semantics, date effectiveness. |
| Material / plant / MIC key | Quality result rows and SPC dimension views | Shared navigation and join candidate. | Proof that Quality and SPC rows are grain-compatible. | Key format, leading zeros, uniqueness, material/plant/MIC coverage. |
| Sample/result dates | Quality result timestamps | Chart ordering candidate. | Source freshness or dashboard query time. | Which timestamp SPC uses: sample, result, posting, or subgroup timestamp. |
| CoA-like result row | `gold_batch_coa_results_v` candidate | Possible display context. | Official CoA document approval, PDF generation, versioning, or sign-off. | Document-backed source and approval model, if any. |
| Batch result absence | Empty Quality result response | Possible empty SPC input set. | No Quality issue, no deviations, no SPC signals, or no inspection performed. | Source coverage, filters, object existence, route status. |

## Boundary Rules For Future Implementation

- Specification limits are not SPC control limits.
- MIC result valuation is not a Western Electric or Nelson rule signal.
- Usage decision is not SPC control status.
- SPC control limits must come from an SPC-specific locked limit source or validated calculation path.
- SPC signals may be backend-calculated, frontend-calculated, stored, or unavailable; Quality evidence does not prove which model is active.
- Quality result rows may provide measurement input candidates for SPC, but the SPC model still needs its own grain, limit, subgroup, exclusion, chart-type, and rule verification.
- CoA-like result evidence must not be treated as official CoA document approval.
- Missing usage-decision evidence must not be treated as accepted or released.
- No-record Quality sections must not be treated as no SPC-relevant measurements unless source coverage is verified.

## Contract Alignment Notes

The read-only Quality evidence contracts added in data contracts intentionally preserve SPC-relevant fields without creating release semantics:

- `QualityEvidenceRequest` carries `plantId`, `materialId`, `batchId`, `inspectionLotId`, `processOrderId`, `dateFrom`, and `dateTo`.
- `QualityMicResultEvidence` carries MIC/result/specification/sample/date/method/source fields.
- `QualityUsageDecisionEvidence` carries source usage-decision fields plus `mappingStatus`; it does not include release approval.
- `QualityCoaResultEvidence` carries CoA-like result evidence with `documentStatus` limited to `unavailable` or `unknown`.
- `QualityEvidenceSummary` separates `source`, `status`, counts, unavailable evidence, warnings, query time, and source-freshness status.

Future SPC contracts should reference these fields where useful, but should keep SPC-specific fields separate:

- chart type
- subgroup ID and subgroup size
- control-limit provenance
- center line / UCL / LCL / range limits
- locked-limit effective windows
- exclusion flags
- Western Electric / Nelson rule identifiers
- capability calculations
- rule calculation timestamp and calculation owner

## Recommended Future SPC Slice

Before wiring SPC to Quality evidence, complete a bounded SPC source-mapping tranche:

1. Verify current UAT availability of SPC views and tables, especially `spc_quality_metric_subgroup_v`, `spc_locked_limits`, `spc_characteristic_dim_mv`, and any rule-flag materialized views.
2. Decide the V2 navigation grain: `materialId + plantId + micId` should be reconciled with current V2 SPC request shape.
3. Map Quality `QualityMicResultEvidence` fields to SPC measurement-input candidates only after timestamp, unit, subgroup, and null semantics are proven.
4. Keep SPC advisory signals visually and contractually separate from Quality release decisions.

## Open Questions

- Which current UAT Databricks objects are authoritative for Quality MIC evidence and SPC chart data?
- Are Quality MIC identifiers and SPC `mic_id` values identical for all plants/materials, or is a crosswalk required?
- Which timestamp should future SPC use for chart ordering: sample date, result date, posting date, or subgroup timestamp?
- Are specification limits effective-dated by material/plant/MIC in the current source?
- Which source owns SPC locked control limits, approval state, and effective windows?
- Are attribute/non-numeric MIC results eligible for SPC in V2, and which chart types should handle them?
