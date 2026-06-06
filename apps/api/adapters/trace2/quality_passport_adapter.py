"""Quality passport specs + build function.

Covers all quality passport specs and the assembler:
  - get_batch_quality_passport_partial_spec / map_batch_quality_passport_partial
  - get_batch_quality_passport_coa_spec
  - get_batch_quality_passport_lots_spec
  - get_batch_quality_passport_summary_spec
  - get_batch_quality_passport_balance_spec
  - build_batch_quality_passport
"""
from __future__ import annotations

from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2BatchQualityPassportRequest
from ._utils import _classify_coa_status, _date_to_utc

# ---------------------------------------------------------------------------
# Trace App slice — getBatchQualityPassport (partial: identity + stock + production)
# ---------------------------------------------------------------------------
#
# The Quality Passport response has 7 sections (identity, quality, stock,
# production, lotHistory, massBalance, signoff). This slice covers the three
# that can be sourced from already-verified gold views. The remaining four
# (quality.coa, lotHistory, massBalance variance/note, signoff) and the
# confidence score require future sources and stay mock-only.
#
# A frontend integration that wants partial real data can call this endpoint
# for identity/stock/production and merge with the existing mock for the rest.

def get_batch_quality_passport_partial_spec(request: Trace2BatchQualityPassportRequest) -> QuerySpec:
    """Return a QuerySpec for the verified-source portion of the Quality Passport.

    Sources (all verified live in connected_plant_uat.gold via the 2026-05-25
    Databricks repository compatibility audit — see
    docs/data-layer/trace2-batch-quality-passport-source-verification.md):
      - gold_batch_stock_v               → stock buckets (per plant)
      - gold_batch_summary_v             → manufacture / expiry dates only
      - gold_material                    → material description, base UoM
      - gold_plant                       → plant name
      - gold_batch_production_history_v  → process order, posting date,
                                            batch quantity, UoM

    Removed projections (columns absent from live DDL — caused
    UNRESOLVED_COLUMN before this fix):
      - b.PROCESS_ORDER_ID (gold_batch_summary_v has only MATERIAL_ID,
        BATCH_ID, MANUFACTURE_DATE, SHELF_LIFE_EXPIRATION_DATE,
        MATERIAL_NAME, MATERIAL_TYPE, MATERIAL_DESC_SHORT, days_to_expiry,
        shelf_life_status)
      - ph.START_DATE, ph.CONFIRMED_DATE, ph.PLANNED_QTY, ph.ACTUAL_QTY,
        ph.PRODUCTION_LINE, ph.OPERATOR (gold_batch_production_history_v
        has only PROCESS_ORDER_ID, BATCH_ID, PLANT_ID, MATERIAL_ID,
        POSTING_DATE, BATCH_QTY, UOM, quality_status)

    Mapping decisions:
      - process_order_id now comes from gold_batch_production_history_v
        (PROCESS_ORDER_ID), not gold_batch_summary_v.
      - production_started_at maps from POSTING_DATE. This is the
        production-history posting date and is NOT claimed to be the
        confirmed production start timestamp — the live view exposes no
        START / CONFIRMED timestamps.
      - production_actual_qty maps from BATCH_QTY. This is the actual
        batch quantity recorded on the production-history posting, NOT a
        planned quantity — the live view exposes no planned-vs-actual split.
      - production_uom is selected as ph.UOM but is currently not surfaced
        through the Production contract (which has no production-uom
        field); the row key is kept so a future contract addition can
        consume it without re-touching the SQL.

    Intentionally unavailable (no live source column — the mapper emits
    contract defaults to keep the response body shape stable):
      - production_confirmed_at
      - production_planned_qty
      - production_line
      - production_operator

    Plant filter is respected when supplied — leave plant_id='' to take the
    first row by sort order (consistent with the existing batch-header route).
    """
    tbl_stock = resolve_domain_object("trace2", "gold_batch_stock_v")
    tbl_summary = resolve_domain_object("trace2", "gold_batch_summary_v")
    tbl_material = resolve_domain_object("trace2", "gold_material")
    tbl_plant = resolve_domain_object("trace2", "gold_plant")
    tbl_prod = resolve_domain_object("trace2", "gold_batch_production_history_v")

    sql = f"""
    SELECT
        s.MATERIAL_ID                AS material_id,
        s.BATCH_ID                   AS batch_id,
        s.PLANT_ID                   AS plant_id,
        s.unrestricted,
        s.blocked,
        s.quality_inspection,
        s.restricted,
        s.transit,
        s.total_stock,
        m.MATERIAL_NAME              AS material_name,
        m.BASE_UNIT_OF_MEASURE       AS uom,
        p.PLANT_NAME                 AS plant_name,
        b.MANUFACTURE_DATE           AS manufacture_date,
        b.SHELF_LIFE_EXPIRATION_DATE AS expiry_date,
        ph.PROCESS_ORDER_ID          AS process_order_id,
        ph.POSTING_DATE              AS production_started_at,
        ph.BATCH_QTY                 AS production_actual_qty,
        ph.UOM                       AS production_uom,
        COALESCE(ph_cnt.production_lot_count, 0) AS production_lot_count
    FROM {tbl_stock} s
    JOIN {tbl_summary} b
        ON s.MATERIAL_ID = b.MATERIAL_ID AND s.BATCH_ID = b.BATCH_ID
    JOIN {tbl_material} m
        ON s.MATERIAL_ID = m.MATERIAL_ID AND m.LANGUAGE_ID = 'E'
    JOIN {tbl_plant} p
        ON s.PLANT_ID = p.PLANT_ID
    LEFT JOIN {tbl_prod} ph
        ON s.MATERIAL_ID = ph.MATERIAL_ID AND s.BATCH_ID = ph.BATCH_ID
    LEFT JOIN (
        SELECT MATERIAL_ID, BATCH_ID, COUNT(DISTINCT PROCESS_ORDER_ID) AS production_lot_count
        FROM {tbl_prod}
        WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
        GROUP BY MATERIAL_ID, BATCH_ID
    ) ph_cnt
        ON s.MATERIAL_ID = ph_cnt.MATERIAL_ID AND s.BATCH_ID = ph_cnt.BATCH_ID
    WHERE s.MATERIAL_ID = :material_id
      AND s.BATCH_ID   = :batch_id
      AND (:plant_id = '' OR s.PLANT_ID = :plant_id)
    ORDER BY s.PLANT_ID
    LIMIT 1
    """

    return QuerySpec(
        name="trace2.get_batch_quality_passport_partial",
        module="trace2",
        endpoint="/api/trace2/batch-quality-passport",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_stock_v+summary_v+production_history_v",
        tags=["trace2", "trace-app", "quality-passport", "partial"],
    )


def map_batch_quality_passport_partial(rows: list[dict]) -> Optional[dict]:
    """Map the partial passport join result to the identity + stock + production
    sections of BatchQualityPassportSchema. The quality, lotHistory,
    massBalance, and signoff fields are NOT populated — frontend must merge
    with mock or a future hook that resolves those.

    Returns None on zero rows so the route can 404 (same convention as the
    existing batch-header route).

    Production-section source mapping (2026-05-25 Databricks compatibility
    audit, Finding #2 — see
    docs/data-layer/trace2-batch-quality-passport-source-verification.md):

      Sourced from live ``gold_batch_production_history_v``:
        - ``orderId``   ← ``process_order_id`` (PROCESS_ORDER_ID)
        - ``startedAt`` ← ``production_started_at`` (POSTING_DATE — the
          production-posting date, **not** a confirmed production start
          timestamp; the live view has no START / CONFIRMED columns)
        - ``actualQty`` ← ``production_actual_qty`` (BATCH_QTY — the
          actual batch quantity, **not** a planned quantity)

      Intentionally unavailable from the live view (the live DDL has no
      START_DATE / CONFIRMED_DATE / PLANNED_QTY / ACTUAL_QTY /
      PRODUCTION_LINE / OPERATOR columns). The Zod source schema was
      relaxed to nullable+optional in the same PR so the API can emit
      ``None`` source-truthfully rather than reassuring contract
      defaults (``""`` / ``0.0``):
        - ``line``                → None
        - ``operator``            → None
        - ``confirmedAt``         → None
        - ``plannedQty``          → None
        - ``yield``               → None (no planned/actual split available)
        - ``originatingCustomer`` → None
        - ``notes``               → None
    """
    if not rows:
        return None
    row = rows[0]

    # Days-to-expiry — defer to caller / frontend (relies on "today" context).
    return {
        "identity": {
            "materialDescription": str(row.get("material_name") or ""),
            "materialId": str(row.get("material_id") or ""),
            "batchId": str(row.get("batch_id") or ""),
            "plantName": str(row.get("plant_name") or ""),
            "plantId": str(row.get("plant_id") or ""),
            "processOrderId": str(row.get("process_order_id") or ""),
            "manufactureDate": _date_to_utc(row.get("manufacture_date")) if row.get("manufacture_date") else "",
            "expiryDate": _date_to_utc(row.get("expiry_date")) if row.get("expiry_date") else "",
            "daysToExpiry": 0,  # frontend recomputes from expiryDate
            "uom": str(row.get("uom") or ""),
        },
        "stock": {
            "unrestricted": float(row.get("unrestricted") or 0),
            "qualityInspection": float(row.get("quality_inspection") or 0),
            "blocked": float(row.get("blocked") or 0),
            "restricted": float(row.get("restricted") or 0),
            "transit": float(row.get("transit") or 0),
            "uom": str(row.get("uom") or ""),
        },
        "production": {
            "orderId": str(row.get("process_order_id") or ""),
            # No PRODUCTION_LINE column in gold_batch_production_history_v —
            # null is source-truthful (contract relaxed in this PR).
            "line": None,
            # No OPERATOR column in gold_batch_production_history_v.
            "operator": None,
            # POSTING_DATE — the production-posting date, not a confirmed
            # start timestamp.
            "startedAt": str(row.get("production_started_at") or ""),
            # No CONFIRMED_DATE column on the live view.
            "confirmedAt": None,
            # No PLANNED_QTY column on the live view.
            "plannedQty": None,
            # BATCH_QTY — the actual batch quantity recorded on the
            # production-history posting.
            "actualQty": float(row.get("production_actual_qty") or 0),
            # Yield = actualQty / plannedQty is not derivable without a
            # planned quantity, which the live view does not expose.
            "yield": None,
            # Originating customer is not in gold_batch_production_history_v.
            "originatingCustomer": None,
            # No free-text notes column on the live view.
            "notes": None,
        },
        "productionLotCount": int(row.get("production_lot_count") or 0),
        # "production" was added 2026-05-25 because the post-audit SQL only
        # surfaces orderId / startedAt / actualQty from the live view.
        # The four-section legacy marker referenced "signoff"; that field
        # was renamed to "usageDecisionEvidence" in the wire contract long
        # ago — the marker is updated here so it reflects the current
        # contract name.
        "_unverifiedSections": [
            "quality",
            "lotHistory",
            "massBalance",
            "usageDecisionEvidence",
            "production",
        ],
    }


def get_batch_quality_passport_coa_spec(request: Trace2BatchQualityPassportRequest) -> QuerySpec:
    """Fetch CoA characteristic results for the active batch.

    Source: gold_batch_quality_result_v.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_quality_result_v")
    sql = f"""
    SELECT
      MIC_ID                       AS mic,
      MIC_NAME                     AS param,
      LOWER_TOLERANCE              AS low,
      UPPER_TOLERANCE              AS high,
      TARGET_VALUE                 AS target,
      QUANTITATIVE_RESULT          AS actual_qty,
      QUALITATIVE_RESULT           AS actual_qual,
      UNIT_OF_MEASURE              AS uom,
      INSPECTION_RESULT_VALUATION  AS valuation
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
      AND (:plant_id = '' OR PLANT_ID = :plant_id)
    ORDER BY MIC_ID
    LIMIT 100
    """
    return QuerySpec(
        name="trace2.get_passport_coa",
        module="trace2",
        endpoint="/api/trace2/batch-quality-passport",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_quality_result_v",
        tags=["trace2", "trace-app", "quality-passport", "coa"],
    )


def get_batch_quality_passport_lots_spec(request: Trace2BatchQualityPassportRequest) -> QuerySpec:
    """Fetch lot history (recent inspections) for the active batch."""
    tbl = resolve_domain_object("trace2", "gold_batch_quality_lot_v")
    sql = f"""
    SELECT
      INSPECTION_LOT_ID           AS id,
      COALESCE(INSPECTION_END_DATE, CREATED_DATE) AS date,
      INSPECTION_TYPE             AS inspection,
      USAGE_DECISION_LONG_TEXT    AS usage_decision,
      CREATED_BY                  AS decision_by
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
      AND (:plant_id = '' OR PLANT_ID = :plant_id)
    ORDER BY COALESCE(INSPECTION_END_DATE, CREATED_DATE) DESC
    LIMIT 20
    """
    return QuerySpec(
        name="trace2.get_passport_lots",
        module="trace2",
        endpoint="/api/trace2/batch-quality-passport",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_quality_lot_v",
        tags=["trace2", "trace-app", "quality-passport", "lots"],
    )


def get_batch_quality_passport_summary_spec(request: Trace2BatchQualityPassportRequest) -> QuerySpec:
    """Fetch quality KPI counts from gold_batch_quality_summary_v."""
    tbl = resolve_domain_object("trace2", "gold_batch_quality_summary_v")
    sql = f"""
    SELECT lot_count, failed_mic_count, accepted_result_count, rejected_result_count, latest_inspection_date
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
    LIMIT 1
    """
    return QuerySpec(
        name="trace2.get_passport_summary",
        module="trace2",
        endpoint="/api/trace2/batch-quality-passport",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_quality_summary_v",
        tags=["trace2", "trace-app", "quality-passport", "summary"],
    )


def get_batch_quality_passport_balance_spec(request: Trace2BatchQualityPassportRequest) -> QuerySpec:
    """Fetch the latest BALANCE_QTY and the net produced-vs-current variance."""
    tbl = resolve_domain_object("trace2", "gold_batch_mass_balance_v")
    sql = f"""
    SELECT
      SUM(CASE WHEN MOVEMENT_TYPE IN ('101','102','131') THEN QUANTITY ELSE 0 END)  AS produced,
      SUM(CASE WHEN MOVEMENT_TYPE IN ('261','262')        THEN QUANTITY ELSE 0 END)  AS consumed,
      SUM(CASE WHEN MOVEMENT_TYPE IN ('601','602')        THEN QUANTITY ELSE 0 END)  AS shipped,
      SUM(CASE WHEN MOVEMENT_TYPE IN ('701','702','711','712') THEN QUANTITY ELSE 0 END) AS adjusted,
      MAX_BY(BALANCE_QTY, POSTING_DATE)  AS latest_balance,
      MAX(UOM)                            AS uom
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id AND BATCH_ID = :batch_id
      AND (:plant_id = '' OR PLANT_ID = :plant_id)
    """
    return QuerySpec(
        name="trace2.get_passport_balance",
        module="trace2",
        endpoint="/api/trace2/batch-quality-passport",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_mass_balance_v",
        tags=["trace2", "trace-app", "quality-passport", "balance"],
    )


def build_batch_quality_passport(
    identity_rows: list[dict],
    coa_rows: list[dict],
    lot_rows: list[dict],
    summary_rows: list[dict],
    balance_rows: list[dict],
) -> Optional[dict]:
    """Assemble a full BatchQualityPassport response from 5 source queries.

    Returns None if identity_rows is empty (no batch found in primary sources).
    Empty coa/lot/balance lists are valid — corresponding sections render with
    empty or zero state.
    """
    partial = map_batch_quality_passport_partial(identity_rows)
    if partial is None:
        return None

    # CoA
    coa: list[dict] = []
    failed = 0
    warn = 0
    for r in coa_rows:
        actual_qty = r.get("actual_qty")
        actual_qual = r.get("actual_qual")
        binary_value = str(actual_qual).strip() if actual_qual is not None else None
        low = float(r.get("low") or 0)
        high = float(r.get("high") or 0)
        target = float(r.get("target") or 0)
        actual = float(actual_qty) if actual_qty is not None else 0.0
        status = _classify_coa_status(r.get("valuation"), actual if actual_qty is not None else None, low, high)
        if status == "fail":
            failed += 1
        elif status == "warn":
            warn += 1
        entry: dict = {
            "mic": str(r.get("mic") or ""),
            "param": str(r.get("param") or ""),
            "low": low,
            "high": high,
            "target": target,
            "actual": actual,
            "uom": str(r.get("uom") or ""),
            "status": status,
        }
        if binary_value and (actual_qty is None or low == 0 == high):
            entry["binary"] = binary_value
        coa.append(entry)

    # Quality summary KPIs
    s = summary_rows[0] if summary_rows else {}
    lot_count = int(s.get("lot_count") or len(lot_rows) or 0)
    accepted_results = int(s.get("accepted_result_count") or 0)
    rejected_results = int(s.get("rejected_result_count") or 0)
    failed_mics = int(s.get("failed_mic_count") or failed)

    # Confidence — simple heuristic from available signals
    confidence = 100
    notes: list[str] = []
    if failed_mics > 0:
        confidence -= 20 * failed_mics
        notes.append(f"{failed_mics} failed MIC{'s' if failed_mics != 1 else ''}")
    if rejected_results > 0:
        confidence -= 15
        notes.append(f"{rejected_results} rejected result{'s' if rejected_results != 1 else ''}")
    if warn > 0:
        confidence -= 5 * warn
        notes.append(f"{warn} MIC{'s' if warn != 1 else ''} near limit")
    if not notes:
        notes.append("No quality flags")
    confidence = max(0, min(100, confidence))

    overall_status = "rejected" if failed_mics > 0 or rejected_results > 0 else ("conditional" if warn > 0 else "accepted")

    # Lot history
    lot_history: list[dict] = []
    for r in lot_rows:
        usage = str(r.get("usage_decision") or "").lower()
        if "reject" in usage:
            result = "reject"
        elif usage and "accept" not in usage:
            result = "conditional"
        elif usage:
            result = "accept"
        else:
            result = "conditional"
        lot_history.append({
            "id": str(r.get("id") or ""),
            "date": str(r.get("date") or "").replace(" ", "T").split("T")[0],
            "inspection": str(r.get("inspection") or ""),
            "result": result,
            "mics": failed_mics + accepted_results if (failed_mics or accepted_results) else 0,
            "failed": failed_mics,
            "decisionBy": str(r.get("decision_by") or "—"),
        })

    # Mass balance variance
    b = balance_rows[0] if balance_rows else {}
    produced = float(b.get("produced") or 0)
    consumed = float(b.get("consumed") or 0)
    shipped = float(b.get("shipped") or 0)
    adjusted = float(b.get("adjusted") or 0)
    current = float(b.get("latest_balance") or 0)
    variance = round((produced + adjusted + consumed + shipped - current) * 10) / 10
    variance_note = (
        "Reconciled — net postings balance to current on-hand."
        if abs(variance) < 0.1
        else f"Unexplained variance of {abs(variance):.1f} {b.get('uom') or 'KG'}."
    )

    # Usage-decision evidence — derived from the latest accepted lot's
    # CREATED_BY. This is NOT a governed signoff / e-signature / release
    # approval. The contract schema deliberately uses
    # `PassportUsageDecisionEvidence` with `decisionType` to make that clear.
    usage_decision_evidence: list[dict] = []
    latest_accept = next(
        (r for r in lot_rows if r.get("usage_decision") and "accept" in str(r.get("usage_decision")).lower()),
        None,
    )
    if latest_accept:
        usage_decision_evidence.append({
            "role": "QA reviewer",
            "decisionBy": str(latest_accept.get("decision_by") or "—"),
            "decisionType": "usage-decision-recorded",
            "recordedAt": str(latest_accept.get("date") or ""),
        })

    # daysToExpiry: compute from identity.expiryDate vs today
    from datetime import datetime, timezone
    days_to_expiry = 0
    expiry = partial["identity"].get("expiryDate") or ""
    if expiry:
        try:
            exp_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00")) if "T" in expiry else datetime.fromisoformat(expiry + "T00:00:00+00:00")
            days_to_expiry = max(0, (exp_dt - datetime.now(timezone.utc)).days)
        except Exception:
            days_to_expiry = 0

    identity = dict(partial["identity"])
    identity["daysToExpiry"] = days_to_expiry

    production = dict(partial["production"])
    if not production.get("orderId"):
        # The mapper sources orderId from ph.PROCESS_ORDER_ID, but if that
        # column was null the partial-spec join may still have surfaced
        # the identity's processOrderId via gold_batch_summary_v.MATERIAL_ID
        # joins; fall back so the response stays internally consistent.
        production["orderId"] = identity.get("processOrderId", "")
    # NOTE: originatingCustomer and notes are intentionally NOT defaulted
    # here — both fields were relaxed to nullable+optional in the Zod
    # schema (2026-05-25 PR) precisely because the live view has no
    # source for them. Substituting "—" or a static "Source: ..." string
    # would re-introduce the fake-default pattern that this PR fixes.

    return {
        "identity": identity,
        "quality": {
            # Heuristic — not a governed QM score. Schema enforces the
            # naming and the `confidenceSource` tag.
            "heuristicQualityConfidence": confidence,
            "confidenceSource": "application-heuristic",
            "heuristicQualityStatus": overall_status,
            "notes": notes,
            "coa": coa,
        },
        "stock": partial["stock"],
        "production": production,
        "lotHistory": lot_history,
        "massBalance": {
            "variance": variance,
            "note": variance_note,
        },
        "usageDecisionEvidence": usage_decision_evidence,
        "inspectionLotCount": lot_count,
        "productionLotCount": partial.get("productionLotCount", 0),
    }
