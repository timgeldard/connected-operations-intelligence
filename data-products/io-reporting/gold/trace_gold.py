"""
Lakeflow Spark Declarative Pipeline — Trace Gold.

T2 and T3 of the governed traceability migration (ADR 016: traceability window, estate lifecycle
scope, and two-tier Unity Catalog security).

T2 — ``gold_batch_lineage``: a deterministic MV of directed batch traceability EDGES built
by a UNION ALL of five named legs sourced from silver.batch_where_used (CHVW) and
silver.goods_movement (MSEG).  The MV is the heart of the Final Trace migration and serves as
the base table for the T3 graph-traversal search views.

T3 — ``gold_trace_anchor``: the anchor-tier search MV.  Aggregates the edge list to a
(MATERIAL_ID, BATCH_ID, PLANT_ID) grain, exposing date-range and directional edge counts,
and gated to ACTIVE plants only (ADR 016 §3 — anchors may only be initiated from a
reviewed-active plant; CLOSED/unconfirmed-review plants are traversable but not anchorable).
Carries ``plant_code`` for the RLS-secured serving-view predicate.

COLUMN CONTRACT — verbatim legacy names (deliberate exception to snake_case per ADR 016 §3):
  PARENT_MATERIAL_ID, PARENT_BATCH_ID, PARENT_PLANT_ID,
  CHILD_MATERIAL_ID,  CHILD_BATCH_ID,  CHILD_PLANT_ID,
  LINK_TYPE, PROCESS_ORDER_ID, MATERIAL_DOCUMENT_NUMBER, MATERIAL_DOCUMENT_YEAR,
  PURCHASE_ORDER_ID, SUPPLIER_ID, CUSTOMER_ID, DELIVERY_ID, SALES_ORDER_ID,
  MOVEMENT_TYPE, QUANTITY, BASE_UNIT_OF_MEASURE, POSTING_DATE.

LEGS:
  1. PRODUCTION         (CHVW × MSEG GR join)
  2. BATCH/STO/MATERIAL TRANSFER  (CHVW rows with receiving_* populated, no order)
  3. VENDOR_RECEIPT     (MSEG inbound-receipt with purchase_order_number)
  4. DELIVERY           (MSEG outbound-issue with delivery_number)
  5. ADJUSTMENT_IN / ADJUSTMENT_OUT  (MSEG stock-adjustment movements, directional)

LIFECYCLE GATING (ADR 016 §2):
  Both endpoint plants are joined to silver.site_lifecycle.  Edges where EITHER endpoint's
  effective_lifecycle is 'SOLD' or 'DIVESTED_ON_SAP' are excluded.  Plants absent from the
  dimension are KEPT (conservative default — the bootstrap seed covers the 4 onboarded plants
  as ACTIVE; unknown plants are kept pending full estate review).

SECURITY (ADR 016 §3):
  gold_batch_lineage: NOT added to generate_gold_security_sql.py / GOLD_TABLES RLS.
    A dedicated capability-tier GRANT is provided in resources/sql/trace_security_{dev,uat,prod}.sql.
  gold_trace_anchor: ADDED to generate_gold_security_sql.py / GOLD_TABLES — anchor tier carries
    per-user RLS via the generated *_secured view (standard plant_code predicate).

DETERMINISM:
  No current_date / current_timestamp in any @dlt.table function — passes CI guard.
  Snapshot MV (full recompute on every triggered pipeline run).
"""

import dlt
from pyspark.sql import DataFrame
from pyspark.sql import functions as F

from gold._shared import get_silver_schema, get_spark_session, gold_table_args

# ── Excluded lifecycle statuses (ADR 016 §2) ──────────────────────────────────
_EXCLUDED_LIFECYCLE = ("SOLD", "DIVESTED_ON_SAP")


def _site_lifecycle_lookup(spark, silver_schema: str) -> DataFrame:
    """(plant_code) -> effective_lifecycle.

    One row per plant from silver.site_lifecycle.  Only the plant_code and
    effective_lifecycle columns are needed for the exclusion gate.
    """
    return (
        spark.read.table(f"{silver_schema}.site_lifecycle")
        .select("plant_code", "effective_lifecycle")
        .dropDuplicates(["plant_code"])
    )


def _apply_lifecycle_gate(
    df: DataFrame,
    parent_col: str,
    child_col: str,
    lifecycle: DataFrame,
) -> DataFrame:
    """Exclude edges where EITHER endpoint's effective_lifecycle is SOLD or DIVESTED_ON_SAP.

    Plants absent from the lifecycle dimension are KEPT (conservative default — unknown plants
    have not been reviewed and may still be active supply-chain nodes; silently dropping them
    would create invisible gaps in the traceability graph.  Once the full estate review
    (site_lifecycle_review.csv) is complete, the 'keep-unknowns' default can be revisited
    via a lifecycle review cycle — ADR 016 §2).
    """
    parent_lc = lifecycle.select(
        F.col("plant_code").alias("_parent_plant"),
        F.col("effective_lifecycle").alias("_parent_lifecycle"),
    )
    child_lc = lifecycle.select(
        F.col("plant_code").alias("_child_plant"),
        F.col("effective_lifecycle").alias("_child_lifecycle"),
    )

    gated = (
        df
        .join(F.broadcast(parent_lc), df[parent_col] == parent_lc["_parent_plant"], "left")
        .join(F.broadcast(child_lc),  df[child_col]  == child_lc["_child_plant"],   "left")
        # Keep when EITHER endpoint plant is unknown (NULL join = plant not in dimension).
        # Exclude when a KNOWN endpoint is SOLD or DIVESTED_ON_SAP.
        .filter(
            ~F.col("_parent_lifecycle").isin(*_EXCLUDED_LIFECYCLE)
            | F.col("_parent_lifecycle").isNull()
        )
        .filter(
            ~F.col("_child_lifecycle").isin(*_EXCLUDED_LIFECYCLE)
            | F.col("_child_lifecycle").isNull()
        )
        .drop("_parent_plant", "_parent_lifecycle", "_child_plant", "_child_lifecycle")
    )
    return gated


# ── Column contract helper ─────────────────────────────────────────────────────

def _lineage_select(
    *,
    link_type,
    parent_material_id,
    parent_batch_id,
    parent_plant_id,
    child_material_id,
    child_batch_id,
    child_plant_id,
    process_order_id=F.lit(None).cast("string"),
    material_document_number=F.lit(None).cast("string"),
    material_document_year=F.lit(None).cast("string"),
    purchase_order_id=F.lit(None).cast("string"),
    supplier_id=F.lit(None).cast("string"),
    customer_id=F.lit(None).cast("string"),
    delivery_id=F.lit(None).cast("string"),
    sales_order_id=F.lit(None).cast("string"),
    movement_type=F.lit(None).cast("string"),
    quantity=F.lit(None).cast("double"),
    base_unit_of_measure=F.lit(None).cast("string"),
    posting_date=F.lit(None).cast("date"),
) -> list:
    """Return a list of column expressions projecting the full legacy contract."""
    return [
        parent_material_id.alias("PARENT_MATERIAL_ID"),
        parent_batch_id.alias("PARENT_BATCH_ID"),
        parent_plant_id.alias("PARENT_PLANT_ID"),
        child_material_id.alias("CHILD_MATERIAL_ID"),
        child_batch_id.alias("CHILD_BATCH_ID"),
        child_plant_id.alias("CHILD_PLANT_ID"),
        link_type.alias("LINK_TYPE"),
        process_order_id.alias("PROCESS_ORDER_ID"),
        material_document_number.alias("MATERIAL_DOCUMENT_NUMBER"),
        material_document_year.alias("MATERIAL_DOCUMENT_YEAR"),
        purchase_order_id.alias("PURCHASE_ORDER_ID"),
        supplier_id.alias("SUPPLIER_ID"),
        customer_id.alias("CUSTOMER_ID"),
        delivery_id.alias("DELIVERY_ID"),
        sales_order_id.alias("SALES_ORDER_ID"),
        movement_type.alias("MOVEMENT_TYPE"),
        quantity.alias("QUANTITY"),
        base_unit_of_measure.alias("BASE_UNIT_OF_MEASURE"),
        posting_date.alias("POSTING_DATE"),
    ]


# ─────────────────────────────────────────────────────────────────────────────
# gold_batch_lineage
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Governed batch traceability edge list — T2 of the Final Trace migration (ADR 016). "
        "One row per directed traceability edge: PARENT_* → CHILD_* with LINK_TYPE classifying "
        "the relationship.  Five legs: PRODUCTION (CHVW × MSEG GR), STO/BATCH/MATERIAL_TRANSFER "
        "(CHVW receiving side), VENDOR_RECEIPT (MSEG PO receipt), DELIVERY (MSEG outbound issue), "
        "ADJUSTMENT_IN / ADJUSTMENT_OUT (MSEG stock adjustments). "
        "Lifecycle-gated: SOLD / DIVESTED_ON_SAP endpoint plants excluded (ADR 016 §2). "
        "Column names are the verbatim legacy contract (deliberate snake_case exception, ADR 016 §3). "
        "Security: capability-tier GRANT via trace_security_{env}.sql; no RLS row filter on the MV "
        "(T3 search views carry the per-user predicate). "
        "Grain: one edge per (parent_material × parent_batch × parent_plant × child_material × "
        "child_batch × child_plant × link_type × process_order_id × material_document_number). "
        "Deterministic base (no current_date / current_timestamp). "
        "NOTE: first materialisation requires a full gold pipeline run; parity check vs legacy "
        "link-type counts is the orchestrator's post-rollout step."
    ),
    cluster_by=["CHILD_MATERIAL_ID", "CHILD_BATCH_ID"],
))
@dlt.expect_all_or_drop({
    "LINK_TYPE present": "LINK_TYPE IS NOT NULL",
})
@dlt.expect_all({
    # Warn-not-drop: one-sided edges (VENDOR_RECEIPT has NULL parents; DELIVERY has NULL children)
    # are intentional — these expectations fire at the row level but do NOT gate the whole table.
    "QUANTITY non-negative if present": "QUANTITY IS NULL OR QUANTITY >= 0",
})
def gold_batch_lineage():  # noqa: C901 — five-leg UNION; complexity is structural, not incidental
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    # ── Source tables ────────────────────────────────────────────────────────
    chvw = spark.read.table(f"{silver_schema}.batch_where_used")
    mseg = spark.read.table(f"{silver_schema}.goods_movement")
    mtc  = spark.read.table(f"{silver_schema}.movement_type_classification")
    po   = spark.read.table(f"{silver_schema}.purchase_order")
    lc   = _site_lifecycle_lookup(spark, silver_schema)

    # Narrow the movement-type classification to boolean flags used across legs.
    # Broadcast: small static reference table, safe to broadcast.
    mtc_slim = F.broadcast(
        mtc.select(
            "movement_type_code",
            "is_production_receipt",
            "is_po_receipt",
            "is_stock_write_on",
            "is_stock_write_off",
            "is_goods_issue",
        )
    )

    # Classify goods_movement rows once; reused across Legs 3, 4, 5.
    mseg_cls = (
        mseg.alias("m")
        .join(
            mtc_slim.alias("c"),
            F.col("m.movement_type_code") == F.col("c.movement_type_code"),
            "left",
        )
        .select(
            "m.*",
            F.col("c.is_production_receipt"),
            F.col("c.is_po_receipt"),
            F.col("c.is_stock_write_on"),
            F.col("c.is_stock_write_off"),
            F.col("c.is_goods_issue"),
        )
    )

    # Narrow purchase_order to one vendor_code per order header (EKKO grain via distinct PO number).
    po_vendor = (
        po.select("purchase_order_number", "vendor_code")
        .dropDuplicates(["purchase_order_number"])
    )

    # ═══════════════════════════════════════════════════════════════════════
    # LEG 1 — PRODUCTION
    # CHVW rows that record a batch CONSUMED into a process order.  The produced
    # batch is resolved by joining MSEG GR rows (is_production_receipt = true)
    # on (plant_code, order_number) to get the child material/batch/plant.
    #
    # Design decisions:
    #  • CHVW order_number != NULL: the CHVW row records a consumption against
    #    an order.  receiving_* columns are blank for pure consumptions (they are
    #    populated only for transfers).
    #  • MSEG GR join key: plant_code + order_number.  This fan-out is bounded
    #    by the deduplication on (parent × child × order) below.
    #  • Quantity: sum of CHVW consumption quantity per (parent × child × order),
    #    matching the legacy MV's one-edge-per-consumed-batch × produced-batch rule.
    #  • PARENT_* = the consumed batch (what went IN to the order).
    #  • CHILD_*  = the batch produced BY the order (what came OUT).
    # ═══════════════════════════════════════════════════════════════════════

    # GR rows on MSEG that represent a production receipt.
    mseg_gr = (
        mseg_cls
        .filter(F.col("is_production_receipt"))
        .select(
            "plant_code",
            "order_number",
            F.col("material_code").alias("gr_material_code"),
            F.col("batch_number").alias("gr_batch_number"),
            F.col("plant_code").alias("gr_plant_code"),
        )
        .dropDuplicates(["plant_code", "order_number", "gr_material_code", "gr_batch_number"])
    )

    # CHVW consumption side: rows with an order reference and no receiving plant
    # (blank receiving side = consumption, not a transfer).
    chvw_consumption = chvw.filter(
        F.col("order_number").isNotNull()
        & (F.trim(F.col("order_number")) != "")
        & (F.col("receiving_plant_code").isNull() | (F.trim(F.col("receiving_plant_code")) == ""))
    )

    leg1_raw = (
        chvw_consumption.alias("w")
        .join(
            mseg_gr.alias("g"),
            (F.col("w.plant_code") == F.col("g.plant_code"))
            & (F.col("w.order_number") == F.col("g.order_number")),
            "inner",
        )
        .groupBy(
            F.col("w.material_code").alias("_par_mat"),
            F.col("w.batch_number").alias("_par_bat"),
            F.col("w.plant_code").alias("_par_plt"),
            F.col("g.gr_material_code").alias("_chi_mat"),
            F.col("g.gr_batch_number").alias("_chi_bat"),
            F.col("g.gr_plant_code").alias("_chi_plt"),
            F.col("w.order_number").alias("_order"),
            F.col("w.material_document_number").alias("_mdoc"),
            F.col("w.fiscal_year").alias("_myear"),
            F.col("w.movement_type_code").alias("_mvt"),
            F.col("w.base_uom").alias("_uom"),
            F.col("w.posting_date").alias("_pdate"),
        )
        .agg(F.sum(F.col("w.quantity").cast("double")).alias("_qty"))
    )

    leg1 = leg1_raw.select(
        *_lineage_select(
            link_type=F.lit("PRODUCTION"),
            parent_material_id=F.col("_par_mat"),
            parent_batch_id=F.col("_par_bat"),
            parent_plant_id=F.col("_par_plt"),
            child_material_id=F.col("_chi_mat"),
            child_batch_id=F.col("_chi_bat"),
            child_plant_id=F.col("_chi_plt"),
            process_order_id=F.col("_order"),
            material_document_number=F.col("_mdoc"),
            material_document_year=F.col("_myear"),
            movement_type=F.col("_mvt"),
            quantity=F.col("_qty"),
            base_unit_of_measure=F.col("_uom"),
            posting_date=F.col("_pdate"),
        )
    )

    # ═══════════════════════════════════════════════════════════════════════
    # LEG 2 — BATCH / MATERIAL / STO TRANSFER
    # CHVW rows with receiving_* populated AND no order_number (pure transfers).
    #
    # LINK_TYPE rules (per legacy contract):
    #  • 'STO_TRANSFER':      plant differs AND purchase_order_number is present.
    #  • 'BATCH_TRANSFER':    same material AND same plant (batch re-tagging / split).
    #  • 'MATERIAL_TRANSFER': everything else (cross-material or same-plant w/o PO).
    #
    # PARENT_* = consumed (sent) side (CHVW MATNR/CHARG/WERKS).
    # CHILD_*  = receiving side (CHVW UMMAT/UMCHA/UMWRK).
    # ═══════════════════════════════════════════════════════════════════════

    chvw_transfer = chvw.filter(
        F.col("receiving_plant_code").isNotNull()
        & (F.trim(F.col("receiving_plant_code")) != "")
        & F.col("receiving_batch_number").isNotNull()
        & (F.trim(F.col("receiving_batch_number")) != "")
        & (F.col("order_number").isNull() | (F.trim(F.col("order_number")) == ""))
    )

    leg2_link_type = (
        F.when(
            (F.col("plant_code") != F.col("receiving_plant_code"))
            & F.col("purchase_order_number").isNotNull()
            & (F.trim(F.col("purchase_order_number")) != ""),
            F.lit("STO_TRANSFER"),
        )
        .when(
            (F.col("material_code") == F.col("receiving_material_code"))
            & (F.col("plant_code") == F.col("receiving_plant_code")),
            F.lit("BATCH_TRANSFER"),
        )
        .otherwise(F.lit("MATERIAL_TRANSFER"))
    )

    leg2 = chvw_transfer.select(
        *_lineage_select(
            link_type=leg2_link_type,
            parent_material_id=F.col("material_code"),
            parent_batch_id=F.col("batch_number"),
            parent_plant_id=F.col("plant_code"),
            child_material_id=F.col("receiving_material_code"),
            child_batch_id=F.col("receiving_batch_number"),
            child_plant_id=F.col("receiving_plant_code"),
            material_document_number=F.col("material_document_number"),
            material_document_year=F.col("fiscal_year"),
            purchase_order_id=F.col("purchase_order_number"),
            delivery_id=F.col("delivery_number"),
            movement_type=F.col("movement_type_code"),
            quantity=F.col("quantity").cast("double"),
            base_unit_of_measure=F.col("base_uom"),
            posting_date=F.col("posting_date"),
        )
    )

    # ═══════════════════════════════════════════════════════════════════════
    # LEG 3 — VENDOR_RECEIPT
    # MSEG inbound-receipt movements (is_po_receipt = true) WITH a purchase_order_number.
    #
    # Legacy shape: PARENT_* are NULL (no upstream batch in scope); CHILD_* = received batch.
    # SUPPLIER_ID from the purchase_order silver join (vendor_code on the PO header).
    # ═══════════════════════════════════════════════════════════════════════

    mseg_vendor_receipt = mseg_cls.filter(
        F.col("is_po_receipt")
        & F.col("purchase_order_number").isNotNull()
        & (F.trim(F.col("purchase_order_number")) != "")
    )

    leg3_raw = (
        mseg_vendor_receipt.alias("m")
        .join(
            po_vendor.alias("p"),
            F.col("m.purchase_order_number") == F.col("p.purchase_order_number"),
            "left",
        )
        .select(
            F.lit(None).cast("string").alias("_par_mat"),
            F.lit(None).cast("string").alias("_par_bat"),
            F.lit(None).cast("string").alias("_par_plt"),
            F.col("m.material_code").alias("_chi_mat"),
            F.col("m.batch_number").alias("_chi_bat"),
            F.col("m.plant_code").alias("_chi_plt"),
            F.col("m.material_document_number").alias("_mdoc"),
            F.col("m.fiscal_year").alias("_myear"),
            F.col("m.purchase_order_number").alias("_po"),
            F.col("p.vendor_code").alias("_supplier"),
            F.col("m.movement_type_code").alias("_mvt"),
            F.col("m.quantity").cast("double").alias("_qty"),
            F.col("m.base_uom").alias("_uom"),
            F.col("m.posting_date").alias("_pdate"),
        )
    )

    leg3 = leg3_raw.select(
        *_lineage_select(
            link_type=F.lit("VENDOR_RECEIPT"),
            parent_material_id=F.col("_par_mat"),
            parent_batch_id=F.col("_par_bat"),
            parent_plant_id=F.col("_par_plt"),
            child_material_id=F.col("_chi_mat"),
            child_batch_id=F.col("_chi_bat"),
            child_plant_id=F.col("_chi_plt"),
            material_document_number=F.col("_mdoc"),
            material_document_year=F.col("_myear"),
            purchase_order_id=F.col("_po"),
            supplier_id=F.col("_supplier"),
            movement_type=F.col("_mvt"),
            quantity=F.col("_qty"),
            base_unit_of_measure=F.col("_uom"),
            posting_date=F.col("_pdate"),
        )
    )

    # ═══════════════════════════════════════════════════════════════════════
    # LEG 4 — DELIVERY (outbound issue)
    # MSEG goods-issue movements (is_goods_issue = true) WITH a delivery_number.
    #
    # Legacy shape: PARENT_* = issued batch; CHILD_* are NULL (terminal edge — the
    # batch leaves the estate).  CUSTOMER_ID is NULL at this layer: goods_movement
    # carries no direct customer reference (LIKP.KUNAG lives in the outbound_delivery
    # table).  Joining outbound_delivery here would require a full scan on the hot path
    # and is deferred to the T3 graph-traversal layer where customer enrichment can be
    # applied once at the subgraph level.  Legacy rows also had NULL CUSTOMER_ID in the
    # delivery leg when no customer could be resolved — this matches that shape.
    # ═══════════════════════════════════════════════════════════════════════

    mseg_delivery = mseg_cls.filter(
        F.col("is_goods_issue")
        & F.col("delivery_number").isNotNull()
        & (F.trim(F.col("delivery_number")) != "")
    )

    leg4 = mseg_delivery.select(
        *_lineage_select(
            link_type=F.lit("DELIVERY"),
            parent_material_id=F.col("material_code"),
            parent_batch_id=F.col("batch_number"),
            parent_plant_id=F.col("plant_code"),
            child_material_id=F.lit(None).cast("string"),
            child_batch_id=F.lit(None).cast("string"),
            child_plant_id=F.lit(None).cast("string"),
            delivery_id=F.col("delivery_number"),
            sales_order_id=F.col("sales_order_number"),
            customer_id=F.lit(None).cast("string"),
            material_document_number=F.col("material_document_number"),
            material_document_year=F.col("fiscal_year"),
            movement_type=F.col("movement_type_code"),
            quantity=F.col("quantity").cast("double"),
            base_unit_of_measure=F.col("base_uom"),
            posting_date=F.col("posting_date"),
        )
    )

    # ═══════════════════════════════════════════════════════════════════════
    # LEG 5 — ADJUSTMENT_IN / ADJUSTMENT_OUT
    # MSEG stock-adjustment movements (STOCK_WRITE_ON or STOCK_WRITE_OFF event category).
    #
    # Direction rule (matches legacy):
    #  • STOCK_WRITE_ON  (event_category='STOCK_WRITE_ON') → ADJUSTMENT_IN:
    #      PARENT_* NULL; CHILD_* = adjusted batch.
    #  • STOCK_WRITE_OFF (event_category='STOCK_WRITE_OFF') → ADJUSTMENT_OUT:
    #      PARENT_* = adjusted batch; CHILD_* NULL.
    #
    # No purchase_order or delivery reference expected on pure stock adjustments.
    # ═══════════════════════════════════════════════════════════════════════

    mseg_adj = mseg_cls.filter(
        F.col("is_stock_write_on") | F.col("is_stock_write_off")
    )

    leg5_link_type = F.when(
        F.col("is_stock_write_on"),
        F.lit("ADJUSTMENT_IN"),
    ).otherwise(F.lit("ADJUSTMENT_OUT"))

    # ADJUSTMENT_IN: one-sided edge — PARENT_* NULL, CHILD_* = the adjusted batch.
    # ADJUSTMENT_OUT: one-sided edge — PARENT_* = the adjusted batch, CHILD_* NULL.
    leg5 = mseg_adj.select(
        *_lineage_select(
            link_type=leg5_link_type,
            parent_material_id=F.when(
                F.col("is_stock_write_on"),
                F.lit(None).cast("string"),
            ).otherwise(F.col("material_code")),
            parent_batch_id=F.when(
                F.col("is_stock_write_on"),
                F.lit(None).cast("string"),
            ).otherwise(F.col("batch_number")),
            parent_plant_id=F.when(
                F.col("is_stock_write_on"),
                F.lit(None).cast("string"),
            ).otherwise(F.col("plant_code")),
            child_material_id=F.when(
                F.col("is_stock_write_on"),
                F.col("material_code"),
            ).otherwise(F.lit(None).cast("string")),
            child_batch_id=F.when(
                F.col("is_stock_write_on"),
                F.col("batch_number"),
            ).otherwise(F.lit(None).cast("string")),
            child_plant_id=F.when(
                F.col("is_stock_write_on"),
                F.col("plant_code"),
            ).otherwise(F.lit(None).cast("string")),
            material_document_number=F.col("material_document_number"),
            material_document_year=F.col("fiscal_year"),
            movement_type=F.col("movement_type_code"),
            quantity=F.col("quantity").cast("double"),
            base_unit_of_measure=F.col("base_uom"),
            posting_date=F.col("posting_date"),
        )
    )

    # ── Union all legs ───────────────────────────────────────────────────────
    all_edges = (
        leg1
        .unionAll(leg2)
        .unionAll(leg3)
        .unionAll(leg4)
        .unionAll(leg5)
    )

    # ── Lifecycle gate (ADR 016 §2) ──────────────────────────────────────────
    # Apply to parent plant and child plant independently.  One-sided edges (e.g.
    # VENDOR_RECEIPT has NULL PARENT_PLANT_ID; DELIVERY has NULL CHILD_PLANT_ID) must
    # pass the gate without being dropped: the gate uses a left-join so a NULL plant ID
    # results in a NULL lifecycle which is kept.
    gated = _apply_lifecycle_gate(
        all_edges,
        parent_col="PARENT_PLANT_ID",
        child_col="CHILD_PLANT_ID",
        lifecycle=lc,
    )

    return gated


# ─────────────────────────────────────────────────────────────────────────────
# gold_trace_anchor
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Governed batch traceability anchor index — T3 of the Final Trace migration (ADR 016). "
        "One row per (MATERIAL_ID, BATCH_ID, PLANT_ID) entry point that a user may initiate a "
        "trace from.  Built by unioning the parent and child endpoint sides of gold_batch_lineage "
        "and aggregating to a batch-plant grain with date-range and directional edge counts. "
        "ANCHORABILITY GATE (ADR 016 §3): only plants with effective_lifecycle = 'ACTIVE' are "
        "retained.  This is deliberately the OPPOSITE default from the edge MV's keep-unknowns "
        "policy — edges keep unknown plants for graph continuity (ADR 016 §2 pass-through), but "
        "anchors require explicit ACTIVE because a trace may only be INITIATED from a reviewed-"
        "active plant; CLOSED and unconfirmed-review plants are traversable but not anchorable. "
        "Null/blank BATCH_ID rows are excluded (an anchor is a batch-level entry point). "
        "Null PLANT_ID rows are excluded (RLS predicate cannot apply to a null plant). "
        "plant_code = PLANT_ID (lowercase contract column for the RLS predicate). "
        "Security: ADDED to generate_gold_security_sql.py GOLD_TABLES — served via "
        "gold_trace_anchor_secured with standard plant_code CSM predicate (application_key = "
        "'io_reporting'). "
        "Deterministic base (no current_date / current_timestamp). "
        "NOTE: app batch-search switchover from the legacy search surface to this anchor tier "
        "is a separate follow-up task."
    ),
    cluster_by=["plant_code", "MATERIAL_ID"],
))
def gold_trace_anchor():
    """Anchor-tier search MV: one row per (MATERIAL_ID, BATCH_ID, PLANT_ID) active anchor.

    Source: dlt.read("gold_batch_lineage") — standard DLT intra-pipeline dependency.
    An MV cannot read another MV in the same pipeline via spark.read.table reliably;
    dlt.read() declares the dependency and lets the DLT runtime manage materialisation order.

    Anchorability gate (ADR 016 §3):
      Inner join to silver.site_lifecycle, keeping ONLY effective_lifecycle == 'ACTIVE'.
      This is the OPPOSITE default from the edge MV's keep-unknowns policy:
        - Edge MV (gold_batch_lineage): unknown plants KEPT — silently dropping them would
          create invisible gaps in the traceability graph (ADR 016 §2).
        - Anchor MV (gold_trace_anchor): unknown plants DROPPED — a trace may only be
          INITIATED from a plant that has been explicitly confirmed as ACTIVE after business
          review.  CLOSED and unconfirmed-review plants (which default to CLOSED) are
          traversable via the edge product but cannot serve as anchor entry points.
    """
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    # ── Read the edge MV via DLT intra-pipeline dependency ────────────────────
    # dlt.read() is the correct pattern for same-pipeline MV → MV dependencies;
    # spark.read.table on another MV in the same pipeline is unreliable during
    # incremental planning (the target table may not yet be visible in the catalog).
    edges = dlt.read("gold_batch_lineage")

    # ── Build endpoint-union: two sides tagged with role ──────────────────────
    # Parent side: edges where the batch appears as the UPSTREAM node.
    parent_side = edges.select(
        F.col("PARENT_MATERIAL_ID").alias("MATERIAL_ID"),
        F.col("PARENT_BATCH_ID").alias("BATCH_ID"),
        F.col("PARENT_PLANT_ID").alias("PLANT_ID"),
        F.col("POSTING_DATE"),
        F.lit("parent").alias("_role"),
    )

    # Child side: edges where the batch appears as the DOWNSTREAM node.
    child_side = edges.select(
        F.col("CHILD_MATERIAL_ID").alias("MATERIAL_ID"),
        F.col("CHILD_BATCH_ID").alias("BATCH_ID"),
        F.col("CHILD_PLANT_ID").alias("PLANT_ID"),
        F.col("POSTING_DATE"),
        F.lit("child").alias("_role"),
    )

    endpoint_union = parent_side.unionAll(child_side)

    # ── Exclude null / blank BATCH_ID and null PLANT_ID ───────────────────────
    # An anchor is a batch-level entry point; rows with no batch identity cannot
    # be anchored.  One-sided edges (e.g. VENDOR_RECEIPT has NULL PARENT_*;
    # DELIVERY has NULL CHILD_*) contribute null-BATCH_ID rows here — they are
    # deliberately excluded from the anchor index.
    # Null PLANT_ID rows are also excluded: the RLS predicate (array_contains on
    # filter_plant) cannot apply to a null plant, so serving them as anchors would
    # either silently expose data outside the entitlement boundary or require
    # special-casing in every consumer.
    filtered = endpoint_union.filter(
        F.col("BATCH_ID").isNotNull()
        & (F.trim(F.col("BATCH_ID")) != "")
        & F.col("PLANT_ID").isNotNull()
    )

    # ── Aggregate to (MATERIAL_ID, BATCH_ID, PLANT_ID) grain ─────────────────
    aggregated = (
        filtered
        .groupBy("MATERIAL_ID", "BATCH_ID", "PLANT_ID")
        .agg(
            F.min("POSTING_DATE").alias("first_posting_date"),
            F.max("POSTING_DATE").alias("last_posting_date"),
            F.count(
                F.when(F.col("_role") == "parent", F.lit(1))
            ).alias("edge_count_as_parent"),
            F.count(
                F.when(F.col("_role") == "child", F.lit(1))
            ).alias("edge_count_as_child"),
        )
    )

    # ── Anchorability gate: ACTIVE plants only (ADR 016 §3) ──────────────────
    # Inner join to site_lifecycle — plants absent from the dimension are excluded
    # (the deliberate opposite of the edge MV's left-join keep-unknowns default).
    lc = _site_lifecycle_lookup(spark, silver_schema)
    active_lc = lc.filter(F.col("effective_lifecycle") == "ACTIVE")

    anchored = aggregated.join(
        F.broadcast(active_lc.select(F.col("plant_code").alias("PLANT_ID"))),
        on="PLANT_ID",
        how="inner",
    )

    # ── Expose plant_code (lowercase contract column for the RLS predicate) ───
    # Precedent: gold_spc_quality_metric_subgroup exposes plant_code alongside
    # plant_id so the generate_gold_security_sql.py predicate (array_contains on
    # filter_plant, plant_code) applies without aliasing in the secured view.
    result = anchored.select(
        F.col("MATERIAL_ID"),
        F.col("BATCH_ID"),
        F.col("PLANT_ID"),
        F.col("PLANT_ID").alias("plant_code"),
        F.col("first_posting_date"),
        F.col("last_posting_date"),
        F.col("edge_count_as_parent"),
        F.col("edge_count_as_child"),
    )

    return result


# ─────────────────────────────────────────────────────────────────────────────
# gold_batch_stock_summary  (T4 — governed trace2 fan-out foundation)
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Batch-grain stock position from silver.batch_stock (MCHB-derived). "
        "One row per (plant_code, material_code, batch_number) with the six SAP stock-category "
        "quantities: unrestricted, quality_inspection, blocked, restricted_use, in_transfer, "
        "blocked_returns — plus total_quantity (sum of all categories) and base_unit_of_measure. "
        "Source: silver.batch_stock (plant-gated current-state MCHB snapshot; one row per "
        "material × plant × storage_location × batch). "
        "Grain: this MV aggregates across storage locations, collapsing to the batch level "
        "so each (plant_code, material_code, batch_number) appears once. "
        "Use case: batch-level stock position for the trace2 fan-out — the Phase 2 "
        "recall-readiness and mass-balance panels need a governed batch-stock position "
        "rather than the ungated legacy gold_batch_stock_v. "
        "Standard plant RLS: expose plant_code; governed via gold_batch_stock_summary_secured "
        "(scripts/generate_gold_security_sql.py GOLD_TABLES). "
        "NOTE: quantities are summed across all storage locations for a given plant/material/batch. "
        "Phase 2 consumers requiring storage-location granularity should read silver.batch_stock. "
        "Deterministic base (no current_date / current_timestamp)."
    ),
    cluster_by=["plant_code", "material_code"],
))
@dlt.expect_all_or_drop({
    "plant_code present": "plant_code IS NOT NULL",
    "material_code present": "material_code IS NOT NULL",
    "batch_number present": "batch_number IS NOT NULL",
})
@dlt.expect_all({
    "total_quantity non-negative": "total_quantity IS NULL OR total_quantity >= 0",
})
def gold_batch_stock_summary():
    """Batch-grain stock position: one row per (plant_code, material_code, batch_number).

    Source: silver.batch_stock — plant-gated MCHB current-state snapshot.
    Aggregates the six SAP stock-category quantity columns across storage locations.
    Phase 2 (mass-balance, recall-readiness) queries against this MV rather than the
    ungated legacy gold_batch_stock_v.
    """
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    bs = spark.read.table(f"{silver_schema}.batch_stock")

    agg = (
        bs
        .groupBy(
            F.col("plant_code"),
            F.col("material_code"),
            F.col("batch_number"),
        )
        .agg(
            F.max("base_uom").alias("base_unit_of_measure"),
            F.sum(F.col("unrestricted_quantity").cast("double")).alias("unrestricted_quantity"),
            F.sum(F.col("quality_inspection_quantity").cast("double")).alias("quality_inspection_quantity"),
            F.sum(F.col("blocked_quantity").cast("double")).alias("blocked_quantity"),
            F.sum(F.col("restricted_use_quantity").cast("double")).alias("restricted_use_quantity"),
            F.sum(F.col("in_transfer_quantity").cast("double")).alias("in_transfer_quantity"),
            F.sum(F.col("blocked_returns_quantity").cast("double")).alias("blocked_returns_quantity"),
        )
    )

    return agg.select(
        F.col("plant_code"),
        F.col("material_code"),
        F.col("batch_number"),
        F.col("base_unit_of_measure"),
        F.col("unrestricted_quantity"),
        F.col("quality_inspection_quantity"),
        F.col("blocked_quantity"),
        F.col("restricted_use_quantity"),
        F.col("in_transfer_quantity"),
        F.col("blocked_returns_quantity"),
        (
            F.coalesce(F.col("unrestricted_quantity"), F.lit(0.0))
            + F.coalesce(F.col("quality_inspection_quantity"), F.lit(0.0))
            + F.coalesce(F.col("blocked_quantity"), F.lit(0.0))
            + F.coalesce(F.col("restricted_use_quantity"), F.lit(0.0))
            + F.coalesce(F.col("in_transfer_quantity"), F.lit(0.0))
            + F.coalesce(F.col("blocked_returns_quantity"), F.lit(0.0))
        ).alias("total_quantity"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# gold_batch_event_ledger  (T4 — governed trace2 fan-out foundation)
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Directional per-batch event ledger derived from gold_batch_lineage. "
        "One row per (batch × plant × direction) event, exploding each directed edge "
        "into per-batch rows so a single batch's full movement history is queryable without "
        "graph traversal. "
        "DIRECTION SEMANTICS: "
        "  PRODUCTION — parent side: OUT (batch consumed into child order); "
        "               child  side: IN  (batch produced by the process order). "
        "  STO_TRANSFER / BATCH_TRANSFER / MATERIAL_TRANSFER — "
        "               parent side: OUT (batch sent); child side: IN (batch received). "
        "  VENDOR_RECEIPT — child side only: IN (received from supplier; parent NULL). "
        "  DELIVERY       — parent side only: OUT (shipped to customer; child NULL). "
        "  ADJUSTMENT_IN  — child side: IN (stock write-on). "
        "  ADJUSTMENT_OUT — parent side: OUT (stock write-off). "
        "COUNTERPART columns carry the opposite endpoint identity: "
        "  COUNTERPART_MATERIAL_ID / COUNTERPART_BATCH_ID / COUNTERPART_PLANT_ID. "
        "VENDOR_RECEIPT IN rows: SUPPLIER_ID + PURCHASE_ORDER_ID populated. "
        "DELIVERY OUT rows: CUSTOMER_ID + DELIVERY_ID + SALES_ORDER_ID populated. "
        "PRODUCTION / TRANSFER rows: PROCESS_ORDER_ID + MATERIAL_DOCUMENT_NUMBER populated. "
        "Source: dlt.read('gold_batch_lineage') — intra-pipeline DLT dependency. "
        "Security: capability tier — NOT in GOLD_TABLES; GRANT added to "
        "resources/sql/trace_security_{env}.sql (traceability-readers group, tolerated failure). "
        "Grain: two rows per two-sided edge (OUT for parent, IN for child); "
        "one row per one-sided edge (VENDOR_RECEIPT IN only; DELIVERY OUT only). "
        "Phase 2 use cases: mass-balance timeline, supplier-batch panel, recall-readiness counts. "
        "Deterministic base (no current_date / current_timestamp)."
    ),
    cluster_by=["plant_code", "MATERIAL_ID"],
))
@dlt.expect_all_or_drop({
    "MATERIAL_ID present": "MATERIAL_ID IS NOT NULL",
    "BATCH_ID present": "BATCH_ID IS NOT NULL",
    "direction present": "direction IS NOT NULL",
    "LINK_TYPE present": "LINK_TYPE IS NOT NULL",
})
@dlt.expect_all({
    "QUANTITY non-negative if present": "QUANTITY IS NULL OR QUANTITY >= 0",
})
def gold_batch_event_ledger():  # noqa: C901 — two-sided fan-out; structural complexity
    """Directional per-batch event ledger exploded from gold_batch_lineage edges.

    Each directed edge is split into at most two rows:
      - parent side (OUT): the batch that was consumed or sent in this event.
      - child  side (IN):  the batch that was produced or received.

    One-sided edges (VENDOR_RECEIPT has NULL PARENT; DELIVERY has NULL CHILD) contribute
    only the populated side.  NULL BATCH_ID or NULL PLANT_ID rows are dropped — they cannot
    be attributed to a specific batch in a specific plant and would break Phase 2 queries.

    Reads gold_batch_lineage via dlt.read() (intra-pipeline DLT dependency pattern —
    same as gold_trace_anchor).
    """
    edges = dlt.read("gold_batch_lineage")

    # ── Parent side (OUT) ────────────────────────────────────────────────────
    # VENDOR_RECEIPT has NULL PARENT_BATCH_ID/PARENT_PLANT_ID — excluded by filter.
    parent_out = edges.filter(
        F.col("PARENT_BATCH_ID").isNotNull()
        & (F.trim(F.col("PARENT_BATCH_ID")) != "")
        & F.col("PARENT_PLANT_ID").isNotNull()
    ).select(
        F.col("PARENT_MATERIAL_ID").alias("MATERIAL_ID"),
        F.col("PARENT_BATCH_ID").alias("BATCH_ID"),
        F.col("PARENT_PLANT_ID").alias("PLANT_ID"),
        F.col("PARENT_PLANT_ID").alias("plant_code"),
        F.lit("OUT").alias("direction"),
        F.col("LINK_TYPE"),
        F.col("QUANTITY"),
        F.col("BASE_UNIT_OF_MEASURE"),
        F.col("POSTING_DATE"),
        # counterpart: the child batch / plant
        F.col("CHILD_MATERIAL_ID").alias("COUNTERPART_MATERIAL_ID"),
        F.col("CHILD_BATCH_ID").alias("COUNTERPART_BATCH_ID"),
        F.col("CHILD_PLANT_ID").alias("COUNTERPART_PLANT_ID"),
        # reference IDs
        F.col("SUPPLIER_ID"),
        F.col("CUSTOMER_ID"),
        F.col("DELIVERY_ID"),
        F.col("PURCHASE_ORDER_ID"),
        F.col("PROCESS_ORDER_ID"),
        F.col("SALES_ORDER_ID"),
        F.col("MATERIAL_DOCUMENT_NUMBER"),
    )

    # ── Child side (IN) ──────────────────────────────────────────────────────
    # DELIVERY has NULL CHILD_BATCH_ID/CHILD_PLANT_ID — excluded by filter.
    child_in = edges.filter(
        F.col("CHILD_BATCH_ID").isNotNull()
        & (F.trim(F.col("CHILD_BATCH_ID")) != "")
        & F.col("CHILD_PLANT_ID").isNotNull()
    ).select(
        F.col("CHILD_MATERIAL_ID").alias("MATERIAL_ID"),
        F.col("CHILD_BATCH_ID").alias("BATCH_ID"),
        F.col("CHILD_PLANT_ID").alias("PLANT_ID"),
        F.col("CHILD_PLANT_ID").alias("plant_code"),
        F.lit("IN").alias("direction"),
        F.col("LINK_TYPE"),
        F.col("QUANTITY"),
        F.col("BASE_UNIT_OF_MEASURE"),
        F.col("POSTING_DATE"),
        # counterpart: the parent batch / plant
        F.col("PARENT_MATERIAL_ID").alias("COUNTERPART_MATERIAL_ID"),
        F.col("PARENT_BATCH_ID").alias("COUNTERPART_BATCH_ID"),
        F.col("PARENT_PLANT_ID").alias("COUNTERPART_PLANT_ID"),
        # reference IDs
        F.col("SUPPLIER_ID"),
        F.col("CUSTOMER_ID"),
        F.col("DELIVERY_ID"),
        F.col("PURCHASE_ORDER_ID"),
        F.col("PROCESS_ORDER_ID"),
        F.col("SALES_ORDER_ID"),
        F.col("MATERIAL_DOCUMENT_NUMBER"),
    )

    return parent_out.unionByName(child_in)


# ─────────────────────────────────────────────────────────────────────────────
# gold_trace_vendor  (T4 — governed trace2 fan-out foundation)
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Vendor lookup for traceability fan-out: vendor_code → vendor_name, country_key. "
        "Source: silver.vendor (LFA1 via published_<env>.central_services.vendormaster_lfa1). "
        "One row per vendor_code. Vendor names are used in the Phase 2 supplier-batch panel "
        "to resolve SUPPLIER_ID → display name without a per-query join to the heavy LFA1 table. "
        "SUPPLIER_ID in gold_batch_lineage / gold_batch_event_ledger is the vendor_code from "
        "silver.purchase_order (EKKO.LIFNR → vendor_code after strip_zeros), which matches "
        "the vendor_code PK of silver.vendor. "
        "Grain: one row per vendor_code (deduped). "
        "Security: capability tier — NOT in GOLD_TABLES; GRANT added to "
        "resources/sql/trace_security_{env}.sql (traceability-readers group, tolerated failure). "
        "NOTE: silver.vendor is built by the slow reference pipeline. This gold MV reads it "
        "via spark.read.table (cross-pipeline Delta read). "
        "Deterministic base (no current_date / current_timestamp)."
    ),
    cluster_by=["vendor_code"],
))
@dlt.expect_all_or_drop({
    "vendor_code present": "vendor_code IS NOT NULL",
})
def gold_trace_vendor():
    """Vendor lookup: vendor_code → vendor_name, country_key.

    Source: silver.vendor (LFA1 via published central_services).
    One row per vendor code (deduped).
    """
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    return (
        spark.read.table(f"{silver_schema}.vendor")
        .select(
            F.col("vendor_code"),
            F.col("vendor_name"),
            F.col("country_key"),
        )
        .groupBy("vendor_code")
        .agg(
            F.max("vendor_name").alias("vendor_name"),
            F.max("country_key").alias("country_key"),
        )
    )


# ─────────────────────────────────────────────────────────────────────────────
# gold_trace_material  (T4 — governed trace2 fan-out foundation)
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Material lookup for traceability fan-out: material_code → material_description, "
        "material_type, material_group, base_uom. "
        "Source: silver.material (MARA + MARC + MAKT, plant-scoped). "
        "GRAIN DECISION: silver.material is one row per (plant_code, material_code) because "
        "MARA attributes live on MARC/plant rows.  This MV aggregates across plants using "
        "F.max (deterministic — same description for a given material_code regardless of plant; "
        "max() is a stable tiebreak that avoids arbitrary ordering).  One row per material_code. "
        "LANGUAGE: silver.material is pre-filtered to MAKT.SPRAS='E' (English) in reference.py — "
        "all rows are English; the LANGUAGE_ID='E' convention from legacy gold_material is "
        "preserved as a literal column so adapter SQL can JOIN on LANGUAGE_ID = 'E' unchanged. "
        "CONSUMER GRAIN: trace2 adapters join on MATERIAL_ID only (no plant), matching the "
        "plant-independent grain produced here.  The legacy gold_material carried one row per "
        "(MATERIAL_ID) with a LANGUAGE_ID column — this MV matches that contract. "
        "Security: capability tier — NOT in GOLD_TABLES; GRANT added to "
        "resources/sql/trace_security_{env}.sql (traceability-readers group, tolerated failure). "
        "NOTE: silver.material is built by the slow reference pipeline. This gold MV reads it "
        "via spark.read.table (cross-pipeline Delta read). "
        "Deterministic base (no current_date / current_timestamp)."
    ),
    cluster_by=["MATERIAL_ID"],
))
@dlt.expect_all_or_drop({
    "MATERIAL_ID present": "MATERIAL_ID IS NOT NULL",
})
def gold_trace_material():
    """Material lookup: material_code → material_description, material_type, material_group, base_uom.

    Source: silver.material (MARA + MARC + MAKT, English only).
    Aggregates across plants (F.max) to produce one row per material_code.
    Exposes a literal LANGUAGE_ID='E' column to match the legacy gold_material JOIN contract
    (adapters use: JOIN gold_material m ON m.MATERIAL_ID = ... AND m.LANGUAGE_ID = 'E').
    """
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    return (
        spark.read.table(f"{silver_schema}.material")
        .groupBy("material_code")
        .agg(
            F.max("material_description").alias("MATERIAL_NAME"),
            F.max("material_type").alias("material_type"),
            F.max("material_group").alias("material_group"),
            F.max("base_uom").alias("BASE_UNIT_OF_MEASURE"),
        )
        .select(
            F.col("material_code").alias("MATERIAL_ID"),
            F.col("MATERIAL_NAME"),
            F.col("material_type"),
            F.col("material_group"),
            F.col("BASE_UNIT_OF_MEASURE"),
            # Preserve legacy LANGUAGE_ID = 'E' join contract (silver.material is English-only;
            # MAKT was pre-filtered to SPRAS='E' in reference.py — all rows are English).
            F.lit("E").alias("LANGUAGE_ID"),
        )
    )


# ─────────────────────────────────────────────────────────────────────────────
# gold_trace_plant  (T4 — governed trace2 fan-out foundation)
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Plant lookup for traceability fan-out: plant_code → plant_name, country_key. "
        "Source decision: silver.plant (T001W via published central_services) UNION "
        "silver.site_lifecycle (estate-wide ~550-plant dimension, ADR 016). "
        "silver.plant covers actively-replicated plants; site_lifecycle fills in estate plants "
        "not yet in T001W (e.g. plants reviewed as CLOSED/SOLD that are in the traceability "
        "graph but not in the live plant master).  Per-side dedup then FULL OUTER join with "
        "F.coalesce — silver.plant (T001W) values are preferred wherever both sources carry "
        "the plant; site_lifecycle fills estate-only plants. "
        "silver.site_lifecycle.country maps to country_key (same attribute, different column name). "
        "GRAIN: one row per plant_code (F.max tiebreak for determinism). "
        "CONSUMER GRAIN: trace2 adapters join on PLANT_ID only, matching this grain. "
        "Legacy contract target: gold_plant — PLANT_ID, PLANT_NAME (adapters reference p.PLANT_ID, "
        "p.PLANT_NAME). "
        "Security: capability tier — NOT in GOLD_TABLES; GRANT added to "
        "resources/sql/trace_security_{env}.sql (traceability-readers group, tolerated failure). "
        "NOTE: silver.plant and silver.site_lifecycle are built by the slow reference pipeline. "
        "This gold MV reads them via spark.read.table (cross-pipeline Delta reads). "
        "Deterministic base (no current_date / current_timestamp)."
    ),
    cluster_by=["PLANT_ID"],
))
@dlt.expect_all_or_drop({
    "PLANT_ID present": "PLANT_ID IS NOT NULL",
})
def gold_trace_plant():
    """Plant lookup: plant_code → PLANT_NAME, country_key.

    Two-source UNION (silver.plant UNION ALL silver.site_lifecycle) so the lookup covers
    the full estate including SOLD/CLOSED plants that still have edges in gold_batch_lineage.

    silver.plant is the authoritative source for plant_name (T001W); silver.site_lifecycle
    provides plant_code, plant_name, country for the reviewed estate.  Each side is first
    deduplicated to one row per plant_code (F.max tiebreak), then FULL OUTER joined with
    F.coalesce(plant.*, site_lifecycle.*) so the authoritative T001W values win wherever
    both sources carry the plant; estate-only plants fall through to site_lifecycle.

    Exposes PLANT_ID and PLANT_NAME (upper-case column names) to match the legacy
    gold_plant JOIN contract (adapters use: JOIN gold_plant p ON p.PLANT_ID = ...).
    """
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    # silver.plant: T001W from published central_services — authoritative for live plants.
    # Dedup to one row per plant_code (deterministic F.max tiebreak).
    plant = (
        spark.read.table(f"{silver_schema}.plant")
        .groupBy("plant_code")
        .agg(
            F.max("plant_name").alias("_p_name"),
            F.max("country_key").alias("_p_country"),
        )
    )

    # silver.site_lifecycle: estate-wide reviewed dimension — covers SOLD/CLOSED/DIVESTED
    # plants that are present in the traceability graph but may be absent from T001W.
    # site_lifecycle.country is the same attribute as plant.country_key (LAND1 equivalent).
    site_lc = (
        spark.read.table(f"{silver_schema}.site_lifecycle")
        .groupBy("plant_code")
        .agg(
            F.max("plant_name").alias("_l_name"),
            F.max("country").alias("_l_country"),
        )
    )

    # FULL OUTER join + coalesce: T001W values preferred, lifecycle fills estate-only plants.
    return (
        plant.join(site_lc, "plant_code", "full")
        .select(
            F.col("plant_code").alias("PLANT_ID"),
            F.coalesce(F.col("_p_name"), F.col("_l_name")).alias("PLANT_NAME"),
            F.coalesce(F.col("_p_country"), F.col("_l_country")).alias("country_key"),
        )
    )


# ─────────────────────────────────────────────────────────────────────────────
# gold_trace_batch_material  (T4 — governed trace2 fan-out foundation)
# ─────────────────────────────────────────────────────────────────────────────

@dlt.table(**gold_table_args(
    comment=(
        "Batch–supplier-batch linkage for traceability fan-out: "
        "(material_code, batch_number) → SUPPLIER_BATCH_ID (vendor's own batch identifier). "
        "Source: silver.batch_where_used (CHVW), which carries LICHA (vendor batch) on rows "
        "where a batch was received from a supplier (LICHA populated on VENDOR_RECEIPT rows). "
        "SOURCE DECISION — MCH1/MCHA NOT used: SAP MCH1 (client-level batch master, "
        "material + batch grain, carries LICHA/MFRGR/VFDAT) and MCHA (plant-level batch, "
        "carries LICHA) are listed in the data dictionary but are NOT replicated into the "
        "connected_plant.sap source schema (no bronze table batchmaster_mch1 or equivalent "
        "exists — confirmed by absence of any MCH1/MCHA reference in pipeline code outside of "
        "generate_data_dictionary.py). An ingestion request for MCH1 would unlock manufacture_date "
        "(MFRGR) and expiry_date (VFDAT) which are also missing from the governed stack; "
        "raise as a follow-up ingestion request. "
        "CHVW.LICHA IS available (confirmed in silver/tables/traceability.py, _CHVW_REQUIRED "
        "list, line 62) and is already surfaced in silver.batch_where_used.vendor_batch_number. "
        "GRAIN: one row per (material_code, batch_number) — SUPPLIER_BATCH_ID deduplicated with "
        "F.max (a batch has at most one supplier batch reference; max() is a stable tiebreak "
        "in the rare case LICHA changes across CHVW rows for the same batch). "
        "NULL / blank LICHA rows are excluded (no vendor batch = no useful linkage). "
        "Legacy contract target: gold_batch_material — MATERIAL_ID, BATCH_ID, SUPPLIER_BATCH_ID. "
        "Security: capability tier — NOT in GOLD_TABLES; GRANT added to "
        "resources/sql/trace_security_{env}.sql (traceability-readers group, tolerated failure). "
        "NOTE: silver.batch_where_used is built by the slow reference pipeline (estate-wide "
        "CHVW snapshot). This gold MV reads it via spark.read.table (cross-pipeline Delta read). "
        "Deterministic base (no current_date / current_timestamp)."
    ),
    cluster_by=["MATERIAL_ID"],
))
@dlt.expect_all_or_drop({
    "MATERIAL_ID present": "MATERIAL_ID IS NOT NULL",
    "BATCH_ID present": "BATCH_ID IS NOT NULL",
    "SUPPLIER_BATCH_ID present": "SUPPLIER_BATCH_ID IS NOT NULL",
})
def gold_trace_batch_material():
    """Batch-to-vendor-batch linkage: (MATERIAL_ID, BATCH_ID) → SUPPLIER_BATCH_ID.

    Source: silver.batch_where_used.vendor_batch_number (CHVW.LICHA).
    Grain: one row per (material_code, batch_number) — SUPPLIER_BATCH_ID deduplicated with F.max.

    MCH1/MCHA (SAP batch master tables) are NOT replicated in connected_plant.sap —
    see table comment for full decision rationale and ingestion follow-up note.

    Adapters join: LEFT JOIN gold_trace_batch_material bm ON s.material_code = bm.MATERIAL_ID
    AND s.batch_number = bm.BATCH_ID — matching this plant-independent grain.
    """
    spark = get_spark_session()
    silver_schema = get_silver_schema(spark)

    bwu = (
        spark.read.table(f"{silver_schema}.batch_where_used")
        .filter(
            F.col("vendor_batch_number").isNotNull()
            & (F.trim(F.col("vendor_batch_number")) != "")
        )
        .groupBy("material_code", "batch_number")
        .agg(F.max("vendor_batch_number").alias("SUPPLIER_BATCH_ID"))
    )

    return bwu.select(
        F.col("material_code").alias("MATERIAL_ID"),
        F.col("batch_number").alias("BATCH_ID"),
        F.col("SUPPLIER_BATCH_ID"),
    )
