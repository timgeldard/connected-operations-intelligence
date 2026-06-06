"""Supplier exposure, consumed lots, and sibling batch specs + mappers.

Covers:
  - get_supplier_exposure_spec / map_supplier_exposure_rows (Slice 6)
  - get_supplier_consumed_lots_spec (Trace App — getSupplierBatches)
  - get_supplier_sibling_batches_spec
  - map_supplier_batch_view
"""
from __future__ import annotations

from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2SupplierBatchViewRequest, Trace2SupplierExposureRequest

# ---------------------------------------------------------------------------
# Slice 6 — getSupplierExposureSummary (gold_batch_lineage VENDOR_RECEIPT + gold_supplier)
# ---------------------------------------------------------------------------

def get_supplier_exposure_spec(request: Trace2SupplierExposureRequest) -> QuerySpec:
    """Return a QuerySpec for getSupplierExposureSummary — V1-parity supplier slice.

    Source: single-hop upstream VENDOR_RECEIPT walk from gold_batch_lineage joined
    to gold_supplier on SUPPLIER_ID. Returns one row per distinct supplier with
    aggregated quantity, receipt count, last-receipt date, and uom.

    Empty-string SUPPLIER_ID handling: lineage rows where SUPPLIER_ID is NULL or
    empty string ('') are filtered at SQL. Live data on 2026-05-20 showed 9 of 10
    direct-parent VENDOR_RECEIPT rows for the UAT candidate had SUPPLIER_ID = ''.
    These represent unattributed inputs (intra-company transfers, missing data)
    and are not real third-party suppliers; they are excluded by design.

    Multi-hop walks are out of scope for this first slice. The query returns
    direct-parent VENDOR_RECEIPT suppliers only. Multi-hop is a separate concern
    (would need a recursive CTE; not in scope here).

    openSupplierActions and highestRiskSupplier are NOT populated — a verified
    QM source is required. See TRACE-P1-012.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl_lineage = resolve_domain_object("trace2", "gold_batch_lineage")
    tbl_supplier = resolve_domain_object("trace2", "gold_supplier")

    sql = f"""
    SELECT
        l.SUPPLIER_ID            AS supplier_id,
        s.SUPPLIER_NAME          AS supplier_name,
        s.COUNTRY_ID             AS country_id,
        s.COUNTRY_NAME           AS country_name,
        SUM(l.QUANTITY)          AS received_quantity,
        COUNT(*)                 AS receipt_count,
        COUNT(DISTINCT l.PARENT_MATERIAL_ID) AS upstream_material_count,
        MAX(l.POSTING_DATE)      AS last_receipt_date,
        MAX(l.BASE_UNIT_OF_MEASURE) AS uom
    FROM {tbl_lineage} l
    LEFT JOIN {tbl_supplier} s ON l.SUPPLIER_ID = s.SUPPLIER_ID
    WHERE l.CHILD_MATERIAL_ID = :material_id
      AND l.CHILD_BATCH_ID    = :batch_id
      AND l.LINK_TYPE         = 'VENDOR_RECEIPT'
      AND l.SUPPLIER_ID IS NOT NULL
      AND l.SUPPLIER_ID <> ''
    GROUP BY l.SUPPLIER_ID, s.SUPPLIER_NAME, s.COUNTRY_ID, s.COUNTRY_NAME
    ORDER BY received_quantity DESC
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_supplier_exposure",
        module="trace2",
        endpoint="/api/trace2/supplier-exposure",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_lineage+gold_supplier",
        tags=["trace2", "supplier-exposure", "vendor-receipt"],
    )


def map_supplier_exposure_rows(rows: list[dict]) -> dict:
    """Map aggregated supplier rows to SupplierExposureSummarySchema shape.

    Empty rows → returns a zero-supplier summary (not None). Distinct from the
    customer-exposure 404 pattern: a batch with zero direct VENDOR_RECEIPT
    suppliers may genuinely be a production-only batch with no purchased inputs.
    The panel surfaces zero-supplier state explicitly.

    Mapped fields:
      supplierCount     = number of distinct suppliers in the result rows
      supplierLots      = total receipt count across suppliers (proxy for "lots received")
      upstreamMaterials = sum of distinct upstream material counts across suppliers
      openSupplierActions = 0 (no QM source)  -- TRACE-P1-012
      highestRiskSupplier = absent (no QM source)
      suppliers          = per-supplier detail array

    receivedQuantity is summed per supplier in SQL; uom is taken from MAX(BASE_UNIT_OF_MEASURE)
    which assumes a supplier's receipts share a UoM. Mixed-UoM cases are rare for a
    given material/batch input; not handled in this slice.
    """
    suppliers: list[dict] = []
    total_lots = 0
    total_upstream_materials = 0

    for row in rows:
        supplier_id = row.get("supplier_id") or ""
        if not supplier_id:
            continue
        received_quantity = float(row.get("received_quantity") or 0)
        receipt_count = int(row.get("receipt_count") or 0)
        upstream_material_count = int(row.get("upstream_material_count") or 0)
        total_lots += receipt_count
        total_upstream_materials += upstream_material_count
        detail: dict = {
            "supplierId": str(supplier_id),
            "receivedQuantity": received_quantity,
            "batchCount": receipt_count,
        }
        if row.get("supplier_name") is not None:
            detail["supplierName"] = str(row["supplier_name"])
        if row.get("country_id") is not None:
            detail["countryId"] = str(row["country_id"])
        if row.get("country_name") is not None:
            detail["countryName"] = str(row["country_name"])
        if row.get("uom") is not None:
            detail["uom"] = str(row["uom"])
        if row.get("last_receipt_date") is not None:
            detail["lastReceiptDate"] = str(row["last_receipt_date"])
        suppliers.append(detail)

    return {
        "supplierCount": len(suppliers),
        "supplierLots": total_lots,
        "upstreamMaterials": total_upstream_materials,
        "openSupplierActions": 0,   # TRACE-P1-012: no verified QM source
        "suppliers": suppliers,
    }


# ---------------------------------------------------------------------------
# Trace App slice — getSupplierBatches  (gold_batch_lineage two-step walk)
# ---------------------------------------------------------------------------

def get_supplier_consumed_lots_spec(request: Trace2SupplierBatchViewRequest) -> QuerySpec:
    """Return a QuerySpec for the consumed-lots half of the Supplier Batches tab.

    Source: gold_batch_lineage filtered to LINK_TYPE='VENDOR_RECEIPT' edges where
    the CHILD is the active batch. SUPPLIER_ID identifies the vendor;
    PARENT_BATCH_ID is the vendor batch.

    Single-hop only — multi-hop upstream walk is out of scope here.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_lineage")

    sql = f"""
    SELECT
      SUPPLIER_ID            AS supplier_id,
      PARENT_BATCH_ID        AS vendor_batch,
      PARENT_MATERIAL_ID     AS parent_material_id,
      QUANTITY               AS quantity,
      BASE_UNIT_OF_MEASURE   AS uom,
      POSTING_DATE           AS posting_date
    FROM {tbl}
    WHERE CHILD_MATERIAL_ID = :material_id
      AND CHILD_BATCH_ID   = :batch_id
      AND LINK_TYPE        = 'VENDOR_RECEIPT'
      AND SUPPLIER_ID IS NOT NULL
      AND PARENT_BATCH_ID IS NOT NULL
    ORDER BY POSTING_DATE DESC
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_supplier_consumed_lots",
        module="trace2",
        endpoint="/api/trace2/supplier-batches",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_lineage",
        tags=["trace2", "trace-app", "supplier-batches", "consumed-lots"],
    )


def get_supplier_sibling_batches_spec(
    request: Trace2SupplierBatchViewRequest,
    vendor_batches: list[str],
) -> QuerySpec:
    """Sibling batches: other batches across plants that consumed any of the
    vendor lots this batch consumed.

    Source: gold_batch_lineage with LINK_TYPE='VENDOR_RECEIPT', joined back on
    PARENT_BATCH_ID IN (vendor_batches we found). Plant filter is intentionally
    omitted — the whole point is to surface cross-plant ripple risk.

    If `vendor_batches` is empty, returns a no-op spec that selects nothing.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_lineage")

    if not vendor_batches:
        # Empty filter — produce a guaranteed-zero-row query without parameter binding for IN clause.
        sql = "SELECT NULL AS plant_id, NULL AS batch_id, NULL AS mfg, NULL AS qty, NULL AS vendor_batch WHERE 1 = 0"
        return QuerySpec(
            name="trace2.get_supplier_sibling_batches",
            module="trace2",
            endpoint="/api/trace2/supplier-batches",
            sql=sql,
            params={},
            cache_policy=CacheTier.PER_USER_60S,
            source_badge="view:gold_batch_lineage",
            tags=["trace2", "trace-app", "supplier-batches", "siblings-empty"],
        )

    # Embed the vendor_batch list as literal strings (already validated upstream
    # by SQL identifier policy in the parameter binding layer); fall back to
    # quoting defensively here.
    sanitised = [vb.replace("'", "''") for vb in vendor_batches]
    in_list = ", ".join(f"'{vb}'" for vb in sanitised)

    sql = f"""
    SELECT
      CHILD_PLANT_ID        AS plant_id,
      CHILD_BATCH_ID        AS batch_id,
      CHILD_MATERIAL_ID     AS child_material_id,
      POSTING_DATE          AS posting_date,
      QUANTITY              AS quantity,
      BASE_UNIT_OF_MEASURE  AS uom,
      PARENT_BATCH_ID       AS vendor_batch
    FROM {tbl}
    WHERE LINK_TYPE = 'VENDOR_RECEIPT'
      AND PARENT_BATCH_ID IN ({in_list})
      AND NOT (CHILD_MATERIAL_ID = :material_id AND CHILD_BATCH_ID = :batch_id)
      AND CHILD_BATCH_ID IS NOT NULL
    ORDER BY POSTING_DATE DESC
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_supplier_sibling_batches",
        module="trace2",
        endpoint="/api/trace2/supplier-batches",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_lineage",
        tags=["trace2", "trace-app", "supplier-batches", "siblings"],
    )


def map_supplier_batch_view(
    consumed_rows: list[dict],
    sibling_rows: list[dict],
    vendor_name_lookup: Optional[dict[str, str]] = None,
) -> dict:
    """Combine consumed-lot rows and sibling rows into SupplierBatchView shape.

    Always returns a dict — empty consumed/siblings lists are valid (a batch may
    have no recorded vendor receipts in the lineage view).
    Vendor names default to the supplier ID if `vendor_name_lookup` is empty —
    gold_supplier join is omitted in this slice to keep the query lean. Replace
    when vendor masters are wired.
    """
    consumed_lots: list[dict] = []
    for row in consumed_rows:
        supplier_id = str(row.get("supplier_id") or "")
        vendor_name = (vendor_name_lookup or {}).get(supplier_id, supplier_id)
        consumed_lots.append({
            "vendor": vendor_name,
            "vendorBatch": str(row.get("vendor_batch") or ""),
            "material": str(row.get("parent_material_id") or ""),
            "receipt": str(row.get("posting_date") or ""),
            "consumed": abs(float(row.get("quantity") or 0)),
            "uom": str(row.get("uom") or ""),
            # CoA reference is not on gold_batch_lineage — left null.
            "coa": None,
            # Risk is server-derived from supplier history once that view exists.
            "risk": "unknown",
        })

    sibling_batches: list[dict] = []
    for row in sibling_rows:
        plant_id = str(row.get("plant_id") or "")
        sibling_batches.append({
            "plant": plant_id,
            "plantId": plant_id or None,
            "batchId": str(row.get("batch_id") or ""),
            "mfg": str(row.get("posting_date") or ""),
            "qty": abs(float(row.get("quantity") or 0)),
            "vendorBatch": str(row.get("vendor_batch") or ""),
        })

    return {
        "consumedLots": consumed_lots,
        "siblingBatches": sibling_batches,
    }
