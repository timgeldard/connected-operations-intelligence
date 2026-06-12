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
from shared.query_service.object_resolver import resolve_governed_trace2_object
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2SupplierBatchViewRequest, Trace2SupplierExposureRequest

# ---------------------------------------------------------------------------
# Slice 6 — getSupplierExposureSummary
# ---------------------------------------------------------------------------

def get_supplier_exposure_spec(request: Trace2SupplierExposureRequest) -> QuerySpec:
    """Return a QuerySpec for getSupplierExposureSummary — governed supplier slice.

    Sources:
      - gold_batch_event_ledger  (TRACE_GOVERNED_SCHEMA) — VENDOR_RECEIPT IN rows only
      - gold_trace_vendor        (TRACE_GOVERNED_SCHEMA) — vendor_code → vendor_name, country_key

    Column mapping from governed objects vs legacy gold_supplier:
      SUPPLIER_ID from the event ledger = vendor_code in gold_trace_vendor  (same FK)
      gold_trace_vendor.vendor_name → SUPPLIER_NAME equivalent (present)
      gold_trace_vendor.country_key → COUNTRY_ID equivalent (present)
      gold_trace_vendor has NO country_name column — COUNTRY_NAME emitted as NULL
      (gap reported: legacy gold_supplier had country_name; gold_trace_vendor has country_key only)

    The event ledger uses direction=IN + LINK_TYPE='VENDOR_RECEIPT' to identify
    incoming goods receipts from suppliers.  MATERIAL_ID and BATCH_ID in the
    event ledger are the received-batch identifiers (child side in the lineage).

    Empty SUPPLIER_ID filtering: rows where SUPPLIER_ID is NULL or empty are
    excluded at SQL (same policy as the legacy adapter).

    Multi-hop walks are out of scope.  Single-hop direct VENDOR_RECEIPT rows only.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl_ledger = resolve_governed_trace2_object("gold_batch_event_ledger")
    tbl_vendor = resolve_governed_trace2_object("gold_trace_vendor")

    sql = f"""
    SELECT
        l.SUPPLIER_ID              AS supplier_id,
        v.vendor_name              AS supplier_name,
        v.country_key              AS country_id,
        CAST(NULL AS STRING)       AS country_name,
        SUM(l.QUANTITY)            AS received_quantity,
        COUNT(*)                   AS receipt_count,
        COUNT(DISTINCT l.COUNTERPART_MATERIAL_ID) AS upstream_material_count,
        MAX(l.POSTING_DATE)        AS last_receipt_date,
        MAX(l.BASE_UNIT_OF_MEASURE) AS uom
    FROM {tbl_ledger} l
    LEFT JOIN {tbl_vendor} v ON l.SUPPLIER_ID = v.vendor_code
    WHERE l.MATERIAL_ID = :material_id
      AND l.BATCH_ID    = :batch_id
      AND l.LINK_TYPE   = 'VENDOR_RECEIPT'
      AND l.direction   = 'IN'
      AND l.SUPPLIER_ID IS NOT NULL
      AND l.SUPPLIER_ID <> ''
    GROUP BY l.SUPPLIER_ID, v.vendor_name, v.country_key
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
        source_badge="mv:gold_batch_event_ledger+gold_trace_vendor",
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
      supplierLots      = total receipt count across suppliers
      upstreamMaterials = sum of distinct upstream material counts across suppliers
      openSupplierActions = 0 (no QM source)
      suppliers          = per-supplier detail array

    country_name: always NULL in the governed source (gold_trace_vendor has only
    country_key, not a country description string). The response model has
    countryName as optional — it is omitted when null, source-truthfully.
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
        # country_name is NULL from gold_trace_vendor (no country description column) — gap.
        # Pass through when non-null in case a future enrichment join provides it.
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
        "openSupplierActions": 0,   # no QM source wired yet
        "suppliers": suppliers,
    }


# ---------------------------------------------------------------------------
# Trace App slice — getSupplierBatches
# ---------------------------------------------------------------------------

def get_supplier_consumed_lots_spec(request: Trace2SupplierBatchViewRequest) -> QuerySpec:
    """Return a QuerySpec for the consumed-lots half of the Supplier Batches tab.

    Source: gold_batch_event_ledger filtered to LINK_TYPE='VENDOR_RECEIPT', direction='IN',
    for the active batch.  SUPPLIER_ID identifies the vendor; COUNTERPART_MATERIAL_ID is
    the vendor-batch material (COUNTERPART columns hold the opposite endpoint).

    Note: the governed ledger does not carry a PARENT_BATCH_ID column by name — for
    VENDOR_RECEIPT IN rows the counterpart (parent) batch is NULL in gold_batch_lineage
    (vendor receipts have no upstream batch identifier in SAP).  COUNTERPART_BATCH_ID will
    therefore be NULL for these rows.  The consumed_lots list shows vendor receipt events;
    vendor_batch is emitted as NULL (same as legacy behaviour for unresolvable vendor batches).

    Single-hop only.
    """
    tbl = resolve_governed_trace2_object("gold_batch_event_ledger")

    sql = f"""
    SELECT
      SUPPLIER_ID              AS supplier_id,
      COUNTERPART_BATCH_ID     AS vendor_batch,
      COUNTERPART_MATERIAL_ID  AS parent_material_id,
      QUANTITY                 AS quantity,
      BASE_UNIT_OF_MEASURE     AS uom,
      POSTING_DATE             AS posting_date
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
      AND LINK_TYPE  = 'VENDOR_RECEIPT'
      AND direction  = 'IN'
      AND SUPPLIER_ID IS NOT NULL
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
        source_badge="mv:gold_batch_event_ledger",
        tags=["trace2", "trace-app", "supplier-batches", "consumed-lots"],
    )


def get_supplier_sibling_batches_spec(
    request: Trace2SupplierBatchViewRequest,
    vendor_batches: list[str],
) -> QuerySpec:
    """Sibling batches: other batches across plants that consumed any of the same
    vendor lots this batch consumed.

    Source: gold_batch_event_ledger VENDOR_RECEIPT IN rows where COUNTERPART_BATCH_ID
    IN (vendor_batches), excluding the active batch.  Plant filter is intentionally
    omitted — the whole point is cross-plant ripple risk.

    If `vendor_batches` is empty, returns a no-op spec.
    """
    tbl = resolve_governed_trace2_object("gold_batch_event_ledger")

    if not vendor_batches:
        sql = "SELECT NULL AS plant_id, NULL AS batch_id, NULL AS mfg, NULL AS qty, NULL AS vendor_batch WHERE 1 = 0"
        return QuerySpec(
            name="trace2.get_supplier_sibling_batches",
            module="trace2",
            endpoint="/api/trace2/supplier-batches",
            sql=sql,
            params={},
            cache_policy=CacheTier.PER_USER_60S,
            source_badge="mv:gold_batch_event_ledger",
            tags=["trace2", "trace-app", "supplier-batches", "siblings-empty"],
        )

    sanitised = [vb.replace("'", "''") for vb in vendor_batches]
    in_list = ", ".join(f"'{vb}'" for vb in sanitised)

    sql = f"""
    SELECT
      PLANT_ID                 AS plant_id,
      BATCH_ID                 AS batch_id,
      MATERIAL_ID              AS child_material_id,
      POSTING_DATE             AS posting_date,
      QUANTITY                 AS quantity,
      BASE_UNIT_OF_MEASURE     AS uom,
      COUNTERPART_BATCH_ID     AS vendor_batch
    FROM {tbl}
    WHERE LINK_TYPE  = 'VENDOR_RECEIPT'
      AND direction  = 'IN'
      AND COUNTERPART_BATCH_ID IN ({in_list})
      AND NOT (MATERIAL_ID = :material_id AND BATCH_ID = :batch_id)
      AND BATCH_ID IS NOT NULL
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
        source_badge="mv:gold_batch_event_ledger",
        tags=["trace2", "trace-app", "supplier-batches", "siblings"],
    )


def map_supplier_batch_view(
    consumed_rows: list[dict],
    sibling_rows: list[dict],
    vendor_name_lookup: Optional[dict[str, str]] = None,
) -> dict:
    """Combine consumed-lot rows and sibling rows into SupplierBatchView shape.

    Always returns a dict — empty consumed/siblings lists are valid.
    Vendor names default to supplier_id if vendor_name_lookup is empty.
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
            # CoA reference is not on gold_batch_event_ledger — left null.
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
