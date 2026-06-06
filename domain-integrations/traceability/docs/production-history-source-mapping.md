# Production History Source Mapping — gold_batch_production_history_v

**Domain:** `domain-integrations/traceability`
**Created:** 2026-05-21
**Status:** First live slice wired — material-only filter, 24 most-recent batches

---

## Purpose

Records the live source for `POST /api/trace2/production-history` and the
column inventory verified on 2026-05-21.

---

## Source

`connected_plant_uat.gold.gold_batch_production_history_v` — 8 columns
confirmed live via DESCRIBE TABLE:

| Column | Type | Used in V2 SQL |
|---|---|---|
| `PROCESS_ORDER_ID` | string | `process_order_id` |
| `BATCH_ID` | string | `batch_id` (filter: IS NOT NULL) |
| `PLANT_ID` | string | `plant_id` |
| `MATERIAL_ID` | string | `material_id` (WHERE key) |
| `POSTING_DATE` | date | `posting_date` (ORDER BY DESC) |
| `BATCH_QTY` | decimal(23,3) | `batch_qty` |
| `UOM` | string | `uom` |
| `quality_status` | string | `quality_status` |

---

## Query shape

`MATERIAL_ID = :material_id` filter only — no plant filter (V1 parity:
investigators want to see all plants' recent production for a material to
assess "isolated batch issue vs. systemic across the production network").

ORDER BY `POSTING_DATE DESC, BATCH_ID DESC`. Default LIMIT 24 (V1 parity).

---

## Quality status mapping

Live values observed 2026-05-21:

| Raw value | Count | Mapped enum |
|---|---|---|
| `Pass` | 1,961,006 | `pass` |
| `Fail` | 295,832 | `fail` |
| any other / null / empty | 0 (none observed live) | `unknown` |

Case-insensitive — `Pass`, `pass`, `PASS` all map to `pass`. The mapper is
explicit: `Pass` → `pass`, `Fail` → `fail`, anything else → `unknown`. No
inference, no business-rule interpretation.

---

## Zero-rows semantics

A material returning zero rows is a valid 200 response, **not** a 404. The
material may legitimately have no recent production history — typical reasons:

- Raw-input material (purchased finished good, not manufactured on-site). The
  UAT candidate material `20035129` (Silicon Dioxide) is a raw input — it has
  rich VENDOR_RECEIPT lineage but zero production history. This is correct,
  not an error.
- Newly-introduced material with no production yet
- Material that has been discontinued

The panel surfaces zero-rows distinctly:
> "No recent production batches found for this material. The material may not
> be manufactured on-site (raw-input materials and purchased finished goods do
> not appear in production history)."

---

## Live spot checks

### Top material (`70948010`)
- 26,196 batches in production history, earliest 2022-02-27, latest 2025-09-28
- First 5 most-recent batches all `Pass` at plants P132 / P648 / P638
- BATCH_QTY values range 30,000–55,000 KG per batch

### UAT candidate material (`20035129`)
- 0 rows — raw-input Silicon Dioxide, not manufactured on-site
- Mapper returns `totalBatches=0`, empty `rows[]`, route returns HTTP 200

---

## Quality status caveat

"Pass" / "Fail" in this view is the gold view's labelling. It is **not** the
SAP QM usage-decision and should not be treated as a release decision. The
panel disclaimer reads:

> Quality status is the gold view's Pass/Fail label. A "Fail" row does not
> imply a release decision was made — full QM usage-decision evidence requires
> the QM source (TRACE-P1-012).

---

## Field-by-field mapping

| Field | Source | Notes |
|---|---|---|
| `materialId` | request body `material_id` (echoed); falls back to row `MATERIAL_ID` | request value is authoritative for the summary; row value is used per-row |
| `totalBatches` | length of mapped rows | |
| `passCount` | rows with `qualityStatus='pass'` | |
| `failCount` | rows with `qualityStatus='fail'` | |
| `unknownCount` | rows with `qualityStatus='unknown'` | |
| `rows[].batchId` | `BATCH_ID` | leading zeros preserved |
| `rows[].processOrderId` | `PROCESS_ORDER_ID` | optional |
| `rows[].plantId` | `PLANT_ID` | optional |
| `rows[].materialId` | `MATERIAL_ID`; fallback to request param | |
| `rows[].postingDate` | `POSTING_DATE` (ISO date string) | optional |
| `rows[].quantity` | `BATCH_QTY` | null → 0.0 |
| `rows[].uom` | `UOM` | optional |
| `rows[].qualityStatus` | `quality_status` (mapped) | enum: pass / fail / unknown |

---

## Source decision summary

> V2 `POST /api/trace2/production-history` queries
> `gold_batch_production_history_v` keyed on MATERIAL_ID only (no plant filter),
> ordered POSTING_DATE DESC, default 24 most-recent batches. Quality status is
> the gold view's Pass/Fail label and is not a release decision.
