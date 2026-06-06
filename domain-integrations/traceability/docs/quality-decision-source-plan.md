# Quality Decision Source — Implementation Plan

**Domain:** `domain-integrations/traceability`  
**Created:** 2026-05-19  
**Status:** Plan only — not implemented  
**Readiness row:** 2.5  
**Defect:** See `traceability-defect-backlog.md` for TRACE-P1-004 (if raised)

> **Implementation constraint:** Do not wire `accepted`, `rejected`, or `conditional` quality status values until the required QM source views have been verified in a live Databricks catalog session and the usage-decision field mapping has been confirmed against real inspection-lot data.

---

## Problem

`_derive_quality_status` in `trace2_databricks_adapter.py` is intentionally conservative. It returns:

- `'pending'` — when `quality_inspection > 0` (stock is in QI; a QM decision may be outstanding)
- `'unknown'` — in all other cases (no QI stock, no QM evidence available)

It explicitly does **not** return `'accepted'`, `'rejected'`, or `'conditional'` because those values require a verified QM usage-decision source. The current query joins `gold_batch_stock_v` for stock buckets only — it does not join any QM view.

This means the cockpit cannot confirm that a batch passed quality inspection or has a conditional release, even when such a decision exists in SAP/Databricks.

---

## Current State

```python
# In map_batch_header_rows
def _derive_quality_status(row: dict) -> str:
    """Conservative quality-status derivation from stock buckets only.

    Returns 'pending' (QI stock present) or 'unknown' (no QM evidence).
    'accepted', 'rejected', 'conditional' require a verified QM usage-decision field.
    """
    qi = row.get("quality_inspection") or 0
    if qi > 0:
        return "pending"
    return "unknown"
```

The `BatchHeaderSummarySchema.qualityStatus` enum supports `'accepted' | 'rejected' | 'pending' | 'conditional' | 'not-applicable' | 'unknown'`. The `'not-applicable'` value covers batch types where quality inspection is structurally not required.

---

## Required QM Source Views

The following views are candidates. Column names and availability are **unverified** — do not assume these names exist in the live catalog without running `DESCRIBE TABLE`.

| View | SAP origin | Likely purpose |
|------|-----------|----------------|
| `gold_qm_usage_decision_v` | QM module usage decision (UD) records | Maps inspection lot → accept/reject/conditional decision |
| `gold_qm_inspection_lot_v` | QM inspection lot header | Inspection lot status, origin, linked batch |

These names follow the `gold_*_v` convention used in this domain. The actual catalog names must be confirmed by running `SHOW TABLES IN <catalog>.<schema>` and looking for QM-prefixed views.

---

## Candidate Fields

### `gold_qm_usage_decision_v` (assumed)

| Field | Notes |
|-------|-------|
| `inspection_lot_id` | Join key to inspection lot |
| `material_id` | Batch material |
| `batch_id` | Batch being inspected |
| `usage_decision_code` | SAP QM UD code (e.g. `A` = accept, `R` = reject) |
| `usage_decision_text` | Human-readable UD description |
| `valuation_date` | Date the decision was recorded |
| `decision_by` | User or system that recorded the decision |

**All column names above are unverified assumptions based on SAP QM data model conventions. Do not use in SQL until confirmed.**

### `gold_qm_inspection_lot_v` (assumed)

| Field | Notes |
|-------|-------|
| `inspection_lot_id` | PK |
| `material_id` | Batch material |
| `batch_id` | Batch under inspection |
| `lot_status` | Current inspection lot status (e.g. `REJO` = rejected, `ACCP` = accepted) |
| `lot_origin` | Inspection origin type (e.g. `01` = goods receipt, `04` = production) |

**All column names above are unverified assumptions. Do not use in SQL until confirmed.**

---

## Proposed Mapping

Once source views are confirmed:

| QM evidence | Mapped `qualityStatus` |
|---|---|
| Usage decision = accept | `'accepted'` |
| Usage decision = reject | `'rejected'` |
| Usage decision = conditional release | `'conditional'` |
| Inspection lot open, no decision yet | `'pending'` |
| No inspection lot found for batch | `'unknown'` |
| Batch type where QI is not used | `'not-applicable'` |

The `'not-applicable'` case requires a business rule: which material types or batch categories are structurally excluded from QM inspection? This must be confirmed with the food-safety or quality team before implementation — do not infer from absence of inspection lot data.

---

## QI Stock vs QM Decision — Key Distinction

`quality_inspection` in `gold_batch_stock_v` is a **stock bucket value** — it indicates how much of the batch quantity is physically in quality inspection stock. It does not indicate whether a QM usage decision has been made.

A batch can have:
- QI stock > 0 AND no usage decision yet → `'pending'` (current conservative behaviour is correct)
- QI stock > 0 AND usage decision = reject → `'rejected'` (stock is blocked pending destruction/return)
- QI stock = 0 AND usage decision = accept → `'accepted'` (stock released to unrestricted)
- QI stock = 0 AND no inspection lot → `'unknown'` (current conservative behaviour is correct)

The correct derivation requires joining the stock row to the QM usage decision, not using the stock bucket alone:

```python
def _derive_quality_status_with_qm(row: dict) -> str:
    """Quality status from QM usage decision (when available) or stock bucket fallback.

    Requires gold_qm_usage_decision_v to be joined into the batch header query.
    Column names below are UNVERIFIED — do not activate until verified.
    """
    usage_decision = row.get("usage_decision_code")   # unverified column name
    if usage_decision == "A":    # accept code — unverified value
        return "accepted"
    if usage_decision == "R":    # reject code — unverified value
        return "rejected"
    if usage_decision == "C":    # conditional code — unverified value
        return "conditional"
    # Fallback: QI stock present but no confirmed decision
    qi = row.get("quality_inspection") or 0
    if qi > 0:
        return "pending"
    return "unknown"
```

The exact SAP usage decision codes (`A`, `R`, `C`, or numeric equivalents) must be confirmed against the live QM data before this mapping is wired.

---

## Integration Point

The QM join should be added to `get_batch_header_summary_spec` in `trace2_databricks_adapter.py` as a `LEFT JOIN` (not `INNER JOIN`) so that batches without an inspection lot still return a row:

```sql
-- Pseudocode only — column names and join keys are unverified
LEFT JOIN gold_qm_usage_decision_v ud
    ON s.material_id = ud.material_id
   AND s.batch_id    = ud.batch_id    -- join key unverified
```

The join should be `LEFT JOIN` so that:
- Batches with no QM record still return a batch header row
- `usage_decision_code` is `NULL` for those batches → falls through to `'unknown'`

**Do not replace the conservative `_derive_quality_status` function until the QM join has been verified in a live session.**

---

## Column Verification Procedure

Before implementation, a Databricks-connected tester must:

1. Run `SHOW TABLES IN <catalog>.<schema>` and confirm QM view names.
2. Run `DESCRIBE TABLE <catalog>.<schema>.gold_qm_usage_decision_v` (or equivalent confirmed name).
3. Identify the usage decision code column and its accepted values.
4. Run a sample join for the reference candidate batch (`000000000020052009` / `0008602411`) to confirm the join produces expected results.
5. Confirm that an absent inspection lot maps to `'unknown'` (missing data), not `'not-applicable'`. `'not-applicable'` must only be assigned when a confirmed business rule explicitly exempts the material or batch type from QM inspection — it is not a fallback for missing lot data.
6. Record results in `docs/migration/databricks-column-verification-queries.md`.

---

## Tests Required

When implementation begins:

1. `test_quality_status_accepted_from_usage_decision_code` — row with `usage_decision_code='A'` → `'accepted'`
2. `test_quality_status_rejected_from_usage_decision_code` — row with `usage_decision_code='R'` → `'rejected'`
3. `test_quality_status_conditional_from_usage_decision_code` — row with `usage_decision_code='C'` → `'conditional'`
4. `test_quality_status_pending_when_qi_present_and_no_decision` — QI > 0 + `usage_decision_code=None` → `'pending'`
5. `test_quality_status_unknown_when_no_qi_and_no_decision` — QI = 0 + `usage_decision_code=None` → `'unknown'`
6. `test_quality_status_never_returns_accepted_without_qm_join` — existing conservative tests must continue to pass; the conservative path should not be removed

Existing tests `test_quality_status_unknown_when_qi_is_null` and `test_quality_status_never_returns_accepted_or_rejected` (added in PR #30) verify the current conservative behaviour and must continue to pass after the QM join is added.

---

## UAT Validation Scenario

| Scenario | What to validate |
|---|---|
| Batch with accepted usage decision | Cockpit shows `qualityStatus: accepted` — not `unknown` or `pending` |
| Batch with rejected usage decision | Cockpit shows `qualityStatus: rejected`; `releaseStatus` should also be `blocked` |
| Batch with open inspection lot, no decision | Cockpit shows `qualityStatus: pending` |
| Batch with no inspection lot | Cockpit shows `qualityStatus: unknown` (conservative — do not imply accepted) |
| Batch where QI is not applicable | Cockpit shows `qualityStatus: not-applicable` (requires business rule confirmation) |

---

## Readiness Checklist Link

- Readiness row 2.5: `Quality decision source documented and blocked until QM evidence verified`
- Current status: 🔶 Partial — conservative values enforced; `accepted`/`rejected`/`conditional` blocked pending QM source verification
