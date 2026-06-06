# QM Usage-Decision Runtime Implementation Plan

**Status:** Plan only — no runtime code changed; no live route wired
**Created:** 2026-05-21
**Related:** `qm-usage-decision-source-verification.md`, `qm-usage-decision-grain-and-joins.md`, `qm-usage-decision-code-semantics.md`, `qm-usage-decision-cross-domain-consumption-plan.md`

This document defines the safe implementation path for displaying QM usage-decision evidence in V2. It is a forward plan — no runtime code has been changed as part of producing this document.

---

## 1. Purpose

To give a future implementation agent a safe, bounded scope for wiring read-only QM usage-decision display. The scope is:

- Display source UD code/text and governed label as read-only evidence in the Quality Evidence view and (optionally) the Traceability batch header.
- No release/reject actions.
- No SAP QM write-back.
- No e-signature or GxP workflow.
- No synthesis of a "batch release decision" from lot-level evidence.

---

## 2. Preconditions

All of the following must be true before any implementation starts:

| Precondition                                                   | Status                                                                                                                                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source object confirmed (`gold_inspection_usage_decision`)     | Done — verified 2026-05-21                                                                                                                                                                                                                  |
| Schema confirmed (13 columns)                                  | Done — verified 2026-05-21                                                                                                                                                                                                                  |
| Grain confirmed (`INSPECTION_LOT_ID + USAGE_DECISION_COUNTER`) | Done — verified 2026-05-21                                                                                                                                                                                                                  |
| Inspection-lot join confirmed                                  | Done — verified 2026-05-21                                                                                                                                                                                                                  |
| All 9 UD codes governed                                        | Done — confirmed by Kerry Quality/QM process owner (tim.geldard@kerry.com) 2026-05-21. Supports read-only display labels only. Does not authorise release/reject actions, SAP QM write-back, e-signature, or batch-level release decisions. |
| Fan-out: multiple UD rows per lot — latest-row logic defined   | Done — SQL template in `qm-usage-decision-grain-and-joins.md` §9                                                                                                                                                                            |
| Fan-out: multiple lots per batch — selection rule confirmed    | **Not done** — this is the remaining gate before batch-level display                                                                                                                                                                        |
| No service-principal fallback                                  | Required — user OAuth only                                                                                                                                                                                                                  |

**The remaining gate before batch-level wiring is the lot-selection rule.** If a material/batch/plant has multiple inspection lots, which lot's usage decision is displayed? This requires a governed rule from the Kerry QM process owner. Without it, either surface evidence per lot (not per batch) or display "multiple lots — see detailed view."

---

## 3. Source Objects

| Object                           | Catalog path                                              | Purpose                                                                                     |
| -------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `gold_inspection_usage_decision` | `connected_plant_uat.gold.gold_inspection_usage_decision` | Primary UD source — 13 columns, grain `(INSPECTION_LOT_ID, USAGE_DECISION_COUNTER)`         |
| `gold_inspection_lot`            | `connected_plant_uat.gold.gold_inspection_lot`            | Join target for MATERIAL_ID, BATCH_ID, PLANT_ID, PROCESS_ORDER_ID, USAGE_DECISION_LONG_TEXT |

---

## 4. Required Joins

```
gold_inspection_usage_decision (UD)
  JOIN gold_inspection_lot (IL)
    ON IL.INSPECTION_LOT_ID = UD.INSPECTION_LOT_ID
  → returns MATERIAL_ID, BATCH_ID, PLANT_ID, PROCESS_ORDER_ID, USAGE_DECISION_LONG_TEXT
```

**Key rules:**

- Join from UD to IL must be a LEFT JOIN where UD is the left table — all UD rows must be preserved even if the lot join returns null (non-batch-linked lots).
- If batch-level filtering is required: filter on `IL.MATERIAL_ID IS NOT NULL AND IL.BATCH_ID IS NOT NULL` after joining.
- PLANT_ID is not on the UD table — always obtain it via `IL.PLANT_ID`.
- Material ID format: unpadded (`20052009`, not `000000000020052009`) — use unpadded in WHERE clause (confirmed for UAT candidate).
- Batch ID format: 10-char padded (`0008602411`) — verify padding behaviour before assuming universal rule.

---

## 5. Latest-Row Selection Pattern

The UD table is historical — multiple rows per inspection lot exist (one per decision version). To get the current decision per lot:

```sql
WITH usage_decision_ranked AS (
  SELECT
    ud.*,
    il.MATERIAL_ID,
    il.BATCH_ID,
    il.PLANT_ID,
    il.PROCESS_ORDER_ID,
    il.USAGE_DECISION_LONG_TEXT,
    ROW_NUMBER() OVER (
      PARTITION BY ud.INSPECTION_LOT_ID
      ORDER BY
        COALESCE(CAST(NULLIF(ud.USAGE_DECISION_COUNTER, '') AS INT), 0) DESC,
        ud.USAGE_DECISION_CREATED_DATE DESC,
        ud.USAGE_DECISION_UPDATED_TIME DESC
    ) AS rn
  FROM connected_plant_uat.gold.gold_inspection_usage_decision ud
  LEFT JOIN connected_plant_uat.gold.gold_inspection_lot il
    ON il.INSPECTION_LOT_ID = ud.INSPECTION_LOT_ID
)
SELECT *
FROM usage_decision_ranked
WHERE rn = 1
  AND MATERIAL_ID = :material_id
  AND BATCH_ID = :batch_id;
```

**Status: proposed template — requires validation before production use.**

Caveats (from `qm-usage-decision-grain-and-joins.md` §9):

- Validate blank-counter semantics with QM/data owner (blank treated as 0 = first decision).
- Validate behaviour if `USAGE_DECISION_COUNTER` ever exceeds 9 — max observed is 5.
- Do not use `MAX(USAGE_DECISION_COUNTER)` on the raw string column.
- If `USAGE_DECISION_CREATED_DATE` / `USAGE_DECISION_UPDATED_TIME` semantics conflict with counter order, escalate before implementation.

---

## 6. Fan-Out Handling

**Multiple UD rows per inspection lot (historical):** Resolved by the latest-row pattern in §5.

**Multiple inspection lots per material/batch/plant:** Governed by Option A (Strict Lot-Level Evidence).

| Scenario                                            | Required handling                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Exactly one inspection lot per material/batch/plant | Display UD evidence for that lot directly                                                           |
| Multiple lots                                       | Surface evidence per lot (not per batch); label "Multiple inspection lots — showing per-lot detail" |
| Zero lots for a batch                               | Show "No inspection lot found for this batch" — not "No usage decision"                             |

**Governed rule:** Option A (Strict Lot-Level Evidence - No Aggregation) was approved. Do not aggregate lot-level decisions into a single "batch release status".

---

## 7. Raw-Code Display Rules

Always show the source UD code verbatim first. The governed label is additive.

| Code                | Display label                            | Release meaning                              |
| ------------------- | ---------------------------------------- | -------------------------------------------- |
| `A`                 | Accepted                                 | → unrestricted stock                         |
| `AE`                | Accepted (variant / EM)                  | Accepted — variant / EM                      |
| `AC`                | Accepted with concession                 | Accepted with concession                     |
| `ACE`               | Accepted with concession (variant / EM)  | Accepted with concession — variant / EM      |
| `A9`                | Accepted — batch restricted              | Accepted but batch restricted                |
| `R`                 | Rejected                                 | → blocked stock                              |
| `RE`                | Rejected (variant / EM)                  | Rejected — variant / EM                      |
| `RR`                | Rejected — batch restricted globally     | Rejected + batch restricted globally         |
| `''` (empty string) | Pending — lot open, stock in QI          | Inspection lot still open; no decision taken |
| absent / null lot   | "No inspection lot found for this batch" | Not a decision; source gap                   |

**Important:** "Accepted" and "Rejected" in the table above are governed source usage-decision labels only — they are not release authorisations or app decisions. They reflect the SAP QM inspection team's recorded outcome for the inspection lot. V2 does not make release decisions.

**Prohibited display:** "Released", "Approved", "Can Release", "Cleared" — none of these may be derived from UD evidence.

---

## 8. Prohibited Mappings

These must never be introduced in implementation:

- Mapping `LIKE 'A%'` to a single "accepted" status (superseded by governed 5-code split).
- Deriving release status from `UNRESTRICTED` stock bucket (stock ≠ UD).
- Using `quality_status` Pass/Fail from production history as a UD substitute.
- Using `VALUATION_CODE` as a standalone release indicator.
- Using `QUALITY_SCORE` as a release threshold.
- Synthesising a "batch decision" by aggregating multiple lot decisions without a governed rule.
- Showing an empty UD row as "Accepted" or "Released."

---

## 9. Proposed API / Query Shape

```python
# Proposed FastAPI route — not yet implemented
# POST /api/quality/usage-decision

class UsageDecisionRequest(BaseModel):
    material_id: str      # unpadded SAP format (e.g. '20052009')
    batch_id: str         # padded SAP format (e.g. '0008602411')
    plant_id: str | None  # optional — filter on IL.PLANT_ID if provided

class UsageDecisionEvidence(BaseModel):
    inspection_lot_id: str
    usage_decision_code: str | None   # raw source value
    usage_decision_label: str | None  # governed label from code mapping
    usage_decision_long_text: str | None  # from gold_inspection_lot
    usage_decision_created_date: str | None
    plant_id: str | None
    material_id: str | None
    batch_id: str | None
    source: Literal['databricks-api']

class UsageDecisionResponse(BaseModel):
    evidence: list[UsageDecisionEvidence]  # one entry per inspection lot
    lot_count: int
    multiple_lots_warning: bool  # true if lot_count > 1 and no selection rule applied
    missing_lot_warning: bool    # true if batch exists but no inspection lot found
    source: Literal['databricks-api']
    warnings: list[str]
```

---

## 10. Proposed UI Display Shape

- Label: **"Usage decision (source) — read-only evidence. Not a release authorization."**
- Show: `[code] — [governed label]`
- Show long text if available: `[code] — [governed label] · [long text]`
- If empty string: `Pending — lot open, stock in QI, no decision taken`
- If absent/null: `No usage decision recorded for this batch`
- If multiple lots: show per-lot table with lot ID, code, label, and date; do NOT aggregate
- If `multiple_lots_warning = true`: amber banner — "Multiple inspection lots found — showing per-lot evidence. A single batch decision cannot be derived without a governed lot-selection rule."

---

## 11. Tests Required

Before any live route is merged:

- [ ] Unit test: latest-row selection returns correct row per lot for a batch with historical UD rows (counter '1', '2', blank).
- [ ] Unit test: blank counter treated as 0 (first decision).
- [ ] Unit test: empty-string UD code maps to "Pending" label, not "Accepted" or null.
- [ ] Unit test: absent lot returns `missing_lot_warning = true` and no UD display.
- [ ] Unit test: multiple lots per batch returns `multiple_lots_warning = true` and per-lot list.
- [ ] Unit test: `MATERIAL_ID` and `BATCH_ID` preserved as strings (no integer coercion).
- [ ] Unit test: no `releaseApproved`, `canRelease`, or `releasedBy` fields on any response.
- [ ] Integration test: query against UAT candidate (material `20052009`, batch `0008602411`, plant `C061`) returns non-empty evidence.
- [ ] Contract test: response Zod schema validates; no extra fields added.

---

## 12. Go / No-Go Checklist

| Gate                                                                             | Status        | Required to proceed                                                   |
| -------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------- |
| Source object verified                                                           | Done          |                                                                       |
| Latest-row SQL template validated against live data                              | Not done      | Run template against UAT candidate; confirm counter and date ordering |
| Multiple lots per batch — count checked for UAT candidate                        | Not done      | Run fan-out check SQL from `qm-usage-decision-grain-and-joins.md` §7  |
| Lot-selection rule confirmed (if multiple lots exist)                            | Not done      | Kerry QM process owner must confirm                                   |
| Unity Catalog grant for `gold_inspection_usage_decision` + `gold_inspection_lot` | Not confirmed | Verify for service-principal-free OAuth path                          |
| Unit tests pass                                                                  | Not done      | Write and run before wiring                                           |
| No `releaseApproved` / `canRelease` field introduced                             | Confirmed     | Permanent constraint                                                  |
| No SAP QM write-back                                                             | Confirmed     | Permanent constraint                                                  |
| No service-principal fallback                                                    | Confirmed     | Permanent constraint                                                  |
