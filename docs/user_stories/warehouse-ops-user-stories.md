# User stories — Warehouse Operations & Process-Order Reporting

Derived from **WMA-E-50** (WM staging / TR-split), **PEX-E-35** (COOISPI report enhancement), and
**standard SAP COOISPI** (Process Order Information System). Each story carries **fulfilment
commentary**: whether the data product can satisfy it today (✅ fully / ⚠️ partial / ❌ not yet),
which tables fulfil it, and whether the acceptance criteria can be met (and the gaps if not).

> **Source-fidelity caveat.** The WMA-E-50 / PEX-E-35 / COOISPI specification PDFs supplied were
> rights-protected (AIP/IRM) and could not be read in full. WMA-E-50 stories are grounded in the
> `wh360` prototype analysis; **COOISPI stories are based on standard SAP COOISPI functionality**;
> **PEX-E-35-specific** field/layout requirements must be confirmed against the readable spec before
> their acceptance criteria are finalised. These are flagged inline.

Personas: **Operative** (RF/floor), **Supervisor** (warehouse/shift), **Dispensary Operator**,
**Planner** (production), **Plant Manager**, **Analyst**, **Quality**.

> [!IMPORTANT]
> **Readiness-Aware Fulfilment Note:** A story marked implemented means the data product or validation mechanism exists. It does not mean every plant is production-ready. Production use depends on plant-level readiness status, secured/live serving view access, freshness, and configuration coverage.

---

## Epic A — Warehouse staging & transfer execution (WMA-E-50)

### A1. Transfer-requirement (staging) backlog
*As a* warehouse supervisor *I want* to see open transfer requirements by warehouse, queue and
priority *so that* I can prioritise RF staging work.
**Acceptance:** lists only open TRs (not complete, open qty > 0); shows open count, open qty, oldest
age; filterable by warehouse/queue/priority; plant-scoped.
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_transfer_requirement_backlog_secured`.** Production use is allowed for validated plants consuming through the secured view, subject to plant-level readiness status and freshness checks (`gold_plant_freshness_readiness`).

### A2. Dispensary / line-pick backlog
*As a* dispensary operator *I want* the open line-pick backlog by production supply area *so that* I
can stage components for imminent process orders.
**Acceptance:** RESB component picks (movement 261), excludes deleted, open qty > 0; shows open
task/order count, open & required qty, earliest requirement & scheduled-start dates.
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_dispensary_backlog_secured`.** Production use is allowed for validated plants via the secured serving view, subject to plant-level readiness status.

### A3. Transfer-order pick performance
*As a* supervisor *I want* TO pick performance (confirmed vs requested, pick accuracy, cycle time)
by operator and source storage type *so that* I can manage RF productivity.
**Acceptance:** confirmed/requested/picked qty, pick accuracy, fully-confirmed rate, confirmation
cycle & processing time, by operator/date/source ST.
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_transfer_order_performance_secured`.** Production use is allowed for validated plants via the secured view, subject to plant-level readiness status. (Operator-level metrics assume `QNAME`/`BNAME` are populated in source data.)

### A4. Process-order component staging completion (RAG risk)
*As a* planner *I want* each released order's staging completion (% TOs confirmed) and a red/amber/
green risk vs scheduled start *so that* I can flag orders at risk of not starting on time.
**Acceptance:** staging fraction = confirmed/total staging TOs; RAG bands on fraction × days-to-start;
one row per order; excludes closed orders.
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_process_order_staging_live`.** Production use is allowed only where process-order staging validation (`gold_process_order_staging_validation`) is `READY` for the relevant plant/warehouse. Otherwise this remains `PILOT_ONLY` or `BLOCKED`. The `LTAK-BETYP='F' + BENUM→AUFNR` key match rate validation is automated, checking mapping consistency on every Gold run. Raw table `gold_process_order_staging` has no public access.

### A5. Pallet / SSCC visibility for staged stock
*As a* supervisor *I want* handling-unit / SSCC visibility (counts, linked deliveries, weight) for
staged stock *so that* I can track pallets through staging.
**Acceptance:** HU & distinct SSCC counts, linked deliveries, gross weight, by plant/warehouse/HU
status; SSCC = EXIDV.
**Fulfilment: ⚠️ Partial / Pilot-only — `gold_handling_unit_summary_secured`.** HU/SSCC summary is built from VEKP/VEPO. Production use is readiness-controlled on a plant-by-plant basis.
**Gap:** The WMA-E-50 execution details — pre-generated SSCC, pallet-ID lineage, TR-split/campaign configurations (`ZWM_SSCC_CREATE`, `ZWM_PALLETID`, `ZTR_SPLIT`, `ZSCMWM_RFCTR`) — are not replicated to Bronze, so true SSCC/pallet-split status cannot be reproduced; VEKP/VEPO only approximate SSCC. Full fidelity is blocked on ingestion (see `docs/ingestion_requests.md`).

### A6. Line-side / production-staging stock
*As a* supervisor *I want* current stock staged in production / line-side storage types *so that* I
can see what is positioned for the line.
**Acceptance:** total/available qty and min days-to-expiry by plant/warehouse/storage-type/material/
batch, for line-side storage types.
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_lineside_stock_live` / `gold_lineside_stock_secured`.** Production use is allowed only where storage type role coverage is validated as `READY` (via `gold_storage_type_role_coverage_status`). The hard-coded logic has been replaced with a governed `site_config_storage_type_role` table in the Silver layer.

---

## Epic B — Stock, occupancy & reconciliation

### B1. Bin occupancy / utilisation
*As a* supervisor *I want* bin occupancy and block counts by storage/bin type *so that* I can manage
capacity. **Acceptance:** occupancy rate, occupied/empty/blocked counts, current state.
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_bin_occupancy_secured`.** Production use is allowed for validated plants, subject to storage type validation status.

### B2. Stock availability by material/batch
*As a* planner *I want* unrestricted vs QI/blocked/restricted/in-transfer stock by material/batch/
sloc *so that* I know what is truly available. **Acceptance:** the five stock buckets at
plant×sloc×material×batch×UOM.
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_stock_availability_secured`.** Production use is allowed for validated plants consuming through the secured serving view.

### B3. Shelf-life / expiry risk
*As a* quality/planner user *I want* expiry exposure bucketed (expired/<7/7–30/30–90/OK) *so that* I
can act on at-risk batches. **Acceptance:** qty per expiry bucket by plant/material/batch.
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_stock_expiry_risk_live` / `gold_stock_expiry_risk_secured`.** Production use is allowed only where the plant's replication freshness and configuration coverage meet readiness criteria. The data product exists, but safety depends on expiry-date coverage, stock/bin freshness (validated via `gold_plant_freshness_readiness`), and shelf-life policy mapping.

### B4. IM ↔ WM stock reconciliation
*As an* analyst *I want* to reconcile IM book stock vs WM bin stock and see variances with value and
ABC class *so that* I can find and root-cause discrepancies.
**Acceptance:** delta qty, inventory value, mismatch reason (rounding/uom/pending-TO/blocked/true
variance), at a grain that supports root-cause (sloc/warehouse/batch/stock-category).
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_stock_reconciliation_secured` / `gold_stock_reconciliation_v2_secured`.** Production use is allowed only where the plant passes validation checks in `gold_stock_reconciliation_readiness`.
**Residual gap:** True SAP storage-location attribution for WM quants remains difficult because `LQUA` does not carry `LGORT` (requires a future bin/storage-type to storage-location configuration layer).

### B5. Warehouse exception monitor
*As a* supervisor *I want* a single exception list (negative stock, expired-with-stock, aged QI,
aged blocked, aged open TOs, IM/WM variance) with severity and SLA *so that* I can work the worst
first. **Acceptance:** one row per exception with type, severity (1–4), SLA hours, age, plant.
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_warehouse_exceptions_secured`.** Production use is allowed for validated plants. The IM/WM-variance exception branch inherits B4's coarse grain (variance detection works; root-cause analysis remains directional).

---

## Epic C — Inbound (WMA-E-50 inbound)

### C1. Inbound backlog awaiting goods receipt
*As a* goods-in supervisor *I want* open inbound PO backlog by vendor/plant *so that* I can plan
receiving. **Acceptance:** open PO items/POs, ordered qty, open value, earliest PO date, QA-inspection
count; ideally remaining (ordered − received) qty and true GR status.
**Fulfilment: ⚠️ Partial / Pilot-only — `gold_inbound_po_backlog_secured` / `gold_inbound_po_backlog_enhanced_secured`.** The data product displays PO backlog, but it is not a true GR status view. Production use is readiness-controlled on a plant-by-plant basis.
**Gap:** True Goods Receipt (GR) lifecycle status, inbound delivery/ASN, and remaining-vs-received quantities are not supported as GR history (EKBE/MSEG 101) is not integrated into this pipeline. This does not satisfy inbound execution, GR, putaway, or inspection lifecycles until those source tables are implemented.

---

## Epic D — Process Order Information System (COOISPI standard + PEX-E-35)

> Standard COOISPI presents selectable **list profiles**: order headers, operations, components,
> confirmations, and documented goods movements, filtered by plant/material/order-type/period with
> flexible layouts. The stories below map those list types onto the product. **PEX-E-35**-specific
> columns/selection logic must be confirmed against the readable spec (caveat above).

### D1. Process-order list (headers)
*As a* planner *I want* a list of process orders with status, quantities and key dates, filtered by
plant/material/period *so that* I can review the order book (COOISPI header list).
**Acceptance:** order, material, plant, order/confirmed-yield qty, scheduled vs actual dates, status;
**scoped to PP-PI process orders (AUTYP 40)**.
**Fulfilment: ✅ Implemented / readiness-controlled — `silver.process_order` / `gold_process_order_schedule_adherence_secured`.** Header attributes and standard AUTYP=40 scope are present in the Silver table and the secured Gold view. Actual production use in dashboards is readiness-controlled by plant. COOISPI dynamic layout is a BI-layer concern.

### D2. Operation list
*As a* planner *I want* per-order operations (work centre, scheduled/actual dates, status) *so that*
I can see routing progress (COOISPI operation list).
**Acceptance:** operations per order with work centre and dates.
**Fulfilment: ⚠️ Partial / Pilot-only — `silver.process_order_operation`.** The operational routing data exists at the Silver layer. However, there is no dedicated conformed Gold operation serving view. Production use is readiness-controlled by plant.

### D3. Component / reservation list
*As a* planner *I want* components (reservations) per order with requirement vs withdrawn qty *so
that* I can check material coverage (COOISPI component list).
**Acceptance:** components per order, required/withdrawn/open qty, requirement date.
**Fulfilment: ⚠️ Partial / Pilot-only — `silver.reservation_requirement`.** The full component list exists at the Silver layer, but the conformed Gold layer today only implements the dispensary line-pick subset (`gold_dispensary_backlog_secured`). Production use is readiness-controlled by plant.

### D4. Confirmation list & production output
*As a* plant manager *I want* produced/scrap/yield and quality rate by plant (and ultimately by
shift) *so that* I can track output and quality (COOISPI confirmation list).
**Acceptance:** produced qty (101−102), scrap (551/552), yield, quality rate; by plant/period (and
shift).
**Fulfilment: ⚠️ Partial / Pilot-only — `gold_shift_output_summary` / `gold_plant_production_quality_summary_secured`.** Quantities are calculated via the conformed movement type classifications, and validated by `gold_movement_type_classification_coverage`.
**Gaps:** There is no shift-calendar-backed shift grain (shift-level reporting is not production-ready), and the plant production quality summary is all-time (lacks period-relative grain). Production use is readiness-controlled by plant.

### D5. Documented goods movements per order
*As an* analyst *I want* the goods movements posted against an order *so that* I can audit
consumption and output (COOISPI documented-goods-movements list).
**Acceptance:** movements with type, qty, posting date, debit/credit, order reference.
**Fulfilment: ✅ Implemented / readiness-controlled — `silver.goods_movement`.** Data-level fulfilment is complete, but production usage is readiness-controlled by plant.

### D6. Process-order schedule adherence
*As a* planner *I want* process-order schedule adherence (actual vs scheduled finish, yield vs order
qty) *so that* I can measure production reliability.
**Acceptance:** on-time and in-full flags per completed/closed order.
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_process_order_schedule_adherence_secured`.** Production use is allowed for validated plants.

### D7. PEX-E-35 custom COOISPI report
*As a* planner *I want* the Kerry-specific COOISPI report (PEX-E-35) fields, selection and layout *so
that* it matches the existing operational report.
**Acceptance:** *to be confirmed from the PEX-E-35 spec.*
**Fulfilment: ❌ Blocked / Unknown.** The standard COOISPI content is covered, but Kerry-specific custom fields, layouts, and logic could not be read from the encrypted spec.
**Action:** Obtain a readable specification, then map required custom fields to Silver/Gold columns.

---

## Epic E — Plant Readiness & Data Product Safety

This epic governs the metadata, validation tests, site configuration layer, and rollout mechanisms that determine whether any individual plant, warehouse, domain, or KPI is safe to use in production.

### E1. Plant readiness dashboard source
*As a* data product owner *I want* to see readiness by plant, domain, and data product *so that* I know which data products are safe for production, pilot, or blocked use.
**Acceptance:**
* shows readiness status
* shows readiness score
* shows top blocker
* shows plant/domain/data product grain
* supports `READY`, `READY_WITH_WARNINGS`, `PILOT_ONLY`, `BLOCKED`, `NOT_APPLICABLE`, `UNKNOWN`
* backed by `gold_readiness_dashboard_source` and/or `gold_plant_readiness_status`
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_plant_readiness_status` / `gold_readiness_dashboard_source`.** Rollup scores (0–100) and readiness status calculations are implemented and refreshed automatically.

### E2. Validation failure evidence
*As a* functional SME *I want* to see why a plant or data product is blocked *so that* I can fix the correct SAP/config/data issue.
**Acceptance:**
* shows validation name
* severity
* failed record count
* recommended action
* source data product
* plant/warehouse context
* backed by `gold_validation_failure_detail`
**Fulfilment: ⚠️ Partial / Pilot-only — `gold_validation_failure_detail`.** All automated test failure metrics, context, and actions are consolidated into this view.
**Gap:** The current implementation leaves the `sample_evidence_json` field as `null` across all validation sources. Capturing specific mock/live failing keys in JSON format is a future enhancement (see `E8`).

### E3. Storage type role readiness
*As a* warehouse functional owner *I want* storage types mapped to operational roles *so that* lineside, staging, bin, and reconciliation KPIs are safe.
**Acceptance:**
* validates active storage types
* detects unmapped or fallback roles
* reports plant/warehouse status
* supports `site_config_storage_type_role`
* backed by `gold_storage_type_role_coverage_status`
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_storage_type_role_coverage_status`.** Active storage types are validated against the conformed Silver config table `site_config_storage_type_role` to prevent raw unmapped or fallback roles from contaminating line-side stock figures.

### E4. Movement type classification readiness
*As an* MM/WM/PP functional owner *I want* active movement types classified *so that* production, consumption, scrap, inbound, outbound, and adjustment KPIs are reliable.
**Acceptance:**
* checks movement types used in the last 90 days
* blocks unclassified `Z*` movement types where material
* supports global and plant-specific classification
* backed by `site_config_movement_type_classification`
* backed by `gold_movement_type_classification_coverage`
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_movement_type_classification_coverage`.** Movement types seen in the last 90 days are checked against the conformed config table. Any unclassified active `Z*` movement type drops the validation status to `BLOCKED` with critical severity.

### E5. Process-order staging validation
*As a* planner or warehouse supervisor *I want* staging KPIs enabled only where warehouse transfer-order references reliably map to process orders *so that* staging risk is not misleading.
**Acceptance:**
* validates `BENUM` / process-order reference match rate
* reports status by plant and warehouse
* thresholds control `READY`, `READY_WITH_WARNINGS`, `PILOT_ONLY`, `BLOCKED`
* backed by `gold_process_order_staging_validation`
**Fulfilment: ✅ Implemented / readiness-controlled — `gold_process_order_staging_validation`.** Staging accuracy is measured, checking key match rates between TO references (`BENUM`) and process orders. Plants without active staging are categorized as `NOT_APPLICABLE`.

### E6. Secured consumption enforcement
*As a* data owner *I want* business users, dashboards, apps, and Genie spaces to consume only secured/live Gold views *so that* raw Gold implementation tables are not used directly.
**Acceptance:**
* raw Gold MVs/tables are not broadly granted
* users consume `_secured` or `_live` views
* readiness tables are exposed appropriately
* grant audit can identify unsafe raw Gold grants
* backed by `docs/security_consumption_model.md` and `resources/sql/grant_audit.sql`
**Fulfilment: ✅ Implemented / readiness-controlled — `resources/sql/grant_audit.sql`.** The grant audit script utilizes an explicit allow-list to ensure only `_secured`, `_live`, and validated readiness tables are granted to general users, while restricting access to raw Gold tables.

### E7. KPI enablement and manual override control
*As a* data product owner *I want* to manually enable, hold, pilot, or block a KPI for a plant *so that* rollout can be governed after automated validation.
**Acceptance:**
* backed by `site_config_kpi_enablement`
* supports enabled/pilot/blocked decisions
* does not allow critical validation failures to be promoted to production-ready
* includes approval metadata and review date
* if current implementation allows overly broad upgrades, mark this as partial and add a follow-up gap
**Fulfilment: ⚠️ Partial / Pilot-only — `site_config_kpi_enablement`.** Manual overrides are loaded into the conformed config layer and take precedence over calculated status codes (e.g. promoting `PILOT_ONLY` to `READY`).
**Gap:** The current DLT validation rollup logic does not programmatically block manual promotion of a KPI to `READY` if there is an active `CRITICAL` or `BLOCKED` validation failure (see `E9`).

### E8. Dynamic validation failure evidence extraction
*As a* functional analyst *I want* to see sample failing record keys inside the failure details *so that* I can locate the exact rows in SAP or configuration tables without writing custom SQL.
**Acceptance:**
* `sample_evidence_json` is populated with a JSON array of up to 10 sample keys (e.g. storage types, movement types, or process order numbers).
* includes relevant IDs (e.g. `[{"LGNUM": "208", "LGTYP": "902"}]`).
* backed by `gold_validation_failure_detail`.
**Fulfilment: ⚠️ Partial / Pilot-only.** Column exists in schema but currently returns `null`. Needs extraction logic added to the individual validation queries.

### E9. Safety gate hard-block enforcement
*As a* data owner *I want* computed readiness status to stay `BLOCKED` if there is a critical validation failure, even if a user attempts to manually enable the KPI *so that* unsafe data is never accidentally shown in production.
**Acceptance:**
* if `has_critical = 1` or `is_stale = 1` in validation checks, the final readiness status is forced to `BLOCKED`.
* manual overrides in `site_config_kpi_enablement` cannot upgrade `BLOCKED` status to `READY` when safety gates are breached.
* backed by `gold_plant_readiness_status` scoring logic.
**Fulfilment: ⚠️ Partial / Pilot-only.** Enablement status override currently takes absolute precedence over computed status without validating safety gate status.

### E10. Plant replication freshness alert triggers
*As an* operations manager *I want* automated alerts when a plant's replication delay exceeds the SLA *so that* we can fix replication lag before users make decisions on stale data.
**Acceptance:**
* triggers alert when a plant's freshness status drops to `BLOCKED`.
* evaluates lag vs SLA using `gold_plant_freshness_readiness`.
* supports email/Teams notifications or integration with Databricks Alerts.
**Fulfilment: ❌ Not yet.** Freshness status is computed in DLT, but alert rules and notification channels are not yet configured.

### E11. Automated site-readiness sign-off and audit log
*As a* compliance officer *I want* changes to KPI enablement status and manual overrides logged and validated *so that* we have a clear history of who authorized a plant's data promotion.
**Acceptance:**
* records changes to `site_config_kpi_enablement`.
* captures approval metadata (`approved_by`, `approved_at`, `reason_code`, and `review_due_at`).
* validates configuration modifications in git/PR history or via configuration table CDF (Change Data Feed).
**Fulfilment: ✅ Implemented / readiness-controlled — `site_config_kpi_enablement`.** Table includes fields for `approved_by`, `approved_at`, `reason_code`, and `review_due_at` and is populated via governed configuration scripts.

---

## Coverage summary

| Epic | Stories | ✅ Implemented | ⚠️ Readiness-controlled / Partial | ❌ / Blocked |
|---|---|---|---|---|
| A — Staging & transfer | A1–A6 | A1, A2, A3, A4, A6 | A5 | — |
| B — Stock & reconciliation | B1–B5 | B1, B2, B3, B4, B5 | — | — |
| C — Inbound | C1 | — | C1 | — |
| D — Process-order info system | D1–D7 | D1, D5, D6 | D2, D3, D4 | D7 (spec blocked) |
| E — Plant Readiness & Safety | E1–E11 | E1, E3, E4, E5, E6, E11 | E2, E7, E8, E9 | E10 |

**Themes in the gaps:** (1) WMA-E-50 execution fidelity (SSCC/pallet/TR-split) is blocked on un-replicated Z-tables (A5); (2) shift- and period-grain reporting requires shift-calendar config (D4); (3) PEX-E-35 needs a readable spec to finalise (D7); (4) sample validation evidence JSON strings are not yet dynamically populated (E2, E8); (5) KPI enablement overrides bypass safety-block validation gates (E7, E9); and (6) automated alert notifications for freshness lag are not yet configured (E10).

None of the functional gaps prevent deployment of the implemented core reporting logic, as the conformed plant readiness safety matrix now governs production rollout plant-by-plant via secured and live serving views.
