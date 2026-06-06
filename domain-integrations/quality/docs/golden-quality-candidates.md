# Golden Quality Candidates

**Status:** candidate template and discovery ledger.
**Last updated:** 2026-05-21.

No verified live Quality UAT candidate has been identified from V1 discovery.

The existing V2 mock release cases in `golden-quality-batches.md` remain useful for UI trust-hardening tests only. They must not be treated as live SAP QM or release evidence.

`quality-databricks-source-verification.md` provides the broad candidate discovery SQL and evidence capture table. `qm-usage-decision-source-verification.md` provides the dedicated QM usage-decision verification pack. A candidate should move out of `TBD` only after source-object existence, required columns, row grain, usage-decision semantics, and CoA/deviation boundaries are captured from Databricks evidence.

For usage-decision candidates specifically: `gold_inspection_usage_decision` schema (13 columns), grain (`INSPECTION_LOT_ID + USAGE_DECISION_COUNTER`), and inspection-lot join were verified via Databricks CLI on 2026-05-21 (TRACE-P1-012). The UAT traceability candidate (material 20052009, batch 0008602411, plant C061) confirmed a usage-decision row (lot 030005059533, code=A, date=2024-08-27). A usage-decision candidate may be confirmed once code-to-release-status meaning is governed by the Kerry Quality/QM process owner. Raw codes must not be mapped to accepted/released/rejected until then.

## Candidate Template

| Field | Value |
|---|---|
| plantId | TBD |
| materialId | TBD |
| batchId | TBD |
| inspectionLotId | TBD |
| processOrderId | TBD, if relevant |
| usageDecisionCode | TBD, if known |
| usageDecisionText | TBD, if known |
| releaseStatus | Unknown until source-backed |
| MIC/result count | TBD, if known |
| CoA status | Unknown until document/result source validated |
| deviation count | Unknown until deviation/notification source validated |
| source views | TBD |
| expected warnings | Missing evidence must not be interpreted as accepted/released/no issue |
| validation status | Not identified |
| evidence captured by | TBD |
| evidence captured at | TBD |
| source verification status | Not run |
| contract coverage | Read-only evidence contracts ready; native source mapping pending |

## Candidate Evidence Rules

- Do not invent expected counts.
- Do not infer accepted/released from missing usage-decision data.
- Do not infer no deviations from missing deviation rows.
- Distinguish SAP QM usage decision, quality result valuation, stock status, lab approval, and CoA evidence.
- Record exact source views and route/query evidence when a candidate is selected.
