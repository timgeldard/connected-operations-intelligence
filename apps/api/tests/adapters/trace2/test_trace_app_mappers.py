"""Direct mapper unit tests for the Trace App data products.

The catalogue P0 follow-on (docs/app-data-layer/domain-data-product-catalog.md)
calls out two gaps in this layer: `build_batch_quality_passport` and
`map_investigation_timeline_rows` had no direct mapper unit tests.

These tests exercise the mappers ONLY — they intentionally do NOT import
`main` so they can run independently of the FastAPI app, and they don't
need any environment variables, databricks config, or HTTP mocking.

The route-level safety contract is exercised separately in
`tests/routes/test_trace_app_routes.py`.
"""
from __future__ import annotations

import pytest
from adapters.trace2.trace2_databricks_adapter import (
    build_batch_quality_passport,
    map_customer_delivery_rows,
    map_investigation_timeline_rows,
    map_supplier_batch_view,
    map_supplier_exposure_rows,
)

# ---------------------------------------------------------------------------
# Fixtures — minimal row shapes that match what the source queries return.
# ---------------------------------------------------------------------------

def _identity_row(**overrides) -> dict:
    """One row from gold_batch_stock_v + summary_v + material + plant + production_history JOIN.

    Production fields reflect the post-audit (2026-05-25) projection of
    ``get_batch_quality_passport_partial_spec``: only
    ``process_order_id``, ``production_started_at`` (← POSTING_DATE), and
    ``production_actual_qty`` (← BATCH_QTY) come back from the live view.
    ``production_line``, ``production_operator``, ``production_confirmed_at``,
    and ``production_planned_qty`` are absent in the source DDL and are
    intentionally omitted from the fixture so the mapper's contract
    defaults are exercised.
    """
    base = {
        "material_id": "20582002",
        "batch_id": "0008898869",
        "plant_id": "C351",
        "material_name": "Emmental cheese block",
        "plant_name": "Charleville",
        "process_order_id": "PO-2024-03-0847",
        "manufacture_date": "2024-03-08",
        "expiry_date": "2024-09-08",
        "uom": "KG",
        "unrestricted": 12450,
        "blocked": 2100,
        "quality_inspection": 850,
        "restricted": 450,
        "transit": 1200,
        # gold_batch_production_history_v live columns only.
        "production_started_at": "2024-03-08",
        "production_actual_qty": 17050,
        "production_uom": "KG",
    }
    base.update(overrides)
    return base


def _coa_row(**overrides) -> dict:
    """One row from gold_batch_quality_result_v."""
    base = {
        "mic": "MIC-001",
        "param": "Moisture",
        "low": 38.0,
        "high": 42.0,
        "target": 40.0,
        "actual_qty": 40.2,
        "actual_qual": None,
        "uom": "%",
        "valuation": "A",
    }
    base.update(overrides)
    return base


def _lot_row(**overrides) -> dict:
    """One row from gold_batch_quality_lot_v."""
    base = {
        "id": "LOT-2024-3-08-A",
        "date": "2024-03-08T11:42:00",
        "inspection": "Lab MIC + retain",
        "usage_decision": "Accepted",
        "decision_by": "S. Murphy",
    }
    base.update(overrides)
    return base


def _summary_row(**overrides) -> dict:
    """One row from gold_batch_quality_summary_v."""
    base = {
        "lot_count": 4,
        "failed_mic_count": 0,
        "accepted_result_count": 24,
        "rejected_result_count": 0,
    }
    base.update(overrides)
    return base


def _balance_row(**overrides) -> dict:
    """One aggregated row from gold_batch_mass_balance_v."""
    base = {
        "produced": 17050.0,
        "consumed": -100.0,
        "shipped": -4280.0,
        "adjusted": 0.0,
        "latest_balance": 12670.0,
        "uom": "KG",
    }
    base.update(overrides)
    return base


# ===========================================================================
# build_batch_quality_passport
# ===========================================================================


class TestBuildBatchQualityPassport:
    """Composite passport mapper across 5 source queries."""

    def test_empty_identity_returns_none(self) -> None:
        """No batch in primary sources → 404, NEVER a synthesised passport."""
        assert build_batch_quality_passport([], [], [], [], []) is None

    def test_identity_only_emits_complete_passport(self) -> None:
        """Identity-only call still produces a valid passport with empty
        sections. The route must not 404 on missing CoA / lots / balance —
        the absence of evidence is itself evidence."""
        result = build_batch_quality_passport(
            identity_rows=[_identity_row()],
            coa_rows=[],
            lot_rows=[],
            summary_rows=[],
            balance_rows=[],
        )
        assert result is not None
        assert result["identity"]["materialId"] == "20582002"
        assert result["quality"]["coa"] == []
        assert result["lotHistory"] == []
        assert result["usageDecisionEvidence"] == []

    def test_confidence_source_is_application_heuristic(self) -> None:
        """The score is heuristic. The marker MUST always be set so the UI
        cannot misread it as a governed metric."""
        result = build_batch_quality_passport(
            [_identity_row()], [_coa_row()], [], [_summary_row()], []
        )
        assert result is not None
        assert result["quality"]["confidenceSource"] == "application-heuristic"

    def test_no_findings_yields_no_quality_flags_note(self) -> None:
        result = build_batch_quality_passport(
            [_identity_row()],
            [_coa_row(valuation="A", actual_qty=40.0)],
            [],
            [_summary_row(failed_mic_count=0, rejected_result_count=0)],
            [],
        )
        assert result is not None
        assert result["quality"]["notes"] == ["No quality flags"]
        assert result["quality"]["heuristicQualityConfidence"] == 100
        assert result["quality"]["heuristicQualityStatus"] == "accepted"

    def test_failed_mic_lowers_confidence_and_flags_rejected(self) -> None:
        result = build_batch_quality_passport(
            [_identity_row()],
            [_coa_row(valuation="R", actual_qty=50.0)],
            [],
            [_summary_row(failed_mic_count=1)],
            [],
        )
        assert result is not None
        assert result["quality"]["heuristicQualityStatus"] == "rejected"
        # 100 - 20 * 1 = 80
        assert result["quality"]["heuristicQualityConfidence"] == 80
        assert any("failed MIC" in n for n in result["quality"]["notes"])

    def test_warn_status_lowers_confidence_and_flags_conditional(self) -> None:
        # Build a CoA row that triggers warn status — actual right at upper edge.
        result = build_batch_quality_passport(
            [_identity_row()],
            [_coa_row(low=38.0, high=42.0, target=40.0, actual_qty=41.7, valuation="A")],
            [],
            [_summary_row(failed_mic_count=0)],
            [],
        )
        assert result is not None
        # The CoA classifier produces warn status near the upper tolerance.
        assert result["quality"]["coa"][0]["status"] == "warn"
        # heuristicQualityStatus flips to 'conditional' on any warn.
        assert result["quality"]["heuristicQualityStatus"] == "conditional"
        # 100 - 5 = 95
        assert result["quality"]["heuristicQualityConfidence"] == 95

    def test_binary_coa_value_preserved_when_low_equals_high(self) -> None:
        """Listeria-style binary characteristics carry a textual `binary`
        value (e.g. 'Absent'). The mapper must surface it when low == high == 0."""
        result = build_batch_quality_passport(
            [_identity_row()],
            [
                _coa_row(
                    mic="MIC-006",
                    param="Listeria",
                    low=0,
                    high=0,
                    target=0,
                    actual_qty=None,
                    actual_qual="Absent",
                    uom="/25g",
                    valuation="A",
                )
            ],
            [],
            [],
            [],
        )
        assert result is not None
        listeria = result["quality"]["coa"][0]
        assert listeria["binary"] == "Absent"

    def test_lot_history_classifies_usage_decision_keywords(self) -> None:
        """Mapping rule:
            - 'reject' in decision → result='reject'
            - 'accept' in decision → result='accept'
            - decision present but neither word → result='conditional'
            - decision missing → result='conditional' (no governed inference)
        """
        lots = [
            _lot_row(id="L1", usage_decision="Accepted with concession"),
            _lot_row(id="L2", usage_decision="Rejected — batch restricted"),
            _lot_row(id="L3", usage_decision="Pending review"),
            _lot_row(id="L4", usage_decision=None),
        ]
        result = build_batch_quality_passport(
            [_identity_row()], [], lots, [], []
        )
        assert result is not None
        history = result["lotHistory"]
        assert [h["id"] for h in history] == ["L1", "L2", "L3", "L4"]
        assert [h["result"] for h in history] == ["accept", "reject", "conditional", "conditional"]

    def test_usage_decision_evidence_picks_latest_accept_only(self) -> None:
        """The evidence list only includes the latest accepted lot. Rejected
        and pending lots MUST NOT be misrepresented as governed approval."""
        lots = [
            _lot_row(id="L1", usage_decision="Accepted", decision_by="S. Murphy", date="2024-03-08"),
            _lot_row(id="L2", usage_decision="Rejected", decision_by="D. Ferreira", date="2024-03-09"),
        ]
        result = build_batch_quality_passport([_identity_row()], [], lots, [], [])
        assert result is not None
        evidence = result["usageDecisionEvidence"]
        # Exactly one entry, role 'QA reviewer', decisionType 'usage-decision-recorded'.
        assert len(evidence) == 1
        assert evidence[0]["role"] == "QA reviewer"
        assert evidence[0]["decisionBy"] == "S. Murphy"
        assert evidence[0]["decisionType"] == "usage-decision-recorded"

    def test_usage_decision_evidence_is_empty_when_no_accept(self) -> None:
        """If no lot reaches accept, the evidence array is empty — the UI
        gets the source-truthful state (no QA evidence)."""
        lots = [
            _lot_row(usage_decision="Rejected"),
            _lot_row(usage_decision=None),
        ]
        result = build_batch_quality_passport([_identity_row()], [], lots, [], [])
        assert result is not None
        assert result["usageDecisionEvidence"] == []

    def test_mass_balance_reconciled_when_variance_under_threshold(self) -> None:
        """variance = produced + adjusted + consumed + shipped - current.
        With the default fixtures (17050 + 0 + (-100) + (-4280) - 12670 = 0.0)."""
        result = build_batch_quality_passport(
            [_identity_row()], [], [], [], [_balance_row()]
        )
        assert result is not None
        assert result["massBalance"]["variance"] == 0.0
        assert "Reconciled" in result["massBalance"]["note"]

    def test_mass_balance_unexplained_when_postings_dont_close(self) -> None:
        result = build_batch_quality_passport(
            [_identity_row()],
            [],
            [],
            [],
            [_balance_row(latest_balance=12000.0)],  # short by 670 KG
        )
        assert result is not None
        assert result["massBalance"]["variance"] == 670.0
        assert "Unexplained" in result["massBalance"]["note"]
        assert "KG" in result["massBalance"]["note"]

    def test_stock_section_is_source_truthful(self) -> None:
        """Stock buckets pass through from gold_batch_stock_v — no invention,
        no defaulting to KG (UOM comes from gold_material)."""
        result = build_batch_quality_passport(
            [_identity_row(unrestricted=100, blocked=50, quality_inspection=25)],
            [], [], [], []
        )
        assert result is not None
        assert result["stock"]["unrestricted"] == 100
        assert result["stock"]["blocked"] == 50
        assert result["stock"]["qualityInspection"] == 25
        assert result["stock"]["uom"] == "KG"

    def test_does_not_emit_signoff_key(self) -> None:
        """Post-PR-#82 rename: the response carries `usageDecisionEvidence`,
        never `signoff`. UI consumers MUST NOT see governance-language."""
        result = build_batch_quality_passport(
            [_identity_row()],
            [_coa_row()],
            [_lot_row()],
            [_summary_row()],
            [_balance_row()],
        )
        assert result is not None
        assert "signoff" not in result
        assert "usageDecisionEvidence" in result

    def test_does_not_emit_governed_release_authority_keys(self) -> None:
        """Forbidden-claims checklist: no canRelease, no releaseApproved,
        no sapPosting, no eSignature anywhere in the response."""
        result = build_batch_quality_passport(
            [_identity_row()], [_coa_row()], [_lot_row()], [_summary_row()], [_balance_row()]
        )
        import json

        as_json = json.dumps(result)
        for forbidden in ("canRelease", "releaseApproved", "sapPosting", "eSignature"):
            assert forbidden not in as_json, f"Forbidden key {forbidden!r} leaked into passport"


# ===========================================================================
# map_investigation_timeline_rows
# ===========================================================================


class TestMapInvestigationTimelineRows:
    """Timeline UNION mapper — coerces heterogeneous rows from mass-balance,
    quality-lot, and delivery sources into a uniform `TimelineEvent` shape."""

    def test_empty_rows_returns_empty_events_not_none(self) -> None:
        """An empty timeline is a VALID state (the batch may have no
        inspections / dispatches yet). The mapper MUST return {events: []}
        — never None, never 404."""
        assert map_investigation_timeline_rows([]) == {"events": []}

    def test_passes_through_known_event_type(self) -> None:
        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "production", "label": "GR", "actor": "SAP", "detail": "17050 KG", "tone": "good", "source_system": "SAP"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["type"] == "production"
        assert result["events"][0]["sourceSystem"] == "SAP"

    def test_unknown_event_type_coerced_to_note(self) -> None:
        """Drift-tolerant: if the SQL adds a new event_type the mapper hasn't
        seen, it falls back to 'note' rather than raising or leaking the
        unknown value to the contract."""
        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "spurious-new-type", "label": "X", "actor": "SAP", "detail": "", "tone": "neutral"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["type"] == "note"

    def test_unknown_tone_coerced_to_neutral(self) -> None:
        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "production", "label": "X", "actor": "SAP", "detail": "", "tone": "pink"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["tone"] == "neutral"

    def test_unknown_source_system_dropped_to_none(self) -> None:
        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "production", "label": "X", "actor": "SAP", "detail": "", "tone": "good", "source_system": "GIBBERISH"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["sourceSystem"] is None

    def test_blank_label_falls_back_to_event(self) -> None:
        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "note", "label": "   ", "actor": "SAP", "detail": "", "tone": "neutral"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["label"] == "Event"

    def test_blank_actor_falls_back_to_em_dash(self) -> None:
        """The contract requires a string actor. Use an em-dash sentinel so
        the UI can render an obvious 'no actor recorded' indicator."""
        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "note", "label": "X", "actor": "", "detail": "", "tone": "neutral"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["actor"] == "—"

    def test_preserves_row_order(self) -> None:
        """The SQL is responsible for ORDER BY ts; the mapper MUST NOT
        re-sort or drop rows."""
        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "production", "label": "first",  "actor": "SAP", "detail": "", "tone": "good"},
            {"ts": "2024-03-09T06:00", "event_type": "qc",         "label": "second", "actor": "Lab", "detail": "", "tone": "good"},
            {"ts": "2024-03-10T06:00", "event_type": "dispatch",   "label": "third",  "actor": "SAP", "detail": "", "tone": "brand"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert [e["label"] for e in result["events"]] == ["first", "second", "third"]

    @pytest.mark.parametrize("good_type", [
        "production", "consumption", "qc", "release", "approval", "hold", "dispatch", "note",
    ])
    def test_all_documented_event_types_pass_through(self, good_type: str) -> None:
        rows = [{"ts": "2024-03-08T06:00", "event_type": good_type, "label": "X", "actor": "A", "detail": "", "tone": "neutral"}]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["type"] == good_type

    @pytest.mark.parametrize("good_tone", ["good", "warn", "bad", "brand", "neutral"])
    def test_all_documented_tones_pass_through(self, good_tone: str) -> None:
        rows = [{"ts": "2024-03-08T06:00", "event_type": "note", "label": "X", "actor": "A", "detail": "", "tone": good_tone}]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["tone"] == good_tone

    @pytest.mark.parametrize("good_source", ["SAP", "LIMS", "TRACE", "MANUAL"])
    def test_all_documented_source_systems_pass_through(self, good_source: str) -> None:
        rows = [{"ts": "2024-03-08T06:00", "event_type": "note", "label": "X", "actor": "A", "detail": "", "tone": "neutral", "source_system": good_source}]
        result = map_investigation_timeline_rows(rows)
        assert result["events"][0]["sourceSystem"] == good_source


# ===========================================================================
# Generated-contract round-trip — pins the wire shape against
# apps/api/contracts/generated.py so a future mapper or schema change
# cannot silently emit an unmodeled key.
# ===========================================================================


class TestPassportValidatesAgainstGeneratedContract:
    """The existing TestBuildBatchQualityPassport class asserts on the
    dict shape directly. This class adds the missing step: the dict must
    also round-trip through the generated Pydantic ``BatchQualityPassport``
    model — every nested type is ``extra='forbid'`` so a leak of an
    unmodeled key (e.g. ``released`` / ``recallRecommended``) surfaces here
    rather than reaching the wire."""

    def test_happy_path_passport_validates(self) -> None:
        from contracts.generated import BatchQualityPassport

        result = build_batch_quality_passport(
            identity_rows=[_identity_row()],
            coa_rows=[_coa_row()],
            lot_rows=[_lot_row()],
            summary_rows=[_summary_row()],
            balance_rows=[_balance_row()],
        )
        assert result is not None
        # `_unverifiedSections` is an internal mapper marker (not modelled
        # by the contract); drop it before validating the wire payload.
        result.pop("_unverifiedSections", None)
        BatchQualityPassport.model_validate(result)

    def test_empty_subqueries_still_validate(self) -> None:
        """No CoA rows, no lots, no summary, no balance — the resulting
        passport must still validate; missing optional evidence MUST NOT
        invent a field outside the contract."""
        from contracts.generated import BatchQualityPassport

        result = build_batch_quality_passport(
            identity_rows=[_identity_row()],
            coa_rows=[],
            lot_rows=[],
            summary_rows=[],
            balance_rows=[],
        )
        assert result is not None
        result.pop("_unverifiedSections", None)
        BatchQualityPassport.model_validate(result)


class TestTimelineValidatesAgainstGeneratedContract:
    """Same generated-contract round-trip for ``InvestigationTimeline``."""

    def test_mixed_events_validate(self) -> None:
        from contracts.generated import InvestigationTimeline

        rows = [
            {"ts": "2024-03-08T06:00", "event_type": "production", "label": "M-101", "actor": "SAP",  "detail": "100.0 KG", "tone": "good",   "source_system": "SAP"},
            {"ts": "2024-03-09T06:00", "event_type": "qc",         "label": "LOT-1", "actor": "Lab",  "detail": "passed",   "tone": "good",   "source_system": "LIMS"},
            {"ts": "2024-03-10T06:00", "event_type": "dispatch",   "label": "DEL-1", "actor": "SAP",  "detail": "50.0 KG",  "tone": "brand",  "source_system": "SAP"},
        ]
        result = map_investigation_timeline_rows(rows)
        InvestigationTimeline.model_validate(result)

    def test_empty_timeline_validates(self) -> None:
        """An empty timeline is NOT a 404 and NOT 'no issue found' — it's
        explicit absence of evidence. It must still validate against the
        contract."""
        from contracts.generated import InvestigationTimeline

        result = map_investigation_timeline_rows([])
        InvestigationTimeline.model_validate(result)


class TestTimelineMissingTimestampSurfacesExplicitly:
    """Existing tests cover unknown / blank label, actor, type, tone, and
    source_system. The timestamp branch was untested. The mapper must NOT
    drop the event or invent a timestamp — missing ``ts`` is preserved as
    an empty string so the UI can render the absence verbatim."""

    def test_blank_timestamp_preserves_event_with_empty_ts(self) -> None:
        rows = [
            {"ts": "",   "event_type": "note", "label": "X", "actor": "A", "detail": "", "tone": "neutral"},
            {"ts": None, "event_type": "note", "label": "Y", "actor": "B", "detail": "", "tone": "neutral"},
        ]
        result = map_investigation_timeline_rows(rows)
        assert len(result["events"]) == 2
        for ev in result["events"]:
            assert ev["ts"] == ""


# ===========================================================================
# map_mass_balance_ledger_rows — source-truthful mapper hardening (PR 7)
# ===========================================================================


def _mb_row(**overrides) -> dict:
    """One row from gold_batch_mass_balance_v (verified MSEG view).
    Quantity carries the natural sign (positive for receipts, negative
    for issues/dispatches). MOVEMENT_CATEGORY direction semantics are
    unresolved; the mapper buckets purely on movement_type code.
    """
    base = {
        "movement_type": "101",
        "movement_category": "production",
        "quantity": 1000.0,
        "balance_qty": 1000.0,
        "uom": "KG",
        "posting_date": "2024-03-08",
    }
    base.update(overrides)
    return base


class TestMapMassBalanceLedgerRows:
    """Direct mapper hardening for map_mass_balance_ledger_rows.

    Pin the source-truthful semantics required by the PR 7 brief:
      - movement quantities preserve sign
      - UOM comes from source or empty string (no KG default)
      - bucket codes derived from MOVEMENT_TYPE only
      - reconciliationSource stays application-heuristic
      - no invented recall / approved / released / safe claims
      - empty input returns None (caller returns 404)
    """

    # --- happy path --------------------------------------------------------

    def test_empty_rows_returns_none(self) -> None:
        """Caller relies on None to return 404 with the 'do not interpret as
        zero ledger' message."""
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        assert map_mass_balance_ledger_rows([]) is None

    def test_happy_path_validates_against_generated_contract(self) -> None:
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        from contracts.generated import MassBalanceLedger

        rows = [
            _mb_row(),
            _mb_row(movement_type="261", quantity=-200.0, balance_qty=800.0, posting_date="2024-03-09"),
            _mb_row(movement_type="601", quantity=-300.0, balance_qty=500.0, posting_date="2024-03-10"),
        ]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        MassBalanceLedger.model_validate(result)

    # --- sign preservation -------------------------------------------------

    def test_negative_consumption_kept_negative(self) -> None:
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row(movement_type="261", quantity=-150.0)]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        assert result["events"][0]["delta"] == -150.0
        assert result["kpi"]["consumed"] == -150.0

    def test_negative_dispatch_kept_negative(self) -> None:
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row(movement_type="601", quantity=-300.0)]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        assert result["events"][0]["delta"] == -300.0
        assert result["kpi"]["shipped"] == -300.0

    def test_positive_production_kept_positive(self) -> None:
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row(movement_type="101", quantity=1000.0)]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        assert result["events"][0]["delta"] == 1000.0
        assert result["kpi"]["produced"] == 1000.0

    # --- UOM source-truth --------------------------------------------------

    def test_uom_echoes_source_value(self) -> None:
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row(uom="L")]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        assert result["kpi"]["uom"] == "L"

    def test_uom_is_null_when_source_null(self) -> None:
        """The MassBalanceKpi contract was relaxed to `z.string().nullable()`,
        so the mapper now emits `null` for an unavailable UOM rather than
        the misleading empty-string sentinel. Never 'KG'."""
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row(uom=None)]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        assert result["kpi"]["uom"] is None
        assert result["kpi"]["uom"] != "KG"
        assert result["kpi"]["uom"] != ""

    def test_uom_is_null_when_source_empty_string(self) -> None:
        """A source row with `uom: ''` is operationally the same as null —
        emit null, not empty string."""
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row(uom="")]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        assert result["kpi"]["uom"] is None

    def test_uom_not_defaulted_to_kg_for_unfamiliar_uom(self) -> None:
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row(uom="LB"), _mb_row(uom=None)]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        # First non-null UOM wins; remaining rows do not promote anything to KG.
        assert result["kpi"]["uom"] == "LB"

    # --- movement-type bucketing ------------------------------------------

    def test_unknown_movement_type_buckets_to_z01(self) -> None:
        """Movement types outside the known {101/102/131, 261/262,
        601/602, 701/702/711/712} sets fall into 'Z01' — they MUST NOT
        be silently classified as production/consumption/dispatch."""
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row(movement_type="999", quantity=50.0)]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        assert result["events"][0]["code"] == "Z01"
        # And the KPI buckets stay zero for the known categories.
        assert result["kpi"]["produced"] == 0
        assert result["kpi"]["consumed"] == 0
        assert result["kpi"]["shipped"] == 0
        assert result["kpi"]["adjusted"] == 0

    def test_movement_type_none_buckets_to_z01(self) -> None:
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row(movement_type=None, quantity=50.0)]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        assert result["events"][0]["code"] == "Z01"

    def test_postings_counts_match_per_bucket_events(self) -> None:
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [
            _mb_row(movement_type="101", quantity=100.0),
            _mb_row(movement_type="101", quantity=200.0),
            _mb_row(movement_type="261", quantity=-50.0),
            _mb_row(movement_type="601", quantity=-30.0),
            _mb_row(movement_type="701", quantity=10.0),
        ]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        postings = result["kpi"]["postings"]
        assert postings["production"] == 2
        assert postings["consumption"] == 1
        assert postings["dispatch"] == 1
        assert postings["adjustment"] == 1

    # --- variance / reconciliation ----------------------------------------

    def test_reconciliation_source_stays_application_heuristic(self) -> None:
        """The variance formula and BALANCE_QTY semantics are not yet
        governed. reconciliationSource MUST stay 'application-heuristic'
        until a governance source lands. UI must surface the caveat."""
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row()]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        assert result["reconciliationSource"] == "application-heuristic"

    def test_variance_is_not_zero_when_postings_dont_close(self) -> None:
        """Unexplained variance MUST surface as a non-zero value, not be
        hidden behind a zero default. variance = produced + adjusted +
        consumed + shipped - current. With produced=100, current=50,
        variance should be 50 (not zero)."""
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row(movement_type="101", quantity=100.0, balance_qty=50.0)]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        assert result["kpi"]["variance"] == 50.0

    def test_variance_zero_only_when_postings_genuinely_close(self) -> None:
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [
            _mb_row(movement_type="101", quantity=100.0, balance_qty=100.0),
            _mb_row(movement_type="261", quantity=-30.0, balance_qty=70.0),
            _mb_row(movement_type="601", quantity=-20.0, balance_qty=50.0),
        ]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        # produced(100) + consumed(-30) + shipped(-20) - current(50) = 0
        assert result["kpi"]["variance"] == 0

    # --- no unsafe claims --------------------------------------------------

    def test_no_invented_release_or_safety_fields(self) -> None:
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row()]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        for forbidden in ("safe", "approved", "released", "cleared",
                          "recallRecommended", "reconciled"):
            assert forbidden not in result
            assert forbidden not in result["kpi"]

    def test_event_does_not_carry_release_status_keys(self) -> None:
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row(), _mb_row(movement_type="601", quantity=-100.0)]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        for event in result["events"]:
            for forbidden in ("status", "safe", "approved", "released"):
                assert forbidden not in event

    # --- missing optional source fields -----------------------------------

    def test_missing_posting_date_yields_empty_string_not_dropped(self) -> None:
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row(posting_date=None)]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        assert len(result["events"]) == 1
        assert result["events"][0]["date"] == ""

    def test_null_quantity_treated_as_zero_not_dropped(self) -> None:
        """A missing quantity row must surface as a zero-delta event, not
        be silently dropped — the chronology must stay intact."""
        from adapters.trace2.trace2_databricks_adapter import map_mass_balance_ledger_rows
        rows = [_mb_row(quantity=None)]
        result = map_mass_balance_ledger_rows(rows)
        assert result is not None
        assert len(result["events"]) == 1
        assert result["events"][0]["delta"] == 0


# ===========================================================================
# map_customer_delivery_rows — source-truthful mapper hardening (PR 7)
# ===========================================================================


def _cd_row(**overrides) -> dict:
    """One row from gold_batch_delivery_v (verified V1-parity delivery view)."""
    base = {
        "delivery": "DEL-001",
        "customer_id": "CUST-001",
        "customer_name": "Kerry Ingredients",
        "country_id": "IE",
        "city": "Dublin",
        "abs_quantity": 500.0,
        "uom": "KG",
        "posting_date": "2024-03-10",
    }
    base.update(overrides)
    return base


class TestMapCustomerDeliveryRows:
    """Direct mapper hardening for map_customer_delivery_rows.

    Pin source-truthful semantics:
      - empty rows return None (caller must 404, not 'no issue found')
      - delivery and customer IDs are counted accurately
      - shipped quantity is aggregated correctly
      - countries are distinct and sorted
      - UOM comes from source row, is never invented
      - recallRecommended is always None (no governed recall source)
      - no delivered/safe/approved/received field is emitted
    """

    def test_empty_rows_returns_none(self) -> None:
        """Zero rows → None. Caller must return 404 with explicit
        'do not interpret as zero exposure' message. The mapper MUST NOT
        return an empty-dict result that the route could surface as clean."""
        assert map_customer_delivery_rows([]) is None

    def test_distinct_delivery_ids_counted(self) -> None:
        rows = [_cd_row(delivery="DEL-A"), _cd_row(delivery="DEL-B"), _cd_row(delivery="DEL-A")]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        assert result["affectedDeliveries"] == 2

    def test_distinct_customer_ids_counted(self) -> None:
        rows = [_cd_row(customer_id="C1"), _cd_row(customer_id="C2"), _cd_row(customer_id="C1")]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        assert result["affectedCustomers"] == 2

    def test_shipped_quantity_aggregated(self) -> None:
        rows = [_cd_row(abs_quantity=300.0), _cd_row(abs_quantity=200.0)]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        assert result["shippedQuantity"] == 500.0

    def test_null_quantity_excluded_from_sum(self) -> None:
        rows = [_cd_row(abs_quantity=400.0), _cd_row(abs_quantity=None)]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        assert result["shippedQuantity"] == 400.0

    def test_countries_collected_and_sorted(self) -> None:
        rows = [_cd_row(country_id="IE"), _cd_row(country_id="DE"), _cd_row(country_id="IE")]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        assert result["countries"] == ["DE", "IE"]

    def test_null_country_id_excluded(self) -> None:
        rows = [_cd_row(country_id=None), _cd_row(country_id="GB")]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        assert result["countries"] == ["GB"]

    def test_null_delivery_id_excluded_from_count(self) -> None:
        """A NULL delivery ID in source is not a countable delivery —
        it should not inflate affectedDeliveries."""
        rows = [_cd_row(delivery=None), _cd_row(delivery="DEL-001")]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        assert result["affectedDeliveries"] == 1

    def test_null_customer_id_excluded_from_count(self) -> None:
        rows = [_cd_row(customer_id=None), _cd_row(customer_id="CUST-001")]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        assert result["affectedCustomers"] == 1

    def test_uom_taken_from_first_non_null_row(self) -> None:
        rows = [_cd_row(uom=None), _cd_row(uom="KG"), _cd_row(uom="T")]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        # First non-null uom is 'KG' — mapper takes it for consistency.
        assert result.get("uom") == "KG"

    def test_all_null_uom_does_not_invent_default(self) -> None:
        """If no row has a UOM, the uom key must be absent — never
        defaulted to 'KG' or 'EA'."""
        rows = [_cd_row(uom=None), _cd_row(uom=None)]
        result = map_customer_delivery_rows(rows)
        assert result is not None
        assert "uom" not in result

    def test_recall_recommended_is_always_none(self) -> None:
        """recallRecommended MUST be None — no governed recall-rule source
        exists. Both True and False would constitute a safety claim or
        safety assurance without a governed engine."""
        result = map_customer_delivery_rows([_cd_row()])
        assert result is not None
        assert result["recallRecommended"] is None
        assert result["recallRecommended"] is not False

    def test_no_delivered_received_safe_approved_field(self) -> None:
        """The presence of a delivery row is NOT a 'delivered' confirmation.
        No invented lifecycle, safety, or approval field may appear."""
        result = map_customer_delivery_rows([_cd_row()])
        assert result is not None
        for forbidden in ("delivered", "received", "safe", "approved", "released", "cleared"):
            assert forbidden not in result

    def test_delivery_evidence_source_is_inventory_movements(self) -> None:
        """deliveryEvidenceSource distinguishes this V1-parity direct-delivery
        path from the lineage-based customer-exposure path."""
        result = map_customer_delivery_rows([_cd_row()])
        assert result is not None
        assert result["deliveryEvidenceSource"] == "inventory-movements"

    def test_blocked_deliveries_is_zero_no_source(self) -> None:
        """blockedDeliveries = 0 because no confirmed blocked-status column
        exists in gold_batch_delivery_v. This is documented governance-pending,
        not an inferred 'no blocks' assurance."""
        result = map_customer_delivery_rows([_cd_row()])
        assert result is not None
        assert result["blockedDeliveries"] == 0

    def test_highest_severity_is_medium_preliminary(self) -> None:
        """highestSeverity = 'medium' as a preliminary placeholder while
        severity business rules are not yet defined for V2. Pin so a
        regression to 'low' (false reassurance) is caught."""
        result = map_customer_delivery_rows([_cd_row()])
        assert result is not None
        assert result["highestSeverity"] == "medium"


# ---------------------------------------------------------------------------
# Supplier exposure mapper tests (PR 8 — spec §8 / source-truth guardrails)
# ---------------------------------------------------------------------------


def _se_row(**overrides) -> dict:
    """Minimal supplier exposure row matching aggregated SQL output shape."""
    base = {
        "supplier_id": "SUPP-001",
        "supplier_name": "Kerry Ingredients Ltd",
        "country_id": "IE",
        "country_name": "Ireland",
        "received_quantity": 1000.0,
        "receipt_count": 2,
        "upstream_material_count": 1,
        "uom": "KG",
        "last_receipt_date": "2024-03-08",
    }
    base.update(overrides)
    return base


class TestMapSupplierExposureRows:
    """map_supplier_exposure_rows — source-truthful guardrails (PR 8)."""

    def test_empty_rows_returns_zero_supplier_summary_not_none(self) -> None:
        """Empty rows → zero-supplier summary dict, not None.
        Distinct from customer-exposure None: a production-only batch
        genuinely has zero supplier inputs."""
        result = map_supplier_exposure_rows([])
        assert result is not None
        assert isinstance(result, dict)
        assert result["supplierCount"] == 0
        assert result["supplierLots"] == 0
        assert result["upstreamMaterials"] == 0
        assert result["suppliers"] == []

    def test_empty_open_supplier_actions_is_zero_not_invented(self) -> None:
        """openSupplierActions MUST be 0 (no QM source). Not defaulted from
        evidence, not invented — pinned per TRACE-P1-012."""
        result = map_supplier_exposure_rows([_se_row()])
        assert result["openSupplierActions"] == 0

    def test_supplier_id_preserved(self) -> None:
        result = map_supplier_exposure_rows([_se_row(supplier_id="SUPP-XYZ")])
        assert result["suppliers"][0]["supplierId"] == "SUPP-XYZ"

    def test_supplier_name_preserved_when_present(self) -> None:
        result = map_supplier_exposure_rows([_se_row(supplier_name="Acme Ingredients")])
        assert result["suppliers"][0]["supplierName"] == "Acme Ingredients"

    def test_supplier_name_absent_when_null(self) -> None:
        result = map_supplier_exposure_rows([_se_row(supplier_name=None)])
        assert "supplierName" not in result["suppliers"][0]

    def test_country_id_preserved_when_present(self) -> None:
        result = map_supplier_exposure_rows([_se_row(country_id="DE")])
        assert result["suppliers"][0]["countryId"] == "DE"

    def test_country_id_absent_when_null(self) -> None:
        result = map_supplier_exposure_rows([_se_row(country_id=None)])
        assert "countryId" not in result["suppliers"][0]

    def test_received_quantity_preserved(self) -> None:
        result = map_supplier_exposure_rows([_se_row(received_quantity=500.0)])
        assert result["suppliers"][0]["receivedQuantity"] == 500.0

    def test_uom_preserved_when_present(self) -> None:
        result = map_supplier_exposure_rows([_se_row(uom="KG")])
        assert result["suppliers"][0]["uom"] == "KG"

    def test_uom_absent_when_null(self) -> None:
        result = map_supplier_exposure_rows([_se_row(uom=None)])
        assert "uom" not in result["suppliers"][0]

    def test_uom_not_defaulted_to_kg_or_ea(self) -> None:
        """UOM must come from source. Null → absent. NEVER default to KG/EA."""
        result = map_supplier_exposure_rows([_se_row(uom=None)])
        supplier = result["suppliers"][0]
        assert supplier.get("uom") not in ("KG", "EA", "kg", "ea")

    def test_supplier_count_matches_distinct_valid_suppliers(self) -> None:
        rows = [_se_row(supplier_id="S1"), _se_row(supplier_id="S2")]
        result = map_supplier_exposure_rows(rows)
        assert result["supplierCount"] == 2
        assert len(result["suppliers"]) == 2

    def test_null_supplier_id_row_is_dropped(self) -> None:
        """A row without supplier_id is not valid supplier evidence."""
        rows = [
            _se_row(supplier_id=None),
            _se_row(supplier_id=""),
            _se_row(supplier_id="SUPP-OK"),
        ]
        result = map_supplier_exposure_rows(rows)
        assert result["supplierCount"] == 1
        assert result["suppliers"][0]["supplierId"] == "SUPP-OK"

    def test_no_risk_field_in_summary(self) -> None:
        """supplierRisk / risk MUST NOT appear in the supplier exposure summary —
        no governed risk source exists (TRACE-P1-012)."""
        result = map_supplier_exposure_rows([_se_row()])
        for forbidden in ("risk", "supplierRisk", "highestRisk"):
            assert forbidden not in result

    def test_no_risk_field_in_supplier_detail(self) -> None:
        """Individual supplier detail MUST NOT carry a risk field."""
        result = map_supplier_exposure_rows([_se_row()])
        supplier = result["suppliers"][0]
        for forbidden in ("risk", "supplierRisk", "cleared", "approved", "safe"):
            assert forbidden not in supplier

    def test_no_recall_recommended_field(self) -> None:
        result = map_supplier_exposure_rows([_se_row()])
        assert "recallRecommended" not in result

    def test_no_safe_approved_released_fields(self) -> None:
        result = map_supplier_exposure_rows([_se_row()])
        for forbidden in ("safe", "approved", "released", "cleared"):
            assert forbidden not in result

    def test_last_receipt_date_preserved_when_present(self) -> None:
        result = map_supplier_exposure_rows([_se_row(last_receipt_date="2024-03-08")])
        assert result["suppliers"][0]["lastReceiptDate"] == "2024-03-08"

    def test_last_receipt_date_absent_when_null(self) -> None:
        result = map_supplier_exposure_rows([_se_row(last_receipt_date=None)])
        assert "lastReceiptDate" not in result["suppliers"][0]

    def test_supplier_lots_aggregated_from_receipt_count(self) -> None:
        rows = [_se_row(receipt_count=3), _se_row(supplier_id="S2", receipt_count=2)]
        result = map_supplier_exposure_rows(rows)
        assert result["supplierLots"] == 5

    def test_upstream_materials_aggregated(self) -> None:
        rows = [
            _se_row(upstream_material_count=2),
            _se_row(supplier_id="S2", upstream_material_count=1),
        ]
        result = map_supplier_exposure_rows(rows)
        assert result["upstreamMaterials"] == 3


# ---------------------------------------------------------------------------
# Supplier batch view mapper tests (PR 8 — risk guardrail pinning)
# ---------------------------------------------------------------------------


def _consumed_row(**overrides) -> dict:
    """Minimal consumed lot row from gold_batch_lineage."""
    base = {
        "supplier_id": "SUPP-001",
        "vendor_batch": "VB-2024-001",
        "parent_material_id": "000000000020052009",
        "posting_date": "2024-03-08",
        "quantity": -500.0,
        "uom": "KG",
    }
    base.update(overrides)
    return base


def _sibling_row(**overrides) -> dict:
    """Minimal sibling batch row from cross-plant lineage query."""
    base = {
        "plant_id": "C061",
        "batch_id": "0008602411",
        "posting_date": "2024-03-08",
        "quantity": -300.0,
        "vendor_batch": "VB-2024-001",
    }
    base.update(overrides)
    return base


class TestMapSupplierBatchView:
    """map_supplier_batch_view — risk guardrail and source-truth pinning (PR 8)."""

    def test_empty_rows_returns_valid_empty_view(self) -> None:
        """Empty consumed/sibling lists → valid dict with empty arrays.
        A batch with no vendor receipts is a legitimate production-only batch."""
        result = map_supplier_batch_view([], [])
        assert isinstance(result, dict)
        assert result["consumedLots"] == []
        assert result["siblingBatches"] == []

    def test_risk_is_always_unknown_on_consumed_lots(self) -> None:
        """risk MUST be 'unknown' — no governed supplier-risk source wired yet.
        This is the primary guardrail: the field must be present but never
        optimistic (low/medium/high)."""
        result = map_supplier_batch_view([_consumed_row()], [])
        assert result["consumedLots"][0]["risk"] == "unknown"

    def test_risk_unknown_for_multiple_consumed_lots(self) -> None:
        rows = [_consumed_row(), _consumed_row(vendor_batch="VB-2024-002")]
        result = map_supplier_batch_view(rows, [])
        for lot in result["consumedLots"]:
            assert lot["risk"] == "unknown"

    def test_risk_never_low_without_governed_source(self) -> None:
        """Exhaustive check: no consumed lot may carry risk='low', 'medium',
        or 'high' until a governed source is wired."""
        rows = [_consumed_row(supplier_id=f"S{i}") for i in range(5)]
        result = map_supplier_batch_view(rows, [])
        for lot in result["consumedLots"]:
            assert lot["risk"] not in ("low", "medium", "high")

    def test_coa_is_none_not_invented(self) -> None:
        """CoA reference not on gold_batch_lineage — must be None, not empty
        string or a default value."""
        result = map_supplier_batch_view([_consumed_row()], [])
        assert result["consumedLots"][0]["coa"] is None

    def test_vendor_preserved_from_supplier_id_when_no_lookup(self) -> None:
        result = map_supplier_batch_view([_consumed_row(supplier_id="SUPP-ABC")], [])
        assert result["consumedLots"][0]["vendor"] == "SUPP-ABC"

    def test_vendor_name_from_lookup_when_provided(self) -> None:
        lookup = {"SUPP-001": "Kerry Ingredients Ltd"}
        result = map_supplier_batch_view([_consumed_row()], [], vendor_name_lookup=lookup)
        assert result["consumedLots"][0]["vendor"] == "Kerry Ingredients Ltd"

    def test_vendor_batch_preserved(self) -> None:
        result = map_supplier_batch_view([_consumed_row(vendor_batch="VB-PINNED")], [])
        assert result["consumedLots"][0]["vendorBatch"] == "VB-PINNED"

    def test_material_preserved(self) -> None:
        result = map_supplier_batch_view(
            [_consumed_row(parent_material_id="000000000020582002")], []
        )
        assert result["consumedLots"][0]["material"] == "000000000020582002"

    def test_consumed_quantity_is_absolute_value(self) -> None:
        """Quantities from lineage edges are negative (CHILD perspective).
        The mapper must abs() them so the UI sees positive consumed amounts."""
        result = map_supplier_batch_view([_consumed_row(quantity=-400.0)], [])
        assert result["consumedLots"][0]["consumed"] == 400.0

    def test_uom_preserved_from_source(self) -> None:
        result = map_supplier_batch_view([_consumed_row(uom="MT")], [])
        assert result["consumedLots"][0]["uom"] == "MT"

    def test_no_recall_or_safety_fields_on_consumed_lot(self) -> None:
        result = map_supplier_batch_view([_consumed_row()], [])
        lot = result["consumedLots"][0]
        for forbidden in ("recallRecommended", "safe", "approved", "released",
                          "cleared", "signoff"):
            assert forbidden not in lot

    def test_no_recall_or_safety_fields_on_view(self) -> None:
        result = map_supplier_batch_view([_consumed_row()], [_sibling_row()])
        for forbidden in ("recallRecommended", "safe", "approved", "released",
                          "cleared", "signoff"):
            assert forbidden not in result

    def test_sibling_batch_id_preserved(self) -> None:
        result = map_supplier_batch_view([], [_sibling_row(batch_id="SIB-BATCH-001")])
        assert result["siblingBatches"][0]["batchId"] == "SIB-BATCH-001"

    def test_sibling_plant_id_preserved(self) -> None:
        result = map_supplier_batch_view([], [_sibling_row(plant_id="C351")])
        assert result["siblingBatches"][0]["plantId"] == "C351"

    def test_sibling_qty_is_absolute_value(self) -> None:
        result = map_supplier_batch_view([], [_sibling_row(quantity=-200.0)])
        assert result["siblingBatches"][0]["qty"] == 200.0

    def test_sibling_vendor_batch_preserved(self) -> None:
        result = map_supplier_batch_view([], [_sibling_row(vendor_batch="VB-SIB-999")])
        assert result["siblingBatches"][0]["vendorBatch"] == "VB-SIB-999"

    def test_multiple_consumed_and_siblings(self) -> None:
        consumed = [_consumed_row(), _consumed_row(vendor_batch="VB-2")]
        siblings = [_sibling_row(), _sibling_row(batch_id="SIB-2")]
        result = map_supplier_batch_view(consumed, siblings)
        assert len(result["consumedLots"]) == 2
        assert len(result["siblingBatches"]) == 2
