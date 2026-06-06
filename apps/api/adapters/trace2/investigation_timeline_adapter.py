"""Investigation timeline spec + mapper.

Covers:
  - get_investigation_timeline_spec / map_investigation_timeline_rows (Trace App)
"""
from __future__ import annotations

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2InvestigationTimelineRequest
from ._utils import _TIMELINE_SOURCE_MAP, _TIMELINE_TONE_MAP, _TIMELINE_TYPE_MAP

# ---------------------------------------------------------------------------
# Trace App slice — getInvestigationTimeline (UNION over 3 sources)
# ---------------------------------------------------------------------------

def get_investigation_timeline_spec(request: Trace2InvestigationTimelineRequest) -> QuerySpec:
    """UNION timeline events from mass-balance, quality-lot, and delivery sources.

    No dedicated `gold_investigation_events` view yet — this synthesises a
    chronological feed from existing verified sources:
      - gold_batch_mass_balance_v → production / consumption / dispatch
      - gold_batch_quality_lot_v  → QC inspections, lot decisions
      - gold_batch_delivery_v     → customer dispatch (cross-plant)

    Each branch tags `event_type`, `tone`, and `source_system` so the mapper
    can produce one homogeneous list. POSTING_DATE / INSPECTION_END_DATE drive
    chronology.
    """
    tbl_mb = resolve_domain_object("trace2", "gold_batch_mass_balance_v")
    tbl_ql = resolve_domain_object("trace2", "gold_batch_quality_lot_v")
    tbl_dl = resolve_domain_object("trace2", "gold_batch_delivery_v")

    sql = f"""
    SELECT * FROM (
      SELECT
        CAST(POSTING_DATE AS STRING) AS ts,
        CASE
          WHEN MOVEMENT_TYPE IN ('101','102','131') THEN 'production'
          WHEN MOVEMENT_TYPE IN ('261','262')        THEN 'consumption'
          WHEN MOVEMENT_TYPE IN ('601','602')        THEN 'dispatch'
          ELSE 'note'
        END                                          AS event_type,
        CONCAT('Movement ', COALESCE(MOVEMENT_TYPE, '?'),
               ' · ', COALESCE(MOVEMENT_CATEGORY, ''))  AS label,
        'SAP · auto'                                 AS actor,
        CONCAT(CAST(ROUND(QUANTITY, 1) AS STRING), ' ', COALESCE(UOM, '')) AS detail,
        CASE
          WHEN QUANTITY > 0 THEN 'good'
          WHEN QUANTITY < 0 THEN 'neutral'
          ELSE 'neutral'
        END                                          AS tone,
        'SAP'                                        AS source_system
      FROM {tbl_mb}
      WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
        AND (:plant_id = '' OR PLANT_ID = :plant_id)

      UNION ALL

      SELECT
        CAST(COALESCE(INSPECTION_END_DATE, CREATED_DATE) AS STRING) AS ts,
        'qc'                                         AS event_type,
        CONCAT('Inspection ', COALESCE(INSPECTION_LOT_ID, '?'),
               ' · ', COALESCE(INSPECTION_TYPE, ''))  AS label,
        COALESCE(CREATED_BY, 'Lab · auto')           AS actor,
        COALESCE(USAGE_DECISION_LONG_TEXT,
                 INSPECTION_SHORT_TEXT, '')          AS detail,
        'good'                                       AS tone,
        'LIMS'                                       AS source_system
      FROM {tbl_ql}
      WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
        AND (:plant_id = '' OR PLANT_ID = :plant_id)

      UNION ALL

      SELECT
        CAST(POSTING_DATE AS STRING)                 AS ts,
        'dispatch'                                   AS event_type,
        CONCAT('Delivery ', COALESCE(DELIVERY, '?'),
               ' · ', COALESCE(COUNTRY_ID, ''))      AS label,
        'SAP · auto'                                 AS actor,
        CONCAT(CAST(ROUND(ABS_QUANTITY, 1) AS STRING), ' ', COALESCE(UOM, ''),
               ' → ', COALESCE(CUSTOMER_NAME, ''))   AS detail,
        'brand'                                      AS tone,
        'SAP'                                        AS source_system
      FROM {tbl_dl}
      WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
        AND DELIVERY IS NOT NULL
    )
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
        source_badge="union:mass_balance_v+quality_lot_v+delivery_v",
        tags=["trace2", "trace-app", "investigation-timeline"],
    )


def map_investigation_timeline_rows(rows: list[dict]) -> dict:
    """Coerce the UNION rows into TimelineEvent[] shape.

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
