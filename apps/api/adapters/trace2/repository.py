"""Trace2Repository — facade over DatabricksRepository for all Trace2 native reads."""
from __future__ import annotations

from typing import Optional

from shared.query_service.query_executor import DatabricksRepository
from shared.query_service.query_spec import QuerySpec

from ._types import (
    Trace2BatchHeaderRequest,
    Trace2BatchQualityPassportRequest,
    Trace2BatchSearchRequest,
    Trace2CustomerDeliveryRequest,
    Trace2CustomerExposureRequest,
    Trace2HoldsLedgerRequest,
    Trace2InvestigationTimelineRequest,
    Trace2MassBalanceLedgerRequest,
    Trace2MassBalanceRequest,
    Trace2ProductionHistoryRequest,
    Trace2RecallReadinessRequest,
    Trace2SupplierBatchViewRequest,
    Trace2SupplierExposureRequest,
)
from .batch_header_adapter import (
    get_batch_header_summary_spec,
    get_batch_search_spec,
    map_batch_header_rows,
    map_batch_search_rows,
)
from .customer_adapter import (
    get_customer_delivery_spec,
    get_customer_exposure_spec,
    map_customer_delivery_rows,
    map_customer_exposure_rows,
)
from .holds_ledger_adapter import get_holds_ledger_spec, map_holds_ledger_rows
from .investigation_timeline_adapter import (
    get_investigation_timeline_spec,
    map_investigation_timeline_rows,
)
from .mass_balance_adapter import (
    get_mass_balance_ledger_spec,
    get_mass_balance_spec,
    map_mass_balance_ledger_rows,
    map_mass_balance_rows,
)
from .production_history_adapter import get_production_history_spec, map_production_history_rows
from .quality_passport_adapter import (
    build_batch_quality_passport,
    get_batch_quality_passport_balance_spec,
    get_batch_quality_passport_coa_spec,
    get_batch_quality_passport_lots_spec,
    get_batch_quality_passport_partial_spec,
    get_batch_quality_passport_summary_spec,
)
from .recall_readiness_adapter import get_recall_readiness_spec, map_recall_readiness_rows
from .supplier_adapter import (
    get_supplier_consumed_lots_spec,
    get_supplier_exposure_spec,
    get_supplier_sibling_batches_spec,
    map_supplier_batch_view,
    map_supplier_exposure_rows,
)


class Trace2Repository:
    """Repository-backed facade for Trace2 native Databricks reads."""

    def __init__(self, repository: DatabricksRepository) -> None:
        self._repository = repository

    async def fetch_batch_header(
        self,
        request: Trace2BatchHeaderRequest,
    ) -> tuple[Optional[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_batch_header_summary_spec(request),
            mapper=map_batch_header_rows,
        )

    async def fetch_batch_search(
        self,
        request: Trace2BatchSearchRequest,
        *,
        display_query: str,
        max_rows: int,
    ) -> tuple[dict, QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_batch_search_spec(request),
            mapper=lambda rows: map_batch_search_rows(rows, display_query, max_rows),
        )

    async def fetch_customer_exposure(
        self,
        request: Trace2CustomerExposureRequest,
    ) -> tuple[Optional[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_customer_exposure_spec(request),
            mapper=map_customer_exposure_rows,
        )

    async def fetch_customer_delivery(
        self,
        request: Trace2CustomerDeliveryRequest,
    ) -> tuple[Optional[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_customer_delivery_spec(request),
            mapper=map_customer_delivery_rows,
        )

    async def fetch_supplier_exposure(
        self,
        request: Trace2SupplierExposureRequest,
    ) -> tuple[dict, QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_supplier_exposure_spec(request),
            mapper=map_supplier_exposure_rows,
        )

    async def fetch_production_history(
        self,
        request: Trace2ProductionHistoryRequest,
        *,
        material_id: str,
    ) -> tuple[dict, QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_production_history_spec(request),
            mapper=lambda rows: map_production_history_rows(rows, material_id),
        )

    async def fetch_mass_balance(
        self,
        request: Trace2MassBalanceRequest,
    ) -> tuple[dict, QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_mass_balance_spec(request),
            mapper=map_mass_balance_rows,
        )

    async def fetch_recall_readiness(
        self,
        request: Trace2RecallReadinessRequest,
    ) -> tuple[Optional[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_recall_readiness_spec(request),
            mapper=map_recall_readiness_rows,
        )

    async def fetch_supplier_batches(
        self,
        request: Trace2SupplierBatchViewRequest,
    ) -> tuple[dict, QuerySpec]:
        consumed_rows, consumed_spec = await self._repository.fetch(
            spec_factory=lambda: get_supplier_consumed_lots_spec(request),
            mapper=lambda rows: rows,
        )
        vendor_batches = sorted({
            str(row.get("vendor_batch") or "")
            for row in consumed_rows
            if row.get("vendor_batch")
        })
        sibling_rows, _ = await self._repository.fetch(
            spec_factory=lambda: get_supplier_sibling_batches_spec(request, vendor_batches),
            mapper=lambda rows: rows,
        )
        return map_supplier_batch_view(consumed_rows, sibling_rows), consumed_spec

    async def fetch_batch_quality_passport(
        self,
        request: Trace2BatchQualityPassportRequest,
    ) -> tuple[Optional[dict], QuerySpec]:
        identity_rows, spec = await self._repository.fetch(
            spec_factory=lambda: get_batch_quality_passport_partial_spec(request),
            mapper=lambda rows: rows,
        )
        coa_rows, _ = await self._repository.fetch(
            spec_factory=lambda: get_batch_quality_passport_coa_spec(request),
            mapper=lambda rows: rows,
        )
        lot_rows, _ = await self._repository.fetch(
            spec_factory=lambda: get_batch_quality_passport_lots_spec(request),
            mapper=lambda rows: rows,
        )
        summary_rows, _ = await self._repository.fetch(
            spec_factory=lambda: get_batch_quality_passport_summary_spec(request),
            mapper=lambda rows: rows,
        )
        balance_rows, _ = await self._repository.fetch(
            spec_factory=lambda: get_batch_quality_passport_balance_spec(request),
            mapper=lambda rows: rows,
        )
        return (
            build_batch_quality_passport(
                identity_rows,
                coa_rows,
                lot_rows,
                summary_rows,
                balance_rows,
            ),
            spec,
        )

    async def fetch_mass_balance_ledger(
        self,
        request: Trace2MassBalanceLedgerRequest,
    ) -> tuple[Optional[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_mass_balance_ledger_spec(request),
            mapper=map_mass_balance_ledger_rows,
        )

    async def fetch_investigation_timeline(
        self,
        request: Trace2InvestigationTimelineRequest,
    ) -> tuple[dict, QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_investigation_timeline_spec(request),
            mapper=map_investigation_timeline_rows,
        )

    async def fetch_holds_ledger(
        self,
        request: Trace2HoldsLedgerRequest,
    ) -> tuple[Optional[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_holds_ledger_spec(request),
            mapper=map_holds_ledger_rows,
        )
