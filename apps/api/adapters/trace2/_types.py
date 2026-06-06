"""Request dataclasses for Trace2 domain adapter.

All public dataclasses are defined here and re-exported from the top-level shim
so that routes/trace2.py can continue importing them from
``adapters.trace2.trace2_databricks_adapter``.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Trace2BatchHeaderRequest:
    material_id: str
    batch_id: str
    plant_id: str = ""   # optional — filters to a single plant when provided


@dataclass
class Trace2BatchSearchRequest:
    query: str
    max_rows: int = 25
    material_id: str = ""
    batch_id: str = ""


@dataclass
class TraceGraphRequest:
    material_id: str
    batch_id: str
    plant_id: str = ""        # optional — stored on nodes for display, not used in SQL filter
    direction: str = "both"   # "upstream" | "downstream" | "both"
    max_depth: int = 3
    max_edges: int = 1000


@dataclass
class Trace2MassBalanceRequest:
    material_id: str
    batch_id: str
    max_rows: int = 5000


@dataclass
class Trace2SupplierExposureRequest:
    material_id: str
    batch_id: str
    max_rows: int = 1000


@dataclass
class Trace2ProductionHistoryRequest:
    material_id: str
    max_rows: int = 24   # V1 parity: most-recent 24 batches


@dataclass
class Trace2CustomerExposureRequest:
    material_id: str
    batch_id: str
    plant_id: str = ""
    max_depth: int = 5
    max_rows: int = 5000


@dataclass
class Trace2CustomerDeliveryRequest:
    material_id: str
    batch_id: str
    max_rows: int = 5000   # no plant_id — user confirmed: all plants needed for recall coverage


@dataclass
class Trace2RecallReadinessRequest:
    """Trace App / Recall & Exposure tab.

    No plant filter — recall coverage must span all plants the batch reached.
    """
    material_id: str
    batch_id: str
    max_rows: int = 10000


@dataclass
class Trace2SupplierBatchViewRequest:
    """Trace App / Supplier Batches tab.

    Two sub-queries are issued:
      1) consumedLots — single-hop upstream VENDOR_RECEIPT edges
      2) siblingBatches — cross-plant batches that consumed any of the same vendor lots
    Plant is intentionally NOT filtered for sibling discovery.
    """
    material_id: str
    batch_id: str
    max_rows: int = 5000


@dataclass
class Trace2BatchQualityPassportRequest:
    """Trace App / Quality Passport tab — full real-data implementation.

    Fans out across 5 gold views: stock_v, summary_v, material, plant,
    production_history_v (identity/stock/production), quality_result_v (CoA),
    quality_lot_v (lot history + signoff), quality_summary_v (KPIs),
    mass_balance_v (variance).
    """
    material_id: str
    batch_id: str
    plant_id: str = ""


@dataclass
class Trace2MassBalanceLedgerRequest:
    """Trace App / Mass Balance tab — ledger of MSEG-style movements."""
    material_id: str
    batch_id: str
    plant_id: str = ""
    max_rows: int = 5000


@dataclass
class Trace2InvestigationTimelineRequest:
    """Trace App / Timeline tab — UNION of events across mass-balance,
    quality-lot, and delivery sources."""
    material_id: str
    batch_id: str
    plant_id: str = ""
    max_rows: int = 1000


@dataclass
class Trace2HoldsLedgerRequest:
    """Trace App / Holds tab — derived from stock_v (current qty-by-reason)
    and quality_lot_v (inspection-driven active/resolved holds)."""
    material_id: str
    batch_id: str
    plant_id: str = ""
    max_rows: int = 500
