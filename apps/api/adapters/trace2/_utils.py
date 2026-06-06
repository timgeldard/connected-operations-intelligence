"""Private helper functions for Trace2 domain adapters.

These helpers are used internally by the domain adapter modules.
They are NOT part of the public API — names are prefixed with ``_``.
"""
from __future__ import annotations

import datetime
from typing import Optional

# ---------------------------------------------------------------------------
# Lookup maps
# ---------------------------------------------------------------------------

# NOTE: _LINK_TYPE_MAP is documentation-only. The live linkType string is passed
# raw in _make_graph_edge and the frontend mapper (trace2-graph-mapper.ts) owns
# the linkType → relationshipType translation. This dict is kept here as a
# reference for what LINK_TYPE values gold_batch_lineage may emit, and to keep
# the Python and TypeScript mapping tables in sync.
# P0-3: VENDOR_RECEIPT and CONSUMPTION are distinct traceability events and must
# NOT be conflated — see trace2-graph-mapper.ts LINK_TYPE_MAP for the canonical mapping.
_LINK_TYPE_MAP: dict[str, str] = {
    "PRODUCTION": "produced-from",
    "BATCH_TRANSFER": "transferred-to",
    "STO_TRANSFER": "transferred-to",
    "VENDOR_RECEIPT": "vendor-receipt",   # inbound goods receipt from external supplier
    "CONSUMPTION": "consumed-by",          # component consumed into a production order
    "DELIVERY": "delivered-to",
    "SPLIT": "split-from",
    "MERGE": "merged-into",
}

_MOVEMENT_CATEGORY_MAP: dict[str, str] = {
    "PRODUCTION": "production",
    "SHIPMENT": "shipment",
    "CONSUMPTION": "consumption",
    "ADJUSTMENT": "adjustment",
}

_BATCH_STATUS_MAP: dict[str, str] = {
    "BLOCKED": "blocked",
    "B": "blocked",
    "2": "blocked",
    "ARCHIVED": "archived",
    "A": "archived",
    "ACTIVE": "active",
    "RELEASED": "active",
    "R": "active",
    "1": "active",
    "DELETED": "deleted",
    "D": "deleted",
    "4": "deleted",
}

_RELEASE_STATUS_MAP: dict[str, str] = {
    "RELEASED": "released",
    "R": "released",
    "1": "released",
    "ACTIVE": "released",
    "BLOCKED": "blocked",
    "B": "blocked",
    "2": "blocked",
    "RESTRICTED": "restricted",
    "NOT_RELEASED": "not-released",
    "NOT-RELEASED": "not-released",
    "N": "not-released",
    "0": "not-released",
}

# Map common MSEG movement types to the panel's bucket codes. The panel
# accepts {101, 261, 601, 701, Z01}; everything else is bucketed as 'Z01'.
_MASS_BALANCE_CODE_MAP: dict[str, str] = {
    "101": "101",  # Goods receipt for purchase order / production order
    "102": "101",  # Reversal of 101 — keep in production bucket so net is correct
    "131": "101",  # Goods receipt from production
    "261": "261",  # Goods issue to order
    "262": "261",  # Reversal of 261
    "601": "601",  # Goods issue · delivery
    "602": "601",  # Reversal of 601
    "701": "701",  # Inventory adjustment
    "702": "701",
    "711": "701",
    "712": "701",
}

_TIMELINE_TONE_MAP = {"good", "warn", "bad", "brand", "neutral"}
_TIMELINE_TYPE_MAP = {"production", "consumption", "qc", "release", "approval", "hold", "dispatch", "note"}
_TIMELINE_SOURCE_MAP = {"SAP", "LIMS", "TRACE", "MANUAL"}


# ---------------------------------------------------------------------------
# Search helpers
# ---------------------------------------------------------------------------

def _to_search_like_pattern(query_upper: str) -> str:
    """Convert a consumer search term to a Databricks LIKE pattern."""
    pattern = query_upper.replace("*", "%")
    if "%" not in pattern:
        pattern = f"%{pattern}%"
    return pattern


def _string_or_empty(value: object) -> str:
    """Preserve falsy-but-valid source identifiers such as numeric 0."""
    return str(value) if value is not None else ""


# ---------------------------------------------------------------------------
# Graph node/edge helpers
# ---------------------------------------------------------------------------

def _node_key(material_id: str, batch_id: str, plant_id: str | None = None) -> str:
    """Unique key for a batch node — 3-tuple (material_id:batch_id:plant_id).

    plant_id is included so that STO transfers (same material+batch, different
    plant) render as two distinct nodes connected by a transferred-to edge.
    """
    return f"{material_id}:{batch_id}:{plant_id or ''}"


def _delivery_child_key(row: dict) -> str:
    """Key for a customer-delivery terminal node (CHILD fields are NULL in gold_batch_lineage)."""
    delivery_id = row.get("delivery_id")
    customer_id = row.get("customer_id")
    if delivery_id:
        return f"delivery:{delivery_id}"
    if customer_id:
        return f"customer:{customer_id}"
    return "delivery:unknown"


def _make_delivery_node(row: dict, depth: int) -> dict:
    customer_id = row.get("customer_id")
    description = f"Customer {customer_id}" if customer_id else "Customer Delivery"
    qty = row.get("quantity")
    uom = row.get("base_unit_of_measure")
    node: dict = {
        "id": _delivery_child_key(row),
        "type": "customer-delivery",
        "materialId": customer_id or "",
        "materialDescription": description,
        "batchId": row.get("delivery_id"),
        "plantId": None,
        "depth": depth,
        "directions": ["downstream"],
        "isAnchor": False,
    }
    if qty is not None:
        node["quantity"] = float(qty)
    if uom:
        node["uom"] = str(uom)
    return node


def _make_graph_node(row: dict, side: str, depth: int, direction: str) -> dict:
    prefix = "parent" if side == "parent" else "child"
    mat = row[f"{prefix}_material_id"]
    bat = row[f"{prefix}_batch_id"]
    pla = row[f"{prefix}_plant_id"]
    return {
        "id": _node_key(mat, bat, pla),
        "materialId": mat,
        "materialDescription": row.get(f"{prefix}_material_name") or row.get("material_name") or "",
        "batchId": bat,
        "plantId": pla,
        "depth": depth,
        "directions": [direction],
        "isAnchor": False,
    }


def _make_graph_edge(
    row: dict,
    parent_key: str,
    child_key: str,
    edge_id: str,
    depth: int,
    direction: str,
) -> dict:
    qty_raw = row.get("quantity")
    return {
        "id": edge_id,
        "source": parent_key,
        "target": child_key,
        "linkType": row.get("link_type"),
        "processOrderId": row.get("process_order_id"),
        "materialDocumentNumber": row.get("material_document_number"),
        "purchaseOrderId": row.get("purchase_order_id"),
        "supplierId": row.get("supplier_id"),
        "customerId": row.get("customer_id"),
        "deliveryId": row.get("delivery_id"),
        "salesOrderId": row.get("sales_order_id"),
        "quantity": float(qty_raw) if qty_raw is not None else None,
        "uom": row.get("uom") or row.get("base_unit_of_measure"),
        "postingDate": row.get("posting_date"),
        "movementType": row.get("movement_type"),
    }


# ---------------------------------------------------------------------------
# Status/category mappers
# ---------------------------------------------------------------------------

def _map_link_type(raw: Optional[str]) -> str:
    # Not called by _make_graph_edge (raw linkType is passed through to the frontend).
    # Retained for test/validation use only.
    return _LINK_TYPE_MAP.get((raw or "").upper().strip(), "component-of")


def _map_movement_category(raw: Optional[str]) -> str:
    return _MOVEMENT_CATEGORY_MAP.get((raw or "").upper().strip(), "adjustment")


def _map_quality_status(raw: Optional[str]) -> str:
    """Map gold_batch_production_history_v.quality_status to the contract enum.

    Live values observed 2026-05-20: 'Pass' (1.96M rows), 'Fail' (296k rows).
    Anything else (including null and empty string) maps to 'unknown'.
    """
    if raw is None:
        return "unknown"
    text = str(raw).strip().lower()
    if text == "pass":
        return "pass"
    if text == "fail":
        return "fail"
    return "unknown"


def _is_unmapped_movement_category(raw: Optional[str], mapped: str) -> bool:
    """True when raw was non-null/non-empty but fell through the map to "adjustment".

    A raw value of None or empty string is intentionally not flagged — it means the
    source provided no category at all, which is a different (and rarer) condition
    than "we received a category but did not know what to do with it".
    """
    if raw is None:
        return False
    text = str(raw).strip()
    if not text:
        return False
    if mapped != "adjustment":
        return False
    # "adjustment"-like raw values (e.g. "ADJUSTMENT", "Adjustment") are not unmapped.
    return text.upper() != "ADJUSTMENT"


def _map_batch_status(raw: Optional[str]) -> str:
    if raw is None:
        return "unknown"
    return _BATCH_STATUS_MAP.get(str(raw).upper().strip(), "unknown")


def _derive_stock_status(row: dict) -> str:
    def qty(col: str) -> float:
        return float(row.get(col) or 0)

    if qty("blocked") > 0:
        return "blocked"
    if qty("quality_inspection") > 0:
        return "quality-inspection"
    if qty("restricted") > 0:
        return "restricted"
    if qty("transit") > 0:
        return "transit"
    return "unrestricted"


def _derive_quality_status(row: dict) -> str:
    """Derive quality status from available batch stock data.

    IMPORTANT: quality_inspection is a stock disposition quantity (QI stock),
    not a QM usage decision. QI stock > 0 means stock is held under quality
    inspection, which justifies 'pending' (open inspection). However, it does
    NOT mean the batch was accepted or rejected — those require an actual QM
    inspection-lot usage decision field that is not present in the current query.

    Returns:
        'pending'  — QI stock is non-zero (open quality inspection in progress).
        'unknown'  — No QI stock and no QM decision field available from this
                     source. Do NOT interpret 'unknown' as 'accepted'. Use
                     'not-applicable' only when quality inspection is structurally
                     not applicable to this batch type (e.g., re-packed or
                     non-regulated materials) — that distinction requires a
                     verified QM inspection type / usage decision field.

    Blocked validation: to return 'accepted', 'rejected', or 'conditional', a
    verified QM usage decision / inspection lot decision field is required.
    The query must be extended to join or select from a QM decisions view (e.g.,
    gold_qm_usage_decision_v or equivalent). Until that field is verified in UAT,
    this function returns 'unknown' rather than guessing.
    """
    if float(row.get("quality_inspection") or 0) > 0:
        return "pending"
    return "unknown"


def _derive_release_status(raw: Optional[str]) -> str:
    if raw is None:
        return "unknown"
    return _RELEASE_STATUS_MAP.get(str(raw).upper().strip(), "unknown")


def _date_to_utc(v: object) -> str:
    if isinstance(v, datetime.datetime):
        return (v.replace(tzinfo=datetime.timezone.utc) if v.tzinfo is None else v).isoformat()
    if isinstance(v, datetime.date):
        return f"{v.isoformat()}T00:00:00Z"
    s = str(v)
    return s if len(s) > 10 else f"{s}T00:00:00Z"


def _bucket_movement_type(mvt: Optional[str]) -> str:
    if mvt is None:
        return "Z01"
    return _MASS_BALANCE_CODE_MAP.get(str(mvt).strip(), "Z01")


def _movement_label(mvt: Optional[str], category: Optional[str]) -> str:
    cat = str(category or "").strip().lower()
    code = str(mvt or "").strip()
    if cat:
        return f"{cat.capitalize()} · {code}" if code else cat.capitalize()
    return f"Movement {code}" if code else "Movement"


def _classify_coa_status(
    valuation: Optional[str],
    actual: Optional[float],
    low: Optional[float],
    high: Optional[float],
) -> str:
    """Return 'ok' / 'warn' / 'fail' for a CoA row.

    Uses SAP INSPECTION_RESULT_VALUATION when present (A=accepted, R=rejected),
    falls back to numeric tolerance comparison.
    """
    v = (str(valuation or "")).strip().upper()
    if v in ("R", "REJECTED", "FAIL"):
        return "fail"
    if v in ("A", "ACCEPTED", "OK"):
        # check warn band: within 10% of upper or lower tolerance
        if actual is not None and low is not None and high is not None and high > low:
            margin = (high - low) * 0.1
            if actual > high - margin or actual < low + margin:
                return "warn"
        return "ok"
    # No explicit valuation — use tolerance window
    if actual is None or low is None or high is None:
        return "ok"
    if actual < low or actual > high:
        return "fail"
    margin = (high - low) * 0.1 if high > low else 0
    if margin > 0 and (actual > high - margin or actual < low + margin):
        return "warn"
    return "ok"
