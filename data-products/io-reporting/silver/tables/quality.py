"""
Quality domain tables — inspection lot (QALS) + usage decision (QAVE) + result family (QAMV/QAMR/QASR/QASE).

Implements the corrected functional model in docs/quality_qm_functional_model.md (§3, §4):
the imported single-table transform conflated three grains and used wrong fields throughout
(WERKS→WERK, LOTORIGIN→HERKUNFT, MENGE→LOSMENGE, MEINH→MENGENEINH, ENSTDE/EENDDE→PASTRTERM/
PAENDTERM, qmih.AUFNR→QALS.AUFNR, UD-fields-on-lot→QAVE child table, fabricated KZLOESCH).

RUN-ELIGIBILITY (lot + UD — §3/§4): the previous always-false AERUNID/AERECNO guard (the
deliberate hold, §6 of the model doc) was flipped to a real source-presence condition on
2026-06-11 — deliberate, approved step (Tim Geldard), with BOTH preconditions of the hold
satisfied in this module:
  * plant gate: apply_plant_gate(..., "quality") — qm_enabled_flag verified true for the active
    plant set (C061/P817) in UAT site_config_plant before the flip;
  * time gate: the QM tables are very large (UAT inspection_qals = 16.7M lots, all plants /
    2014→now), so lots are additionally gated to a configurable lookback window —
    `qm_lookback_years` pipeline conf, default 5. Plant + time gate together cut the lot scan to
    ~505k rows (~3%) for the pilot plants.

RUN-ELIGIBILITY (result family — §8): the hold on the result-grain family (QAMV/QAMR/QASR/QASE)
is LIFTED as of 2026-06-11 (SPC Phase 1, WP1.2 — Tim Geldard). The hold was pending the
two-tier spc gate landing (PR #79). Preconditions now satisfied:
  * spc gate present: apply_plant_gate(..., "spc") — requires BOTH qm_enabled_flag AND
    spc_enabled_flag in site_config_plant (silver/_plant_gate.py, two-tier QM rule);
  * gate-via-parent: all four result tables carry no WERK; plant derives via inner join on
    PRUEFLOS to the spc-gated lot set (_gated_qals with product_area="spc");
  * time gate: inherited from _gated_qals (same qm_lookback_years window);
  * UAT volume verified 2026-06-11: gated qamv 8.3M, qamr 7.0M, qasr 10.3M, qase 0.7M
    (~26M total across 4 tables, 4 plants × 5y) — snapshot MVs correct on daily refresh cadence.

UAT bronze shape (verified live 2026-06-11):
  * Dates are ISO 'yyyy-MM-dd' with '0000-00-00' sentinels; AEDATTM is a real timestamp.
    sap_date handles both ISO and compact formats.
  * QAVE.VWERKS is NOT the lot's plant — it is 'R001' (central/responsible QM plant) on 15.47M of
    15.47M rows in Kerry's config. The model doc's "plant gate on VWERKS" (§9) would gate
    EVERYTHING out; usage decisions are therefore gated VIA THE PARENT LOT (PRUEFLOS inner join to
    the gated QALS set — the §7 gate-via-parent pattern), which also applies the time gate
    consistently.
  * VBEWERTUNG value domain CONFIRMED from data (was design-intent pending in §4): 'A' accepted /
    'R' rejected / blank (C061: 964k A, 4.4k R; P817: 123k A, 4.6k R). Small 'F' count also
    observed — mapped to "Other Decision" (same as any other non-blank, non-A/R code).
  * UD multiplicity: exactly 1 UD per lot in the pilot plants' data (ZAEHLER blank, KZART='L') —
    the child grain (PRUEFLOS+KZART+ZAEHLER) still stands per SAP's design.
  * SPCKRIT (QAMV): 100% blank in Kerry's config — column retained for contract completeness but
    NOTHING filters on it; see quality_inspection_characteristic table below.

Ingestion model: SNAPSHOT MVs (full recompute, the batch_stock/MCHB current-state pattern), the
§6-sanctioned alternative to AEDATTM-sequenced streaming SCD1. Chosen deliberately over streaming:
  1. the lookback window is CONFIGURABLE — an MV self-corrects when qm_lookback_years changes
     (streaming SCD1 would need a manual full refresh: apply_changes never retro-purges keys);
  2. usage decisions derive plant via the QALS parent — in a stream, a QAVE row that arrives
     before its lot is inner-join-dropped and never reprocessed; an MV has no ordering hole;
  3. the quality pipeline is TRIGGERED / run-on-demand, and the gated volume (~505k lots, ~1.1M
     UDs) makes a full recompute cheap — streaming steady-state economics don't apply.
  4. the result family (§8) exhibits the same AEDATTM-only / no-WERK pattern; snapshot MVs under
     the spc gate reproduce the same self-correcting, ordering-hole-free properties.
AEDATTM is carried as `_replicated_at` (extraction timestamp, NOT used for event ordering — same
note as MCHB).
"""

import dlt
from pyspark.sql import functions as F

from silver._plant_gate import apply_plant_gate
from silver.helpers import BRONZE, bronze_columns_exist, get_spark, sap_date, strip_zeros

# Columns each source must carry for the flows to be run-eligible (real presence test — replaces
# the always-false AERUNID/AERECNO hold; those CDC columns do NOT exist on QALS/QAVE and are no
# longer referenced). All QM sources are AEDATTM-only (no AERUNID/AERECNO).
_QALS_REQUIRED = [
    "PRUEFLOS", "MANDANT", "WERK", "ART", "HERKUNFT", "LOSMENGE", "MENGENEINH",
    "MATNR", "CHARG", "AUFNR", "PASTRTERM", "PAENDTERM", "ENSTEHDAT",
    "ERSTELLER", "ERSTELDAT", "AENDERER", "AENDERDAT", "AEDATTM",
]
_QAVE_REQUIRED = [
    "PRUEFLOS", "MANDANT", "KZART", "ZAEHLER", "VCODE", "VCODEGRP", "VBEWERTUNG",
    "VDATUM", "VNAME", "QKENNZAHL", "VFOLGEAKTI", "VWERKS", "AEDATTM",
]
# Result-family required columns (§8 — spc gate, AEDATTM-only, no WERK on any result table).
_QAMV_REQUIRED = [
    "PRUEFLOS", "VORGLFNR", "MERKNR", "MANDANT", "SOLLWERT", "TOLERANZOB",
    "TOLERANZUN", "KURZTEXT", "PMETHODE", "MASSEINHSW", "VERWMERKM", "MKVERSION",
    "KZEINSTELL", "SPCKRIT", "STELLEN", "AEDATTM",
]
_QAMR_REQUIRED = [
    "PRUEFLOS", "VORGLFNR", "MERKNR", "MANDANT", "MITTELWERT", "CODE1",
    "MBEWERTG", "ANZFEHLER", "PRUEFDATUV", "PRUEFDATUB", "PRUEFER",
    "MINWERT", "MAXWERT", "AEDATTM",
]
_QASR_REQUIRED = [
    "PRUEFLOS", "VORGLFNR", "MERKNR", "PROBENR", "MANDANT", "MITTELWERT",
    "CODE1", "MBEWERTG", "AEDATTM",
]
_QASE_REQUIRED = [
    "PRUEFLOS", "VORGLFNR", "MERKNR", "PROBENR", "DETAILERG", "MANDANT",
    "MESSWERT", "CODE1", "MBEWERTG", "AEDATTM",
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


def _gated_qals(spark, product_area="quality"):
    """The plant- and time-gated QALS base that all quality flows build on.

    Pre-gate pushdown (validated pattern): the time filter + plant gate apply at the source read,
    on the SAME axes as the output gate, so every downstream join/projection only ever sees
    in-scope lots (~3% of the 16.7M-row table).

    `product_area` controls which site_config_plant flags are required:
      "quality" (default) — qm_enabled_flag only (lot + UD tables, unchanged behaviour);
      "spc"               — qm_enabled_flag AND spc_enabled_flag (result-family tables, §8).
    The default keeps lot/UD behaviour byte-identical; the result family passes "spc" to pick up
    the two-tier spc gate (PR #79)."""
    lookback = _qm_lookback_years(spark)
    qals = spark.read.table(f"{BRONZE}.inspection_qals")
    qals = qals.filter(
        sap_date("ENSTEHDAT") >= F.add_months(F.current_date(), -12 * lookback)
    )
    return apply_plant_gate(qals, "WERK", product_area, spark=spark)


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
        out = lots.select(
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
        # Authoritative output gate (pre-gated in _gated_qals on the same axis; kept as the
        # belt-and-braces final gate, same as batch_stock).
        return apply_plant_gate(out, "plant_code", "quality", spark=spark)

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
        # Client-qualified join (PRUEFLOS unique per client; single-client today, robust to multi-client bronze).
        lot_keys = _gated_qals(spark).select(
            F.col("PRUEFLOS").alias("_lot_prueflos"),
            F.col("MANDANT").alias("_lot_client"),
            F.col("WERK").alias("_lot_plant"),
        )
        qave = spark.read.table(f"{BRONZE}.inspection_qave")
        gated = qave.join(
            lot_keys,
            (qave["PRUEFLOS"] == F.col("_lot_prueflos")) & (qave["MANDANT"] == F.col("_lot_client")),
            "inner",
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

# ── RESULT FAMILY — SPC GATE (§8, SPC Phase 1, WP1.2, 2026-06-11) ───────────
#
# All four result tables (QAMV/QAMR/QASR/QASE) are AEDATTM-only and carry NO plant field.
# Plant is derived via inner join of PRUEFLOS to the spc-gated lot set (_gated_qals("spc")).
# The spc gate requires BOTH qm_enabled_flag AND spc_enabled_flag (two-tier QM rule, PR #79).
# Snapshot MV pattern (same rationale as lot + UD above); time gate inherited from _gated_qals.
#
# MBEWERTG value domain (UAT 2026-06-11): 'A' accepted / 'R' rejected / blank / small 'F' count
# — any non-blank, non-A/R code maps to "Other Decision" (matches UD table's VBEWERTUNG logic).

if (
    bronze_columns_exist("inspection_qals", _QALS_REQUIRED)
    and bronze_columns_exist("inspection_qamv", _QAMV_REQUIRED)
    and bronze_columns_exist("inspection_qamr", _QAMR_REQUIRED)
    and bronze_columns_exist("inspection_qasr", _QASR_REQUIRED)
    and bronze_columns_exist("inspection_qase", _QASE_REQUIRED)
):

    # ── 3. QUALITY INSPECTION CHARACTERISTIC (QAMV, MIC spec — PK PRUEFLOS+VORGLFNR+MERKNR) ──

    @dlt.table(
        name="quality_inspection_characteristic",
        comment=(
            "MIC spec per inspection lot × operation × characteristic (QAMV) — one row per "
            "PRUEFLOS+VORGLFNR+MERKNR. Supplies SPC spec limits (nominal_target/usl_spec/lsl_spec) "
            "and characteristic metadata. Plant- and time-gated via the parent QALS lot under the "
            "spc gate (qm_enabled_flag AND spc_enabled_flag). Current-state snapshot (AEDATTM only)."
        ),
        table_properties={
            "delta.enableChangeDataFeed": "true",
            "delta.autoOptimize.optimizeWrite": "true",
            "delta.autoOptimize.autoCompact": "true",
        },
        cluster_by=["plant_code", "inspection_lot_number"],
    )
    @dlt.expect_all_or_drop({
        "inspection_lot_number present": "inspection_lot_number IS NOT NULL",
        "plant_code present": "plant_code IS NOT NULL",
    })
    @dlt.expect_all({
        "operation_id present": "operation_id IS NOT NULL",
        "mic_id present": "mic_id IS NOT NULL",
    })
    def quality_inspection_characteristic():
        spark = get_spark()
        # Gate-via-parent: inner join on PRUEFLOS to the spc-gated lot set to filter (plant +
        # time window) and derive plant_code. QAMV carries no WERK.
        # Do NOT use QMTB_WERKS/QPMK_WERKS as plant — they are the inspection method / MIC master
        # plants, which can differ from the lot's plant (§8a note in the functional model doc).
        lot_keys = _gated_qals(spark, product_area="spc").select(
            F.col("PRUEFLOS").alias("_lot_prueflos"),
            F.col("MANDANT").alias("_lot_client"),
            F.col("WERK").alias("_lot_plant"),
        )
        qamv = spark.read.table(f"{BRONZE}.inspection_qamv")
        gated = qamv.join(
            lot_keys,
            (qamv["PRUEFLOS"] == F.col("_lot_prueflos")) & (qamv["MANDANT"] == F.col("_lot_client")),
            "inner",
        )
        out = gated.select(
            # QM inspection objects use MANDANT, not MANDT (replicated-source convention, #27).
            F.col("MANDANT").alias("client"),
            F.col("PRUEFLOS").alias("inspection_lot_number"),
            # VORGLFNR = inspection-operation routing line (NOT an SAP work centre; work centres
            # are CRHD/CRTX objects. This is the operation sequence within the inspection plan).
            F.col("VORGLFNR").alias("operation_id"),
            F.col("MERKNR").alias("mic_id"),
            F.col("SOLLWERT").alias("nominal_target"),
            F.col("TOLERANZOB").alias("usl_spec"),
            F.col("TOLERANZUN").alias("lsl_spec"),
            F.col("KURZTEXT").alias("mic_name"),
            F.col("PMETHODE").alias("inspection_method"),
            F.col("MASSEINHSW").alias("uom"),
            F.col("VERWMERKM").alias("mic_code"),
            F.col("MKVERSION").alias("mic_version"),
            F.col("KZEINSTELL").alias("characteristic_type"),
            # SPCKRIT: 100% blank in Kerry's config (UAT recon 2026-06-11). Column retained for
            # contract completeness and future use; NOTHING in this pipeline may filter on it.
            F.col("SPCKRIT").alias("spc_criterion"),
            F.col("STELLEN").alias("decimal_places"),
            F.col("_lot_plant").alias("plant_code"),
            # Extraction timestamp only — NOT an event-ordering column (MCHB note).
            F.col("AEDATTM").cast("timestamp").alias("_replicated_at"),
        )
        # Authoritative output gate (pre-gated via lot keys on the same spc axis; belt-and-braces
        # final gate, same pattern as batch_stock and the lot/UD tables).
        return apply_plant_gate(out, "plant_code", "spc", spark=spark)

    # ── 4. QUALITY INSPECTION RESULT (QAMR, MIC result — PK PRUEFLOS+VORGLFNR+MERKNR) ──

    @dlt.table(
        name="quality_inspection_result",
        comment=(
            "MIC-level inspection results (QAMR) — one row per PRUEFLOS+VORGLFNR+MERKNR. "
            "Contains quantitative/qualitative result, MBEWERTG accept/reject valuation, and "
            "result-recording dates (PRUEFDATUV/PRUEFDATUB — distinct from the lot's planned "
            "inspection window PASTRTERM/PAENDTERM). Plant- and time-gated via parent QALS lot "
            "under the spc gate. Current-state snapshot (AEDATTM only)."
        ),
        table_properties={
            "delta.enableChangeDataFeed": "true",
            "delta.autoOptimize.optimizeWrite": "true",
            "delta.autoOptimize.autoCompact": "true",
        },
        cluster_by=["plant_code", "inspection_lot_number"],
    )
    @dlt.expect_all_or_drop({
        "inspection_lot_number present": "inspection_lot_number IS NOT NULL",
        "plant_code present": "plant_code IS NOT NULL",
    })
    @dlt.expect_all({
        "operation_id present": "operation_id IS NOT NULL",
        "mic_id present": "mic_id IS NOT NULL",
    })
    def quality_inspection_result():
        spark = get_spark()
        # Gate-via-parent: PRUEFLOS inner join to spc-gated lot set to filter + derive plant_code.
        lot_keys = _gated_qals(spark, product_area="spc").select(
            F.col("PRUEFLOS").alias("_lot_prueflos"),
            F.col("MANDANT").alias("_lot_client"),
            F.col("WERK").alias("_lot_plant"),
        )
        qamr = spark.read.table(f"{BRONZE}.inspection_qamr")
        gated = qamr.join(
            lot_keys,
            (qamr["PRUEFLOS"] == F.col("_lot_prueflos")) & (qamr["MANDANT"] == F.col("_lot_client")),
            "inner",
        )
        out = gated.select(
            F.col("MANDANT").alias("client"),
            F.col("PRUEFLOS").alias("inspection_lot_number"),
            F.col("VORGLFNR").alias("operation_id"),
            F.col("MERKNR").alias("mic_id"),
            F.col("MITTELWERT").alias("quantitative_result"),
            F.col("CODE1").alias("qualitative_result"),
            F.col("MBEWERTG").alias("inspection_result_valuation"),
            # Derived label from the CONFIRMED MBEWERTG domain (A/R/blank/small-F, UAT 2026-06-11);
            # raw valuation surfaced alongside so the mapping stays auditable. 'F' code observed
            # in UAT at small count — falls through to "Other Decision" (non-blank, non-A/R).
            F.when(F.col("MBEWERTG") == "A", "Accepted")
             .when(F.col("MBEWERTG") == "R", "Rejected")
             .when(F.trim(F.col("MBEWERTG")) != "", "Other Decision")
             .otherwise(None).alias("inspection_result"),
            F.col("ANZFEHLER").alias("number_of_defects_found"),
            # Result-RECORDING dates — when the inspector entered results into the system.
            # Distinct from the lot's planned inspection window (PASTRTERM/PAENDTERM on QALS, §3).
            sap_date("PRUEFDATUV").alias("result_recording_start_date"),
            sap_date("PRUEFDATUB").alias("result_recording_end_date"),
            F.col("PRUEFER").alias("inspector"),
            F.col("MINWERT").alias("min_value"),
            F.col("MAXWERT").alias("max_value"),
            F.col("_lot_plant").alias("plant_code"),
            # Extraction timestamp only — NOT an event-ordering column (MCHB note).
            F.col("AEDATTM").cast("timestamp").alias("_replicated_at"),
        )
        return apply_plant_gate(out, "plant_code", "spc", spark=spark)

    # ── 5. QUALITY INSPECTION SAMPLE RESULT (QASR, sample grain — PK +PROBENR) ──

    @dlt.table(
        name="quality_inspection_sample_result",
        comment=(
            "Per-sample inspection results (QASR) — one row per PRUEFLOS+VORGLFNR+MERKNR+PROBENR. "
            "MITTELWERT is the per-SAMPLE MEAN (aggregate over individual readings within the "
            "sample), distinct from QASE.MESSWERT which is the raw individual reading. Plant- and "
            "time-gated via parent QALS lot under the spc gate. Current-state snapshot (AEDATTM only)."
        ),
        table_properties={
            "delta.enableChangeDataFeed": "true",
            "delta.autoOptimize.optimizeWrite": "true",
            "delta.autoOptimize.autoCompact": "true",
        },
        cluster_by=["plant_code", "inspection_lot_number"],
    )
    @dlt.expect_all_or_drop({
        "inspection_lot_number present": "inspection_lot_number IS NOT NULL",
        "plant_code present": "plant_code IS NOT NULL",
    })
    @dlt.expect_all({
        "operation_id present": "operation_id IS NOT NULL",
        "mic_id present": "mic_id IS NOT NULL",
        "sample_number present": "sample_number IS NOT NULL",
    })
    def quality_inspection_sample_result():
        spark = get_spark()
        lot_keys = _gated_qals(spark, product_area="spc").select(
            F.col("PRUEFLOS").alias("_lot_prueflos"),
            F.col("MANDANT").alias("_lot_client"),
            F.col("WERK").alias("_lot_plant"),
        )
        qasr = spark.read.table(f"{BRONZE}.inspection_qasr")
        gated = qasr.join(
            lot_keys,
            (qasr["PRUEFLOS"] == F.col("_lot_prueflos")) & (qasr["MANDANT"] == F.col("_lot_client")),
            "inner",
        )
        out = gated.select(
            F.col("MANDANT").alias("client"),
            F.col("PRUEFLOS").alias("inspection_lot_number"),
            F.col("VORGLFNR").alias("operation_id"),
            F.col("MERKNR").alias("mic_id"),
            F.col("PROBENR").alias("sample_number"),
            # MITTELWERT here is the per-SAMPLE MEAN (aggregated over the sample's individual
            # readings). Compare QASE.MESSWERT — the raw individual reading at the deepest grain.
            F.col("MITTELWERT").alias("quantitative_result"),
            F.col("CODE1").alias("qualitative_result"),
            F.col("MBEWERTG").alias("inspection_result_valuation"),
            F.when(F.col("MBEWERTG") == "A", "Accepted")
             .when(F.col("MBEWERTG") == "R", "Rejected")
             .when(F.trim(F.col("MBEWERTG")) != "", "Other Decision")
             .otherwise(None).alias("inspection_result"),
            F.col("_lot_plant").alias("plant_code"),
            # Extraction timestamp only — NOT an event-ordering column (MCHB note).
            F.col("AEDATTM").cast("timestamp").alias("_replicated_at"),
        )
        return apply_plant_gate(out, "plant_code", "spc", spark=spark)

    # ── 6. QUALITY INSPECTION INDIVIDUAL RESULT (QASE, individual grain — PK +DETAILERG) ──

    @dlt.table(
        name="quality_inspection_individual_result",
        comment=(
            "Individual inspection readings (QASE) — one row per "
            "PRUEFLOS+VORGLFNR+MERKNR+PROBENR+DETAILERG. MESSWERT is the RAW individual reading "
            "(NOT a sample mean — that is QASR.MITTELWERT). This is the deepest result grain, "
            "feeding SPC chart individual values. Plant- and time-gated via parent QALS lot under "
            "the spc gate. Current-state snapshot (AEDATTM only)."
        ),
        table_properties={
            "delta.enableChangeDataFeed": "true",
            "delta.autoOptimize.optimizeWrite": "true",
            "delta.autoOptimize.autoCompact": "true",
        },
        cluster_by=["plant_code", "inspection_lot_number"],
    )
    @dlt.expect_all_or_drop({
        "inspection_lot_number present": "inspection_lot_number IS NOT NULL",
        "plant_code present": "plant_code IS NOT NULL",
    })
    @dlt.expect_all({
        "operation_id present": "operation_id IS NOT NULL",
        "mic_id present": "mic_id IS NOT NULL",
        "sample_number present": "sample_number IS NOT NULL",
        "individual_result_number present": "individual_result_number IS NOT NULL",
    })
    def quality_inspection_individual_result():
        spark = get_spark()
        lot_keys = _gated_qals(spark, product_area="spc").select(
            F.col("PRUEFLOS").alias("_lot_prueflos"),
            F.col("MANDANT").alias("_lot_client"),
            F.col("WERK").alias("_lot_plant"),
        )
        qase = spark.read.table(f"{BRONZE}.inspection_qase")
        gated = qase.join(
            lot_keys,
            (qase["PRUEFLOS"] == F.col("_lot_prueflos")) & (qase["MANDANT"] == F.col("_lot_client")),
            "inner",
        )
        out = gated.select(
            F.col("MANDANT").alias("client"),
            F.col("PRUEFLOS").alias("inspection_lot_number"),
            F.col("VORGLFNR").alias("operation_id"),
            F.col("MERKNR").alias("mic_id"),
            F.col("PROBENR").alias("sample_number"),
            F.col("DETAILERG").alias("individual_result_number"),
            # MESSWERT = the RAW individual reading (deepest grain). NOT MITTELWERT (which is the
            # sample mean on QASR). This column feeds the SPC chart individual-value array.
            F.col("MESSWERT").alias("quantitative_result"),
            F.col("CODE1").alias("qualitative_result"),
            F.col("MBEWERTG").alias("inspection_result_valuation"),
            F.when(F.col("MBEWERTG") == "A", "Accepted")
             .when(F.col("MBEWERTG") == "R", "Rejected")
             .when(F.trim(F.col("MBEWERTG")) != "", "Other Decision")
             .otherwise(None).alias("inspection_result"),
            F.col("_lot_plant").alias("plant_code"),
            # Extraction timestamp only — NOT an event-ordering column (MCHB note).
            F.col("AEDATTM").cast("timestamp").alias("_replicated_at"),
        )
        return apply_plant_gate(out, "plant_code", "spc", spark=spark)
