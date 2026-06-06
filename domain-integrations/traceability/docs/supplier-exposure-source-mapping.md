# Supplier Exposure Source Mapping — gold_batch_lineage + gold_supplier

**Domain:** `domain-integrations/traceability`
**Created:** 2026-05-21
**Status:** First live slice wired — single-hop direct VENDOR_RECEIPT suppliers only

---

## Purpose

Records the live source for `POST /api/trace2/supplier-exposure` and the
constraints / known gaps surfaced by live data inspection.

---

## Source

`connected_plant_uat.gold.gold_batch_lineage` joined to
`connected_plant_uat.gold.gold_supplier` on `SUPPLIER_ID`.

Live row counts (2026-05-21):
- `gold_batch_lineage` VENDOR_RECEIPT rows: 30,110,142
- `gold_supplier` rows: ~5,921 distinct supplier IDs across the catalog

---

## Query shape

Single-hop upstream walk: rows where `CHILD_MATERIAL_ID = :material_id` and
`CHILD_BATCH_ID = :batch_id` and `LINK_TYPE = 'VENDOR_RECEIPT'`. Grouped by
SUPPLIER_ID. No recursive CTE — multi-hop supplier walks are out of scope for
the first slice (queue as follow-up if needed).

---

## Filter critical: empty-string SUPPLIER_ID

Live data shows `SUPPLIER_ID` is sometimes `NULL` and sometimes an empty string
(`''`). 9 of 10 direct-parent VENDOR_RECEIPT rows for the UAT candidate had
`SUPPLIER_ID = ''`. These represent **unattributed inputs** — intra-company
transfers, missing master data, or movement-type rows without a real third-party
supplier — and are not real suppliers.

The query filter is:

```sql
AND l.SUPPLIER_ID IS NOT NULL
AND l.SUPPLIER_ID <> ''
```

Both clauses are required. `IS NOT NULL` alone is insufficient because Databricks
treats empty string as non-null.

---

## Live spot checks

### UAT candidate (`20035129 / 8000049668`)
- 1 supplier with `SUPPLIER_ID <> ''` after filtering
- `PQ Silicas UK` (`0005002928`), GB, 201,300 KG total across 20 receipts, last 2025-06-04

### Multi-supplier batch (`20394026 / 0005587610`)
- 4 suppliers across US, DE, AE
- `Agropur MSI, LLC` (`0005033449`) is the largest receiver — 1,886,976 KG across 144 receipts

---

## Field-by-field mapping

| Field | Source | Notes |
|---|---|---|
| `supplierCount` | `COUNT(DISTINCT SUPPLIER_ID)` after filter | |
| `supplierLots` | sum of per-supplier receipt counts | proxy for "supplier lots received" |
| `upstreamMaterials` | sum of `COUNT(DISTINCT PARENT_MATERIAL_ID)` per supplier | **Live observation:** for VENDOR_RECEIPT rows the PARENT_MATERIAL_ID/PARENT_BATCH_ID/PARENT_PLANT_ID are typically `NULL` (no internal batch parent — the parent IS the supplier). So this metric is usually 0 for the supplier slice. Surfaced as-is. |
| `openSupplierActions` | `0` (constant) | TRACE-P1-012 — no verified QM source |
| `highestRiskSupplier` | absent (omitted) | TRACE-P1-012 — no verified QM source |
| `suppliers[].supplierId` | `SUPPLIER_ID` | leading zeros preserved |
| `suppliers[].supplierName` | `gold_supplier.SUPPLIER_NAME` | optional |
| `suppliers[].countryId` | `gold_supplier.COUNTRY_ID` | optional |
| `suppliers[].countryName` | `gold_supplier.COUNTRY_NAME` | optional |
| `suppliers[].receivedQuantity` | `SUM(gold_batch_lineage.QUANTITY)` | |
| `suppliers[].batchCount` | `COUNT(*)` per supplier | |
| `suppliers[].uom` | `MAX(BASE_UNIT_OF_MEASURE)` | assumes a supplier's receipts share UoM (rare mixed-UoM case not handled in this slice) |
| `suppliers[].lastReceiptDate` | `MAX(POSTING_DATE)` | |

---

## Decisions

1. **Single-hop only.** Multi-hop recursive walks are deferred.
2. **Empty SUPPLIER_ID rows excluded at SQL.** Not surfaced as "unknown supplier" — they are operationally not third-party suppliers.
3. **Quality data not joined.** `openSupplierActions` and `highestRiskSupplier` are unavailable until a verified QM source is wired (TRACE-P1-012).
4. **Zero suppliers → HTTP 200 with empty array.** A batch may legitimately have no purchased inputs (production-only batch with no vendor receipts). Distinct from the "do not interpret as zero exposure" pattern used for customer deliveries.

---

## Source decision summary

> V2 `POST /api/trace2/supplier-exposure` queries `gold_batch_lineage`
> (`LINK_TYPE='VENDOR_RECEIPT'`) left-joined to `gold_supplier` on
> `SUPPLIER_ID`, filtered to `CHILD_MATERIAL_ID + CHILD_BATCH_ID` matching the
> investigation anchor. Empty-string SUPPLIER_ID rows are excluded at SQL.
> Single-hop. No QM data joined.
