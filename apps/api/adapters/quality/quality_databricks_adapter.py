from dataclasses import dataclass
from typing import Optional

from contracts.generated import (
    QualityEvidenceSummary,
    QualityInspectionLotEvidence,
)
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_executor import DatabricksRepository
from shared.query_service.query_spec import QuerySpec

# Governed UD Labels (Option A)
UD_LABELS = {
    "A": "Accepted",
    "AE": "Accepted (variant / EM)",
    "AC": "Accepted with concession",
    "ACE": "Accepted with concession (variant / EM)",
    "A9": "Accepted — batch restricted",
    "R": "Rejected",
    "RE": "Rejected (variant / EM)",
    "RR": "Rejected — batch restricted globally",
    "": "Pending — lot open, stock in QI, no decision taken",
}

@dataclass(kw_only=True)
class QualityUsageDecisionQuerySpec(QuerySpec):
    """QuerySpec subclass that carries the usage-decision request identifiers
    as typed attributes.

    Uses ``kw_only=True`` so the subclass-added required fields don't have to
    appear *before* the parent's defaulted fields in the generated ``__init__``.
    All callers therefore MUST construct the spec via keyword arguments
    (which `get_quality_usage_decision_spec` already does).
    """

    material_id: str
    batch_id: str
    plant_id: Optional[str] = None

    def cache_key(self) -> str:
        return f"quality_ud:{self.material_id}:{self.batch_id}:{self.plant_id or 'none'}"


@dataclass(frozen=True)
class QualityUsageDecisionEvidence:
    """Mapped lot-level usage decision evidence returned by the repository."""

    inspection_lots: list[QualityInspectionLotEvidence]
    summary: QualityEvidenceSummary


class QualityUsageDecisionRepository:
    """Repository pilot for read-only Quality usage-decision evidence.

    The route owns request validation and response assembly. This class owns
    Databricks QuerySpec creation, execution, and row-to-contract mapping.
    """

    def __init__(self, repository: DatabricksRepository) -> None:
        self._repository = repository

    async def fetch_usage_decision_evidence(
        self,
        *,
        material_id: str,
        batch_id: str,
        plant_id: Optional[str],
        queried_at: str,
    ) -> tuple[QualityUsageDecisionEvidence, QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_quality_usage_decision_spec(
                material_id,
                batch_id,
                plant_id,
            ),
            mapper=lambda rows: map_quality_usage_decision_evidence(rows, queried_at),
        )


def get_quality_usage_decision_spec(material_id: str, batch_id: str, plant_id: Optional[str] = None) -> QuerySpec:
    usage_decision_mv = resolve_domain_object("cq", "gold_inspection_usage_decision")
    inspection_lot_mv = resolve_domain_object("cq", "gold_inspection_lot")

    sql = f"""
    WITH `usage_decision_ranked` AS (
      SELECT
        ud.INSPECTION_LOT_ID,
        ud.USAGE_DECISION_CODE,
        ud.USAGE_DECISION_CREATED_DATE,
        ud.USAGE_DECISION_UPDATED_TIME,
        il.MATERIAL_ID,
        il.BATCH_ID,
        il.PLANT_ID,
        il.PROCESS_ORDER_ID,
        ROW_NUMBER() OVER (
          PARTITION BY ud.INSPECTION_LOT_ID
          ORDER BY
            COALESCE(CAST(NULLIF(ud.USAGE_DECISION_COUNTER, '') AS INT), 0) DESC,
            ud.USAGE_DECISION_CREATED_DATE DESC,
            ud.USAGE_DECISION_UPDATED_TIME DESC
        ) AS rn
      FROM {usage_decision_mv} ud
      LEFT JOIN {inspection_lot_mv} il
        ON il.INSPECTION_LOT_ID = ud.INSPECTION_LOT_ID
    )
    SELECT
      udr.INSPECTION_LOT_ID,
      udr.USAGE_DECISION_CODE,
      udr.USAGE_DECISION_CREATED_DATE,
      udr.MATERIAL_ID,
      udr.BATCH_ID,
      udr.PLANT_ID,
      udr.PROCESS_ORDER_ID
    FROM `usage_decision_ranked` udr
    WHERE udr.rn = 1
      AND udr.MATERIAL_ID = :material_id
      AND udr.BATCH_ID = :batch_id
    """

    params: dict[str, object] = {"material_id": material_id, "batch_id": batch_id}
    if plant_id:
        sql += " AND udr.PLANT_ID = :plant_id"
        params["plant_id"] = plant_id

    return QualityUsageDecisionQuerySpec(
        name="quality.get_usage_decision",
        module="quality",
        endpoint="/api/quality/read-only-evidence",
        sql=sql,
        params=params,
        source_badge="view:gold_inspection_usage_decision",
        tags=["quality", "usage-decision", "lot-level-evidence"],
        material_id=material_id,
        batch_id=batch_id,
        plant_id=plant_id,
    )

def map_quality_usage_decision_rows(rows: list[dict], queried_at: str) -> tuple[list[QualityInspectionLotEvidence], QualityEvidenceSummary]:
    inspection_lots = []

    for row in rows:
        lot_id = row.get("INSPECTION_LOT_ID")
        if not lot_id:
            continue

        raw_code = row.get("USAGE_DECISION_CODE")
        # Mapping-status taxonomy (spec §7):
        #   verified    — code matched the governed UD_LABELS dictionary
        #   unverified  — code present but absent from UD_LABELS (needs governance)
        #   not-mapped  — UD code is NULL / empty; lot is in QI / pending
        # 'source-only' and 'unavailable' are route-level concerns, not mapper.
        if raw_code is None or raw_code == "":
            normalised_code = ""
            governed_label = UD_LABELS[""]
            mapping_status = "not-mapped"
        elif raw_code in UD_LABELS:
            normalised_code = raw_code
            governed_label = UD_LABELS[raw_code]
            mapping_status = "verified"
        else:
            normalised_code = raw_code
            governed_label = f"Unknown ({raw_code})"
            mapping_status = "unverified"

        created_dt = row.get("USAGE_DECISION_CREATED_DATE")
        # Format date as ISO string if present
        created_str = str(created_dt) if created_dt else None

        lot_evidence = QualityInspectionLotEvidence(
            inspectionLotId=str(lot_id),
            materialId=str(row.get("MATERIAL_ID")) if row.get("MATERIAL_ID") else None,
            batchId=str(row.get("BATCH_ID")) if row.get("BATCH_ID") else None,
            plantId=str(row.get("PLANT_ID")) if row.get("PLANT_ID") else None,
            processOrderId=str(row.get("PROCESS_ORDER_ID")) if row.get("PROCESS_ORDER_ID") else None,
            source='databricks-api',
            usageDecisionCode=str(normalised_code),
            usageDecisionText=governed_label,
            usageDecisionMappingStatus=mapping_status,
            usageDecisionCreatedAt=created_str
        )
        inspection_lots.append(lot_evidence)

    lot_count = len(inspection_lots)

    multiple_lots_warning = None
    missing_lot_warning = None

    if lot_count > 1:
        multiple_lots_warning = "Multiple inspection lots found — showing per-lot evidence. A single batch decision cannot be derived without a governed lot-selection rule."
    elif lot_count == 0:
        missing_lot_warning = "No inspection lot found for this batch"

    summary = QualityEvidenceSummary(
        source='databricks-api',
        status='loaded' if lot_count > 0 else 'no-records',
        inspectionLotCount=lot_count,
        micResultCount=0,
        usageDecisionStatus='source-present' if lot_count > 0 else 'not-found',
        coaResultCount=0,
        unavailableEvidence=[
            'mic-results',
            'coa-results',
            'deviations'
        ],
        warnings=[],
        queriedAt=queried_at,
        sourceFreshnessStatus='unknown',
        lotCount=lot_count,
        multipleLotsWarning=multiple_lots_warning,
        missingLotWarning=missing_lot_warning
    )

    return inspection_lots, summary


def map_quality_usage_decision_evidence(
    rows: list[dict],
    queried_at: str,
) -> QualityUsageDecisionEvidence:
    inspection_lots, summary = map_quality_usage_decision_rows(rows, queried_at)
    return QualityUsageDecisionEvidence(
        inspection_lots=inspection_lots,
        summary=summary,
    )
