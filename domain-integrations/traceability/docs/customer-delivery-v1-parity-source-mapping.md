# Customer Delivery V1 Parity Source Mapping

**Domain:** `domain-integrations/traceability`
**Created:** 2026-05-20
**Status:** V1 source identified; 17 columns verified live 2026-05-20 (DESCRIBE TABLE, connected_plant_uat)

---

## Purpose

This document answers the 12 V1 parity questions from the customer delivery work package and
records the definitive source decision for the V2 `POST /api/trace2/customer-deliveries` endpoint.

---

## Q1: Which V1 files implement customer delivery / customer exposure logic?

V1's application code queries `gold_batch_delivery_v` — a Databricks Unity Catalog view over
`gold_inventory_movement`. Evidence sources:

- `docs/migration/trace2-functional-parity-audit.md` §3 (column mapping table for
  `gold_batch_delivery_v`): DELIVERY, CUSTOMER_ID, CUSTOMER_NAME, COUNTRY_ID, CITY, ABS_QUANTITY
- `docs/migration/trace2-functional-parity-audit.md` §8 (V1 customer exposure behaviour):
  query keyed on material_id + batch_id against `gold_batch_delivery_v`
- `docs/migration/databricks-vertical-slices-trace-plan.md` Slice 4: proposes `gold_batch_delivery_v`
  with the same 6-column set as the V2 target

No V1 application file queries `gold_inventory_movement` directly. The movement-type filtering
(601/602/641) is encapsulated inside the Databricks view definition.

---

## Q2: Which Databricks view is the primary source?

**`gold_batch_delivery_v`** — a view over `gold_inventory_movement` that pre-filters to
goods-issue delivery movement types and exposes customer delivery metadata columns.

The relationship:

```
gold_inventory_movement  (fact table — all movement types)
        ↓ view definition filters to delivery movement types
gold_batch_delivery_v    (delivery records only — V1 app queries this)
        ↓ V2 app queries this view
POST /api/trace2/customer-deliveries
```

V2 must query `gold_batch_delivery_v` rather than `gold_inventory_movement` directly because:
- Querying `gold_inventory_movement` directly would require V2 to invent movement-type filter
  values (601, 602, 641) that are not confirmed in V2 app context — violates CLAUDE.md
  "No hardcoded mature-domain behaviour" constraint.
- `gold_batch_delivery_v` encapsulates the movement-type filter semantics inside the Databricks
  layer, which is the correct separation of concerns.

---

## Q3: Confirmed column set

All 17 columns verified live 2026-05-20 via `DESCRIBE TABLE connected_plant_uat.gold.gold_batch_delivery_v`.

| Column | Type | Used in V2 SQL | Notes |
|---|---|---|---|
| `MATERIAL_ID` | string | WHERE key | Confirmed |
| `BATCH_ID` | string | WHERE key | Confirmed |
| `PLANT_ID` | string | Not selected | Available; not filtered (recall requires all plants) |
| `CUSTOMER_ID` | string | `customer_id` | Confirmed |
| `CUSTOMER_NAME` | string | `customer_name` | Confirmed |
| `STREET` | string | Not selected | Available for future drill-through |
| `CITY` | string | `city` | Confirmed |
| `POSTCODE` | string | Not selected | Available for future drill-through |
| `COUNTRY_ID` | string | `country_id` | Confirmed; populates `countries` array |
| `COUNTRY_NAME` | string | `country_name` | Added 2026-05-20; available for future display |
| `DELIVERY` | string | `delivery` | Confirmed |
| `SALES_ORDER_ID` | string | Not selected | Available for future drill-through |
| `QUANTITY` | decimal(13,3) | Not selected | Signed quantity; ABS_QUANTITY used instead |
| `ABS_QUANTITY` | decimal(13,3) | `abs_quantity` | Confirmed; sums to `shippedQuantity` |
| `UOM` | string | `uom` | Confirmed; returned as optional field in mapper |
| `POSTING_DATE` | date | `posting_date` | Confirmed |
| `MOVEMENT_TYPE` | string | Not selected | Available; movement-type filtering encapsulated by view definition |

---

## Q4: How does `gold_inventory_movement` relate to `gold_batch_delivery_v`?

`gold_inventory_movement` is the Databricks fact table storing all SAP MM/WM movement postings.
Key movement types relevant to customer delivery:

| Movement Type | Description | Included in `gold_batch_delivery_v` |
|---|---|---|
| 601 | Goods issue for delivery | Yes |
| 602 | Reversal of 601 | Yes (reversal records) |
| 641 | Goods issue for STO (stock transfer order) delivery | Yes |

`gold_batch_delivery_v` is a derived view that filters `gold_inventory_movement` to these
delivery-relevant movement types and surfaces delivery metadata columns. V2 queries the view,
not the fact table.

---

## Q5: Why no plant filter on customer delivery queries?

User confirmed 2026-05-20: "plant filtering is not relevant, a user needs to know wherever
a material went to a customer regardless for the recall/trace to be effective."

A batch may have been shipped from multiple plants. Filtering by plant would hide downstream
customer shipments made from other plants, creating false containment signals. The customer
delivery query must return all shipments regardless of originating plant.

This differs from the batch header query (which accepts plant_id for disambiguation) and the
lineage-only customer exposure query (which accepted plant_id for the anchor row filter).
The customer delivery endpoint does not accept or use plant_id.

---

## Q6: Was V1 exposure limited to direct shipments or multi-hop?

V1 showed customer deliveries from the delivery view. These are direct delivery records —
the view surfaces rows where the specified batch_id was shipped to a customer. It does not
traverse lineage hops.

For multi-hop traceability (i.e., "a sub-component of this batch ended up in a product
shipped to customers"), the lineage graph is needed. The `gold_batch_delivery_v` query
gives direct delivery evidence for the exact batch; the lineage recursive CTE gives
exposure depth for intermediate batches.

In this implementation, `gold_batch_delivery_v` provides the V1-parity direct delivery slice.
Multi-hop indirect exposure via lineage remains a separate concern.

---

## Q7: Were countries shown in V1?

Yes — V1 populated country from `COUNTRY_ID` on the delivery view. `gold_batch_delivery_v`
has a `COUNTRY_ID` column (High confidence). The V2 `countries` array in
`CustomerExposureSummarySchema` will be populated from distinct `COUNTRY_ID` values.

The lineage-only slice could not populate `countries` because `gold_batch_lineage` has no
country column. The delivery view resolves this gap.

---

## Q8: Were customer names shown in V1?

Yes — `CUSTOMER_NAME` is in the confirmed column set for `gold_batch_delivery_v`. V1 populated
customer names from the delivery view directly (no separate customer master join required for
the summary count, though names could appear in a detail list).

---

## Q9: Was shipped quantity calculated?

Yes — from `ABS_QUANTITY` (absolute quantity, decimal(13,3), confirmed). The mapper sums `ABS_QUANTITY`
across all delivery rows to produce `shippedQuantity`. `UOM` is confirmed as a string column
(verified live 2026-05-20); the mapper extracts the first non-null UOM value and returns it as
the optional `uom` field. The panel shows `{shippedQuantity} {uom}` when UOM is available,
falling back to `{shippedQuantity} source units` when absent.

---

## Q10: Were blocked deliveries shown?

V1 exposed a blocked delivery count. No blocked-status column has been confirmed in the
`gold_batch_delivery_v` column set at this time. The `blockedDeliveries` field will remain 0
in this slice until a blocked-status column is verified in UAT.

---

## Q11: Were sales orders shown?

V1 had sales order linkage. `SALES_ORDER_ID` is confirmed as a string column in `gold_batch_delivery_v`
(verified live 2026-05-20). It is not included in the V2 first slice SELECT but is available for
a future drill-through slice.

---

## Q12: How does this differ from the lineage-only slice?

| Attribute | Lineage-only slice | gold_batch_delivery_v slice |
|---|---|---|
| Source | `gold_batch_lineage` (LINK_TYPE='DELIVERY' edges) | `gold_batch_delivery_v` |
| Data confidence | Medium — LINK_TYPE population unvalidated | High — direct delivery records |
| Countries | Not available (no country column in lineage) | Available (`COUNTRY_ID`) |
| Customer names | Not available | Available (`CUSTOMER_NAME`) |
| Depth indicator | Yes (`maxExposureDepth` from hop_depth) | No — direct delivery records only |
| plant filter | Was accepted (anchor filter) | Not used (user confirmed) |
| V1 parity | Preliminary indicator only | V1-parity source |

The lineage-only slice (implemented 2026-05-20 on `POST /api/trace2/customer-exposure`) remains
in place as a preliminary exposure-depth indicator. It is not V1-parity evidence of customer
delivery. The `gold_batch_delivery_v` slice on `POST /api/trace2/customer-deliveries` is the
V1-parity implementation.

---

## Source Decision Summary

> **V2 `POST /api/trace2/customer-deliveries` queries `gold_batch_delivery_v` keyed on
> MATERIAL_ID + BATCH_ID with no plant filter.**
>
> The existing `POST /api/trace2/customer-exposure` (lineage-only) remains as a preliminary
> exposure-depth indicator and is **not** V1-parity customer delivery evidence.

---

## Column Verification Status

DESCRIBE TABLE executed live 2026-05-20 against `connected_plant_uat.gold.gold_batch_delivery_v`.

| Item | Status |
|---|---|
| `MATERIAL_ID` as WHERE key | ✅ Confirmed |
| `BATCH_ID` as WHERE key | ✅ Confirmed |
| `UOM` column | ✅ Confirmed (string; added to SELECT and mapper) |
| `COUNTRY_NAME` column | ✅ Confirmed (string; added to SELECT for future display) |
| `SALES_ORDER_ID` column | ✅ Confirmed (string; available for future drill-through) |
| `MOVEMENT_TYPE` column | ✅ Confirmed (string; encapsulated by view — not filtered in V2) |
| Null sparsity of `COUNTRY_ID` in live records | ⬜ Pending UAT — DEF-TRACE-006 CD-3 |
| Blocked delivery count (`blockedDeliveries`) | ⬜ Pending — no blocked-status column in view; deferred |
