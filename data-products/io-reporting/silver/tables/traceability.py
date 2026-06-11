"""
Traceability domain tables — batch where-used (CHVW).

T1 of the governed traceability migration (ADR 016: traceability window, estate lifecycle scope,
and two-tier Unity Catalog security).

Source: `connected_plant_uat.sap.batchwhereusedlist_chvw` — fully replicated, AEDATTM-only (no
AERUNID/AERECNO → snapshot MV pattern, same rationale as MCHB/QALS). CHVW is the SAP batch
classification where-used list: each row records one consumption or transfer event that involved
a batch.

INGESTION MODEL — SNAPSHOT MV (not streaming SCD1):
  1. AEDATTM-only: no CDC sequencing metadata (AERUNID/AERECNO absent) — deterministic SCD1
     is not possible; snapshot MV (full-recompute on every pipeline run) is the correct model.
  2. `trace_lookback_years` configurable window: an MV self-corrects when the window changes
     (streaming SCD1 would need a manual full refresh; an MV never needs one).
  3. The pipeline is TRIGGERED (batch) — full recompute is affordable at the expected CHVW volume
     within the time window.
AEDATTM is carried as `_replicated_at` (extraction timestamp only — NOT an event-ordering column;
same note as MCHB / quality.py).

ESTATE GATING (PHASE 1 — WINDOW ONLY):
  CHVW is deliberately estate-wide: traceability traces across ALL active plants and their supply
  chains, not just the WM/QM pilot set (ADR 016 §1: the product is NOT gated to the WM pilot
  plants). The lifecycle dimension that would gate SOLD/DIVESTED edges (ADR 016 §2) does not exist
  yet — it is pending business review of resources/config/site_lifecycle_review.csv. Therefore,
  phase 1 applies NO plant filter; the time window (trace_lookback_years) cuts the volume
  substantially while keeping silver faithful to source within the window.

  Lifecycle gating (exclude SOLD/DIVESTED edges; preserve CLOSED as non-anchorable pass-through
  nodes per ADR 016 §2) is applied AT THE GOLD EDGE BUILD (T2) once site_config_plant.lifecycle_status
  is populated and business-reviewed. This table must NOT pre-filter by plant to avoid silently
  truncating graph traversals.

  The stage-gate inventory classifies this table as EXEMPT (estate-wide traceability product;
  lifecycle gating applied at gold; window-gated via trace_lookback_years — ADR 016 §2).
"""

import dlt
from pyspark.sql import functions as F

from silver.helpers import (
    _SAP_NULL_DATES,
    BRONZE,
    bronze_columns_exist,
    get_spark,
    sap_date,
    strip_zeros,
)

# Every column used in the flow, including AEDATTM, must be present for the flow to be
# run-eligible. CHVW is AEDATTM-only (no AERUNID/AERECNO) — snapshot MV pattern.
_CHVW_REQUIRED = [
    "MANDT", "MATNR", "CHARG", "WERKS",
    "UMMAT", "UMCHA", "UMWRK",
    "AUFNR", "MBLNR", "MJAHR", "ZEILE",
    "BWART", "SHKZG", "MENGE", "MEINS",
    "BUDAT",
    "VBELN", "POSNR",
    "KDAUF", "KDPOS",
    "EBELN", "EBELP",
    "LIFNR", "KUNNR", "LICHA",
    "SOBKZ", "AUTYP", "XZUGA",
    "AEDATTM",
]


def _trace_lookback_years(spark) -> int:
    """Configurable time gate for CHVW batch where-used history (default 5 years).

    Set via the `trace_lookback_years` pipeline conf
    (resources/silver_slow_pipeline.pipeline.yml configuration block).

    Applied to BUDAT (goods/posting date) at the source read. Snapshot-MV recompute makes the
    window self-maintaining and self-correcting on config change (no manual full refresh needed).

    Legislation references 7 years (ADR 016 §1); 5 years is the accepted default. The window
    may be reduced to 3 once the estate is understood. Lookbacks beyond this product window
    (up to statutory 7y or the full 16-year SAP history) are explicitly referred back to SAP /
    the source layer — a documented procedure, not an app feature (ADR 016 §1)."""
    raw = spark.conf.get("trace_lookback_years", "5")
    years = int(str(raw).strip())
    if years <= 0:
        raise ValueError(f"trace_lookback_years must be a positive integer, got {raw!r}")
    return years


if bronze_columns_exist("batchwhereusedlist_chvw", _CHVW_REQUIRED):

    @dlt.table(
        name="batch_where_used",
        comment=(
            "Batch where-used list (CHVW) — one row per consumption/transfer event involving a "
            "batch. Rolling trace_lookback_years window (default 5y) on posting date (BUDAT). "
            "Estate-wide: NOT filtered to WM/QM pilot plants — traceability traces the full "
            "supply chain across all active plants (ADR 016 §1; lifecycle gating of "
            "SOLD/DIVESTED edges applied at gold edge build T2 once lifecycle_status is "
            "populated). Current-state snapshot (CHVW is AEDATTM-only; no AERUNID/AERECNO)."
        ),
        table_properties={
            "delta.enableChangeDataFeed": "true",
            "delta.autoOptimize.optimizeWrite": "true",
            "delta.autoOptimize.autoCompact": "true",
        },
        cluster_by=["plant_code", "posting_date"],
    )
    @dlt.expect_all_or_drop({
        "material_code present": "material_code IS NOT NULL",
        "batch_number present": "batch_number IS NOT NULL",
        "plant_code present": "plant_code IS NOT NULL",
    })
    @dlt.expect_all({
        "posting_date present": "posting_date IS NOT NULL",
    })
    def batch_where_used():
        spark = get_spark()
        lookback = _trace_lookback_years(spark)
        chvw = spark.read.table(f"{BRONZE}.batchwhereusedlist_chvw")

        # Time-gate at the source read: window-only gating for phase 1 (no plant filter —
        # see module docstring; lifecycle gating deferred to T2 gold edge build).
        #
        # Raw-string pushdown: compare BUDAT as a string rather than calling sap_date() here.
        # Rationale (review PR #96):
        #   1. Delta file skipping: a string predicate on BUDAT propagates as a data-skipping filter;
        #      sap_date() wraps the column in try_to_timestamp() expressions that Delta cannot push
        #      down to file-level statistics, destroying skip efficiency on large CHVW partitions.
        #   2. NULL/sentinel preservation: NULL BUDAT rows and SAP initial-date sentinels
        #      ("", "00000000", "0000-00-00" — matching _SAP_NULL_DATES in helpers.py) are
        #      DELIBERATELY KEPT so they reach the "posting_date present" @dlt.expect_all expectation
        #      below. sap_date() maps them to NULL at SELECT time (not filter time), so the
        #      expectation sees them as warnings rather than silently dropping them.
        #   3. Dual-format support: Aecorsoft delivers BUDAT in BOTH compact 'yyyyMMdd' (e.g.
        #      '20240115') and ISO 'yyyy-MM-dd' (e.g. '2024-01-15') formats. A single lexicographic
        #      cutoff string cannot span both: at character position 5, '-' (ASCII 45) sorts BELOW
        #      any digit (ASCII 48–57), so an ISO date would compare LOWER than its compact
        #      equivalent — a single-threshold filter would incorrectly exclude recent ISO-format rows.
        #      F.length(F.trim(...)) == 8 vs 10 discriminates format unambiguously.
        cutoff_compact = F.date_format(F.add_months(F.current_date(), -12 * lookback), "yyyyMMdd")
        cutoff_iso = F.date_format(F.add_months(F.current_date(), -12 * lookback), "yyyy-MM-dd")
        keep = (
            F.col("BUDAT").isNull()
            | F.col("BUDAT").isin(*_SAP_NULL_DATES)
            | ((F.length(F.trim(F.col("BUDAT"))) == 8) & (F.col("BUDAT") >= cutoff_compact))
            | ((F.length(F.trim(F.col("BUDAT"))) == 10) & (F.col("BUDAT") >= cutoff_iso))
        )
        chvw = chvw.filter(keep)

        return chvw.select(
            # ── identity ────────────────────────────────────────────────────────────────────
            F.col("MANDT").alias("client"),

            # CONSUMED batch / material / plant (the batch that was used).
            # MATNR: strip leading zeros (ALPHA-format numeric identifier).
            strip_zeros("MATNR").alias("material_code"),
            F.col("MATNR").alias("material_code_raw"),
            # CHARG is an exact SAP batch identifier — preserve as replicated (no
            # strip/trim/normalise). Batch numbers are NOT purely numeric in all plants;
            # normalising would silently merge distinct batches (see CHARG comments in quality.py).
            F.col("CHARG").alias("batch_number"),
            F.col("CHARG").alias("batch_number_raw"),
            F.col("WERKS").alias("plant_code"),

            # ── receiving / transfer leg (UMMAT/UMCHA/UMWRK — the destination for transfers) ──
            # These are blank for pure consumption events; populated for stock transfers.
            strip_zeros("UMMAT").alias("receiving_material_code"),
            F.col("UMMAT").alias("receiving_material_code_raw"),
            # UMCHA: exact batch identifier on the receiving side — no normalisation.
            F.col("UMCHA").alias("receiving_batch_number"),
            F.col("UMCHA").alias("receiving_batch_number_raw"),
            F.col("UMWRK").alias("receiving_plant_code"),

            # ── order reference ──────────────────────────────────────────────────────────────
            strip_zeros("AUFNR").alias("order_number"),
            F.col("AUFNR").alias("order_number_raw"),
            F.col("AUTYP").alias("order_category"),

            # ── material document reference ──────────────────────────────────────────────────
            strip_zeros("MBLNR").alias("material_document_number"),
            F.col("MJAHR").alias("fiscal_year"),
            F.col("ZEILE").alias("document_line_item"),

            # ── movement classification ──────────────────────────────────────────────────────
            F.col("BWART").alias("movement_type_code"),
            F.col("SHKZG").alias("debit_credit_indicator"),

            # ── quantity ─────────────────────────────────────────────────────────────────────
            F.col("MENGE").alias("quantity"),
            F.col("MEINS").alias("base_uom"),

            # ── posting date ─────────────────────────────────────────────────────────────────
            sap_date("BUDAT").alias("posting_date"),

            # ── delivery reference ───────────────────────────────────────────────────────────
            strip_zeros("VBELN").alias("delivery_number"),
            F.col("VBELN").alias("delivery_number_raw"),
            F.col("POSNR").alias("delivery_item"),

            # ── sales order reference ────────────────────────────────────────────────────────
            strip_zeros("KDAUF").alias("sales_order_number"),
            F.col("KDAUF").alias("sales_order_number_raw"),
            F.col("KDPOS").alias("sales_order_item"),

            # ── purchase order reference ─────────────────────────────────────────────────────
            strip_zeros("EBELN").alias("purchase_order_number"),
            F.col("EBELN").alias("purchase_order_number_raw"),
            F.col("EBELP").alias("purchase_order_item"),

            # ── partner references ───────────────────────────────────────────────────────────
            F.col("LIFNR").alias("vendor_number"),
            F.col("KUNNR").alias("customer_number"),
            # LICHA: vendor's own batch identifier — exact, no normalisation (same rule as CHARG).
            F.col("LICHA").alias("vendor_batch_number"),

            # ── special-stock indicator ──────────────────────────────────────────────────────
            # SOBKZ: blank for standard stock; 'K' consignment; 'O' subcontracting.
            # Future enrichment hook (ADR 016): consignment/subcontract edges may need separate
            # traversal semantics at the gold graph layer. Retained here for downstream T2 use.
            F.col("SOBKZ").alias("special_stock_indicator"),

            # ── additional flags ─────────────────────────────────────────────────────────────
            F.col("XZUGA").alias("receipt_indicator"),

            # ── extraction metadata ──────────────────────────────────────────────────────────
            # Extraction timestamp only — NOT an event-ordering column (same note as MCHB / quality.py).
            # CHVW is AEDATTM-only; AEDATTM is the Aecorsoft replication watermark, not a
            # business event timestamp.
            F.col("AEDATTM").cast("timestamp").alias("_replicated_at"),
        )
