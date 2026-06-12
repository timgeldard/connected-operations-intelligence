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

from datetime import datetime, timezone
from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import (
    resolve_domain_object,
    resolve_governed_trace2_object,
)
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2BatchQualityPassportRequest
from ._utils import _classify_coa_status

# ---------------------------------------------------------------------------
# Trace App slice — getBatchQualityPassport (partial: identity + stock + production)
# ---------------------------------------------------------------------------
#
# The Quality Passport response has 7 sections (identity, quality, stock,
# production, lotHistory, massBalance, signoff).  Governed sources:
#   identity   ← gold_batch_stock_summary_secured + gold_material + gold_plant +
#                gold_batch_event_ledger (latest PRODUCTION event for process order / date)
#   stock      ← gold_batch_stock_summary_secured
#   production ← gold_batch_event_ledger (PRODUCTION IN rows for production history)
#   lotHistory ← gold_wm_qm_lot_status
#   massBalance← gold_batch_event_ledger (aggregate KPIs)
#   quality/coa← gold_batch_quality_result_v (still on legacy TRACE_SCHEMA — no governed
#                  equivalent yet; kept unchanged)
#   quality KPIs← gold_wm_qm_lot_status aggregate
#
# gold_batch_summary_v and gold_batch_production_history_v are replaced by the
# governed equivalents.  The legacy gold_batch_stock_v is replaced by
# gold_batch_stock_summary_secured.

def get_batch_quality_passport_partial_spec(request: Trace2BatchQualityPassportRequest) -> QuerySpec:
    """Return a QuerySpec for the verified-source portion of the Quality Passport.

    Sources:
      - gold_batch_stock_summary_secured (TRACE_GOVERNED_SCHEMA, RLS)
            → stock buckets, base_unit_of_measure
      - gold_material (legacy TRACE_SCHEMA — no governed equivalent)
            → material_name, BASE_UNIT_OF_MEASURE
      - gold_plant (legacy TRACE_SCHEMA — no governed equivalent)
            → plant_name
      - gold_batch_event_ledger (TRACE_GOVERNED_SCHEMA)
            → latest PRODUCTION IN event: PROCESS_ORDER_ID, POSTING_DATE, QUANTITY (batch qty)

    manufacture_date / expiry_date: these came from gold_batch_summary_v.
    gold_batch_stock_summary does not carry dates.  gold_batch_event_ledger has
    POSTING_DATE but not manufacture/expiry dates.  These fields are emitted as
    empty string (same as when the legacy view had no value) — no governed source
    provides them yet.  The contract accepts empty string for these optional fields.

    The production_lot_count (count of distinct process orders for this batch) is
    computed as a subquery over gold_batch_event_ledger PRODUCTION IN rows.
    """
    tbl_stock = resolve_governed_trace2_object("gold_batch_stock_summary_secured")
    tbl_material = resolve_domain_object("trace2", "gold_material")
    tbl_plant = resolve_domain_object("trace2", "gold_plant")
    tbl_ledger = resolve_governed_trace2_object("gold_batch_event_ledger")

    sql = f"""
    SELECT
        s.material_code              AS material_id,
        s.batch_number               AS batch_id,
        s.plant_code                 AS plant_id,
        s.unrestricted_quantity      AS unrestricted,
        s.blocked_quantity           AS blocked,
        s.quality_inspection_quantity AS quality_inspection,
        s.restricted_use_quantity    AS restricted,
        s.in_transfer_quantity       AS transit,
        s.total_quantity             AS total_stock,
        m.MATERIAL_NAME              AS material_name,
        m.BASE_UNIT_OF_MEASURE       AS uom,
        p.PLANT_NAME                 AS plant_name,
        '' AS manufacture_date,
        '' AS expiry_date,
        ph.PROCESS_ORDER_ID          AS process_order_id,
        ph.POSTING_DATE              AS production_started_at,
        ph.QUANTITY                  AS production_actual_qty,
        m.BASE_UNIT_OF_MEASURE       AS production_uom,
        COALESCE(ph_cnt.production_lot_count, 0) AS production_lot_count
    FROM {tbl_stock} s
    JOIN {tbl_material} m
        ON s.material_code = m.MATERIAL_ID AND m.LANGUAGE_ID = 'E'
    JOIN {tbl_plant} p
        ON s.plant_code = p.PLANT_ID
    LEFT JOIN (
        SELECT
            MATERIAL_ID,
            BATCH_ID,
            PLANT_ID,
            PROCESS_ORDER_ID,
            POSTING_DATE,
            QUANTITY,
            ROW_NUMBER() OVER (
                PARTITION BY MATERIAL_ID, BATCH_ID, PLANT_ID
                ORDER BY POSTING_DATE DESC NULLS LAST
            ) AS rn
        FROM {tbl_ledger}
        WHERE MATERIAL_ID = :material_id
          AND BATCH_ID   = :batch_id
          AND LINK_TYPE  = 'PRODUCTION'
          AND direction  = 'IN'
    ) ph ON s.material_code = ph.MATERIAL_ID
         AND s.batch_number  = ph.BATCH_ID
         AND s.plant_code    = ph.PLANT_ID
         AND ph.rn = 1
    LEFT JOIN (
        SELECT MATERIAL_ID, BATCH_ID,
               COUNT(DISTINCT PROCESS_ORDER_ID) AS production_lot_count
        FROM {tbl_ledger}
        WHERE MATERIAL_ID = :material_id
          AND BATCH_ID   = :batch_id
          AND LINK_TYPE  = 'PRODUCTION'
          AND direction  = 'IN'
        GROUP BY MATERIAL_ID, BATCH_ID
    ) ph_cnt
        ON s.material_code = ph_cnt.MATERIAL_ID AND s.batch_number = ph_cnt.BATCH_ID
    WHERE s.material_code = :material_id
      AND s.batch_number  = :batch_id
      AND (:plant_id = '' OR s.plant_code = :plant_id)
    ORDER BY s.plant_code
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
        source_badge="mv:gold_batch_stock_summary+gold_batch_event_ledger",
        tags=["trace2", "trace-app", "quality-passport", "partial"],
    )


def map_batch_quality_passport_partial(rows: list[dict]) -> Optional[dict]:
    """Map the partial passport join result to identity + stock + production sections.

    Returns None on zero rows so the route can 404.

    manufacture_date / expiry_date: emitted as empty string — no governed source
    provides these fields in the current Phase 2 schema.  The Zod contract accepts
    empty string for these optional identity fields.

    production section sourced from gold_batch_event_ledger PRODUCTION IN rows:
      orderId    ← PROCESS_ORDER_ID (most recent production event for this batch×plant)
      startedAt  ← POSTING_DATE (posting date of the production event)
      actualQty  ← QUANTITY (batch quantity on the production receipt)
    """
    if not rows:
        return None
    row = rows[0]

    return {
        "identity": {
            "materialDescription": str(row.get("material_name") or ""),
            "materialId": str(row.get("material_id") or ""),
            "batchId": str(row.get("batch_id") or ""),
            "plantName": str(row.get("plant_name") or ""),
            "plantId": str(row.get("plant_id") or ""),
            "processOrderId": str(row.get("process_order_id") or ""),
            # manufacture_date / expiry_date: not available in governed stock summary.
            "manufactureDate": "",
            "expiryDate": "",
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
            "line": None,
            "operator": None,
            "startedAt": str(row.get("production_started_at") or ""),
            "confirmedAt": None,
            "plannedQty": None,
            "actualQty": float(row.get("production_actual_qty") or 0),
            "yield": None,
            "originatingCustomer": None,
            "notes": None,
        },
        "productionLotCount": int(row.get("production_lot_count") or 0),
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

    Source: gold_batch_quality_result_v (still on legacy TRACE_SCHEMA — no governed
    equivalent exists yet; kept unchanged from legacy adapter).
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
    """Fetch lot history (recent inspections) for the active batch.

    Source: gold_wm_qm_lot_status (TRACE_GOVERNED_SCHEMA, estate-wide after #122).
    Replaces legacy gold_batch_quality_lot_v.

    Column mapping:
      inspection_lot_number     → id
      COALESCE(inspection_end_date, lot_created_date) → date
      inspection_type           → inspection
      last_usage_decision       → usage_decision
      last_usage_decision_by    → decision_by
    """
    tbl = resolve_governed_trace2_object("gold_wm_qm_lot_status")
    sql = f"""
    SELECT
      inspection_lot_number                                    AS id,
      COALESCE(inspection_end_date, lot_created_date)          AS date,
      inspection_type                                          AS inspection,
      last_usage_decision                                      AS usage_decision,
      last_usage_decision_by                                   AS decision_by
    FROM {tbl}
    WHERE material_code = :material_id
      AND batch_number  = :batch_id
      AND (:plant_id = '' OR plant_code = :plant_id)
    ORDER BY COALESCE(inspection_end_date, lot_created_date) DESC
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
        source_badge="mv:gold_wm_qm_lot_status",
        tags=["trace2", "trace-app", "quality-passport", "lots"],
    )


def get_batch_quality_passport_summary_spec(request: Trace2BatchQualityPassportRequest) -> QuerySpec:
    """Fetch quality KPI counts from gold_wm_qm_lot_status aggregate.

    Source: gold_wm_qm_lot_status (TRACE_GOVERNED_SCHEMA), replacing legacy
    gold_batch_quality_summary_v.

    The governed QM lot status table carries has_usage_decision (boolean) and
    quality_score.  We derive:
      lot_count            = COUNT(inspection_lot_number)
      failed_mic_count     = 0 (no MIC-level result counts in this table; CoA spec fills this)
      accepted_result_count= COUNT where has_usage_decision = true
      rejected_result_count= 0 (no rejected-result metric; approval is boolean at lot level)
      latest_inspection_date= MAX(COALESCE(inspection_end_date, lot_created_date))
    """
    tbl = resolve_governed_trace2_object("gold_wm_qm_lot_status")
    sql = f"""
    SELECT
      COUNT(inspection_lot_number)                             AS lot_count,
      0                                                        AS failed_mic_count,
      COUNT(CASE WHEN has_usage_decision THEN 1 END)           AS accepted_result_count,
      0                                                        AS rejected_result_count,
      MAX(COALESCE(inspection_end_date, lot_created_date))     AS latest_inspection_date
    FROM {tbl}
    WHERE material_code = :material_id
      AND batch_number  = :batch_id
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
        source_badge="mv:gold_wm_qm_lot_status",
        tags=["trace2", "trace-app", "quality-passport", "summary"],
    )


def get_batch_quality_passport_balance_spec(request: Trace2BatchQualityPassportRequest) -> QuerySpec:
    """Fetch the latest running balance and net variance from gold_batch_event_ledger.

    Source: gold_batch_event_ledger (TRACE_GOVERNED_SCHEMA), replacing legacy
    gold_batch_mass_balance_v.

    LINK_TYPE→bucket mapping (mirrors mass_balance_adapter):
      PRODUCTION IN / VENDOR_RECEIPT IN   → produced (positive quantity received)
      PRODUCTION OUT                       → consumed (component consumed into an order)
      DELIVERY OUT                         → shipped
      ADJUSTMENT_IN                        → adjusted (positive)
      ADJUSTMENT_OUT                       → adjusted (negative)

    Signed quantity: IN → +QUANTITY, OUT → -QUANTITY.
    latest_balance = last row's running SUM (application-computed).
    """
    tbl = resolve_governed_trace2_object("gold_batch_event_ledger")
    sql = f"""
    SELECT
      SUM(CASE
            WHEN (LINK_TYPE IN ('PRODUCTION','VENDOR_RECEIPT') AND direction = 'IN')
            THEN QUANTITY ELSE 0
          END)                                                        AS produced,
      SUM(CASE
            WHEN LINK_TYPE = 'PRODUCTION' AND direction = 'OUT'
            THEN -QUANTITY ELSE 0
          END)                                                        AS consumed,
      SUM(CASE
            WHEN LINK_TYPE = 'DELIVERY' AND direction = 'OUT'
            THEN -QUANTITY ELSE 0
          END)                                                        AS shipped,
      SUM(CASE
            WHEN LINK_TYPE IN ('ADJUSTMENT_IN','ADJUSTMENT_OUT',
                               'BATCH_TRANSFER','MATERIAL_TRANSFER','STO_TRANSFER')
            THEN CASE WHEN direction = 'IN' THEN QUANTITY ELSE -QUANTITY END
            ELSE 0
          END)                                                        AS adjusted,
      SUM(CASE WHEN direction = 'IN' THEN QUANTITY ELSE -QUANTITY END) AS latest_balance,
      MAX(BASE_UNIT_OF_MEASURE)                                       AS uom
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
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
        source_badge="mv:gold_batch_event_ledger",
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

    # Usage-decision evidence — derived from the latest accepted lot's decision_by.
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
        production["orderId"] = identity.get("processOrderId", "")

    return {
        "identity": identity,
        "quality": {
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
