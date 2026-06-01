# Plant-Filtering Methodology: UAT `csm_process_order_history` vs. IOReporting repo

> **Status:** Analysis + recommendation. **Date:** 2026-06-01.
> No repo changes are proposed for immediate implementation; the items in the Recommendation and
> Verification sections are decisions/validations to run with the platform & governance teams.

> [!TODO]
> **Open decision — review required.** Review this comparison and decide the repo's plant-security
> direction before any Gold/consumption work is deployed to a shared catalog. Choose one of:
> (a) **hybrid** — engine-enforced UC row filter on Silver + enterprise `published.security.model`
> view layer on Gold (recommended); or (b) **fully view-based** to match the platform's current
> zero-row-filter standard. Owner: _TBD_. Target date: _TBD_. The Verification checklist below must
> be cleared with the platform & governance teams before the decision is finalised.

## Context

The IOReporting repo secures plant data with a **Unity Catalog ROW FILTER** function bound to
Silver base tables, sourced from a SCIM user attribute (`allowed_plants`). Meanwhile, the live
UAT workspace already runs a **different, enterprise-governed** plant-filtering pattern for the
`connected_plant_uat.csm_process_order_history` consumption model. This document compares the two,
traces the ownership/lineage of the UAT objects, and recommends how the repo should align.

All UAT findings below were read live from the `uat` profile
(`adb-604667594731808.8.azuredatabricks.net`) on 2026-06-01.

---

## What the UAT consumption model actually is

`connected_plant_uat.csm_process_order_history` is a **schema** (a "consumption model", `csm_` =
consumable semantic model), not a single view. It contains a plant-filter view plus ~23 `vw_gold_*`
consumption views. Sibling consumption schemas exist: `csm_batch_traceability`, `csm_equipment_history`.

**Filtering is embedded in each view** as a correlated predicate. Representative
(`vw_gold_process_order`):

```sql
SELECT * FROM connected_plant_uat.gold.gold_process_order
WHERE EXISTS (
    SELECT 1 FROM published_uat.security.model
     WHERE current_user() = email
       AND application_key = "process_order_history"
       AND LOWER(access_type) IN ("full view")
  UNION ALL
    SELECT 1 FROM published_uat.security.model
     WHERE current_user() = email
       AND application_key = "process_order_history"
       AND LOWER(access_type) IN ("filter")
       AND array_contains(filter_plant, PLANT_ID)
)
```

- `published_uat.security.model` is a view = `SELECT * FROM security_uat.model.data`.
- Its columns are an **enterprise multi-dimensional ACL**: `email`, `application_key`, `access_type`,
  and arrays `filter_eum_level_1..3`, `filter_region`, `filter_subregion`, `filter_territory`,
  `filter_country`, `filter_cluster`, `filter_core_technology`, `filter_product_group`,
  `filter_mtl_group_*`, `filter_ops_mgmt_*`, **`filter_plant`**, `employees`.
- The current account **lacks `USE CATALOG` on `security_uat`** — the policy store is owned and
  governed centrally, outside this project.

### Lineage / ownership (traced)
- `connected_plant_uat.gold` is a **shared, multi-producer schema**.
- The base `gold_*` tables behind the `csm_*` views (e.g. `gold_process_order`, `gold_material`,
  `gold_confirmation`, `gold_adp_movement`, all `gold_inspection_*`) are owned by service principal
  **`sp_connected_plant_uat`** (`ff1a28ca-…`) — the platform/ingestion deployment. Schema uses
  UPPER_CASE `*_ID` naming + `__BATCH_ID/__CREATED_ON/__UPDATED_ON` system columns.
- The `csm_*` schemas/views are owned by SP `79797a04-…`.
- The user (`tim.geldard`) owns a **parallel analytical layer** in the same schema: `spc_*`,
  `metric_*` MVs, `gold_batch_*_v` views, `em_*`, plus a hand-rolled **`user_plant_assignments`**
  table (`user_email, plant_id, created_at`) — a *third* ad-hoc plant-security source.

### Deployment-status findings (verified live — important reframing)
- **The IOReporting repo is not deployed in this UAT workspace at all.** Its Gold table names
  (`gold_shift_output_summary`, `gold_order_otif_metrics`, …) are absent, and its Silver is absent:
  `connected_plant_uat.silver` holds 47 **`silver_*`-prefixed** platform tables
  (`silver_process_order`, `silver_material`, …), **not** the repo's bare-named tables
  (`process_order`, `material`, …). `connected_plant_uat.silver.process_order` does not exist.
- **No row filter is applied to any table in `connected_plant_uat`** (`information_schema.row_filters`
  is empty). The platform secures data **exclusively** via the view pattern. The repo's
  `plant_access_filter` function does **not** exist anywhere in the catalog.
- A *fourth* pattern exists: a user-authored UDF `connected_plant_uat.gold.user_has_plant_access`
  over `user_plant_assignments`. Two problems: (a) it is **not bound as a row filter** to anything,
  and (b) it has a real bug — its body is `… WHERE user_email = CURRENT_USER() AND plant_id =
  plant_id …`, a self-comparison that is always true, so it grants access to *any* plant for any user
  who has *any* assignment (the intended parameter is shadowed by the table column).
- **Consequence:** the comparison below is between a **deployed reality** (UAT view pattern) and the
  repo's **design as written** (UC row filters). That asymmetry is stated explicitly rather than
  implied.

---

## Compare & contrast

| Axis | IOReporting repo (**as designed — not deployed in UAT**) | UAT `csm_process_order_history` (**deployed reality**) |
|---|---|---|
| Enforcement point | UC `ROW FILTER` fn on **Silver base tables** (`ALTER TABLE … SET ROW FILTER`) | Predicate embedded in **consumption views** over **Gold base tables** |
| Enforcement strength | **Engine-enforced by design** — every query path to the base table would be filtered (currently 0 row filters exist in UAT) | **Secure-by-grant/convention** — only safe if consumers get the `csm_*` views and *not* the base `gold_*` tables |
| Policy source of truth | SCIM attribute `current_user_attribute('allowed_plants')` (comma string) + admin group bypass + `SHARED` plant | Governed table `security_uat.model.data` via `published_uat.security.model`, matched on `current_user()` email |
| Dimensions | **Plant only** (single, binary in/out) | **Multi-dimensional** (plant, region, cluster, EUM levels, material groups, ops-mgmt hierarchy, employees) |
| Access modes | in-list / admin-all / SHARED | explicit `full view` vs `filter` per `application_key` |
| Multi-product consistency | Bespoke to this pipeline | `application_key` namespacing → one policy store serves many products consistently |
| Gold/MV security | **Disabled by default** ("trusted layer"; row filters force full MV refresh) → leaves a Gold gap | Native — predicate in view does not break MV refresh |
| Data model / naming | snake_case, raw/display key pairs (`order_number`/`order_number_raw`), `plant_code`, SCD1 streaming | UPPER_CASE `*_ID`, `__`-prefixed system cols |
| Policy/code coupling | Generated SQL (`scripts/generate_row_filter_sql.py`) — versioned, reproducible | Hand-written view SQL — flexible but drift-prone; policy lives in a governed table, decoupled from code |

**Net:** the repo's approach is *stronger at the base table* (engine-enforced, single dimension);
the UAT approach is *richer and enterprise-consistent at the consumption boundary* (multi-dimension,
centrally governed) but relies on grants to be airtight.

---

## Recommendation

**Adopt a hybrid that keeps the repo's engine-enforced Silver floor and aligns the Gold/consumption
boundary with the enterprise pattern.** Concretely (this is forward-looking design guidance — the
repo isn't deployed in UAT yet, so there is freedom to choose before facts on the ground harden):

1. **Keep the UC row filter on Silver** as defense-in-depth — it is the one place that is
   unavoidable for ad-hoc/direct reads, which the enterprise view pattern does not protect.
2. **Close the Gold gap by aligning with the enterprise model, not the bespoke attribute.** Replace
   the repo's "trusted Gold + downstream grants" stance (current gap) with a **`csm_`-style
   consumption-view layer** over the repo's Gold tables that embeds the
   `published_uat.security.model` predicate under its **own `application_key`** (e.g.
   `io_reporting`). Lock down direct grants on the raw repo Gold tables so the views are the only
   path. This is consistent with how the rest of Connected Plant is already secured.
3. **Converge the policy source of truth.** Prefer `security_uat.model.data` (the governed,
   multi-dimensional store) over the SCIM `allowed_plants` attribute *and* over the ad-hoc
   `user_plant_assignments` table. Three (now four) competing sources is the real risk. If the
   Silver row filter should also be governed, having `plant_access_filter` resolve against the same
   governance source is **a feasibility check, not a settled recommendation**: row-filter UDFs run
   under the function-owner's identity/privilege model, and this account was **denied `USE CATALOG`
   on `security_uat`** — so a row-filter UDF referencing the governed model may not be grantable the
   way the SP-owned consumption views are. Validate before designing around it.
   - **Also fix or retire the buggy `gold.user_has_plant_access` UDF** (`plant_id = plant_id` no-op);
     in its current form it would grant cross-plant access if ever applied.
4. **Decide the Gold publishing target & contract.** If the repo's Gold is meant to be consumed
   alongside the platform model in `connected_plant_uat.gold`, reconcile naming conventions
   (`*_ID`/UPPER_CASE vs `*_code`/`*_raw`) and request `application_key` provisioning from the
   governance team. If it stays in a separate schema, document that it is a parallel product.
5. **Retire `user_plant_assignments`** once the governed model covers the repo's needs.

**Why this over "just switch the repo to the UAT pattern wholesale":** the UAT pattern alone is only
as safe as its grants — and `connected_plant_uat.gold` is already a shared schema with many owners,
exactly the scenario where a stray grant bypasses view-level filtering. Keeping Silver hard-filtered
preserves a guarantee the view pattern cannot give, while adopting the enterprise model at Gold buys
consistency and multi-dimensional governance the repo lacks today.

**Honest counter-weight:** UAT today has **zero row filters** and secures everything via views, so a
Silver row filter would make the repo the *only* row-filter user in the catalog — an operational
divergence the platform team may not want to support, and one that depends on the
`current_user_attribute` ABAC source being maintained. If consistency with the platform is valued
above base-table hard-enforcement, the alternative is to go **fully view-based like UAT** and rely on
locked-down grants on the base tables. The decision hinges on how much you trust grant hygiene on a
shared Gold schema vs. the cost of being the lone row-filter product. Recommend the hybrid, but
surface this trade-off explicitly to the platform/governance owners.

---

## Verification / how to confirm before acting

- **Confirm the `application_key` story:** ask the governance team which `application_key`(s) the
  repo's reporting should use and whether a new one can be provisioned in `security_uat.model.data`.
- **Confirm grant posture:** `SHOW GRANTS ON SCHEMA connected_plant_uat.gold` and on representative
  `gold_*` base tables, to prove whether the `csm_*` view layer is actually the only consumer path
  today (tests whether "secure-by-grant" currently holds).
- **Confirm MV-refresh claim:** validate the repo's premise that a UC row filter on a Gold MV forces
  full refresh, on a throwaway table, before committing to the view-layer approach for Gold.
- **Confirm Silver↔governance parity:** compare a sample user's `allowed_plants` SCIM attribute vs
  their `filter_plant` in `published_uat.security.model` — divergence proves the drift risk that
  motivates converging the source of truth.
