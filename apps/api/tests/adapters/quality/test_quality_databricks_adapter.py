import pytest
from adapters.quality.quality_databricks_adapter import (
    UD_LABELS,
    QualityUsageDecisionEvidence,
    QualityUsageDecisionQuerySpec,
    QualityUsageDecisionRepository,
    get_quality_usage_decision_spec,
    map_quality_usage_decision_rows,
)
from shared.query_service.identity import UserIdentity
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_executor import DatabricksRepository


@pytest.fixture(autouse=True)
def setup_env(monkeypatch):
    monkeypatch.setenv("CQ_CATALOG", "test_catalog")
    monkeypatch.setenv("CQ_SCHEMA", "test_schema")
    monkeypatch.setenv(
        "DATABRICKS_ALLOWED_CATALOGS",
        "test_catalog,env_catalog,override_catalog,repo_catalog",
    )

def test_get_quality_usage_decision_spec():
    spec = get_quality_usage_decision_spec(material_id="123", batch_id="456", plant_id="P1")
    assert isinstance(spec, QualityUsageDecisionQuerySpec)
    assert spec.material_id == "123"
    assert spec.batch_id == "456"
    assert spec.plant_id == "P1"
    assert "udr.MATERIAL_ID = :material_id" in spec.sql
    assert "udr.BATCH_ID = :batch_id" in spec.sql
    assert "udr.PLANT_ID = :plant_id" in spec.sql


def test_no_plant_id_param_when_not_provided():
    spec = get_quality_usage_decision_spec(material_id="123", batch_id="456")
    assert "plant_id" not in spec.params


def test_no_plant_filter_in_sql_when_not_provided():
    spec = get_quality_usage_decision_spec(material_id="123", batch_id="456")
    assert ":plant_id" not in spec.sql


def test_plant_id_included_in_params_when_provided():
    spec = get_quality_usage_decision_spec(material_id="123", batch_id="456", plant_id="P1")
    assert spec.params["plant_id"] == "P1"


class _FakeExecutor:
    def __init__(self, rows: list[dict] | None = None, error: Exception | None = None) -> None:
        self.rows = rows or []
        self.error = error
        self.sql_seen: str | None = None

    async def execute(self, spec, identity):
        self.sql_seen = spec.sql
        if self.error:
            raise self.error
        return self.rows


async def test_quality_repository_executes_and_maps_usage_decision(monkeypatch):
    monkeypatch.setenv("CQ_CATALOG", "repo_catalog")
    monkeypatch.setenv("CQ_SCHEMA", "repo_schema")
    executor = _FakeExecutor(
        rows=[
            {
                "INSPECTION_LOT_ID": "LOT-100",
                "USAGE_DECISION_CODE": "A",
                "MATERIAL_ID": "MAT1",
                "BATCH_ID": "BATCH1",
            }
        ]
    )
    repository = QualityUsageDecisionRepository(
        DatabricksRepository(
            executor=executor,
            identity=UserIdentity(user_id="u001", raw_oauth_token="tok"),
        )
    )

    evidence, spec = await repository.fetch_usage_decision_evidence(
        material_id="MAT1",
        batch_id="BATCH1",
        plant_id=None,
        queried_at="2026-05-25T00:00:00Z",
    )

    assert isinstance(evidence, QualityUsageDecisionEvidence)
    assert isinstance(spec, QualityUsageDecisionQuerySpec)
    assert evidence.inspection_lots[0].inspection_lot_id == "LOT-100"
    assert evidence.summary.inspection_lot_count == 1
    assert "`repo_catalog`.`repo_schema`.`gold_inspection_usage_decision`" in executor.sql_seen


async def test_quality_repository_applies_catalog_override_without_leaking(monkeypatch):
    monkeypatch.setenv("CQ_CATALOG", "env_catalog")
    monkeypatch.setenv("CQ_SCHEMA", "gold")
    executor = _FakeExecutor(rows=[])
    repository = QualityUsageDecisionRepository(
        DatabricksRepository(
            executor=executor,
            identity=UserIdentity(
                user_id="u001",
                raw_oauth_token="tok",
                catalog_target="override_catalog",
            ),
        )
    )

    await repository.fetch_usage_decision_evidence(
        material_id="MAT1",
        batch_id="BATCH1",
        plant_id=None,
        queried_at="2026-05-25T00:00:00Z",
    )

    assert "`override_catalog`.`gold`.`gold_inspection_usage_decision`" in executor.sql_seen
    assert "`env_catalog`.`gold`.`gold_inspection_usage_decision`" in resolve_domain_object(
        "cq",
        "gold_inspection_usage_decision",
    )


async def test_quality_repository_resets_catalog_override_after_error(monkeypatch):
    monkeypatch.setenv("CQ_CATALOG", "env_catalog")
    monkeypatch.setenv("CQ_SCHEMA", "gold")
    executor = _FakeExecutor(error=RuntimeError("query failed"))
    repository = QualityUsageDecisionRepository(
        DatabricksRepository(
            executor=executor,
            identity=UserIdentity(
                user_id="u001",
                raw_oauth_token="tok",
                catalog_target="override_catalog",
            ),
        )
    )

    with pytest.raises(RuntimeError, match="query failed"):
        await repository.fetch_usage_decision_evidence(
            material_id="MAT1",
            batch_id="BATCH1",
            plant_id=None,
            queried_at="2026-05-25T00:00:00Z",
        )

    assert "`env_catalog`.`gold`.`gold_inspection_usage_decision`" in resolve_domain_object(
        "cq",
        "gold_inspection_usage_decision",
    )

def test_map_quality_usage_decision_rows_empty():
    lots, summary = map_quality_usage_decision_rows([], "2026-05-22T00:00:00Z")
    assert len(lots) == 0
    assert summary.status == "no-records"
    assert summary.usage_decision_status == "not-found"
    assert summary.inspection_lot_count == 0
    assert summary.missing_lot_warning is not None
    assert summary.multiple_lots_warning is None

def test_map_quality_usage_decision_rows_single_lot():
    rows = [
        {
            "INSPECTION_LOT_ID": "100",
            "USAGE_DECISION_CODE": "A",
            "USAGE_DECISION_CREATED_DATE": "2026-05-22T00:00:00Z",
            "MATERIAL_ID": "123",
            "BATCH_ID": "456",
            "PLANT_ID": "P1",
            "PROCESS_ORDER_ID": "789"
        }
    ]
    lots, summary = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
    assert len(lots) == 1
    assert lots[0].inspection_lot_id == "100"
    assert lots[0].usage_decision_code == "A"
    assert lots[0].usage_decision_text == "Accepted"
    assert lots[0].usage_decision_created_at == "2026-05-22T00:00:00Z"

    assert summary.status == "loaded"
    assert summary.usage_decision_status == "source-present"
    assert summary.inspection_lot_count == 1
    assert summary.multiple_lots_warning is None

def test_map_quality_usage_decision_rows_multiple_lots():
    rows = [
        {
            "INSPECTION_LOT_ID": "100",
            "USAGE_DECISION_CODE": "R",
        },
        {
            "INSPECTION_LOT_ID": "101",
            "USAGE_DECISION_CODE": "A",
        }
    ]
    lots, summary = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
    assert len(lots) == 2
    assert lots[0].usage_decision_code == "R"
    assert lots[0].usage_decision_text == "Rejected"
    assert lots[1].usage_decision_code == "A"
    assert lots[1].usage_decision_text == "Accepted"

    assert summary.inspection_lot_count == 2
    assert summary.multiple_lots_warning is not None
    assert "Multiple inspection lots found" in summary.multiple_lots_warning

def test_map_quality_usage_decision_rows_empty_string_code():
    rows = [
        {
            "INSPECTION_LOT_ID": "102",
            "USAGE_DECISION_CODE": "",
        },
        {
            "INSPECTION_LOT_ID": "103",
            "USAGE_DECISION_CODE": None,
        }
    ]
    lots, summary = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
    assert len(lots) == 2
    assert lots[0].usage_decision_code == ""
    assert lots[0].usage_decision_text == "Pending — lot open, stock in QI, no decision taken"

    assert lots[1].usage_decision_code == ""
    assert lots[1].usage_decision_text == "Pending — lot open, stock in QI, no decision taken"


# ---------------------------------------------------------------------------
# Governed UD code coverage (spec §6.2)
# ---------------------------------------------------------------------------


_EXPECTED_UD_LABELS = {
    "A":   ("Accepted",                                            "verified"),
    "AE":  ("Accepted (variant / EM)",                             "verified"),
    "AC":  ("Accepted with concession",                            "verified"),
    "ACE": ("Accepted with concession (variant / EM)",             "verified"),
    "A9":  ("Accepted — batch restricted",                         "verified"),
    "R":   ("Rejected",                                            "verified"),
    "RE":  ("Rejected (variant / EM)",                             "verified"),
    "RR":  ("Rejected — batch restricted globally",                "verified"),
    "":    ("Pending — lot open, stock in QI, no decision taken",  "not-mapped"),
}


@pytest.mark.parametrize("code,expected_label,expected_status", [
    (code, label, status) for code, (label, status) in _EXPECTED_UD_LABELS.items()
])
def test_all_governed_ud_codes_map_to_expected_label_and_status(code, expected_label, expected_status):
    """All 9 governed UD codes from the spec must map deterministically:
    text comes from the backend UD_LABELS dictionary, mappingStatus reflects
    the spec §7 taxonomy."""
    rows = [{"INSPECTION_LOT_ID": "LOT-1", "USAGE_DECISION_CODE": code}]
    lots, _ = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
    assert len(lots) == 1
    assert lots[0].usage_decision_text == expected_label
    assert lots[0].usage_decision_mapping_status == expected_status


def test_ud_labels_dictionary_matches_spec():
    """UD_LABELS is the backend's source-of-truth dictionary — the front
    end MUST NOT derive labels locally. Pin the dictionary content."""
    assert UD_LABELS == {
        "A":   "Accepted",
        "AE":  "Accepted (variant / EM)",
        "AC":  "Accepted with concession",
        "ACE": "Accepted with concession (variant / EM)",
        "A9":  "Accepted — batch restricted",
        "R":   "Rejected",
        "RE":  "Rejected (variant / EM)",
        "RR":  "Rejected — batch restricted globally",
        "":    "Pending — lot open, stock in QI, no decision taken",
    }


# ---------------------------------------------------------------------------
# Mapping-status taxonomy (spec §7)
# ---------------------------------------------------------------------------


class TestUsageDecisionMappingStatusTaxonomy:
    """Confirms every branch of `usageDecisionMappingStatus` per the spec:

      verified    — code matched UD_LABELS
      unverified  — code present but absent from UD_LABELS
      not-mapped  — UD code is NULL / empty
      unavailable — no UD record returned (route-level, not mapper)
      source-only — raw passthrough (route-level, not mapper)
    """

    def test_known_governed_code_yields_verified(self):
        rows = [{"INSPECTION_LOT_ID": "L1", "USAGE_DECISION_CODE": "A"}]
        lots, _ = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
        assert lots[0].usage_decision_mapping_status == "verified"

    def test_unknown_code_yields_unverified_and_unknown_label(self):
        """An unrecognised code must NOT default to 'verified'. It is
        evidence-present-but-ungoverned — spec §7 mandates 'unverified'.
        The label must read 'Unknown (X)' so the UI can surface the
        caveat without inventing a meaning."""
        rows = [{"INSPECTION_LOT_ID": "L1", "USAGE_DECISION_CODE": "MYSTERY"}]
        lots, _ = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
        assert lots[0].usage_decision_mapping_status == "unverified"
        assert lots[0].usage_decision_text == "Unknown (MYSTERY)"
        # And the bare code is preserved (not relabelled to '' / 'A' / etc.).
        assert lots[0].usage_decision_code == "MYSTERY"

    def test_null_code_yields_not_mapped(self):
        """NULL USAGE_DECISION_CODE → 'not-mapped' (lot is in QI / pending).
        Must NOT be 'verified' just because the row was found."""
        rows = [{"INSPECTION_LOT_ID": "L1", "USAGE_DECISION_CODE": None}]
        lots, _ = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
        assert lots[0].usage_decision_mapping_status == "not-mapped"

    def test_empty_string_code_yields_not_mapped(self):
        """Empty string code → 'not-mapped' (same operational meaning as NULL)."""
        rows = [{"INSPECTION_LOT_ID": "L1", "USAGE_DECISION_CODE": ""}]
        lots, _ = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
        assert lots[0].usage_decision_mapping_status == "not-mapped"


# ---------------------------------------------------------------------------
# Option A — Strict Lot-Level Evidence (spec §1 / §3)
# ---------------------------------------------------------------------------


class TestOptionAStrictLotLevelEvidence:
    """QualityUsageDecisionEvidence must NEVER aggregate decisions across
    lots. Each row is a per-lot evidence record. A single batch-level
    release decision must NOT be inferred. multipleLotsWarning surfaces
    the ambiguity to the UI."""

    def test_multi_lot_returns_one_row_per_inspection_lot(self):
        """Two lots → two evidence rows. No 'winning lot', no aggregation."""
        rows = [
            {"INSPECTION_LOT_ID": "LOT-1", "USAGE_DECISION_CODE": "A",
             "MATERIAL_ID": "M1", "BATCH_ID": "B1"},
            {"INSPECTION_LOT_ID": "LOT-2", "USAGE_DECISION_CODE": "R",
             "MATERIAL_ID": "M1", "BATCH_ID": "B1"},
            {"INSPECTION_LOT_ID": "LOT-3", "USAGE_DECISION_CODE": "AC",
             "MATERIAL_ID": "M1", "BATCH_ID": "B1"},
        ]
        lots, summary = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
        assert len(lots) == 3
        ids = [lot.inspection_lot_id for lot in lots]
        assert ids == ["LOT-1", "LOT-2", "LOT-3"]
        # All lots map to their per-lot decision verbatim — no aggregation.
        assert lots[0].usage_decision_code == "A"
        assert lots[1].usage_decision_code == "R"
        assert lots[2].usage_decision_code == "AC"

    def test_multi_lot_preserves_warning(self):
        """When >1 lot is found, multipleLotsWarning MUST surface so the
        UI cannot silently collapse them into a batch-level decision."""
        rows = [
            {"INSPECTION_LOT_ID": "LOT-1", "USAGE_DECISION_CODE": "A"},
            {"INSPECTION_LOT_ID": "LOT-2", "USAGE_DECISION_CODE": "R"},
        ]
        _, summary = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
        assert summary.multiple_lots_warning is not None
        assert "Multiple inspection lots" in summary.multiple_lots_warning
        assert "single batch decision cannot be derived" in summary.multiple_lots_warning

    def test_rejected_lot_stays_as_lot_evidence_not_batch_recall(self):
        """A REJECTED lot is per-lot evidence. The mapper MUST NOT emit a
        batch-level recall recommendation, release status, or approval
        field. The contract does not even model such a field; this test
        pins the contract scope."""
        rows = [{"INSPECTION_LOT_ID": "LOT-R", "USAGE_DECISION_CODE": "R",
                 "MATERIAL_ID": "M1", "BATCH_ID": "B1"}]
        lots, summary = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
        lot = lots[0]
        # Lot-level evidence is preserved with verified governed label.
        assert lot.usage_decision_code == "R"
        assert lot.usage_decision_text == "Rejected"
        assert lot.usage_decision_mapping_status == "verified"
        # Summary MUST NOT carry batch-level recall / approval signals.
        dumped = summary.model_dump(by_alias=True)
        for forbidden in ("recallRecommended", "batchReleased", "batchApproved",
                          "approved", "safe", "released", "cleared"):
            assert forbidden not in dumped

    def test_lot_evidence_carries_no_batch_release_field(self):
        """QualityInspectionLotEvidence MUST NOT carry a batch-level
        release/approved/cleared/safe field. Contract enforces this; the
        test pins it so a future schema change can't quietly leak."""
        rows = [{"INSPECTION_LOT_ID": "LOT-1", "USAGE_DECISION_CODE": "A"}]
        lots, _ = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
        dumped = lots[0].model_dump(by_alias=True)
        for forbidden in ("batchReleased", "released", "approved", "cleared",
                          "safe", "recallRecommended", "signoff"):
            assert forbidden not in dumped


# ---------------------------------------------------------------------------
# QuerySpec — latest UD per lot via ROW_NUMBER ranking
# ---------------------------------------------------------------------------


class TestUsageDecisionQuerySpecRanking:
    """The QuerySpec partitions by INSPECTION_LOT_ID and ranks rows by
    (counter, created_date, updated_time) DESC so the mapper sees the
    LATEST usage decision per lot. The mapper itself does no ranking —
    it trusts rn=1 rows from the spec."""

    def test_sql_partitions_by_inspection_lot_id(self):
        spec = get_quality_usage_decision_spec(material_id="M1", batch_id="B1")
        assert "PARTITION BY ud.INSPECTION_LOT_ID" in spec.sql

    def test_sql_ranks_by_counter_then_dates_desc(self):
        spec = get_quality_usage_decision_spec(material_id="M1", batch_id="B1")
        assert "USAGE_DECISION_COUNTER" in spec.sql
        assert "USAGE_DECISION_CREATED_DATE DESC" in spec.sql
        assert "USAGE_DECISION_UPDATED_TIME DESC" in spec.sql
        # The outer WHERE keeps only the latest decision per lot.
        assert "udr.rn = 1" in spec.sql


# ---------------------------------------------------------------------------
# Source-truthful safety guardrails
# ---------------------------------------------------------------------------


class TestUsageDecisionEvidenceSourceTruth:
    def test_source_field_is_databricks_api(self):
        rows = [{"INSPECTION_LOT_ID": "LOT-1", "USAGE_DECISION_CODE": "A"}]
        lots, summary = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
        assert lots[0].source == "databricks-api"
        assert summary.source == "databricks-api"

    def test_rows_without_inspection_lot_id_are_dropped(self):
        """A row without INSPECTION_LOT_ID is not lot-level evidence and
        must NOT be silently promoted into the response."""
        rows = [
            {"INSPECTION_LOT_ID": None, "USAGE_DECISION_CODE": "A"},
            {"INSPECTION_LOT_ID": "", "USAGE_DECISION_CODE": "R"},
            {"INSPECTION_LOT_ID": "LOT-OK", "USAGE_DECISION_CODE": "A"},
        ]
        lots, summary = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
        assert len(lots) == 1
        assert lots[0].inspection_lot_id == "LOT-OK"
        assert summary.inspection_lot_count == 1

    def test_empty_rows_summary_uses_safe_unavailable_taxonomy(self):
        """No source rows = no decision. Status MUST be 'no-records' (or
        similar safe value) — NEVER 'loaded' / 'accepted' / 'released'."""
        _, summary = map_quality_usage_decision_rows([], "2026-05-22T00:00:00Z")
        assert summary.status == "no-records"
        # Field classifications use governance-safe terms.
        assert summary.usage_decision_status == "not-found"
        # Missing-lot warning is emitted so the UI cannot silently fall
        # back to a default.
        assert summary.missing_lot_warning is not None

    def test_known_code_label_is_supplied_by_backend_not_client(self):
        """usageDecisionText MUST come from UD_LABELS in this backend
        module, NOT be derivable from the code on the client. The test
        pins one example explicitly so client-side derivation is not
        introduced."""
        rows = [{"INSPECTION_LOT_ID": "LOT-1", "USAGE_DECISION_CODE": "A9"}]
        lots, _ = map_quality_usage_decision_rows(rows, "2026-05-22T00:00:00Z")
        assert lots[0].usage_decision_text == UD_LABELS["A9"]
        assert lots[0].usage_decision_text == "Accepted — batch restricted"


# ---------------------------------------------------------------------------
# Lot identifier preservation (spec §3)
# ---------------------------------------------------------------------------


class TestLotIdentifierPreservation:
    """Each lot evidence record must carry all source identifiers intact.
    These are the traceability anchors — dropping or defaulting any of them
    breaks the evidential chain from inspection lot back to batch and plant.
    """

    _FULL_ROW = {
        "INSPECTION_LOT_ID": "LOT-FULL",
        "USAGE_DECISION_CODE": "A",
        "MATERIAL_ID": "000000000020582002",
        "BATCH_ID": "0008898869",
        "PLANT_ID": "C351",
        "PROCESS_ORDER_ID": "PO-2024-03-0847",
        "USAGE_DECISION_CREATED_DATE": "2024-03-09T11:42:00",
    }

    def test_inspection_lot_id_preserved(self):
        lots, _ = map_quality_usage_decision_rows([self._FULL_ROW], "2026-05-22T00:00:00Z")
        assert lots[0].inspection_lot_id == "LOT-FULL"

    def test_material_id_preserved(self):
        lots, _ = map_quality_usage_decision_rows([self._FULL_ROW], "2026-05-22T00:00:00Z")
        assert lots[0].material_id == "000000000020582002"

    def test_batch_id_preserved(self):
        lots, _ = map_quality_usage_decision_rows([self._FULL_ROW], "2026-05-22T00:00:00Z")
        assert lots[0].batch_id == "0008898869"

    def test_plant_id_preserved(self):
        lots, _ = map_quality_usage_decision_rows([self._FULL_ROW], "2026-05-22T00:00:00Z")
        assert lots[0].plant_id == "C351"

    def test_process_order_id_preserved(self):
        lots, _ = map_quality_usage_decision_rows([self._FULL_ROW], "2026-05-22T00:00:00Z")
        assert lots[0].process_order_id == "PO-2024-03-0847"

    def test_usage_decision_created_at_preserved(self):
        lots, _ = map_quality_usage_decision_rows([self._FULL_ROW], "2026-05-22T00:00:00Z")
        assert lots[0].usage_decision_created_at == "2024-03-09T11:42:00"

    def test_null_material_id_becomes_none(self):
        """NULL MATERIAL_ID from a LEFT JOIN must not be invented — it stays None."""
        row = {**self._FULL_ROW, "MATERIAL_ID": None}
        lots, _ = map_quality_usage_decision_rows([row], "2026-05-22T00:00:00Z")
        assert lots[0].material_id is None

    def test_null_plant_id_becomes_none(self):
        """A lot matched without a plant filter yields no PLANT_ID — must stay None."""
        row = {**self._FULL_ROW, "PLANT_ID": None}
        lots, _ = map_quality_usage_decision_rows([row], "2026-05-22T00:00:00Z")
        assert lots[0].plant_id is None

    def test_null_process_order_id_becomes_none(self):
        """Inspection lots may not be linked to a process order — None must stay None."""
        row = {**self._FULL_ROW, "PROCESS_ORDER_ID": None}
        lots, _ = map_quality_usage_decision_rows([row], "2026-05-22T00:00:00Z")
        assert lots[0].process_order_id is None

    def test_null_created_at_becomes_none(self):
        """A lot with no usage decision has no USAGE_DECISION_CREATED_DATE — must stay None."""
        row = {**self._FULL_ROW, "USAGE_DECISION_CREATED_DATE": None}
        lots, _ = map_quality_usage_decision_rows([row], "2026-05-22T00:00:00Z")
        assert lots[0].usage_decision_created_at is None
