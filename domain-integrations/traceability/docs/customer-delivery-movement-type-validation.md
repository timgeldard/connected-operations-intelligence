# Customer Delivery Movement Type Validation

**Domain:** `domain-integrations/traceability`
**Created:** 2026-05-20
**Status:** Reference documentation; validation SQL for UAT

---

## Purpose

Records the SAP movement type semantics relevant to customer delivery records and explains
how movement-type filtering is handled in the Databricks layer rather than V2 app code.

---

## Movement Types in gold_batch_delivery_v

`gold_batch_delivery_v` is a Databricks view over `gold_inventory_movement`. The view definition
(inside Databricks, not in V2 app code) filters to the following SAP goods-issue delivery movement types:

| Movement Type | SAP Description | Relevance |
|---|---|---|
| **601** | Goods issue for delivery (outbound delivery to customer) | Primary delivery movement — batch shipped to customer |
| **602** | Reversal of goods issue for delivery | Reversal record — cancellation of a 601 posting |
| **641** | Goods issue for stock transfer order (STO) delivery | Inter-plant/inter-company delivery via STO |

These movement types are the Databricks view concern. V2 app code does not filter by movement type
when querying `gold_batch_delivery_v` — the view pre-applies the filter.

---

## Why V2 Does Not Filter by Movement Type Directly

CLAUDE.md constraint: "Do not assume V1 field names, enum values, or business rules when
implementing new mock data or schemas."

Applying movement-type filters in V2 SQL would require hardcoding `601`, `602`, `641` as numeric
constants. These values:
- Are SAP transaction codes that could differ between client configurations
- Are already encapsulated in the Databricks view definition
- Are not present in the confirmed column set for `gold_batch_delivery_v`
  (the view does not expose `MOVEMENT_TYPE` as a queryable column — it is used in the view's
  WHERE clause internally)

V2 queries `gold_batch_delivery_v` and trusts the view to return only delivery-relevant records.

---

## Reversal Handling (Movement Type 602)

602 reversals appear as rows in `gold_batch_delivery_v` alongside 601 originals. The V2 mapper
(`map_customer_delivery_rows`) does not currently de-net reversals — it sums `ABS_QUANTITY` across
all rows.

**Known gap:** If a delivery is reversed, both the original (601) and the reversal (602) appear in
the result. The net quantity would require: `SUM(CASE WHEN movement_type = '601' THEN abs_quantity ELSE -abs_quantity END)`.

This de-netting logic requires `MOVEMENT_TYPE` to be exposed as a queryable column in
`gold_batch_delivery_v`. Until this is confirmed in UAT, the mapper sums `ABS_QUANTITY` without
de-netting, which may overstate quantities if significant reversal activity exists.

**Escalation rule:** If UAT shows reversal rows are present and ABS_QUANTITY sum materially
overstates shipped quantity, add `MOVEMENT_TYPE` to the Scope E SQL and implement de-netting
in the mapper.

---

## Validation SQL

Run these in a Databricks notebook against `connected_plant_uat` to validate `gold_batch_delivery_v`
behaviour before promoting to production.

### 1. Confirm DESCRIBE TABLE column names

```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_delivery_v
```

Expected output must include: `DELIVERY`, `CUSTOMER_ID`, `CUSTOMER_NAME`, `COUNTRY_ID`,
`CITY`, `ABS_QUANTITY`, `POSTING_DATE`, and the WHERE keys (`MATERIAL_ID`, `BATCH_ID`).

### 2. Count records for a known test batch

```sql
SELECT COUNT(*) AS delivery_count
FROM connected_plant_uat.gold.gold_batch_delivery_v
WHERE MATERIAL_ID = '<test_material_id>'
  AND BATCH_ID   = '<test_batch_id>'
```

Expected: > 0 rows for a batch known to have been shipped to customers.

### 3. Check COUNTRY_ID null sparsity

```sql
SELECT
  COUNT(*)                                        AS total_rows,
  COUNT(COUNTRY_ID)                               AS rows_with_country,
  COUNT(*) - COUNT(COUNTRY_ID)                    AS rows_missing_country,
  ROUND(COUNT(COUNTRY_ID) * 100.0 / COUNT(*), 1) AS country_fill_pct
FROM connected_plant_uat.gold.gold_batch_delivery_v
WHERE MATERIAL_ID = '<test_material_id>'
  AND BATCH_ID   = '<test_batch_id>'
```

Expected: country_fill_pct ≥ 80%. If < 80%, investigate whether `COUNTRY_ID` is populated
for recent deliveries only (data migration gap vs. systemic absence).

### 4. Check for reversal records (602 presence)

```sql
-- Only run if MOVEMENT_TYPE column is confirmed in DESCRIBE output
SELECT MOVEMENT_TYPE, COUNT(*) AS cnt, SUM(ABS_QUANTITY) AS total_qty
FROM connected_plant_uat.gold.gold_batch_delivery_v
WHERE MATERIAL_ID = '<test_material_id>'
  AND BATCH_ID   = '<test_batch_id>'
GROUP BY MOVEMENT_TYPE
ORDER BY MOVEMENT_TYPE
```

If 602 rows appear alongside 601 rows with similar quantities, de-netting is required.
Escalate to Scope E SQL update if confirmed.

### 5. Spot-check against lineage-only slice

```sql
-- Compare delivery count from view vs LINK_TYPE='DELIVERY' in gold_batch_lineage
-- Run both for the same test batch and compare affectedDeliveries count

-- Delivery view count:
SELECT COUNT(DISTINCT DELIVERY) AS delivery_view_count
FROM connected_plant_uat.gold.gold_batch_delivery_v
WHERE MATERIAL_ID = '<test_material_id>'
  AND BATCH_ID   = '<test_batch_id>'
  AND DELIVERY IS NOT NULL
  AND CUSTOMER_ID IS NOT NULL

-- Lineage count (for comparison only):
SELECT COUNT(DISTINCT DELIVERY_ID) AS lineage_delivery_count
FROM connected_plant_uat.gold.gold_batch_lineage
WHERE PARENT_MATERIAL_ID = '<test_material_id>'
  AND PARENT_BATCH_ID   = '<test_batch_id>'
  AND LINK_TYPE = 'DELIVERY'
  AND CUSTOMER_ID IS NOT NULL
```

If delivery_view_count > lineage_delivery_count: delivery view is more complete (expected).
If lineage_delivery_count > delivery_view_count: lineage has edges the view does not — investigate.

---

## UAT Sign-off Criteria

Before the `gold_batch_delivery_v` slice is promoted to production-ready:

- [ ] DESCRIBE TABLE confirms MATERIAL_ID and BATCH_ID as column names
- [ ] At least one test batch returns > 0 delivery rows
- [ ] COUNTRY_ID fill rate ≥ 80% on test batch
- [ ] Reversal presence assessed; de-netting decision made
- [ ] Delivery view count compared to lineage-only count; discrepancy investigated if any
- [ ] Results reviewed by domain owner (tim.geldard@kerry.com)
