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

---

## Epic A — Warehouse staging & transfer execution (WMA-E-50)

### A1. Transfer-requirement (staging) backlog
*As a* warehouse supervisor *I want* to see open transfer requirements by warehouse, queue and
priority *so that* I can prioritise RF staging work.
**Acceptance:** lists only open TRs (not complete, open qty > 0); shows open count, open qty, oldest
age; filterable by warehouse/queue/priority; plant-scoped.
**Fulfilment: ✅ Fully — `gold_transfer_requirement_backlog`.** Grain (wh × plant × queue × src/dst
ST × priority) and measures meet the AC; plant scope enforced by RLS. No gap.

### A2. Dispensary / line-pick backlog
*As a* dispensary operator *I want* the open line-pick backlog by production supply area *so that* I
can stage components for imminent process orders.
**Acceptance:** RESB component picks (movement 261), excludes deleted, open qty > 0; shows open
task/order count, open & required qty, earliest requirement & scheduled-start dates.
**Fulfilment: ✅ Fully — `gold_dispensary_backlog`.** Filter (261, not deleted, open>0) and measures
match the AC exactly. No gap.

### A3. Transfer-order pick performance
*As a* supervisor *I want* TO pick performance (confirmed vs requested, pick accuracy, cycle time)
by operator and source storage type *so that* I can manage RF productivity.
**Acceptance:** confirmed/requested/picked qty, pick accuracy, fully-confirmed rate, confirmation
cycle & processing time, by operator/date/source ST.
**Fulfilment: ✅ Fully — `gold_transfer_order_performance`.** AC met. (Operator-level metrics assume
`QNAME`/`BNAME` are populated — true in Kerry RF flows.)

### A4. Process-order component staging completion (RAG risk)
*As a* planner *I want* each released order's staging completion (% TOs confirmed) and a red/amber/
green risk vs scheduled start *so that* I can flag orders at risk of not starting on time.
**Acceptance:** staging fraction = confirmed/total staging TOs; RAG bands on fraction × days-to-start;
one row per order; excludes closed orders.
**Fulfilment: ✅ Fully — `gold_process_order_staging` [PILOT, assumption validated].** Logic and AC are implemented. The LTAK-BETYP='F' + BENUM→AUFNR assumption is validated against live UAT data (2026-06-02): BENUM matches a known AUTYP='40' process order in 100% of F-type TOs across all warehouses. `gold_process_order_staging_validation` provides persistent per-plant/warehouse status (VALIDATED / NOT_VALIDATED / NOT_APPLICABLE) on every Gold run. Plants with no F-type TOs are classified NOT_APPLICABLE. No remaining gap on the staging-fraction or RAG logic; AUART allowlist (BR-PP-001) and per-plant confirmation remain open items.

### A5. Pallet / SSCC visibility for staged stock
*As a* supervisor *I want* handling-unit / SSCC visibility (counts, linked deliveries, weight) for
staged stock *so that* I can track pallets through staging.
**Acceptance:** HU & distinct SSCC counts, linked deliveries, gross weight, by plant/warehouse/HU
status; SSCC = EXIDV.
**Fulfilment: ⚠️ Partial — `gold_handling_unit_summary`.** HU/SSCC summary is built from VEKP/VEPO.
**Gap:** the WMA-E-50 *execution* detail — pre-generated SSCC, pallet-ID lineage, TR-split/campaign
config (`ZWM_SSCC_CREATE`, `ZWM_PALLETID`, `ZTR_SPLIT`, `ZSCMWM_RFCTR`) — is **not replicated** to
bronze (see `docs/ingestion_requests.md`), so true SSCC/pallet-split status cannot be reproduced;
VEKP/VEPO only *approximate* SSCC. AC partially met; full fidelity blocked on ingestion.

### A6. Line-side / production-staging stock
*As a* supervisor *I want* current stock staged in production / line-side storage types *so that* I
can see what is positioned for the line.
**Acceptance:** total/available qty and min days-to-expiry by plant/warehouse/storage-type/material/
batch, for line-side storage types.
**Fulfilment: ⚠️ Partial — `gold_lineside_stock` [PILOT].** Works, **but** line-side storage types are
hard-coded (`'100' OR LIKE '8%'`). **Gap:** needs a governed storage-type *role* config per
warehouse/plant before multi-plant rollout. AC met for the piloted plant(s) only.

---

## Epic B — Stock, occupancy & reconciliation

### B1. Bin occupancy / utilisation
*As a* supervisor *I want* bin occupancy and block counts by storage/bin type *so that* I can manage
capacity. **Acceptance:** occupancy rate, occupied/empty/blocked counts, current state.
**Fulfilment: ✅ Fully — `gold_bin_occupancy`.** AC met.

### B2. Stock availability by material/batch
*As a* planner *I want* unrestricted vs QI/blocked/restricted/in-transfer stock by material/batch/
sloc *so that* I know what is truly available. **Acceptance:** the five stock buckets at
plant×sloc×material×batch×UOM.
**Fulfilment: ✅ Fully — `gold_stock_availability`** (MCHB batch stock). AC met.

### B3. Shelf-life / expiry risk
*As a* quality/planner user *I want* expiry exposure bucketed (expired/<7/7–30/30–90/OK) *so that* I
can act on at-risk batches. **Acceptance:** qty per expiry bucket by plant/material/batch.
**Fulfilment: ✅ Fully — `gold_stock_expiry_risk`.** AC met (uses bin quants + shelf-life policy).

### B4. IM ↔ WM stock reconciliation
*As an* analyst *I want* to reconcile IM book stock vs WM bin stock and see variances with value and
ABC class *so that* I can find and root-cause discrepancies.
**Acceptance:** delta qty, inventory value, mismatch reason (rounding/uom/pending-TO/blocked/true
variance), at a grain that supports root-cause (sloc/warehouse/batch/stock-category).
**Fulfilment: ✅ Mostly — `gold_stock_reconciliation_v2`, `gold_stock_value_reconciliation`,
`gold_reconciliation_audit_log`.** v2 provides warehouse/material/batch/stock-category grain,
quantity/value deltas, tolerance breach flags, mismatch reasons, and an audit register.
**Residual gap:** true SAP sloc attribution for WM quants still needs a future bin/storage-type→sloc
configuration layer because LQUA does not carry LGORT.

### B5. Warehouse exception monitor
*As a* supervisor *I want* a single exception list (negative stock, expired-with-stock, aged QI,
aged blocked, aged open TOs, IM/WM variance) with severity and SLA *so that* I can work the worst
first. **Acceptance:** one row per exception with type, severity (1–4), SLA hours, age, plant.
**Fulfilment: ✅ Fully — `gold_warehouse_exceptions`** (7-branch union). AC met. (The IM/WM-variance
branch inherits B4's coarse grain — variance *detection* works; *root-cause* is directional.)

---

## Epic C — Inbound (WMA-E-50 inbound)

### C1. Inbound backlog awaiting goods receipt
*As a* goods-in supervisor *I want* open inbound PO backlog by vendor/plant *so that* I can plan
receiving. **Acceptance:** open PO items/POs, ordered qty, open value, earliest PO date, QA-inspection
count; ideally remaining (ordered − received) qty and true GR status.
**Fulfilment: ⚠️ Partial — `gold_inbound_po_backlog` [PILOT].** Delivers open-PO backlog and the
counts/values in the AC. **Gap:** it is **PO backlog, not GR status** — no GR history (EKBE/MSEG 101),
inbound delivery/ASN, or remaining-vs-received qty, so the "true GR status / remaining qty" part of
the AC is **not met**. Honest naming applied; enrich with GR history to fully satisfy.

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
**Fulfilment: ✅ Fully (data) — `silver.process_order`** (+ `gold_process_order_schedule_adherence`,
`gold_shift_output_summary`). Header attributes and the corrected AUTYP=40 scope are present. The
flexible COOISPI selection/layout is a **BI-layer** concern over this table. AC met at data level.

### D2. Operation list
*As a* planner *I want* per-order operations (work centre, scheduled/actual dates, status) *so that*
I can see routing progress (COOISPI operation list).
**Acceptance:** operations per order with work centre and dates.
**Fulfilment: ⚠️ Partial — `silver.process_order_operation`** exists; **no dedicated Gold operation
list/KPI yet.** AC met at silver/BI level; a Gold operation view would make it first-class.

### D3. Component / reservation list
*As a* planner *I want* components (reservations) per order with requirement vs withdrawn qty *so
that* I can check material coverage (COOISPI component list).
**Acceptance:** components per order, required/withdrawn/open qty, requirement date.
**Fulfilment: ⚠️ Partial — `silver.reservation_requirement`** (+ `gold_dispensary_backlog` for the
261 line-pick subset). Full component list (all movement types, not just 261) is available at silver;
the Gold view today is the dispensary subset. AC met at silver level.

### D4. Confirmation list & production output
*As a* plant manager *I want* produced/scrap/yield and quality rate by plant (and ultimately by
shift) *so that* I can track output and quality (COOISPI confirmation list).
**Acceptance:** produced qty (101−102), scrap (551/552), yield, quality rate; by plant/period (and
shift).
**Fulfilment: ⚠️ Partial — `gold_shift_output_summary`, `gold_plant_production_quality_summary`.**
Output/scrap/quality are computed via the conformed movement classification. **Gaps:** (a) no **shift**
dimension yet (ADR 008 — config-seeded calendar); (b) the plant-quality summary is **all-time** (no
period grain). AC met for plant/day; shift- and period-grain pending.

### D5. Documented goods movements per order
*As an* analyst *I want* the goods movements posted against an order *so that* I can audit
consumption and output (COOISPI documented-goods-movements list).
**Acceptance:** movements with type, qty, posting date, debit/credit, order reference.
**Fulfilment: ✅ Fully (data) — `silver.goods_movement`** (keeps `movement_type_code`, `quantity`,
`posting_date`, debit/credit indicator, `order_number`). AC met at data level; surface as a BI list.

### D6. Process-order schedule adherence
*As a* planner *I want* process-order schedule adherence (actual vs scheduled finish, yield vs order
qty) *so that* I can measure production reliability.
**Acceptance:** on-time and in-full flags per completed/closed order.
**Fulfilment: ✅ Fully — `gold_process_order_schedule_adherence`.** AC met.

### D7. PEX-E-35 custom COOISPI report
*As a* planner *I want* the Kerry-specific COOISPI report (PEX-E-35) fields, selection and layout *so
that* it matches the existing operational report.
**Acceptance:** *to be confirmed from the PEX-E-35 spec.*
**Fulfilment: ⚠️ Unknown / blocked.** The standard COOISPI content (D1–D6) is largely covered by
`process_order`, `process_order_operation`, `reservation_requirement`, `goods_movement` and the Gold
order KPIs. **Gap:** PEX-E-35's specific custom fields, derived columns, and selection logic could
not be read (IRM-encrypted PDF). **Action:** confirm the spec, then map each custom field to a
Silver/Gold column and add any missing derivations before sign-off.

---

## Coverage summary

| Epic | Stories | ✅ Fully | ⚠️ Partial | ❌ / Blocked |
|---|---|---|---|---|
| A — Staging & transfer | A1–A6 | A1, A2, A3 | A4, A5, A6 | — |
| B — Stock & reconciliation | B1–B5 | B1, B2, B3, B5 | B4 | — |
| C — Inbound | C1 | — | C1 | — |
| D — Process-order info system | D1–D7 | D1, D5, D6 | D2, D3, D4 | D7 (spec blocked) |

**Themes in the gaps:** (1) WMA-E-50 execution fidelity (SSCC/pallet/TR-split) is blocked on
un-replicated Z-tables; (2) reconciliation/line-side/staging are **pilot-grade** pending ADR 009 +
config tables + LTAK validation; (3) shift- and period-grain reporting needs ADR 008; (4) PEX-E-35
needs a readable spec to finalise. None of the gaps are blockers for the ✅ stories, which are
production-usable today (subject to the security/CI/schema remediation in the open PRs).
