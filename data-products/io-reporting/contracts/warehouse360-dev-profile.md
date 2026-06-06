# Warehouse360 DEV Profile Evidence Log

This is an evidence capture log for the Warehouse360 DEV validation pack.

**Outcome (2026-06-06): BLOCKED at the source-object gate.** The governed DEV
gold source layer is not deployed in the DEV workspace, so the consumption views
cannot be built and the schema/key/data-quality/contract checks cannot run. No
contract advances beyond candidate/pending. See §2 and §12–13 for detail.

> **Next validation attempt prerequisites (added 2026-06-06).** This validation
> has **not** been rerun — the result below still stands. Rerunning requires the
> IOReporting governed source layer to exist in `connected_plant_dev.gold_io_reporting`.
> A first DEV deployment baseline is now in place (bundle validated + deployed;
> see `ioreporting-dev-deployment-profile.md` and ADR
> `docs/architecture/adr-ioreporting-dev-deployment-baseline.md`), but the Silver
> → Gold pipeline runs remain blocked on DEV `central_services` reference-data
> sourcing. Until those pipelines run and the 7 source objects materialise (verify
> with `validation/warehouse360_dev_source_layer_preflight.sql` → 7/7 FOUND), all
> contracts stay candidate/blocked.
>
> **DEV is a technical shakedown only (added 2026-06-06).** `central_services` is
> externally owned and `published_dev` lacks the HU tables, so DEV now runs in
> `dev_shakedown` mode (`enable_hu_reconciliation=false`) — see ADR
> `docs/architecture/adr-ioreporting-dev-shakedown-vs-uat-validation.md`. A DEV
> shakedown can validate **deployment mechanics and non-HU contract structure**
> only (none of the 7 governed source objects depend on HU). It is **not**
> business validation — DEV data is old/limited. HU-dependent outputs are not
> materialised in DEV and remain **not business-validated until UAT**; **UAT is
> the first environment for full validation**. A green DEV shakedown does not
> imply UAT readiness or app cutover, and no contract is promoted.

Target environment:

| Field | Value |
|---|---|
| Catalog | `connected_plant_dev` |
| Schema | `gold_io_reporting` |
| Source mode | Governed IO reporting sources only |
| Legacy `wh360` dependency | Not allowed |
| Dispensary queue | Not deployed in Wave 1 |

## 1. Execution Metadata

| Field | Value |
|---|---|
| Executed by | tim.geldard@kerry.com |
| Execution date/time | 2026-06-06 18:46 UTC |
| Databricks workspace | `https://adb-3548637138127338.18.azuredatabricks.net` (DEV) |
| SQL warehouse | `connected_plant_dev` — serverless PRO, id `8fae28f1808dbf75` |
| CLI profile | `TG` |
| Git branch | `fix/imported-code-review` |
| Git commit SHA | `8cba60e3a51b6df1e3ba7fc9de8e5be00d4570c1` |

> Note: the DEV catalog `connected_plant_dev` lives in workspace
> `adb-3548637138127338.18`, **not** the default/UAT workspace
> `adb-604667594731808.8`. The catalog is not bound/visible in the UAT
> workspace, so DEV validation must be run via the `TG` profile.

## 2. Source Object Validation

Target query: `validation/warehouse360_dev_source_object_validation.sql`

Expected result: every expected source object returns `FOUND`.

**Result: 0 of 7 FOUND — all MISSING.** The schema
`connected_plant_dev.gold_io_reporting` is not present/visible to the executing
principal, so the `information_schema.tables` lookup returns zero rows.

| Source Object | Validation Status | Notes |
|---|---|---|
| `gold_warehouse_kpi_snapshot_secured` | **MISSING** | schema not present in DEV |
| `gold_inbound_po_backlog_enhanced_live` | **MISSING** | schema not present in DEV |
| `gold_delivery_pick_status_live` | **MISSING** | schema not present in DEV |
| `gold_process_order_staging_live` | **MISSING** | schema not present in DEV |
| `gold_stock_expiry_risk_live` | **MISSING** | schema not present in DEV |
| `gold_transfer_requirement_backlog` | **MISSING** | schema not present in DEV |
| `gold_warehouse_exceptions` | **MISSING** | schema not present in DEV |

```text
-- Query 1: existing source objects in gold_io_reporting
(0 rows)

-- Query 2: required source object status
table_name                              | validation_status
gold_delivery_pick_status_live          | MISSING
gold_inbound_po_backlog_enhanced_live   | MISSING
gold_process_order_staging_live         | MISSING
gold_stock_expiry_risk_live             | MISSING
gold_transfer_requirement_backlog       | MISSING
gold_warehouse_exceptions               | MISSING
gold_warehouse_kpi_snapshot_secured     | MISSING
```

Corroborating context (ad-hoc probes, same workspace/warehouse):

- `connected_plant_dev` is accessible in the DEV workspace; `SHOW CATALOGS`
  lists it alongside `published_dev`, `system`, etc.
- Schemas present in `connected_plant_dev`: `sap`, `silver`, `silver_tables`,
  `gold`, `gold_tables`, `csm_*`, `graph*`, `tulip*`, `scratch`, `unit_test`, …
  **`gold_io_reporting` and `gold_dev` are NOT present.**
- A catalog-wide search for the 7 governed source-object names across **all**
  schemas returned **0 rows** — they do not exist under any schema in DEV.
- The legacy `gold` schema (63 tables) holds general process/quality/inventory
  gold tables (`gold_process_order`, `gold_stock`, `gold_material`, …); it
  contains **no** Warehouse360 warehouse/inbound/delivery/staging/expiry/
  transfer/exception aggregates.

## 3. Source Column Validation

Target query: `validation/warehouse360_dev_source_column_validation.sql`

Expected result: every expected source column returns `FOUND`.

**Result: every expected source column returns MISSING** (NULL `data_type` /
NULL `is_nullable`), which is the direct consequence of the source tables not
existing. No column-name mismatch could be assessed because there are no live
source objects to compare against.

```text
table_name                              | column_name                | data_type | is_nullable | validation_status
gold_delivery_pick_status_live          | actual_goods_issue_date    | NULL      | NULL        | MISSING
gold_delivery_pick_status_live          | ... (all 14 columns)       | NULL      | NULL        | MISSING
gold_inbound_po_backlog_enhanced_live   | ... (all 18 columns)       | NULL      | NULL        | MISSING
gold_process_order_staging_live         | ... (all 16 columns)       | NULL      | NULL        | MISSING
gold_stock_expiry_risk_live             | ... (all 8 columns)        | NULL      | NULL        | MISSING
gold_transfer_requirement_backlog       | ... (all 5 columns)        | NULL      | NULL        | MISSING
gold_warehouse_exceptions               | ... (all 11 columns)       | NULL      | NULL        | MISSING
gold_warehouse_kpi_snapshot_secured     | ... (all 10 columns)       | NULL      | NULL        | MISSING
-- 82 expected (table, column) pairs, all MISSING.
```

## 4. Consumption View Deployment

Target SQL: `resources/sql/warehouse360_consumption_views_dev.sql`

**NOT EXECUTED — intentionally gated.** Per the validation runbook rule ("if any
source object is missing, stop before deploying views unless the fix is an
obvious naming correction"), deployment was not attempted: all 7 source objects
are missing and there is no obvious naming correction (the source schema is
absent entirely). Running the deploy would only produce
`TABLE_OR_VIEW_NOT_FOUND` on every `CREATE OR REPLACE VIEW`.

`vw_consumption_warehouse360_dispensary_queue` remains correctly **not deployed**
in the DEV consumption SQL (it is documented as `not_runtime_ready`, source/grain
unconfirmed) — verified by inspection of the SQL file, which contains only a
commented placeholder for it.

### Wiring inconsistency discovered (decision required — see §12)

Even once a DEV gold layer is built, the consumption views as written would not
resolve their sources:

- The DEV gold build artifacts `resources/sql/gold_serving_views_dev.sql` and
  `resources/sql/gold_security_dev.sql`, and the bundle `dev_*` targets in
  `databricks.yml` (`gold_schema: gold_dev`), materialise the governed gold
  objects into **`connected_plant_dev.gold_dev`**.
- But `warehouse360_consumption_views_dev.sql` reads its sources from
  **`connected_plant_dev.gold_io_reporting`** (7 `FROM` clauses).
- UAT is internally consistent: the UAT bundle `gold_schema` *is*
  `gold_io_reporting`, and `warehouse360_consumption_views_uat.sql` reads from
  `connected_plant_uat.gold_io_reporting`.

So the DEV consumption file appears to have inherited `gold_io_reporting` from
the UAT template without switching the source schema to the DEV convention
(`gold_dev`). This is **not** corrected here: choosing whether DEV standardises
on `gold_io_reporting` (matching UAT/prod) or the consumption views repoint to
`gold_dev` is an architecture/product-owner decision, and neither schema can be
profiled because neither is deployed.

## 5. View Existence Verification

Target query: `validation/warehouse360_dev_schema_validation.sql`

**NOT EXECUTED — blocked upstream.** The views were never deployed (§4), so none
exist. Marked blocked, not failed.

| Table Name | Type | Verified |
|---|---|---|
| `vw_consumption_warehouse360_overview` | VIEW | Blocked (not deployed) |
| `vw_consumption_warehouse360_inbound_backlog` | VIEW | Blocked (not deployed) |
| `vw_consumption_warehouse360_outbound_backlog` | VIEW | Blocked (not deployed) |
| `vw_consumption_warehouse360_staging_workload` | VIEW | Blocked (not deployed) |
| `vw_consumption_warehouse360_stock_exceptions` | VIEW | Blocked (not deployed) |
| `vw_consumption_warehouse360_shortfalls` | VIEW | Blocked (not deployed) |
| `vw_consumption_warehouse360_im_wm_reconciliation` | VIEW | Blocked (not deployed) |

## 6. View Columns and Data Types

Target query: `validation/warehouse360_dev_schema_validation.sql`

**NOT EXECUTED — blocked upstream** (no views to introspect).

## 7. Key Uniqueness Verification

Target query: `validation/warehouse360_dev_key_validation.sql`

**NOT EXECUTED — blocked upstream.** Primary-key uniqueness cannot be proven for
any contract until the source layer and views exist.

| View Name | Total Rows | Distinct Key Count | Duplicate Key Count |
|---|---|---|---|
| `vw_consumption_warehouse360_overview` | — | — | Blocked |
| `vw_consumption_warehouse360_inbound_backlog` | — | — | Blocked |
| `vw_consumption_warehouse360_outbound_backlog` | — | — | Blocked |
| `vw_consumption_warehouse360_staging_workload` | — | — | Blocked |
| `vw_consumption_warehouse360_stock_exceptions` | — | — | Blocked |
| `vw_consumption_warehouse360_shortfalls` | — | — | Blocked |
| `vw_consumption_warehouse360_im_wm_reconciliation` | — | — | Blocked |

## 8. Required-Key Nullability Verification

Target query: `validation/warehouse360_dev_data_quality_validation.sql`

**NOT EXECUTED — blocked upstream.** `plant_id` non-nullness (canonical plant
scope, required for row-level filtering) cannot be proven for any view. Treated
as **unproven / blocking** for every plant-scoped contract until re-run.

## 9. Date, Time, and Freshness Findings

Target query: `validation/warehouse360_dev_data_quality_validation.sql`

**NOT EXECUTED — blocked upstream.** Freshness is indeterminate (no
`snapshot_ts` data exists to measure).

| View Name | Finding | Decision |
|---|---|---|
| `vw_consumption_warehouse360_overview` | Blocked (no data) | Re-test after source build |

## 10. Contract Compatibility

Target query: `validation/warehouse360_dev_contract_validation.sql`

**NOT EXECUTED — blocked upstream.** Required contract-field presence and type
compatibility cannot be confirmed for any contract.

## 11. Sample Rows Capture

Target query: `validation/warehouse360_dev_data_quality_validation.sql`

**NOT EXECUTED — blocked upstream** (no rows exist).

## 12. Failures and Corrections Log

| Failure Description | Severity | Resolution Action | Re-test Result |
|---|---|---|---|
| Governed DEV gold source layer not deployed — schema `connected_plant_dev.gold_io_reporting` (and `gold_dev`) absent; 0/7 source objects exist anywhere in `connected_plant_dev`. | **Blocking** | Deploy the IO-reporting gold layer to DEV (gold pipeline `data-products/io-reporting/gold/*.py` + `resources/sql/gold_serving_views_dev.sql` + `resources/sql/gold_security_dev.sql`) so the 7 governed sources materialise. | Pending re-run |
| Source-schema mismatch: DEV gold build + bundle target `gold_dev`, but `warehouse360_consumption_views_dev.sql` reads `gold_io_reporting`. | **Blocking** | Architecture/product-owner decision: standardise DEV on `gold_io_reporting` (match UAT/prod) **or** repoint DEV consumption views to `gold_dev`. Not corrected unilaterally — no live schema to confirm against. | Pending decision |
| No evidence-driven SQL/column/type/key corrections were warranted. | Info | None — there is no live schema to validate column names, casts, `plant_id` aliases, or candidate keys against. | n/a |

## 13. Contract Status Recommendation

All seven Warehouse360 contracts remain **candidate / pending DEV profiling** —
none can advance to "ready for DEV app test" because their views are not
deployed and no row-level evidence (plant scope, keys, freshness) exists.

| Contract | Recommended Status | Rationale |
|---|---|---|
| `warehouse360.overview` | Candidate / blocked | Source `gold_warehouse_kpi_snapshot_secured` missing; view not deployed |
| `warehouse360.inbound_backlog` | Candidate / blocked | Source `gold_inbound_po_backlog_enhanced_live` missing; view not deployed |
| `warehouse360.outbound_backlog` | Candidate / blocked | Source `gold_delivery_pick_status_live` missing; view not deployed |
| `warehouse360.staging_workload` | Candidate / blocked | Source `gold_process_order_staging_live` missing; view not deployed |
| `warehouse360.stock_exceptions` | Candidate / blocked | Source `gold_stock_expiry_risk_live` missing; view not deployed |
| `warehouse360.shortfalls` | Candidate / blocked | Source `gold_transfer_requirement_backlog` missing; view not deployed |
| `warehouse360.im_wm_reconciliation` | Candidate / blocked | Source `gold_warehouse_exceptions` missing; view not deployed |
| `warehouse360.dispensary_queue` | Draft / not_runtime_ready | Correctly excluded from Wave 1; source/grain unconfirmed |

## 14. Recommended Next Actions

1. **Deploy the DEV governed gold layer.** Run the IO-reporting gold pipeline
   (`data-products/io-reporting/gold/*.py`) and the gold serving/security SQL
   (`gold_serving_views_dev.sql`, `gold_security_dev.sql`) against the DEV
   workspace so the 7 governed source objects exist.
2. **Resolve the source-schema decision** (`gold_io_reporting` vs `gold_dev` in
   DEV) before re-running, so the consumption views resolve their sources.
3. **Re-run this validation pack** (`TG` profile, warehouse `8fae28f1808dbf75`)
   in order: source object → source column → deploy consumption views → schema →
   key → data quality → contract compatibility.
4. Only then assess per-contract readiness against the decision rules (views
   compile, required fields present, `plant_id` non-null, candidate keys unique).
