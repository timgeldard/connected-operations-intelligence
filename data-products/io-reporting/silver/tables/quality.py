"""
Quality domain tables — inspection lot (QALS) + usage decision (QAVE).

Implements the corrected functional model in docs/quality_qm_functional_model.md (§3, §4):
the imported single-table transform conflated three grains and used wrong fields throughout
(WERKS→WERK, LOTORIGIN→HERKUNFT, MENGE→LOSMENGE, MEINH→MENGENEINH, ENSTDE/EENDDE→PASTRTERM/
PAENDTERM, qmih.AUFNR→QALS.AUFNR, UD-fields-on-lot→QAVE child table, fabricated KZLOESCH).

RUN-ELIGIBILITY: the previous always-false AERUNID/AERECNO guard (the deliberate hold, §6 of the
model doc) was flipped to a real source-presence condition on 2026-06-11 — deliberate, approved
step (Tim Geldard), with BOTH preconditions of the hold satisfied in this module:
  * plant gate: apply_plant_gate(..., "quality") — qm_enabled_flag verified true for the active
    plant set (C061/P817) in UAT site_config_plant before the flip;
  * time gate: the QM tables are very large (UAT inspection_qals = 16.7M lots, all plants /
    2014→now), so lots are additionally gated to a configurable lookback window —
    `qm_lookback_years` pipeline conf, default 5. Plant + time gate together cut the lot scan to
    ~505k rows (~3%) for the pilot plants.

UAT bronze shape (verified live 2026-06-11):
  * Dates are ISO 'yyyy-MM-dd' with '0000-00-00' sentinels; AEDATTM is a real timestamp.
    sap_date handles both ISO and compact formats.
  * QAVE.VWERKS is NOT the lot's plant — it is 'R001' (central/responsible QM plant) on 15.47M of
    15.47M rows in Kerry's config. The model doc's "plant gate on VWERKS" (§9) would gate
    EVERYTHING out; usage decisions are therefore gated VIA THE PARENT LOT (PRUEFLOS inner join to
    the gated QALS set — the §7 gate-via-parent pattern), which also applies the time gate
    consistently.
  * VBEWERTUNG value domain CONFIRMED from data (was design-intent pending in §4): 'A' accepted /
    'R' rejected / blank (C061: 964k A, 4.4k R; P817: 123k A, 4.6k R).
  * UD multiplicity: exactly 1 UD per lot in the pilot plants' data (ZAEHLER blank, KZART='L') —
    the child grain (PRUEFLOS+KZART+ZAEHLER) still stands per SAP's design.

Ingestion model: SNAPSHOT MVs (full recompute, the batch_stock/MCHB current-state pattern), the
§6-sanctioned alternative to AEDATTM-sequenced streaming SCD1. Chosen deliberately over streaming:
  1. the lookback window is CONFIGURABLE — an MV self-corrects when qm_lookback_years changes
     (streaming SCD1 would need a manual full refresh: apply_changes never retro-purges keys);
  2. usage decisions derive plant via the QALS parent — in a stream, a QAVE row that arrives
     before its lot is inner-join-dropped and never reprocessed; an MV has no ordering hole;
  3. the quality pipeline is TRIGGERED / run-on-demand, and the gated volume (~505k lots, ~1.1M
     UDs) makes a full recompute cheap — streaming steady-state economics don't apply.
AEDATTM is carried as `_replicated_at` (extraction timestamp, NOT used for event ordering — same
note as MCHB).

The QM result-grain family (QAMV/QAMR/QASR/QASE — §8) remains ON HOLD: it serves the SPC /
Connected Quality surface, not these io-reporting consumers, and stays not-run-eligible per §9
until that workstream lands its own gate-via-parent flows.
"""

import dlt
from pyspark.sql import functions as F

from silver._plant_gate import apply_plant_gate
from silver.helpers import BRONZE, bronze_columns_exist, get_spark, sap_date, strip_zeros

# Columns each source must carry for the flows to be run-eligible (real presence test — replaces
# the always-false AERUNID/AERECNO hold; those CDC columns do NOT exist on QALS/QAVE and are no
# longer referenced).
_QALS_REQUIRED = [
    "PRUEFLOS", "MANDANT", "WERK", "ART", "HERKUNFT", "LOSMENGE", "MENGENEINH",
    "MATNR", "CHARG", "AUFNR", "PASTRTERM", "PAENDTERM", "ENSTEHDAT",
    "ERSTELLER", "ERSTELDAT", "AENDERER", "AENDERDAT", "AEDATTM",
]
_QAVE_REQUIRED = [
    "PRUEFLOS", "MANDANT", "KZART", "ZAEHLER", "VCODE", "VCODEGRP", "VBEWERTUNG",
    "VDATUM", "VNAME", "QKENNZAHL", "VFOLGEAKTI", "VWERKS", "AEDATTM",
]


def _qm_lookback_years(spark) -> int:
    """Configurable time gate for the very large QM sources (default 5 years).

    Set via the `qm_lookback_years` pipeline conf (resources/silver_quality_pipeline.pipeline.yml).
    Applied to QALS.ENSTEHDAT (lot creation) at the source read; the usage-decision child inherits
    it via the gate-via-parent join. Snapshot-MV recompute makes the window self-maintaining and
    self-correcting on config change (no manual full refresh)."""
    raw = spark.conf.get("qm_lookback_years", "5")
    years = int(str(raw).strip())
    if years <= 0:
        raise ValueError(f"qm_lookback_years must be a positive integer, got {raw!r}")
    return years


def _gated_qals(spark):
    """The plant- and time-gated QALS base both flows build on.

    Pre-gate pushdown (validated pattern): the time filter + plant gate apply at the source read,
    on the SAME axes as the output gate, so every downstream join/projection only ever sees
    in-scope lots (~3% of the 16.7M-row table)."""
    lookback = _qm_lookback_years(spark)
    qals = spark.read.table(f"{BRONZE}.inspection_qals")
    qals = qals.filter(
        sap_date("ENSTEHDAT") >= F.add_months(F.current_date(), -12 * lookback)
    )
    return apply_plant_gate(qals, "WERK", "quality", spark=spark)


# ── 1. QUALITY INSPECTION LOT (QALS, lot grain) ──────────────────────────────

if bronze_columns_exist("inspection_qals", _QALS_REQUIRED) and bronze_columns_exist("inspection_qave", _QAVE_REQUIRED):

    @dlt.table(
        name="quality_inspection_lot",
        comment=(
            "Quality inspection lots (QALS) — one row per lot, pilot plants, rolling "
            "qm_lookback_years window (default 5y) on lot creation date. Current-state snapshot "
            "(QALS has no CDC sequencing metadata — AEDATTM only). Usage decisions live in the "
            "1:many child quality_inspection_usage_decision, NOT on the lot."
        ),
        table_properties={
            "delta.enableChangeDataFeed": "true",
            "delta.autoOptimize.optimizeWrite": "true",
            "delta.autoOptimize.autoCompact": "true",
        },
        cluster_by=["plant_code", "inspection_start_date"],
    )
    @dlt.expect_all_or_drop({
        "inspection_lot_number present": "inspection_lot_number IS NOT NULL",
        "plant_code present": "plant_code IS NOT NULL",
    })
    @dlt.expect_all({
        "material_code present": "material_code IS NOT NULL",
        "inspection dates ordered":
            "inspection_start_date <= inspection_end_date "
            "OR inspection_start_date IS NULL OR inspection_end_date IS NULL",
    })
    def quality_inspection_lot():
        spark = get_spark()
        lots = _gated_qals(spark)
        return lots.select(
            # QM inspection objects use MANDANT, not MANDT (replicated-source convention, #27).
            F.col("MANDANT").alias("client"),
            F.col("PRUEFLOS").alias("inspection_lot_number"),
            F.col("WERK").alias("plant_code"),
            F.col("ART").alias("inspection_type"),
            F.col("HERKUNFT").alias("inspection_lot_origin_code"),
            F.col("LOSMENGE").alias("inspection_lot_quantity"),
            F.col("MENGENEINH").alias("inspection_lot_uom"),
            strip_zeros("MATNR").alias("material_code"),
            F.col("MATNR").alias("material_code_raw"),
            # CHARG is an exact SAP identifier — preserve as replicated (no strip/trim/normalise).
            F.col("CHARG").alias("batch_number"),
            F.col("CHARG").alias("batch_number_raw"),
            # Order number is QALS' own AUFNR — NOT routed through qualitymessage_qmih (lossy
            # 1:many notification join, dropped per model doc §5).
            strip_zeros("AUFNR").alias("order_number"),
            F.col("AUFNR").alias("order_number_raw"),

            # Planned inspection window, lot grain (PASTRTERM/PAENDTERM). Lot creation is a
            # DISTINCT date (ENSTEHDAT) — not the inspection start.
            sap_date("PASTRTERM").alias("inspection_start_date"),
            sap_date("PAENDTERM").alias("inspection_end_date"),
            sap_date("ENSTEHDAT").alias("lot_created_date"),

            F.col("ERSTELLER").alias("created_by"),
            sap_date("ERSTELDAT").alias("created_date"),
            F.col("AENDERER").alias("updated_by"),
            sap_date("AENDERDAT").alias("updated_on"),

            # Extraction timestamp only — NOT an event-ordering column (MCHB note).
            F.col("AEDATTM").cast("timestamp").alias("_replicated_at"),
        )

    # ── 2. QUALITY INSPECTION USAGE DECISION (QAVE, UD grain — 1:many per lot) ──

    @dlt.table(
        name="quality_inspection_usage_decision",
        comment=(
            "Usage decisions (QAVE) — one row per decision (PRUEFLOS+KZART+ZAEHLER); a lot can "
            "carry many. Accept/reject is VBEWERTUNG (A/R, confirmed from data), NOT the "
            "plant-configurable VCODE catalog code. Plant- and time-gated via the parent QALS lot "
            "(QAVE.VWERKS is the central responsible plant 'R001', not the lot's plant). "
            "Current-state snapshot (AEDATTM only)."
        ),
        table_properties={
            "delta.enableChangeDataFeed": "true",
            "delta.autoOptimize.optimizeWrite": "true",
            "delta.autoOptimize.autoCompact": "true",
        },
        cluster_by=["plant_code", "usage_decision_date"],
    )
    @dlt.expect_all_or_drop({
        "inspection_lot_number present": "inspection_lot_number IS NOT NULL",
        "plant_code present": "plant_code IS NOT NULL",
    })
    @dlt.expect_all({
        "valuation in confirmed domain":
            "usage_decision_valuation IN ('A', 'R', '') OR usage_decision_valuation IS NULL",
    })
    def quality_inspection_usage_decision():
        spark = get_spark()
        # Gate-via-parent: PRUEFLOS is QALS' PK, so this inner join filters (plant + time window)
        # and enriches the lot's plant without fan-out.
        lot_keys = _gated_qals(spark).select(
            F.col("PRUEFLOS").alias("_lot_prueflos"),
            F.col("WERK").alias("_lot_plant"),
        )
        qave = spark.read.table(f"{BRONZE}.inspection_qave")
        gated = qave.join(
            lot_keys, qave["PRUEFLOS"] == F.col("_lot_prueflos"), "inner"
        )
        out = gated.select(
            F.col("MANDANT").alias("client"),
            F.col("PRUEFLOS").alias("inspection_lot_number"),
            F.col("_lot_plant").alias("plant_code"),
            F.col("KZART").alias("inspection_lot_type"),
            F.col("ZAEHLER").alias("usage_decision_counter"),
            F.col("VCODE").alias("usage_decision_code"),
            F.col("VCODEGRP").alias("usage_decision_code_group"),
            F.col("VBEWERTUNG").alias("usage_decision_valuation"),
            # Derived label from the CONFIRMED VBEWERTUNG domain (A/R/blank, UAT 2026-06-11);
            # raw valuation is surfaced alongside so the mapping stays auditable.
            F.when(F.col("VBEWERTUNG") == "A", "Accepted")
             .when(F.col("VBEWERTUNG") == "R", "Rejected")
             .when(F.trim(F.col("VBEWERTUNG")) != "", "Other Decision")
             .otherwise(None).alias("usage_decision"),
            sap_date("VDATUM").alias("usage_decision_date"),
            F.col("VNAME").alias("usage_decision_by"),
            F.col("QKENNZAHL").alias("quality_score"),
            F.col("VFOLGEAKTI").alias("follow_up_action"),
            # The CENTRAL responsible QM plant (constant 'R001' in Kerry's config) — kept as
            # evidence for why the gate goes via the parent lot; NOT the lot's plant.
            F.col("VWERKS").alias("responsible_plant_code"),
            F.col("AEDATTM").cast("timestamp").alias("_replicated_at"),
        )
        # Authoritative output gate on the derived plant (pre-gate pushdown keeps it cheap;
        # same belt-and-braces as batch_stock).
        return apply_plant_gate(out, "plant_code", "quality", spark=spark)
