"""POH Databricks-api adapter — QuerySpec factories and row mappers for Process Order Review.

Implemented slices:
  - get_process_order_header_spec / map_process_order_header_rows
  - get_order_operations_spec / map_order_operations_rows
  - get_order_confirmations_spec / map_order_confirmations_rows
  - get_order_goods_movements_spec / map_order_goods_movements_rows  (direction map pending MOVEMENT_TYPE DDL)

Column verification status (2026-05-17, connected_plant_uat):
  vw_gold_process_order columns confirmed via live DDL:
    PROCESS_ORDER_ID, STATUS, MATERIAL_ID, INSPECTION_LOT_ID, MATERIAL_DESCRIPTION, PLANT_ID
  vw_gold_process_order_phase columns confirmed via live DDL:
    PROCESS_ORDER_PHASE_ID, PROCESS_ORDER_ID, PHASE_ID, PHASE_DESCRIPTION, PHASE_TEXT,
    START_USER, END_USER, OPERATION_QUANTITY, OPERATION_QUANTITY_UOM, SORT_NUMBER
  vw_gold_confirmation columns confirmed via live DDL:
    PROCESS_ORDER_PHASE_ID, CONFIRMATION_ID, PROCESS_ORDER_ID, PHASE_ID, PLANT_ID,
    CONFIRMED_QUANTITY, CONFIRMED_QUANTITY_UOM, START_TIMESTAMP, END_TIMESTAMP,
    SET_UP_DURATION_S, MACHINE_DURATION_S, CLEANING_DURATION_S, GROSS_DURATION_S,
    __BATCH_ID, __CREATED_ON, __UPDATED_ON
  vw_gold_adp_movement columns confirmed via live DDL:
    ID, PROCESS_ORDER_ID, PHASE_ID, QUANTITY, UOM, PLANT_ID, SOURCE_VESSEL_ID,
    PROCESSING_UNIT_ID, SCALE, SCALE_MODE, DATE_TIME_OF_ENTRY, USER, MATERIAL_ID,
    BATCH_ID, MOVEMENT_TYPE, STORAGE_ID, SOURCE_BIN, STORAGE_UNIT_TYPE, SOURCE_ST,
    SOURCE_VESSEL_NAME, SOURCE_SSCC, DESTINATION_VESSEL_NAME, MATERIAL_DOCUMENT,
    MATERIAL_DOCUMENT_YEAR, DESTINATION_BIN, DESTINATION_ST, DESTINATION_SSCC,
    APP_FEATURE, SEAL_NUMBER, __BATCH_ID, __CREATED_ON, __UPDATED_ON,
    MOVEMENT, PROCESS_ORDER_PHASE_ID, PO_MATERIAL_BATCH_ID, ITEM_TYPE, SSCC,
    BIN, STORAGE_UNIT_TYPE1

  Fields NOT available in confirmed views (no corresponding columns):
    vw_gold_confirmation: operationText (no description), isFinalConfirmation (no flag)
    vw_gold_adp_movement: materialDescription (no material master join)
  These schema fields are temporarily optional — re-require once upstream views expose them.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_executor import DatabricksRepository
from shared.query_service.query_spec import QuerySpec

# ---------------------------------------------------------------------------
# Status mapping — confirmed against live vw_gold_process_order (2026-05-17)
# The view uses text STATUS values consistent with V1 (not SAP technical codes).
# ---------------------------------------------------------------------------

# STATUS text values → V2 contract enum
# ('created' | 'released' | 'in-process' | 'confirmed' | 'partially-confirmed' | 'closed' | 'cancelled')
# V1 reference: STATUS values include 'IN PROGRESS', 'COMPLETED', 'CLOSED', 'NOT STARTED'
# TODO: verify exact STATUS enum values from live data (DESCRIBE extended or sample query)
_ORDER_STATUS_MAP: dict[str, str] = {
    "NOT STARTED": "created",
    "RELEASED": "released",
    "IN PROGRESS": "in-process",
    "CONFIRMED": "confirmed",
    "PARTIALLY CONFIRMED": "partially-confirmed",
    "COMPLETED": "confirmed",
    "CLOSED": "closed",
    "CANCELLED": "cancelled",
    # SAP technical fallbacks (in case view exposes AUOBJ codes)
    "CRTD": "created",
    "REL": "released",
    "PCNF": "partially-confirmed",
    "CNF": "confirmed",
    "CLSD": "closed",
    "TECO": "closed",
}


@dataclass
class ProcessOrderHeaderRequest:
    process_order_id: str
    plant_id: Optional[str] = None


@dataclass
class OrderOperationsRequest:
    process_order_id: str


@dataclass
class OrderConfirmationsRequest:
    process_order_id: str


@dataclass
class OrderGoodsMovementsRequest:
    process_order_id: str


def get_process_order_header_spec(request: ProcessOrderHeaderRequest) -> QuerySpec:
    """Return a QuerySpec for getProcessOrderHeader.

    Source view: vw_gold_process_order under POH_CATALOG / POH_SCHEMA.
    Contract: ProcessOrderHeaderSchema (packages/data-contracts)
    Cache: PER_USER_60S — order status changes during a shift.

    Raises DatabricksConfigError if POH_CATALOG is not set.

    Column names confirmed from live DDL (2026-05-17, connected_plant_uat):
      Available: PROCESS_ORDER_ID, STATUS, MATERIAL_ID, INSPECTION_LOT_ID,
                 MATERIAL_DESCRIPTION, PLANT_ID
      Missing from this view: order_type, batch_id, production_line, quantities, dates.
      Those fields return empty/default until a richer view is confirmed.
    """
    order_view = resolve_domain_object("poh", "vw_gold_process_order")
    plant_clause = "AND PLANT_ID = :plant_id" if request.plant_id else ""

    sql = f"""
    SELECT
        PROCESS_ORDER_ID    AS process_order_id,
        STATUS              AS order_status_raw,
        MATERIAL_ID         AS material_id,
        MATERIAL_DESCRIPTION AS material_description,
        PLANT_ID            AS plant_id,
        INSPECTION_LOT_ID   AS inspection_lot_id
    FROM {order_view}
    WHERE PROCESS_ORDER_ID = :process_order_id
    {plant_clause}
    LIMIT :max_rows
    """

    params: dict[str, object] = {"process_order_id": request.process_order_id}
    if request.plant_id:
        params["plant_id"] = request.plant_id

    return QuerySpec(
        name="poh.get_process_order_header",
        module="poh",
        endpoint="/api/por/order-header",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["poh", "process-order", "header"],
    )


def map_process_order_header_rows(rows: list[dict]) -> dict | None:
    """Map raw Databricks rows to the ProcessOrderHeader contract shape.

    Returns ``None`` if *rows* is empty (caller should return 404).

    Field coverage (2026-05-17): vw_gold_process_order provides PROCESS_ORDER_ID,
    STATUS, MATERIAL_ID, MATERIAL_DESCRIPTION, PLANT_ID, INSPECTION_LOT_ID only.
    Fields not in the view (quantities, uom, dates, batchId, productionLine)
    return None until a richer view is confirmed. orderType defaults to 'process-order'.

    INSPECTION_LOT_ID is fetched by the SQL but is NOT part of the
    ProcessOrderHeader contract (contract has extra='forbid'). Inspection-lot
    evidence belongs to the separate OrderQualityContext contract, not here.
    The mapper therefore drops the field rather than emitting an
    unmodeled key that would fail response_model validation.
    """
    if not rows:
        return None
    row = rows[0]

    return {
        "processOrderId": str(row.get("process_order_id") or ""),
        "orderType": "process-order",  # not in view — default
        "materialId": str(row.get("material_id") or ""),
        "materialDescription": str(row.get("material_description") or ""),
        "plantId": str(row.get("plant_id") or ""),
        "plannedQuantity": None,  # not in view
        "confirmedQuantity": None, # not in view
        "uom": None,              # not in view
        "plannedStart": None,       # not in view
        "plannedFinish": None,      # not in view
        "orderStatus": _map_order_status(row.get("order_status_raw")),
    }


def _map_order_status(raw: object) -> str:
    """Map SAP STATUS text to the ProcessOrderHeader.orderStatus enum.

    Empty / null / unrecognised values surface as 'unknown' rather than
    the previous reassuring default of 'created'. The orderStatus enum
    was extended to include 'unknown' (see
    packages/data-contracts/src/schemas/process-order-review.ts) so the
    mapper can be source-truthful without inventing process-order state.
    """
    if not raw:
        return "unknown"
    raw_upper = str(raw).upper()
    for key, val in _ORDER_STATUS_MAP.items():
        if key in raw_upper:
            return val
    return "unknown"


def _safe_float(value: object) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


def _format_datetime(value: object) -> str | None:
    """Normalise a Databricks date/datetime value to an ISO 8601 string."""
    if value is None:
        return None
    s = str(value).strip()
    if not s or s == "None":
        return None
    # Databricks may return "2024-01-15 06:00:00.000" — convert space to T
    if " " in s:
        s = s.replace(" ", "T", 1)
    # Date-only: append midnight
    if "T" not in s:
        s = f"{s}T00:00:00"
    return s


def get_order_operations_spec(request: OrderOperationsRequest) -> QuerySpec:
    """Return a QuerySpec for getOrderOperations.

    Source view: vw_gold_process_order_phase under POH_CATALOG / POH_SCHEMA.
    Contract: ProcessOrderOperationSchema[] (packages/data-contracts)
    Cache: PER_USER_60S — operation confirmations post during the shift.

    Column names confirmed from live DDL (2026-05-17, connected_plant_uat):
      PROCESS_ORDER_PHASE_ID, PROCESS_ORDER_ID, PHASE_ID, PHASE_DESCRIPTION,
      PHASE_TEXT, START_USER, END_USER, OPERATION_QUANTITY, OPERATION_QUANTITY_UOM,
      SORT_NUMBER
    Note: no start/finish date columns in this view. Dates not available until a
    richer operations view is confirmed.

    Raises DatabricksConfigError if POH_CATALOG is not set.
    """
    ops_view = resolve_domain_object("poh", "vw_gold_process_order_phase")

    sql = f"""
    SELECT
        PROCESS_ORDER_PHASE_ID  AS operation_id,
        PHASE_ID                AS operation_number,
        PHASE_DESCRIPTION       AS operation_text,
        PHASE_TEXT              AS operation_detail,
        OPERATION_QUANTITY      AS planned_quantity,
        OPERATION_QUANTITY_UOM  AS uom,
        SORT_NUMBER             AS sort_number,
        START_USER              AS start_user,
        END_USER                AS end_user
    FROM {ops_view}
    WHERE PROCESS_ORDER_ID = :process_order_id
    ORDER BY SORT_NUMBER
    LIMIT :max_rows
    """

    return QuerySpec(
        name="poh.get_order_operations",
        module="poh",
        endpoint="/api/por/order-operations",
        sql=sql,
        params={"process_order_id": request.process_order_id},
        cache_policy=CacheTier.PER_USER_60S,
        tags=["poh", "process-order", "operations"],
    )


def map_order_operations_rows(rows: list[dict]) -> list[dict]:
    """Map raw Databricks rows to a list of ProcessOrderOperation contract shapes.

    Field coverage (2026-05-17): vw_gold_process_order_phase provides
    PROCESS_ORDER_PHASE_ID, PHASE_ID, PHASE_DESCRIPTION, PHASE_TEXT,
    OPERATION_QUANTITY, OPERATION_QUANTITY_UOM, SORT_NUMBER, START_USER, END_USER.

    Fields not in the view (workCentre, plannedStart, plannedFinish,
    plannedDurationMinutes, resource, actualStart, actualFinish, actualDurationMinutes)
    return empty/zero defaults until a richer view is confirmed.

    Status and confirmationStatus are inferred from START_USER / END_USER presence:
      - END_USER populated → confirmed / final-confirmed
      - START_USER only → in-progress / partially-confirmed
      - neither → pending / unconfirmed
    """
    result = []
    for row in rows:
        start_user = row.get("start_user")
        end_user = row.get("end_user")

        if end_user:
            status = "confirmed"
            confirmation_status = "final-confirmed"
            confirmed = True
        elif start_user:
            status = "in-progress"
            confirmation_status = "partially-confirmed"
            confirmed = False
        else:
            status = "pending"
            confirmation_status = "unconfirmed"
            confirmed = False

        result.append({
            "operationId": str(row.get("operation_id") or ""),
            "operationNumber": str(row.get("operation_number") or ""),
            "operationText": str(row.get("operation_text") or ""),
            "workCentre": None,            # not in view
            "plannedStart": None,            # not in view
            "plannedFinish": None,           # not in view
            "plannedDurationMinutes": None, # not in view
            "status": status,
            "confirmationStatus": confirmation_status,
            "confirmed": confirmed,
            "hasException": False,         # not in view
        })
    return result


# ---------------------------------------------------------------------------
# getOrderConfirmations
# ---------------------------------------------------------------------------

def get_order_confirmations_spec(request: OrderConfirmationsRequest) -> QuerySpec:
    """Return a QuerySpec for getOrderConfirmations.

    Source view: vw_gold_confirmation under POH_CATALOG / POH_SCHEMA.
    Contract: ProcessOrderConfirmationSchema[] (packages/data-contracts)
    Cache: PER_USER_60S — confirmations post during the shift.

    Column names confirmed from live DDL (2026-05-17, connected_plant_uat):
      Available: CONFIRMATION_ID, PROCESS_ORDER_PHASE_ID, PROCESS_ORDER_ID, PHASE_ID,
                 PLANT_ID, CONFIRMED_QUANTITY, CONFIRMED_QUANTITY_UOM,
                 START_TIMESTAMP, END_TIMESTAMP, SET_UP_DURATION_S, MACHINE_DURATION_S,
                 CLEANING_DURATION_S, GROSS_DURATION_S, __CREATED_ON
      Missing: operationText (no description column), isFinalConfirmation (no flag column)
      Both are temporarily optional in the schema — re-require when view is enriched.

    confirmedAt uses END_TIMESTAMP coalesced with START_TIMESTAMP then __CREATED_ON
    to handle in-progress confirmations where END_TIMESTAMP may be null.
    Duration columns are in seconds; schema fields are in minutes (÷ 60).
    """
    confirmation_view = resolve_domain_object("poh", "vw_gold_confirmation")

    sql = f"""
    SELECT
        CONFIRMATION_ID             AS confirmation_id,
        PROCESS_ORDER_PHASE_ID      AS operation_id,
        CONFIRMED_QUANTITY          AS confirmed_yield,
        CONFIRMED_QUANTITY_UOM      AS uom,
        COALESCE(END_TIMESTAMP, START_TIMESTAMP, __CREATED_ON) AS confirmed_at,
        SET_UP_DURATION_S           AS setup_duration_s,
        MACHINE_DURATION_S          AS machine_duration_s,
        CLEANING_DURATION_S         AS cleaning_duration_s
    FROM {confirmation_view}
    WHERE PROCESS_ORDER_ID = :process_order_id
    ORDER BY COALESCE(END_TIMESTAMP, START_TIMESTAMP, __CREATED_ON)
    LIMIT :max_rows
    """

    return QuerySpec(
        name="poh.get_order_confirmations",
        module="poh",
        endpoint="/api/por/order-confirmations",
        sql=sql,
        params={"process_order_id": request.process_order_id},
        cache_policy=CacheTier.PER_USER_60S,
        tags=["poh", "process-order", "confirmations"],
    )


def map_order_confirmations_rows(rows: list[dict]) -> list[dict]:
    """Map raw Databricks rows to a list of ProcessOrderConfirmation contract shapes.

    Field coverage (2026-05-17): see get_order_confirmations_spec docstring.
    operationText and isFinalConfirmation are absent from the view and omitted.
    Duration fields are converted from seconds to minutes.
    """
    result = []
    for row in rows:
        item: dict[str, object] = {
            "confirmationId": str(row.get("confirmation_id") or ""),
            "operationId": str(row.get("operation_id") or ""),
            "confirmedYield": float(raw_yield) if (raw_yield := row.get("confirmed_yield")) is not None else None,
            "uom": row.get("uom"),
            "confirmedAt": _format_datetime(row.get("confirmed_at")),
        }

        setup_s = row.get("setup_duration_s")
        if setup_s is not None:
            item["setupDurationMinutes"] = _safe_float(setup_s) / 60.0

        machine_s = row.get("machine_duration_s")
        if machine_s is not None:
            item["machineDurationMinutes"] = _safe_float(machine_s) / 60.0

        cleaning_s = row.get("cleaning_duration_s")
        if cleaning_s is not None:
            item["cleaningDurationMinutes"] = _safe_float(cleaning_s) / 60.0

        result.append(item)
    return result


# ---------------------------------------------------------------------------
# getOrderGoodsMovements
# ---------------------------------------------------------------------------

# MOVEMENT_TYPE → direction map for ADP (Tulip) movements.
# Confirmed from DISTINCT MOVEMENT_TYPE, MOVEMENT, ITEM_TYPE query (2026-05-17,
# connected_plant_uat.csm_process_order_history.vw_gold_adp_movement):
#   101  Goods Receipts          → output
#   261  Goods Issues            → input  (also covers "Unplanned Goods Issues")
#   262  Goods Issues (reversal) → input
#   531  Goods Receipts ITEM_TYPE=B (by-product receipt) → output
#   711  Write-On/Off            → unmapped (direction ambiguous for write-on/off)
#   712  Write-On/Off            → unmapped
#   999  (null MOVEMENT)         → unmapped
#   null MOVEMENT_TYPE           → unmapped ("Productions", "Write-On/Off", or null)
# Rows with unmapped MOVEMENT_TYPE are included with direction: 'unknown'.
# Extend this map when direction is confirmed for additional ADP codes.
_MOVEMENT_DIRECTION_MAP: dict[str, str] = {
    "101": "output",   # goods receipt from production order
    "261": "input",    # goods issue to order (standard and unplanned)
    "262": "input",    # reversal of goods issue
    "531": "output",   # by-product goods receipt (ITEM_TYPE=B)
}


def _map_movement_direction(movement_type: object) -> str:
    """Return 'input' | 'output' for a known MOVEMENT_TYPE, else 'unknown'."""
    if movement_type is None:
        return "unknown"
    return _MOVEMENT_DIRECTION_MAP.get(str(movement_type).strip(), "unknown")


def get_order_goods_movements_spec(request: OrderGoodsMovementsRequest) -> QuerySpec:
    """Return a QuerySpec for getOrderGoodsMovements.

    Source view: vw_gold_adp_movement under POH_CATALOG / POH_SCHEMA.
    Contract: ProcessOrderGoodsMovementSchema[] (packages/data-contracts)
    Cache: PER_USER_60S — goods movements post during the shift.

    Column names confirmed from live DDL (2026-05-17, connected_plant_uat):
      Available: ID, PROCESS_ORDER_ID, MATERIAL_ID, MOVEMENT_TYPE, QUANTITY, UOM,
                 DATE_TIME_OF_ENTRY, BATCH_ID, USER, MATERIAL_DOCUMENT,
                 MATERIAL_DOCUMENT_YEAR, STORAGE_ID
      Missing: materialDescription (no material master join in this view)
      materialDescription is temporarily optional in the schema.

    direction is derived from MOVEMENT_TYPE via _MOVEMENT_DIRECTION_MAP.
    Unrecognised MOVEMENT_TYPE values map to direction: 'unknown' so the UI can
    render them visibly without crashing — extend _MOVEMENT_DIRECTION_MAP when confirmed.
    MATERIAL_ID leading zeros are preserved (string, not cast to numeric).
    """
    movement_view = resolve_domain_object("poh", "vw_gold_adp_movement")

    sql = f"""
    SELECT
        ID                      AS movement_id,
        MOVEMENT_TYPE           AS movement_type,
        MATERIAL_ID             AS material_id,
        QUANTITY                AS quantity,
        UOM                     AS uom,
        DATE_TIME_OF_ENTRY      AS posted_at,
        BATCH_ID                AS batch_id,
        USER                    AS posted_by,
        MATERIAL_DOCUMENT       AS reference_document,
        STORAGE_ID              AS storage_location
    FROM {movement_view}
    WHERE PROCESS_ORDER_ID = :process_order_id
    ORDER BY DATE_TIME_OF_ENTRY
    LIMIT :max_rows
    """

    return QuerySpec(
        name="poh.get_order_goods_movements",
        module="poh",
        endpoint="/api/por/order-goods-movements",
        sql=sql,
        params={"process_order_id": request.process_order_id},
        cache_policy=CacheTier.PER_USER_60S,
        tags=["poh", "process-order", "goods-movements"],
    )


def map_order_goods_movements_rows(rows: list[dict]) -> list[dict]:
    """Map raw Databricks rows to a list of ProcessOrderGoodsMovement contract shapes.

    Field coverage (2026-05-17): see get_order_goods_movements_spec docstring.
    materialDescription is absent from the view and omitted.
    direction is always present — 'unknown' for unrecognised MOVEMENT_TYPE values.
    The UI must render unknown-direction rows visibly rather than hiding them.
    """
    result = []
    for row in rows:
        movement_type = str(row.get("movement_type") or "")
        direction = _map_movement_direction(movement_type)

        item: dict[str, object] = {
            "movementId": str(row.get("movement_id") or ""),
            "movementType": movement_type,
            "direction": direction,
            "materialId": str(row.get("material_id") or ""),
            "quantity": float(raw_qty) if (raw_qty := row.get("quantity")) is not None else None,
            "uom": row.get("uom"),
            "postedAt": _format_datetime(row.get("posted_at")),
        }

        batch_id = row.get("batch_id")
        if batch_id:
            item["batchId"] = str(batch_id)

        posted_by = row.get("posted_by")
        if posted_by:
            item["postedBy"] = str(posted_by)

        ref_doc = row.get("reference_document")
        if ref_doc:
            item["referenceDocument"] = str(ref_doc)

        storage = row.get("storage_location")
        if storage:
            item["storageLocation"] = str(storage)

        result.append(item)
    return result


class PohRepository:
    """Repository for Process Order History data."""

    def __init__(self, repository: DatabricksRepository) -> None:
        self._repository = repository

    async def fetch_process_order_header(self, request: ProcessOrderHeaderRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_process_order_header_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_order_operations(self, request: OrderOperationsRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_order_operations_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_order_confirmations(self, request: OrderConfirmationsRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_order_confirmations_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_order_goods_movements(self, request: OrderGoodsMovementsRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_order_goods_movements_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_order_search(
        self,
        request: ProcessOrderSearchRequest,
        *,
        display_query: str,
        max_rows: int,
    ) -> tuple[dict, QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_order_search_spec(request),
            mapper=lambda rows: map_order_search_rows(rows, display_query, max_rows),
        )


@dataclass
class ProcessOrderSearchRequest:
    query: str
    max_rows: int = 50
    material_id: Optional[str] = None
    batch_id: Optional[str] = None


def get_order_search_spec(request: ProcessOrderSearchRequest) -> QuerySpec:
    """Return a QuerySpec for Process Order unified search.

    Source view: vw_gold_process_order under POH_CATALOG / POH_SCHEMA.
    """
    order_view = resolve_domain_object("poh", "vw_gold_process_order")
    pattern = f"%{request.query.replace('*', '%')}%"
    material_clause = "AND MATERIAL_ID = :material_id" if request.material_id else ""

    sql = f"""
    SELECT
        PROCESS_ORDER_ID    AS process_order_id,
        STATUS              AS order_status_raw,
        MATERIAL_ID         AS material_id,
        MATERIAL_DESCRIPTION AS material_description,
        PLANT_ID            AS plant_id,
        INSPECTION_LOT_ID   AS inspection_lot_id,
        CASE WHEN PROCESS_ORDER_ID LIKE :search_pattern THEN 1 ELSE 0 END AS order_id_match,
        CASE WHEN MATERIAL_ID LIKE :search_pattern THEN 1 ELSE 0 END AS material_id_match,
        CASE WHEN MATERIAL_DESCRIPTION LIKE :search_pattern THEN 1 ELSE 0 END AS description_match
    FROM {order_view}
    WHERE (
        PROCESS_ORDER_ID LIKE :search_pattern
        OR MATERIAL_ID LIKE :search_pattern
        OR MATERIAL_DESCRIPTION LIKE :search_pattern
    )
    {material_clause}
    LIMIT :db_limit
    """

    params: dict[str, object] = {
        "search_pattern": pattern,
        "db_limit": (request.max_rows or 50) + 1,
    }
    if request.material_id:
        params["material_id"] = request.material_id

    return QuerySpec(
        name="poh.search_process_orders",
        module="poh",
        endpoint="/api/por/order-search",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["poh", "process-order", "search"],
    )


def map_order_search_rows(rows: list[dict], query: str, max_rows: int) -> dict:
    """Map raw Databricks rows to ProcessOrderSearchResponse contract."""
    items = []
    for row in rows:
        process_order_id = str(row.get("process_order_id") or "")
        material_id = str(row.get("material_id") or "")
        material_description = str(row.get("material_description") or "")
        plant_id = str(row.get("plant_id") or "")

        match_types = []
        if row.get("order_id_match") == 1:
            match_types.append("process-order-id")
        if row.get("material_id_match") == 1:
            match_types.append("material-id")
        if row.get("description_match") == 1:
            match_types.append("description")

        if not match_types:
            q = query.lower()
            if q in process_order_id.lower():
                match_types.append("process-order-id")
            if q in material_id.lower():
                match_types.append("material-id")
            if q in material_description.lower():
                match_types.append("description")

        items.append({
            "processOrderId": process_order_id,
            "materialId": material_id,
            "materialDescription": material_description,
            "batchId": None,
            "plantId": plant_id,
            "plantName": f"Plant {plant_id}",
            "orderStatus": _map_order_status(row.get("order_status_raw")),
            "plannedQuantity": None,
            "confirmedQuantity": None,
            "uom": None,
            "plannedStart": None,
            "plannedFinish": None,
            "matchTypes": match_types,
        })

    return {
        "items": items[:max_rows],
        "total": len(items),
        "truncated": len(rows) > max_rows,
        "wildcardApplied": "*" in query or "%" in query,
    }


