# Customer Exposure Source Mapping

**Domain:** `domain-integrations/traceability`
**Created:** 2026-05-20
**Status:** Lineage-only first slice implemented (preliminary); gold_batch_delivery_v V1-parity slice in progress

---

## V1 Source Discovery

### Did V1 Trace2 have a customer exposure panel/section?

Yes. V1 Trace2 had a customer exposure section surfacing affected customers, affected deliveries, shipped quantity, and highest severity. Evidence from V1 code references `gold_batch_delivery_mat` (a materialized view separate from `gold_batch_lineage`).

### What source did V1 use?

V1 used `gold_batch_delivery_mat` — a materialized delivery view — not the lineage graph's customer-edge columns. The V1 SQL queried delivery records keyed on material_id + batch_id, joining directly to delivery and customer metadata.

### Did V1 use direct delivery data, lineage graph edges, or both?

Primarily direct delivery data from `gold_batch_delivery_mat`. Lineage was used for depth/hop calculation but customer details (customer ID, delivery ID, country) came from the delivery view.

### Was exposure depth calculated?

Yes — V1 inferred depth from the lineage hop count at which a batch reached a delivery edge.

### Was severity calculated?

Yes — in application code from depth and shipped quantity. V1 did not persist severity in Databricks.

### Was customer country shown?

Yes — country codes came from the delivery view. No country column exists in `gold_batch_lineage`.

### Were blocked deliveries shown?

Yes — blocked delivery status came from the delivery view. Not derivable from `gold_batch_lineage` alone.

### Were deliveries linked to sales orders?

Yes — `SALES_ORDER_ID` was available on delivery rows.

### Was shipped quantity calculated?

Yes — sum of delivery quantities from the delivery view.

### Was exposure limited to direct delivery or downstream multi-hop?

V1 showed multi-hop downstream exposure. The depth field indicated how many hops separated the anchor batch from the customer delivery.

---

## Source Mapping Table

| Concept | V1 Source | V2 Candidate Source | Columns | Confidence | Gap |
|---|---|---|---|---|---|
| affectedCustomers (count) | `gold_batch_delivery_mat.customer_id` | `gold_batch_lineage.CUSTOMER_ID` (DELIVERY edges) | `CUSTOMER_ID` | Medium | CUSTOMER_ID column confirmed present; DELIVERY-edge population not UAT-validated (P0-3) |
| affectedDeliveries (count) | `gold_batch_delivery_mat.delivery_id` | `gold_batch_lineage.DELIVERY_ID` (DELIVERY edges) | `DELIVERY_ID` | Medium | As above — same edge population caveat |
| shippedQuantity | `gold_batch_delivery_mat.delivery_quantity` | `gold_batch_lineage.QUANTITY` (DELIVERY edges) | `QUANTITY`, `BASE_UNIT_OF_MEASURE` | Medium | Quantity column confirmed; correct attribution on DELIVERY edges needs UAT |
| maxExposureDepth | lineage hop count | `gold_batch_lineage.hop_depth` (recursive CTE) | `hop_depth` (computed) | High | Already used in trace graph CTE; same logic applies |
| countries | `gold_batch_delivery_mat.country_code` | `gold_batch_delivery_v.country_code` (unverified) | Unknown | Missing | No country column in gold_batch_lineage; requires gold_batch_delivery_v column verification |
| blockedDeliveries | `gold_batch_delivery_mat.blocked_flag` | `gold_batch_delivery_v` (unverified) | Unknown | Missing | Blocked status requires delivery view; not in lineage |
| customerName | `gold_batch_delivery_mat` / customer master | Not yet identified | Unknown | Missing | No customer name in lineage; requires customer master view |
| salesOrderId | `gold_batch_delivery_mat.sales_order_id` | `gold_batch_lineage.SALES_ORDER_ID` | `SALES_ORDER_ID` | Medium | Column confirmed; population on DELIVERY edges needs UAT |
| LINK_TYPE value ('DELIVERY') | V1 inspection | `gold_batch_lineage.LINK_TYPE` | `LINK_TYPE` | Medium | Value 'DELIVERY' in _LINK_TYPE_MAP from V1 inspection; live value validation pending (P0-3) |
| highestSeverity | Application code (depth + quantity rules) | Application code | — | High | Business rules not yet defined for V2; preliminary 'medium' used |
| recallRecommended | Application/manual decision | Not implemented | — | Unknown | Out of scope for this tranche |

---

## Lineage-Only First Slice (Implemented 2026-05-20)

**Decision:** Implement a bounded first slice using `gold_batch_lineage` downstream CTE with `LINK_TYPE = 'DELIVERY'` and `CUSTOMER_ID IS NOT NULL` filter. This provides customer/delivery counts and depth without requiring `gold_batch_delivery_v` column verification.

**Justification:** This is a strictly smaller slice than the full V1 parity plan. It defers all fields that require `gold_batch_delivery_v` (countries, blockedDeliveries, customer names) while providing the first live evidence of downstream customer exposure.

**What is implemented:**
- `affectedCustomers` — distinct `CUSTOMER_ID` values on DELIVERY-type edges
- `affectedDeliveries` — distinct `DELIVERY_ID` values on DELIVERY-type edges
- `shippedQuantity` — sum of `QUANTITY` on DELIVERY-type edges
- `maxExposureDepth` — minimum `hop_depth` across matching edges
- `highestSeverity: 'medium'` — preliminary; business rules not yet defined
- `countries: []` — deferred; no country column in gold_batch_lineage
- `blockedDeliveries: 0` — deferred; requires delivery view
- `recallRecommended: false` — out of scope

**Zero-rows semantics:**
Zero rows from the query → mapper returns `None` → route returns HTTP 404 with message:
> "No customer delivery records returned from current source — do not interpret as zero exposure until source coverage is validated."

This is critical: zero rows could mean no deliveries, or LINK_TYPE not matching 'DELIVERY', or CUSTOMER_ID not populated on those edges. The UI must not display "no exposure" for zero rows.

**Direct vs multi-hop exposure:**

| maxExposureDepth | Meaning |
|---|---|
| 1 | Direct shipment to customer |
| ≥ 2 | Multi-hop indirect exposure |
| absent | Depth not computed (hop_depth null in source) |

---

## Relationship to gold_batch_delivery_v Slice

**The lineage-only customer exposure slice is a preliminary exposure indicator.
V1-parity customer delivery evidence is expected to come from `gold_batch_delivery_v`.**

The `POST /api/trace2/customer-deliveries` endpoint (Scope E, in progress) queries
`gold_batch_delivery_v` directly and provides V1-parity customer delivery records including
countries, customer names, and delivery counts. See
`customer-delivery-v1-parity-source-mapping.md` for full source decision and column mapping.

Items still deferred in the lineage-only slice:
- `countries` — resolved in gold_batch_delivery_v slice (`COUNTRY_ID` column, High confidence)
- `blockedDeliveries` — no confirmed blocked-status column in gold_batch_delivery_v yet
- Severity rules beyond 'medium' preliminary — requires business rules definition
- `recallRecommended` logic — out of scope

---

## Next Steps

1. ~~Run `DESCRIBE TABLE` to confirm country column~~ — resolved: `COUNTRY_ID` confirmed High confidence
2. Confirm `MATERIAL_ID`/`BATCH_ID` WHERE keys in `gold_batch_delivery_v` via DESCRIBE TABLE
3. UAT-validate that `LINK_TYPE='DELIVERY'` edges have CUSTOMER_ID populated in live data (P0-3)
4. Assess blocked delivery column once DESCRIBE output is available
5. Update this document once DESCRIBE TABLE results are in hand
