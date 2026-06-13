# Spec 20 — Quality Release Ageing & Service Impact (QRS) — MVP4

Read `docs/specs/_conventions.md`, `docs/specs/16-operational-risk-foundation.md`,
`docs/specs/06-readiness-quality-release.md`, `docs/specs/07-qm-characteristic-drill.md`, and
`docs/specs/03-expiry-shelf-life-risk.md` first. Branch: `feature/quality-release-ageing`.
Depends on spec 16; extends the QM lot/UD + MIC-result + expiry work (does not rebuild it).

## Objective

Which batches/inspection lots are blocked, why, how long, and what production orders / stock /
deliveries / customers are affected. Answers the quality-hold service-impact questions with
**conservative, source-truthful language**. Read-only.

## Grounding (verify aliases; mind the gotchas)

`gold_wm_qm_lot_status` (lot/UD state), the readiness QM dimension (spec 06), the QM characteristic/
MIC drill (spec 07 — QAMR/QASR result grain), `gold_wm_expiry_risk` (spec 03 — shelf-life), and
delivery/customer via `gold/warehouse_flow_gold.py` (`gold_delivery_pick_status`, outbound_delivery
→ `ship_to_customer`/`planned_goods_issue_date`). **QAMR-stall caveat (backlog §4):** MIC-result
depth is C351-only until replication clears — scope result-level detail accordingly, surface
`Unknown` elsewhere, don't imply completeness. **QAVE central-plant gotcha:** QAVE.VWERKS='R001' is
the central plant, NOT the lot plant — gate via the parent QALS plant, per the existing QM pattern.

## Design

1. **Gold `gold_wm_quality_release_ageing`** — lot/batch grain awaiting disposition: plant_code
   (from parent QALS, NOT QAVE — see prerequisite below), material+desc, batch, inspection_lot, process_order, stock_qty,
   stock_status, lot_status, ud_status, the ageing basis timestamps, priority inputs, confidence.
   Reuse `gold_wm_qm_lot_status`. **⚠ PREREQUISITE — the existing `gold_wm_qm_lot_status` currently
   carries the QAVE bug this spec warns about:** in `wm_operations_gold.py` (~L1603–1615) `latest_ud`
   groups the UD frame (QAVE) by `plant_code` — which is always the central `'R001'` — and then
   joins to lots (QALS) on `["plant_code", "inspection_lot"]`, so the UD join silently mismatches
   for any lot whose real plant ≠ R001. Before QRS reuses this table for plant-correct ageing, that
   join MUST be fixed (gate/derive plant from the parent QALS, drop QAVE.VWERKS from the join key).
   Treat this as a precursor fix (raise it as its own small PR / backlog item); do NOT inherit the
   bug into the new ageing table.
2. **Ageing basis** (QRS-002): carry the candidate start timestamps (lot creation / GR / batch mfg
   date / order completion / first-or-last result / UD-due) in gold; the **age = now − basis** is
   computed query-time, and the **selected basis is a visible field/param** (default documented).
3. **Block-reason** (QRS-003) from the foundation taxonomy: UD-missing / lot-open /
   MIC-result-missing / MIC-result-failed / out-of-spec / pending-review / CoA-missing / in-QI-stock
   / restricted-blocked-stock / deviation-open / source-incomplete / **Unknown**.
4. **Conservative language** (QRS-004 — CRITICAL): NEVER emit "Released / Approved / Can release /
   Cleared / Safe to ship" unless a governed source semantic exists. Use "Usage decision recorded /
   Quality evidence pending / Inspection incomplete / Blocked stock / Source verification pending /
   Requires quality review". The foundation's **wording guard fails the build** on prohibited terms
   — call this out; the view/labels must use the approved phrasing only.
5. **Service-impact linkage** (QRS-005/006/007): join held batch → outbound deliveries / sales
   orders / customers / STOs (customer exposure: delivery, customer, planned GI, qty, pick/ship
   status, time-to-ship [query-time]); and → dependent production orders (line, scheduled start,
   required qty, available-unrestricted qty, held qty, shortfall). **Alternative-stock check**
   (QRS-008): available / partial / none / **Unknown** unrestricted stock for the same
   material+plant.
6. **Prioritisation** (QRS-009, explainable): age, customer-delivery impact, production impact,
   qty, material criticality, expiry/shelf-life risk (reuse spec 03), #affected orders, confidence.
   Time-relative parts query-time; surface components (explainability, like ORC).
7. **MIC/result drill** (QRS-010): characteristics, result status/values, specs where available,
   failed/missing MICs, result timestamps, UD evidence, CoA-like evidence — reuse spec 07; respect
   QAMR-stall scope (C351 full, others `Unknown`).
8. **UD analytics** (QRS-011): UD ageing, code distribution, avg-time-to-UD by plant/material,
   late-UD count, repeated-delay by inspection type, open lots by responsible area.
9. **Release lead-time** (QRS-012) by plant/material/material-group/inspection-type/supplier/line/
   batch-family; **bottleneck Pareto** (QRS-013): missing MICs / failing MICs / lot status /
   materials / suppliers / plants / labs / missing CoA-deviation.
10. **Confidence** (QRS-014, foundation helper): High (lot+batch+stock+UD+MIC+impact) / Medium /
    Low / Unknown. **Risk emission:** held-batch rows feed `gold_operational_risk_item`
    (domain=quality, reasons QUALITY_HOLD / UD_MISSING / INSPECTION_LOT_OPEN / MIC_RESULT_*).

## Backend + Frontend

Consumption views (ageing queue, customer-exposure, production-impact, UD analytics, lead-time,
Pareto), contracts, OKF, SQL (all variants). View: ageing queue (sorted by priority) with visible
ageing-basis, block-reason chips, service-impact panels (customer + production), alternative-stock
indicator, MIC/result drill, UD analytics + bottleneck Pareto. **Read-only** (QRS-015) — no UD post
/ release / SAP QM write (foundation wording guard). Configurable-cadence react-query. Ageing
thresholds + UD-code mappings configurable per SHD-008.

## Gotchas

- **Conservative language is paramount** — the wording guard is non-negotiable; a planted "Release
  batch" string must fail CI. No view label may imply disposition the source doesn't assert.
- **QAVE='R001' central-plant** — gate plant via parent QALS, not QAVE.VWERKS (existing QM pattern).
- **QAMR stall** — result depth C351-only; elsewhere `Unknown`, not "no issues".
- plant_code axis on lot×stock×delivery joins (conventions §2 — drop non-axis plant).
- Ageing-as-of-now / time-to-ship / priority blend = query-time; basis timestamps = gold.

## Acceptance

- Fixtures: a held batch with an open customer delivery surfaces the exposure (delivery+customer+
  time-to-ship); a held material with no alternative unrestricted stock shows `none`; a
  missing-evidence lot is `Unknown`, never "released/cleared"; ageing basis is visible and the age
  recomputes query-time.
- Wording guard fails on prohibited terms, passes on approved phrasing.
- `tests/golden/qrs.md` (golden held batch → expected reason, age, customer/production impact).
- Determinism guard passes; QAVE gated via QALS; read-only.
