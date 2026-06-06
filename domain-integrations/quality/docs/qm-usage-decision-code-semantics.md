# QM Usage-Decision Code Semantics and Release-Status Boundaries

**Status:** codes captured 2026-05-21; governed mapping confirmed 2026-05-21 for all 9 observed codes including empty string; V2 may display governed labels additive to source code
**Created:** 2026-05-21
**Evidence captured via:** Databricks CLI using user-authorised workspace access, 2026-05-21 (code distribution from `connected_plant_uat.gold.gold_inspection_usage_decision`)
**Related:** `qm-usage-decision-source-verification.md`, `quality-decision-source-plan.md`

This document defines what can and cannot be inferred from usage-decision codes and texts, and establishes the hard boundaries between QM usage decision and other quality-related concepts.

---

## 1. Hard Rule

> **V2 must display source usage-decision code/text first. It must not map to accepted, released, rejected, conditional, or blocked unless a governed SAP QM mapping is verified with the Quality/QM process owner.**

Missing usage-decision data must not be interpreted as accepted or released.

---

## 2. Actual Distinct Usage-Decision Codes

**Status: codes captured 2026-05-21 from live `connected_plant_uat.gold.gold_inspection_usage_decision` (15,473,693 rows).**

Governed mapping confirmed 2026-05-21 (tim.geldard@kerry.com) for all 9 observed codes.

| Source Code | Row Count | % of Total | V2 Display Label | Release Meaning | Confidence | Governance Required |
|---|---:|---:|---|---|---|---|
| `A` | 13,969,983 | 90.3% | "Accepted" | Accepted → unrestricted | governed | No — confirmed 2026-05-21 |
| `AE` | 1,154,235 | 7.5% | "Accepted (variant / EM)" | Accepted — variant / EM | governed | No — confirmed 2026-05-21 |
| `AC` | 177,810 | 1.2% | "Accepted with concession" | Accepted with concession | governed | No — confirmed 2026-05-21 |
| `R` | 97,432 | 0.6% | "Rejected" | Rejected → blocked | governed | No — confirmed 2026-05-21 |
| `ACE` | 35,695 | 0.2% | "Accepted with concession (variant / EM)" | Accepted with concession — variant / EM | governed | No — confirmed 2026-05-21 |
| `RE` | 29,366 | 0.2% | "Rejected (variant / EM)" | Rejected — variant / EM | governed | No — confirmed 2026-05-21 |
| `A9` | 6,178 | 0.0% | "Accepted — batch restricted" | Accepted but batch restricted | governed | No — confirmed 2026-05-21 |
| `RR` | 2,725 | 0.0% | "Rejected — batch restricted globally" | Rejected + batch restricted globally | governed | No — confirmed 2026-05-21 |
| `''` (empty string) | 269 | 0.0% | "Pending — lot open, stock in QI, no decision taken" | Inspection lot still open; stock in QI; no decision taken; no business effect yet | governed | No — confirmed 2026-05-21 |

**Observed valuation codes (same source):**

| Valuation Code | Row Count | % of Total | Notes |
|---|---:|---:|---|
| `A` | 15,343,901 | 99.2% | Raw value — do not interpret |
| `R` | 129,523 | 0.8% | Raw value — do not interpret |
| `''` (empty string) | 269 | 0.0% | Matches rows with empty usage_decision_code |

**Note on V1 code assumptions:** `quality-decision-source-plan.md` contains example code assumptions (`A`=accept, `R`=reject, `C`=conditional). The A/R base meaning is consistent with the now-confirmed mapping. However, the V1 heuristic `LIKE 'A%' => accepted` is **superseded** — it conflates distinct codes (AC = concession, AE = variant/EM, ACE = concession+variant, A9 = batch restricted) into a single "accepted" bucket. Do not use the broad LIKE heuristic in V2.

**Code suffix semantics (confirmed 2026-05-21):** Suffix `E` = variant / EM (electronic measurement or equivalent local configuration); suffix `C` = with concession; `9` = batch restricted (local scope); double-R (`RR`) = rejected + batch restricted globally. These are confirmed by the Kerry QM process owner and may now be used in display labels.

---

## 3. Concept Separation Table

The following concepts are distinct in SAP QM. V2 must not conflate them.

| Concept | SAP Source (UAT) | V2 Source (if wired) | What it IS | What it is NOT |
|---|---|---|---|---|
| **SAP QM usage decision** | `gold_inspection_usage_decision` (13 cols, grain: lot+counter) | Not yet wired | The QM inspection team's decision on the inspection lot (code only — long text in inspection_lot) | Batch stock status, quality score, CoA document approval, SPC signal |
| **Inspection result valuation** | `gold_batch_quality_result_v.INSPECTION_RESULT_VALUATION` | Not wired natively | Per-MIC pass/fail/warning valuation | Usage decision; release approval |
| **quality_status Pass/Fail** | `gold_batch_production_history_v.quality_status` | Wired in production history panel | Gold view labelling for production history context | SAP QM usage decision; not a release decision |
| **Batch stock status** | `gold_batch_stock_v` (UNRESTRICTED, BLOCKED, QI_HOLD, etc.) | Wired in batch header panel | Current stock bucket quantities | Quality inspection outcome; release decision |
| **Batch release approval** | SAP QM write-back (not implemented) | Not wired; blocked | Governed formal release act | Any of the above |
| **CoA document approval** | Not proven in V1 | Not wired | Controlled CoA document status | CoA-like result evidence |
| **SPC control status** | SPC control chart signals | SPC panel (mock only) | Process-control signal (Western Electric / Nelson rules) | QM inspection outcome; batch release |

---

## 4. Display Wording Rules

When displaying usage-decision evidence in V2:

| Situation | Required Display Wording | Prohibited Wording |
|---|---|---|
| Code is one of 8 governed codes (A, AE, AC, R, ACE, RE, A9, RR) — no lot text | Show source code verbatim; add governed label from §2 table; e.g. "Usage decision (source): A — Accepted" | Do not omit the source code; do not substitute the governed label for the verbatim code |
| Code is one of 8 governed codes — lot long text available | Show code + text verbatim; add governed label; e.g. "Usage decision (source): A — Accepted · [long text]" | Do not suppress the source long text; governed label is additive only |
| Usage-decision code is empty string (269 rows) | Show "Pending — lot open, stock in QI, no decision taken" | Do not show "Accepted", "Passed", "No issues", "Compliant", or "Released" |
| Usage-decision data absent (lot has no row in UD table) | Show "No usage decision recorded" or "Evidence unavailable" | Do not show "Accepted", "Passed", "No issues", or "Compliant" |
| Multiple inspection lots for a batch (each with a UD) | Show evidence for each lot; do not aggregate into a single "batch decision" | Do not synthesise a "batch release decision" from individual lot decisions without governance |
| quality_status is "Pass" | "Pass/Fail label from production history source" | Do not display as "Released", "Accepted", or "QM decision: Pass" |
| quality_status is "Fail" | "Pass/Fail label from production history source" | Do not display as "Rejected" or "Release blocked" |
| quality_status is "unknown" | "Quality status unknown — do not interpret as accepted or rejected" | Do not hide or suppress the unknown state |

---

## 5. Verification SQL for Code Semantics

Run only after the source object and column names are verified (see `qm-usage-decision-source-verification.md` §7).

Replace `<verified_usage_decision_object>` with the actual object name. Replace column names if they differ from V1 assumptions.

```sql
-- Distinct usage decision codes and texts
SELECT
  usage_decision_code,
  usage_decision_text,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY usage_decision_code, usage_decision_text
ORDER BY rows DESC
LIMIT 100;

-- Distinct valuation codes
SELECT
  valuation_code,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY valuation_code
ORDER BY rows DESC
LIMIT 100;

-- Null/empty code frequency
SELECT
  COUNT(*) AS total_rows,
  COUNT(usage_decision_code) AS rows_with_code,
  COUNT(CASE WHEN usage_decision_code = '' THEN 1 END) AS rows_empty_string,
  COUNT(*) - COUNT(usage_decision_code) AS rows_null_code
FROM connected_plant_uat.gold.<verified_usage_decision_object>;

-- Combined code + valuation + quality score distribution
SELECT
  usage_decision_code,
  valuation_code,
  COUNT(*) AS rows,
  AVG(quality_score) AS avg_quality_score,
  MIN(quality_score) AS min_quality_score,
  MAX(quality_score) AS max_quality_score
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY usage_decision_code, valuation_code
ORDER BY rows DESC
LIMIT 100;
```

Capture actual results verbatim in the evidence table in `qm-usage-decision-source-verification.md` §13. Do not remap or interpret the values before capturing them.

---

## 6. Release-Status Mapping Rules

The following mapping rules apply to any display slice that references usage-decision codes:

| Rule | Description |
|---|---|
| **Governed mapping now confirmed for 8 codes** | Codes A, AE, AC, R, ACE, RE, A9, RR have confirmed mappings (2026-05-21) — use the V2 display labels in §2. Empty-string code and any future codes not listed in §2 remain unmapped. |
| **No absence = accepted** | A null or absent usage-decision must never be displayed as accepted, released, or compliant |
| **No valuation heuristic** | V1 broad heuristic `LIKE 'A%' => accepted` must not be promoted to V2 release mapping without explicit governance |
| **No quality_score threshold** | Do not derive release status from quality_score thresholds without a confirmed business rule |
| **No stock proxy** | UNRESTRICTED stock ≠ released; QI HOLD stock ≠ pending UD; BLOCKED stock ≠ rejected |
| **Distinct from SPC** | Control chart status (in control / out of control) is not usage decision status |
| **Distinct from CoA** | CoA-like result evidence is not CoA document approval and is not usage decision |
| **Display source verbatim** | If a code is available, show it verbatim first; any V2 interpretation label must be additive and governed |

---

## 7. Governance Checkpoint

Before any usage-decision code mapping is added to V2:

- [x] The Kerry Quality or QM process owner has confirmed the code-to-release-status mapping in writing. *(tim.geldard@kerry.com, 2026-05-21)*
- [x] The mapping covers **all 9 codes**: A, AE, AC, R, ACE, RE, A9, RR, and `''` (empty string = lot open, stock in QI, no decision). *(2026-05-21)*
- [x] The mapping is recorded in this document in §2 with confidence = `governed` and a governance reference.
- [ ] The V2 display wording is reviewed against the SAP QM spec for consistency. *(pending)*
- [x] Absent/null usage-decision behaviour is explicitly defined. *(§4 display wording rules)*
- [x] The suffix semantics (E = variant/EM, C = concession, 9 = batch restricted) are explicitly addressed. *(§2 note)*

**Remaining gate:** V2 display wording review against the SAP QM spec for consistency (optional hardening; not a blocker for read-only evidence display).

---

## 8. Backlog Items

| Priority | Item | Notes |
|---|---|---|
| ~~P0~~ | ~~Obtain governed code mapping from Kerry Quality/QM process owner~~ | **Done 2026-05-21** — 8 of 9 codes confirmed (tim.geldard@kerry.com) |
| ~~P0~~ | ~~Confirm empty-string code semantics with QM process owner~~ | **Done 2026-05-21** — lot still open; stock in QI; no decision taken; no business effect yet |
| ~~P1~~ | ~~Confirm suffix semantics: E (AE, RE), C (AC, ACE), 9 (A9), RR~~ | **Done 2026-05-21** — E = variant/EM; C = concession; 9 = batch restricted; RR = rejected globally |
| P1 | Review `VALUATION_CODE` semantics with QM process owner | A and R observed; are they an independent axis from UD code or derived? |
| P2 | Confirm `QUALITY_SCORE` meaning and safe display threshold | Do not use as release proxy |
| ~~P3~~ | ~~Update §2 table once governed mapping is confirmed~~ | **Done 2026-05-21** |
