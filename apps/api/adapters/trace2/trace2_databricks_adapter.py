"""Backward-compatible re-export shim. Uses `resolve_domain_object` internally via sub-adapters.

This module was split into domain-scoped adapter modules for maintainability.
All names remain importable from here so routes/trace2.py requires no changes.

Domain modules:
  _types.py                    — request dataclasses
  _utils.py                    — private helper functions
  batch_header_adapter.py      — batch header summary + batch search
  trace_graph_adapter.py       — recursive trace graph
  mass_balance_adapter.py      — mass balance summary + ledger
  recall_readiness_adapter.py  — recall readiness
  supplier_adapter.py          — supplier exposure, consumed lots, sibling batches
  customer_adapter.py          — customer exposure + delivery
  production_history_adapter.py — production history
  quality_passport_adapter.py  — quality passport (partial, CoA, lots, summary, balance)
  investigation_timeline_adapter.py — investigation timeline
  holds_ledger_adapter.py      — holds ledger
  repository.py                — Trace2Repository facade
"""
from __future__ import annotations

from ._types import *  # noqa: F401, F403
from ._utils import _bucket_movement_type, _derive_quality_status  # noqa: F401
from .batch_header_adapter import *  # noqa: F401, F403
from .customer_adapter import *  # noqa: F401, F403
from .holds_ledger_adapter import *  # noqa: F401, F403
from .investigation_timeline_adapter import *  # noqa: F401, F403
from .mass_balance_adapter import *  # noqa: F401, F403
from .production_history_adapter import *  # noqa: F401, F403
from .quality_passport_adapter import *  # noqa: F401, F403
from .recall_readiness_adapter import *  # noqa: F401, F403
from .repository import *  # noqa: F401, F403
from .supplier_adapter import *  # noqa: F401, F403
from .trace_graph_adapter import *  # noqa: F401, F403
