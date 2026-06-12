"""Investigation timeline spec + mapper.

Covers:
  - get_investigation_timeline_spec / map_investigation_timeline_rows (Trace App)
"""
from __future__ import annotations

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_governed_trace2_object
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2InvestigationTimelineRequest
from ._utils import _TIMELINE_SOURCE_MAP, _TIMELINE_TONE_MAP, _TIMELINE_TYPE_MAP

# ---------------------------------------------------------------------------
# Trace App slice — getInvestigationTimeline (event ledger ordered by POSTING_DATE)
# ---------------------------------------------------------------------------

def get_investigation_timeline_spec(request: Trace2InvestigationTimelineRequest) -> QuerySpec:
    """Timeline events from gold_batch_event_ledger ordered by POSTING_DATE.

    Source: gold_batch_event_ledger (TRACE_GOVERNED_SCHEMA, default: "gold_io_reporting").

    The legacy adapter UNIONed three sources:
      - gold_batch_mass_balance_v → production / consumption / dispatch
      - gold_batch_quality_lot_v  → QC inspections
      - gold_batch_delivery_v     → customer dispatch

    In the governed migration all movement events are consolidated in
    gold_batch_event_ledger.  QM lot context from gold_batch_quality_lot_v is
    not in the governed Phase 2 scope for this endpoint — QM lot events are
    available via holds-ledger and quality-passport adapters.  The timeline
    emits movement events only (same coverage as the mass-balance leg of the
    legacy UNION; the QM and delivery legs were additive and are not present
    in this governed source as separate rows — delivery events appear as
    DELIVERY link-type rows in the ledger).

    event_type mapping from LINK_TYPE + direction:
      direction=IN  (PRODUCTION IN, VENDOR_RECEIPT, TRANSFER IN, ADJUSTMENT_IN)
                                    → 'production'
      DELIVERY (always direction=OUT)  → 'dispatch'
      direction=OUT (all others)    → 'consumption'
    """
    tbl = resolve_governed_trace2_object("gold_batch_event_ledger")

    sql = f"""
    SELECT
        CAST(POSTING_DATE AS STRING)   AS ts,
        CASE
          WHEN direction = 'IN'       THEN 'production'
          WHEN LINK_TYPE = 'DELIVERY' THEN 'dispatch'
          ELSE 'consumption'
        END                            AS event_type,
        CONCAT(
            COALESCE(LINK_TYPE, '?'),
            ' \xb7 ', direction
        )                              AS label,
        'SAP \xb7 auto'               AS actor,
        CONCAT(
            CAST(ROUND(QUANTITY, 1) AS STRING),
            ' ', COALESCE(BASE_UNIT_OF_MEASURE, '')
        )                              AS detail,
        CASE
          WHEN direction = 'IN'  THEN 'good'
          ELSE 'neutral'
        END                            AS tone,
        'SAP'                          AS source_system
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
      AND (:plant_id = '' OR PLANT_ID = :plant_id)
    ORDER BY ts
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_investigation_timeline",
        module="trace2",
        endpoint="/api/trace2/investigation-timeline",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="mv:gold_batch_event_ledger",
        tags=["trace2", "trace-app", "investigation-timeline"],
    )


def map_investigation_timeline_rows(rows: list[dict]) -> dict:
    """Coerce the event ledger rows into TimelineEvent[] shape.

    Returns an empty `events` array (not 404) when no rows match — an empty
    timeline is a valid state (the batch may simply not have had any
    inspections or dispatches yet).
    """
    events: list[dict] = []
    for row in rows:
        ev_type = str(row.get("event_type") or "note")
        if ev_type not in _TIMELINE_TYPE_MAP:
            ev_type = "note"
        tone = str(row.get("tone") or "neutral")
        if tone not in _TIMELINE_TONE_MAP:
            tone = "neutral"
        source = row.get("source_system")
        if source is not None and source not in _TIMELINE_SOURCE_MAP:
            source = None
        events.append({
            "ts": str(row.get("ts") or ""),
            "type": ev_type,
            "label": str(row.get("label") or "").strip() or "Event",
            "actor": str(row.get("actor") or "").strip() or "—",
            "detail": str(row.get("detail") or "").strip(),
            "tone": tone,
            "sourceSystem": source,
        })
    return {"events": events}
