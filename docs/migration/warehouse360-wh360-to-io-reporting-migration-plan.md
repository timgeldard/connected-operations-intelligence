# Warehouse360 Migration Plan — Legacy `wh360` to IOReporting Data Product

## Purpose

This plan describes how to migrate Warehouse360 from the legacy UAT-only `wh360` views to a properly governed IOReporting data-product serving layer.

The original Warehouse360 app and its supporting `wh360` views were deployed in **UAT only**. The new implementation will be built correctly through the landscape:

```text
DEV data product → DEV app → UAT data product → UAT app → PROD
```

The legacy `wh360` views are retained only as a comparison baseline during migration. They are not the target architecture.

---

## Confirmed Decisions

| Topic | Decision |
|---|---|
| DEV target schema | `connected_plant_dev.gold_io_reporting` |
| DEV data profile | Configuration should mostly exist because config is set up in DEV and transported through the landscape. Transactional data will be limited and old. |
| Consumption view pattern | Use `vw_consumption_*` views. These may serve Databricks dashboards as well as the app. |
| Canonical plant field | `plant_id` |
| Migration scope | Warehouse360 only |
| Business grain owner | Tim / product owner |
| Key design | Avoid truly keyless views; follow best practice |
| Deployment path | DEV data product → DEV app → UAT data product → UAT app → PROD |

---

# 1. Target Architecture

## 1.1 Legacy State

The current imported Warehouse360 app points to UAT-only legacy views:

```text
connected_plant_uat.wh360.*
        ↓
Warehouse360 API adapter
        ↓
Warehouse360 React workspace
```

Example legacy objects include:

```text
connected_plant_uat.wh360.wh360_kpi_snapshot_v
connected_plant_uat.wh360.wh360_inbound_v
connected_plant_uat.wh360.wh360_deliveries_v
connected_plant_uat.wh360.wh360_process_orders_v
connected_plant_uat.wh360.imwm_exceptions_v
```

These views were useful for the original app, but they are not the target contract layer.

## 1.2 Target State

The new target is a governed IOReporting data-product serving layer in DEV first:

```text
connected_plant_dev.gold_io_reporting
        ↓
internal governed gold/live/secured views
        ↓
vw_consumption_warehouse360_*
        ↓
contract manifest
        ↓
QuerySpec(contract_id=...)
        ↓
Warehouse360 API adapter
        ↓
Warehouse360 React workspace / Databricks dashboards
```

Application code and dashboards should consume:

```text
connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_*
```

Application code and dashboards should not consume:

```text
connected_plant_dev.gold_io_reporting.gold_*_live
connected_plant_dev.gold_io_reporting.gold_*_secured
connected_plant_uat.wh360.*
bronze.*
silver.*
raw SAP tables
```

The `vw_consumption_*` views are the product API for Warehouse360.

---

# 2. Migration Principles

## 2.1 Do Not Contract the Old `wh360` Views

The old `wh360` views are a baseline for comparison only. They should not define the new contract.

Known issues in the legacy views include:

- unclear grain
- duplicate natural keys
- nullable plant fields
- string-typed dates
- global or keyless snapshots
- app-specific rather than product-level naming
- UAT-only deployment history

The new model should fix these issues rather than reproduce them.

## 2.2 Consumption Views Are Shared Serving Assets

The `vw_consumption_warehouse360_*` views are intended for:

```text
Warehouse360 app
Databricks dashboards
future semantic / Genie-safe views where appropriate
```

This means they must be stable, documented, governed, keyable, fresh enough for operational use, safe for plant-level access control, understandable to dashboard authors, and not tightly coupled to React or FastAPI implementation details.

## 2.3 `plant_id` Is the Canonical Plant Scope Field

All Warehouse360 consumption views should include:

```text
plant_id
```

Rules:

- `plant_id` must be non-null for plant-scoped records.
- `plant_id` must be the standard row-level security and dashboard filtering field.
- If a source does not naturally provide `plant_id`, the data product must derive or enrich it before exposure.
- Do not expose records into app-facing views where plant scope cannot be determined unless explicitly marked as global scope.

Recommended optional fields:

```text
plant_name
warehouse_id
storage_location_id
```

## 2.4 Avoid Truly Keyless Views

Every consumption view should have a defined grain and stable primary key.

Even summary/overview views should not be keyless. Use an explicit key such as:

```text
plant_id + snapshot_ts
```

or, for global views if absolutely necessary:

```text
scope_id + snapshot_ts
```

Recommended pattern for global scope:

```text
scope_id = 'GLOBAL'
snapshot_ts = timestamp of snapshot generation
```

For Warehouse360, plant-level overview is preferred.

---

# 3. Scope

## 3.1 In Scope

This migration covers Warehouse360 only.

Included capabilities:

```text
Warehouse overview
Inbound backlog
Outbound backlog
Staging workload
Stock exceptions
Shortfalls
IM/WM reconciliation
Dispensary queue, if required for Wave 1
```

Included technical areas:

```text
DEV data product deployment
DEV consumption views
Warehouse360 contracts
API QuerySpec contract_id support
Warehouse360 adapter migration
DEV app validation
UAT promotion
UAT comparison with legacy wh360
PROD readiness
```

## 3.2 Out of Scope

The following are out of scope for this migration wave:

```text
Traceability migration
Process order history migration
Quality/SPC migration
Environmental monitoring migration
Genie semantic model build-out
Full replacement of all existing gold models
Full DEV transactional data remediation
```

These domains should follow the Warehouse360 pattern later.

---

# 4. Target Warehouse360 Consumption Views

## 4.1 Recommended View Set

Create the following views in:

```text
connected_plant_dev.gold_io_reporting
```

| View | Purpose |
|---|---|
| `vw_consumption_warehouse360_overview` | Plant/warehouse operational KPI summary |
| `vw_consumption_warehouse360_inbound_backlog` | Open inbound PO/STO workload and risk |
| `vw_consumption_warehouse360_outbound_backlog` | Outbound deliveries and pick/despatch risk |
| `vw_consumption_warehouse360_staging_workload` | Production staging workload and readiness |
| `vw_consumption_warehouse360_stock_exceptions` | Stock risks, blocked stock, expiry, mismatch, or exception stock |
| `vw_consumption_warehouse360_shortfalls` | Material/staging shortfalls requiring warehouse action |
| `vw_consumption_warehouse360_im_wm_reconciliation` | IM/WM discrepancies and reconciliation exceptions |
| `vw_consumption_warehouse360_dispensary_queue` | Dispensary workload if required for Warehouse360 Wave 1 |

## 4.2 Expected Internal Source Mapping

The exact internal source views must be confirmed during DEV deployment and profiling.

Initial target mapping:

| Consumption view | Likely governed source |
|---|---|
| `vw_consumption_warehouse360_outbound_backlog` | `gold_delivery_pick_status_live` |
| `vw_consumption_warehouse360_staging_workload` | `gold_process_order_staging_live` |
| `vw_consumption_warehouse360_inbound_backlog` | `gold_inbound_po_backlog_enhanced_live` |
| `vw_consumption_warehouse360_stock_exceptions` | `gold_stock_expiry_risk_live` |
| `vw_consumption_warehouse360_shortfalls` | `gold_transfer_requirement_backlog` |
| `vw_consumption_warehouse360_overview` | new KPI rollup view or materialized view |
| `vw_consumption_warehouse360_im_wm_reconciliation` | reconciliation exception source |
| `vw_consumption_warehouse360_dispensary_queue` | TBD |

---

# 5. Required View Design Standards

Each `vw_consumption_warehouse360_*` view must meet the following standards.

## 5.1 Required Metadata Fields

| Field | Requirement |
|---|---|
| `plant_id` | Required, non-null for plant-scoped records |
| `snapshot_ts` | Required for snapshot-style views |
| `source_updated_ts` | Required where available |
| `data_freshness_ts` | Required or derivable |
| `record_source` | Recommended |
| `source_system` | Recommended, e.g. `SAP_ECC` |
| `view_version` | Recommended for controlled migration |

## 5.2 Required Grain Documentation

Every view must explicitly state its grain.

| View | Preferred grain |
|---|---|
| `vw_consumption_warehouse360_overview` | one row per `plant_id` + `snapshot_ts`, optionally `warehouse_id` |
| `vw_consumption_warehouse360_inbound_backlog` | one row per `plant_id` + purchasing document + item + schedule/grain decision |
| `vw_consumption_warehouse360_outbound_backlog` | one row per `plant_id` + delivery, or delivery item if required |
| `vw_consumption_warehouse360_staging_workload` | one row per `plant_id` + process order + staging component/task |
| `vw_consumption_warehouse360_stock_exceptions` | one row per `plant_id` + material + batch + storage location/bin + exception type |
| `vw_consumption_warehouse360_shortfalls` | one row per `plant_id` + process order/material or transfer requirement |
| `vw_consumption_warehouse360_im_wm_reconciliation` | one row per `plant_id` + material/batch/storage location/bin + exception type |
| `vw_consumption_warehouse360_dispensary_queue` | one row per `plant_id` + process order + component/dispensary task |

The business grain decisions are owned by Tim / the product owner.

## 5.3 Required Primary Key

Every contract must have a primary key. Avoid keyless views.

Example candidate keys:

```text
overview:
plant_id + snapshot_ts

inbound_backlog:
plant_id + purchasing_document_id + purchasing_document_item_id + schedule_line_id

outbound_backlog:
plant_id + delivery_id

staging_workload:
plant_id + process_order_id + component_id + reservation_item_id

stock_exceptions:
plant_id + material_id + batch_id + storage_location_id + exception_type

shortfalls:
plant_id + process_order_id + material_id + requirement_id

im_wm_reconciliation:
plant_id + material_id + batch_id + storage_location_id + bin_id + exception_type

dispensary_queue:
plant_id + process_order_id + component_id + task_id
```

These are examples only. Actual keys must be verified in DEV.

## 5.4 Date and Timestamp Rules

Avoid app-facing date fields typed as strings.

Preferred types:

```text
DATE
TIMESTAMP
```

Required timestamp handling:

- SAP date/time fields should be converted into typed dates/timestamps where feasible.
- Operational cut-off calculations should use typed timestamps.
- Consumption views should not require frontend/API code to parse SAP date strings.
- All freshness fields should be timestamp-based.

## 5.5 Freshness Rules

Suggested starting freshness targets:

| Contract | Expected | Warning | Critical |
|---|---:|---:|---:|
| `warehouse360.overview` | 15 min | 30 min | 60 min |
| `warehouse360.inbound_backlog` | 30 min | 60 min | 120 min |
| `warehouse360.outbound_backlog` | 15 min | 30 min | 60 min |
| `warehouse360.staging_workload` | 15 min | 30 min | 60 min |
| `warehouse360.stock_exceptions` | 30 min | 60 min | 120 min |
| `warehouse360.shortfalls` | 15 min | 30 min | 60 min |
| `warehouse360.im_wm_reconciliation` | 30 min | 60 min | 120 min |
| `warehouse360.dispensary_queue` | 15 min | 30 min | 60 min |

These targets should be adjusted after DEV performance and cost testing.

---

# 6. Phase Plan

## Phase 1 — DEV Data Product Deployment

### Objective

Deploy the governed IOReporting data-product layer to DEV.

### Target

```text
connected_plant_dev.gold_io_reporting
```

### Tasks

1. Confirm Databricks bundle target for DEV.
2. Confirm DEV catalog and schema permissions.
3. Deploy IOReporting bundle to DEV.
4. Deploy required Silver and Gold dependencies.
5. Deploy internal `gold_*_live` and/or `_secured` views.
6. Create Warehouse360 `vw_consumption_*` views.
7. Apply DEV grants and row-level security.
8. Validate schema existence using `information_schema`.
9. Capture object inventory.

### Exit Criteria

```text
connected_plant_dev.gold_io_reporting exists
required internal views exist
required vw_consumption_warehouse360_* views exist
views are queryable in DEV
plant_id exists and is non-null where required
basic row counts are captured
```

## Phase 2 — DEV Profiling and Grain Validation

### Objective

Confirm the actual shape of the new DEV views before authoring contracts.

### Tasks

For each `vw_consumption_warehouse360_*` view:

1. Capture row count.
2. Capture column list and data types.
3. Validate nullability of `plant_id`.
4. Validate candidate primary key uniqueness.
5. Confirm business grain.
6. Identify duplicate records.
7. Identify stale source timestamps.
8. Compare core measures to legacy UAT where meaningful.
9. Document limitations caused by old/limited DEV transactional data.

### Required Output

Create:

```text
data-products/io-reporting/contracts/warehouse360-dev-profile.md
```

### Exit Criteria

```text
all Warehouse360 views profiled
grain is documented
primary keys are verified or gaps recorded
plant_id is validated
known DEV data limitations are documented
```

## Phase 3 — Consumption View Refinement

### Objective

Fix DEV view issues before contracts are written.

### Expected Fix Types

```text
add plant_id enrichment
add snapshot_ts
convert string dates to typed dates/timestamps
add surrogate key where justified
split mixed-grain views
aggregate overly detailed views
rename fields to contract-friendly names
remove app-specific fields where inappropriate
add freshness fields
```

### Exit Criteria

```text
each consumption view has stable grain
each view has a primary key
each view has non-null plant_id where plant-scoped
each view has usable freshness metadata
each view is suitable for both app and dashboard consumption
```

## Phase 4 — Warehouse360 Contract Authoring

### Objective

Author contracts against the DEV `vw_consumption_warehouse360_*` views.

### Contract IDs

```text
warehouse360.overview
warehouse360.inbound_backlog
warehouse360.outbound_backlog
warehouse360.staging_workload
warehouse360.stock_exceptions
warehouse360.shortfalls
warehouse360.im_wm_reconciliation
warehouse360.dispensary_queue
```

### Contract Requirements

Each contract must include:

```text
id
version
domain
owner
consumer
source_view
lifecycle
grain
primary_key
freshness
access_policy
columns
```

### Source View Rule

Contracts must point to:

```text
vw_consumption_warehouse360_*
```

not:

```text
wh360_*
gold_*_live
gold_*_secured
```

### Exit Criteria

```text
all Wave 1 Warehouse360 contracts authored
contracts validate
source_view names use vw_consumption_* convention
primary keys match verified DEV profile
plant_id is the access policy row-level key
```

## Phase 5 — API Contract Binding

### Objective

Make Warehouse360 API routes use contract IDs rather than direct object names.

### Current Gap

The current query path uses `QuerySpec` / resolver abstractions but is not yet contract-bound.

### Target Pattern

```text
Warehouse360 route
        ↓
Warehouse360 adapter
        ↓
QuerySpec(contract_id="warehouse360.inbound_backlog")
        ↓
contract manifest
        ↓
source_view = vw_consumption_warehouse360_inbound_backlog
        ↓
object resolver
        ↓
Databricks execution
```

### Tasks

1. Add `contract_id` to `QuerySpec`.
2. Add contract manifest lookup to the query service.
3. Resolve physical object names from contract metadata.
4. Refactor Warehouse360 adapter to use contract IDs.
5. Keep legacy object-name mode temporarily behind a feature flag.
6. Add unit tests proving Warehouse360 uses contract IDs.
7. Add a contract coverage CI check.

### Feature Flag

```text
WAREHOUSE360_SOURCE_MODE=legacy_wh360 | governed_contracts
```

DEV default:

```text
WAREHOUSE360_SOURCE_MODE=governed_contracts
```

UAT initial default:

```text
WAREHOUSE360_SOURCE_MODE=legacy_wh360
```

UAT after cutover:

```text
WAREHOUSE360_SOURCE_MODE=governed_contracts
```

### Exit Criteria

```text
Warehouse360 adapter no longer requires wh360 object names in governed mode
all Warehouse360 routes use contract IDs in DEV
unit tests prove contract usage
boundary check still passes
contract coverage check passes
```

## Phase 6 — DEV App Validation

### Objective

Run Warehouse360 in DEV against the new data product.

### Tasks

1. Deploy DEV API with governed contract mode enabled.
2. Deploy DEV frontend/app.
3. Run API smoke tests.
4. Run browser smoke tests.
5. Validate all Warehouse360 routes.
6. Validate Databricks dashboard compatibility with the same views.
7. Record known differences due to limited/old DEV transactional data.
8. Confirm stale/empty states are presented honestly.

### DEV Acceptance Checks

| Area | Check |
|---|---|
| Overview | renders from `warehouse360.overview` |
| Inbound | renders from `warehouse360.inbound_backlog` |
| Outbound | renders from `warehouse360.outbound_backlog` |
| Staging | renders from `warehouse360.staging_workload` |
| Exceptions | renders from `warehouse360.im_wm_reconciliation` |
| Stock exceptions | dashboard/app query succeeds |
| Shortfalls | dashboard/app query succeeds |
| Plant filter | uses `plant_id` |
| Freshness | stale/old DEV data is visible |
| Security | user cannot query outside permitted plant scope |

### Exit Criteria

```text
DEV app runs against governed contracts
all Warehouse360 routes return controlled responses
empty/old data is clearly marked
no route depends on legacy wh360
dashboard use case is proven against vw_consumption views
```

## Phase 7 — UAT Data Product Deployment

### Objective

Promote the governed Warehouse360 data product from DEV to UAT.

### Tasks

1. Deploy IOReporting data product to UAT.
2. Create UAT `gold_io_reporting` schema if required.
3. Deploy UAT internal governed views.
4. Deploy UAT `vw_consumption_warehouse360_*` views.
5. Apply UAT grants and RLS.
6. Validate UAT schemas and row counts.
7. Run contract validation against UAT.
8. Compare UAT governed views against legacy UAT `wh360`.

### UAT Side-by-Side State

For a temporary migration window, UAT should contain both:

```text
connected_plant_uat.wh360.*
connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_*
```

### Exit Criteria

```text
UAT data product deployed
UAT contracts validate
UAT consumption views are queryable
legacy wh360 remains available for comparison
known differences are documented
```

## Phase 8 — UAT App Migration and Parity Testing

### Objective

Switch Warehouse360 UAT app from legacy `wh360` mode to governed contract mode.

### Tasks

1. Deploy API with contract mode available.
2. Deploy frontend/app if required.
3. Run in legacy mode first.
4. Run in governed contract mode.
5. Compare outputs route by route.
6. Classify differences.
7. Fix data-product or app issues.
8. Obtain business sign-off.

### Difference Classification

| Difference type | Meaning |
|---|---|
| Expected improvement | New data product fixes old defect |
| Mapping issue | New view needs correction |
| App assumption issue | UI expects old shape |
| Business rule difference | Product owner decision required |
| Data availability gap | Source/pipeline issue |
| Security difference | RLS or plant filtering issue |

### Exit Criteria

```text
Warehouse360 UAT works in governed contract mode
business owner accepts differences
legacy wh360 is no longer required for app operation
dashboard users can query consumption views
cutover decision is recorded
```

## Phase 9 — PROD Deployment

### Objective

Deploy the governed Warehouse360 data product and app path to PROD.

### Pre-PROD Gates

```text
DEV validation complete
UAT validation complete
contracts validated
plant_id RLS validated
freshness checks implemented
dashboard compatibility confirmed
app smoke tests passed
rollback plan documented
business sign-off recorded
```

### PROD Tasks

1. Deploy IOReporting data product to PROD.
2. Deploy PROD `vw_consumption_warehouse360_*` views.
3. Apply PROD grants and RLS.
4. Validate PROD contracts.
5. Deploy API/app with governed mode.
6. Run PROD smoke tests.
7. Monitor freshness and query performance.
8. Confirm business acceptance.

### Exit Criteria

```text
Warehouse360 PROD uses governed IOReporting consumption views
contracts are active
dashboard/app consumers use the same stable serving layer
legacy wh360 is not part of PROD architecture
```

---

# 7. Legacy `wh360` Retirement

## 7.1 UAT-Only Baseline

The legacy `wh360` views should be retained only for migration comparison.

Recommended lifecycle:

```text
freeze → compare → sign off → deprecate → remove later
```

## 7.2 Freeze Rules

Once the new migration starts:

```text
no new app features should be built on wh360
no new dashboard dependencies should be added to wh360
wh360 changes should require explicit migration owner approval
```

## 7.3 Retirement Criteria

Legacy `wh360` can be retired when:

```text
Warehouse360 governed UAT is signed off
all app routes run in governed_contracts mode
dashboard consumers are moved to vw_consumption views
no active user depends on wh360
rollback period has expired
```

---

# 8. Testing Strategy

## 8.1 Data Product Tests

| Test | Purpose |
|---|---|
| Schema existence | Confirms required views exist |
| Primary key uniqueness | Confirms key design |
| `plant_id` non-null | Supports RLS and filtering |
| Freshness timestamp present | Enables stale data handling |
| Type validation | Avoids frontend/API parsing issues |
| Row count sanity | Detects broken joins or filters |
| Duplicate detection | Confirms grain |
| Grant validation | Confirms access model |

## 8.2 API Tests

| Test | Purpose |
|---|---|
| Route returns 200 | Basic availability |
| Route uses contract ID | Contract binding |
| No legacy object in governed mode | Migration enforcement |
| Plant filter applied | Security and scope |
| Empty data handled | DEV old/limited data |
| Stale data metadata returned | Truthful UX |
| Contract schema matches response | Consumer safety |

## 8.3 Frontend Tests

| Test | Purpose |
|---|---|
| Page renders with governed data | Migration validation |
| Empty state renders | DEV limited data |
| Stale state renders | Old DEV transactional data |
| Plant filter displayed | Scope clarity |
| Dashboard-compatible fields shown | Shared serving model |
| Legacy badges absent in governed mode | Cutover clarity |

## 8.4 Dashboard Tests

Because `vw_consumption_*` views may also serve Databricks dashboards, test:

```text
dashboard query can read each view
common filters work
plant_id filter works
date filters work
view performance is acceptable
field names are business-readable
freshness is visible
```

---

# 9. Governance and CI

## 9.1 Keep Forbidden Data Access Blocking

The existing boundary check should remain blocking.

It should prevent app code from directly referencing:

```text
raw SAP tables
bronze objects
silver objects
internal gold objects
legacy wh360 objects in governed mode
```

## 9.2 Add Contract Coverage Check

Add a new CI check:

```text
make contract-coverage
```

The check should verify:

```text
every Warehouse360 governed route has a contract_id
every contract_id exists in the manifest
every Warehouse360 contract source_view starts with vw_consumption_
every source_view exists in the target environment during deployment validation
no governed Warehouse360 route directly depends on wh360 object names
```

## 9.3 Add Environment Mode Check

Add a check that prevents accidental deployment with the wrong source mode:

| Environment | Allowed default |
|---|---|
| DEV | `governed_contracts` |
| UAT before cutover | `legacy_wh360` or `governed_contracts` by explicit config |
| UAT after cutover | `governed_contracts` |
| PROD | `governed_contracts` only |

---

# 10. Deliverables

## Documentation Deliverables

```text
docs/migration/warehouse360-wh360-to-io-reporting-migration-plan.md
data-products/io-reporting/contracts/warehouse360-dev-profile.md
data-products/io-reporting/contracts/warehouse360-contracts.md
docs/architecture/warehouse360-contract-cutover-record.md
docs/runbooks/warehouse360-dev-to-uat-promotion.md
docs/runbooks/warehouse360-uat-cutover.md
```

## Data Product Deliverables

```text
connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview
connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog
connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog
connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_staging_workload
connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions
connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_shortfalls
connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation
connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_dispensary_queue
```

## Contract Deliverables

```text
warehouse360.overview
warehouse360.inbound_backlog
warehouse360.outbound_backlog
warehouse360.staging_workload
warehouse360.stock_exceptions
warehouse360.shortfalls
warehouse360.im_wm_reconciliation
warehouse360.dispensary_queue
```

## Application Deliverables

```text
QuerySpec supports contract_id
Warehouse360 adapter supports governed_contracts mode
Warehouse360 routes use contract IDs in DEV
Warehouse360 frontend handles governed data, empty data, and stale data
```

## CI Deliverables

```text
forbidden data access remains blocking
contract coverage check added
Warehouse360 governed mode test added
environment source-mode check added
```

---

# 11. Codex Task Prompts

## Task 1 — Create the Migration Plan File

```text
Create docs/migration/warehouse360-wh360-to-io-reporting-migration-plan.md using the agreed DEV-first migration approach. The legacy UAT wh360 views are a comparison baseline only. The target schema is connected_plant_dev.gold_io_reporting. Warehouse360 should migrate to vw_consumption_warehouse360_* views, with plant_id as the canonical plant scope field. Do not change runtime code.
```

## Task 2 — Add DEV Data Product Deployment Checklist

```text
Create docs/runbooks/warehouse360-dev-data-product-deployment.md. Include steps to deploy the IOReporting bundle to connected_plant_dev.gold_io_reporting, validate the schema, confirm internal gold/live/secured views, create vw_consumption_warehouse360_* views, apply grants/RLS, and capture row counts. Do not change runtime code.
```

## Task 3 — Profile DEV Warehouse360 Views

```text
Create a script or notebook plan to profile connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_* views. For each view, capture row count, schema, plant_id nullability, candidate primary key uniqueness, freshness timestamp coverage, and duplicate records. Output findings to data-products/io-reporting/contracts/warehouse360-dev-profile.md. Do not invent keys; mark unresolved grain decisions as requiring product owner decision.
```

## Task 4 — Create Warehouse360 Consumption View Skeletons

```text
Create SQL skeletons for connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_* views. The views should wrap the governed IOReporting internal views, not legacy wh360 views. Include plant_id, snapshot_ts or freshness metadata, clear aliases, and TODO comments where source mappings require verification. Do not point contracts at these until DEV profiling confirms schema and grain.
```

## Task 5 — Add Warehouse360 Contracts After Profiling

```text
After DEV profiling is complete, expand data-products/io-reporting/contracts/app_contract_manifest.yml with Warehouse360 Wave 1 contracts. Use source_view values beginning with vw_consumption_warehouse360_*. Use plant_id as the row-level access key. Include grain, primary_key, freshness, lifecycle, and verified columns. Do not use legacy wh360 views as contract sources.
```

## Task 6 — Add QuerySpec Contract ID Support

```text
Update the API query service so QuerySpec can take a contract_id. Add manifest lookup so the query service resolves contract_id to source_view and then to the environment-specific physical object. Keep existing object-name mode temporarily for legacy Warehouse360 operation. Add unit tests for contract lookup, missing contract handling, and environment resolution.
```

## Task 7 — Migrate Warehouse360 Adapter to Governed Mode

```text
Refactor apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py so it supports WAREHOUSE360_SOURCE_MODE=legacy_wh360|governed_contracts. In governed_contracts mode, each route must use a Warehouse360 contract_id rather than wh360 object names. Add tests proving no wh360 object names are used in governed_contracts mode.
```

## Task 8 — Add Contract Coverage CI

```text
Add a CI check named contract-coverage. It should verify that every Warehouse360 governed route has a contract_id, every contract_id exists in the manifest, every Warehouse360 source_view starts with vw_consumption_warehouse360_, and no governed Warehouse360 route depends on wh360 object names. Keep the existing forbidden data access check blocking.
```

---

# 12. Immediate Next Steps

Do these in order:

1. Add this migration plan to the repo.
2. Create the DEV deployment checklist.
3. Deploy or validate `connected_plant_dev.gold_io_reporting`.
4. Create `vw_consumption_warehouse360_*` skeleton views.
5. Profile DEV view schemas and grain.
6. Resolve product-owner grain decisions.
7. Author Warehouse360 contracts.
8. Add `contract_id` support to `QuerySpec`.
9. Repoint Warehouse360 DEV app to governed contracts.
10. Run DEV app and dashboard validation.
11. Promote to UAT.
12. Compare against legacy UAT `wh360`.
13. Cut over UAT app.
14. Prepare PROD deployment.

---

# 13. Open Decisions

| Decision | Owner | Status |
|---|---|---|
| Exact grain of inbound backlog | Tim | Open |
| Exact grain of outbound backlog | Tim | Open |
| Exact grain of staging workload | Tim | Open |
| Whether dispensary queue is Wave 1 | Tim | Open |
| Whether overview is plant-level or plant + warehouse-level | Tim | Open |
| Whether shortfalls are order/material or transfer-requirement grain | Tim | Open |
| Whether old `wh360` is removed after UAT sign-off or retained for a fixed period | Tim / platform owner | Open |

---

# 14. Success Criteria

The migration is successful when:

```text
Warehouse360 DEV runs against connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_*
Warehouse360 contracts are verified against DEV
Warehouse360 API uses contract_id-based QuerySpec
Warehouse360 UAT runs against governed consumption views
legacy wh360 is no longer required for app operation
Databricks dashboards can use the same consumption views
plant_id filtering and RLS are validated
no truly keyless consumption views remain
PROD deployment path is ready
```
