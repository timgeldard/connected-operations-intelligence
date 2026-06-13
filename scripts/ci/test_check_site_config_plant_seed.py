"""Tests for scripts/ci/check_site_config_plant_seed.py

Tests:
  - Valid single-entry CSV passes.
  - Missing field detected.
  - Boolean string (not bool) detected.
  - Invalid go_live_status detected.
  - Invalid lifecycle_status detected (ADR 016 vocab).
  - valid_from > valid_to detected.
  - Duplicate plant_code detected.
  - Bad plant_code format detected.
  - Plant in CSV but absent from reference.py seed is detected.
  - Plant in seed but absent from CSV is detected.
"""
import csv
import sys
import textwrap
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_site_config_plant_seed as guard

_GOOD_ROW = {
    "plant_code": "X999",
    "plant_name": "Test Plant [MFG]",
    "country": "IE",
    "region": "Europe",
    "business_unit": "Operations",
    "timezone": "Europe/Dublin",
    "sap_system_id": "ECC",
    "go_live_status": "PRODUCTION",
    "wm_enabled_flag": "true",
    "hu_enabled_flag": "true",
    "qm_enabled_flag": "true",
    "spc_enabled_flag": "true",
    "lifecycle_status": "ACTIVE",
    "batch_managed_flag": "true",
    "process_manufacturing_flag": "true",
    "default_language_code": "EN",
    "valid_from": "2026-01-01",
    "valid_to": "9999-12-31",
    "is_active": "true",
    "config_owner": "wm-config-owner",
    "last_validated_at": "2026-06-13",
}

_CSV_COLUMNS = list(_GOOD_ROW.keys())


def _write_csv(path: Path, rows: list) -> None:
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=_CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def _make_row(**overrides) -> dict:
    row = dict(_GOOD_ROW)
    row.update(overrides)
    return row


def _make_fake_reference_py(plant_codes: list) -> str:
    """Generate a minimal fake reference.py with the given plant_codes in the seed."""
    rows_src = "\n".join(
        "        Row(plant_code=\"{pc}\", plant_name=\"Test\", country=\"IE\", region=\"Europe\","
        " business_unit=\"Ops\", timezone=\"UTC\", sap_system_id=\"ECC\","
        " go_live_status=\"PRODUCTION\", wm_enabled_flag=True, hu_enabled_flag=True,"
        " qm_enabled_flag=True, spc_enabled_flag=True, lifecycle_status=\"ACTIVE\","
        " batch_managed_flag=True, process_manufacturing_flag=True,"
        " default_language_code=\"EN\", valid_from=\"2026-01-01\", valid_to=\"9999-12-31\","
        " is_active=True, config_owner=\"wm-config-owner\","
        " last_validated_at=\"2026-06-13\"),".replace("{pc}", pc)
        for pc in plant_codes
    )
    return textwrap.dedent("""
        def site_config_plant():
            data = [
        {rows}
            ]
            return data
    """.replace("{rows}", rows_src))


class TestCsvValidation:
    def test_good_row_passes(self, tmp_path):
        csv_path = tmp_path / "site_config_plant.csv"
        _write_csv(csv_path, [_GOOD_ROW])
        orig = guard.SEED_CSV
        guard.SEED_CSV = csv_path
        try:
            errors = []
            rows = guard.validate_csv(errors)
            assert errors == [], f"Unexpected errors: {errors}"
            assert len(rows) == 1
        finally:
            guard.SEED_CSV = orig

    def test_missing_column_detected(self, tmp_path):
        csv_path = tmp_path / "site_config_plant.csv"
        bad_cols = [c for c in _CSV_COLUMNS if c != "plant_code"]
        with open(csv_path, "w", newline="", encoding="utf-8") as fh:
            writer = csv.DictWriter(fh, fieldnames=bad_cols)
            writer.writeheader()
            writer.writerow({k: v for k, v in _GOOD_ROW.items() if k in bad_cols})
        orig = guard.SEED_CSV
        guard.SEED_CSV = csv_path
        try:
            errors = []
            guard.validate_csv(errors)
            assert any("plant_code" in e and "Missing" in e for e in errors), errors
        finally:
            guard.SEED_CSV = orig

    def test_boolean_string_detected(self, tmp_path):
        csv_path = tmp_path / "site_config_plant.csv"
        _write_csv(csv_path, [_make_row(wm_enabled_flag="yes")])
        orig = guard.SEED_CSV
        guard.SEED_CSV = csv_path
        try:
            errors = []
            guard.validate_csv(errors)
            assert any("wm_enabled_flag" in e for e in errors), errors
        finally:
            guard.SEED_CSV = orig

    def test_invalid_go_live_status_detected(self, tmp_path):
        csv_path = tmp_path / "site_config_plant.csv"
        _write_csv(csv_path, [_make_row(go_live_status="LIVE")])
        orig = guard.SEED_CSV
        guard.SEED_CSV = csv_path
        try:
            errors = []
            guard.validate_csv(errors)
            assert any("go_live_status" in e and "LIVE" in e for e in errors), errors
        finally:
            guard.SEED_CSV = orig

    def test_invalid_lifecycle_status_detected(self, tmp_path):
        """lifecycle_status must use ADR 016 vocabulary, not go_live_status values."""
        csv_path = tmp_path / "site_config_plant.csv"
        _write_csv(csv_path, [_make_row(lifecycle_status="PRODUCTION")])
        orig = guard.SEED_CSV
        guard.SEED_CSV = csv_path
        try:
            errors = []
            guard.validate_csv(errors)
            assert any("lifecycle_status" in e and "PRODUCTION" in e for e in errors), errors
        finally:
            guard.SEED_CSV = orig

    def test_valid_lifecycle_statuses_pass(self, tmp_path):
        """All ADR 016 lifecycle_status values are accepted."""
        for lcs in ("ACTIVE", "CLOSED", "SOLD", "DIVESTED_ON_SAP"):
            csv_path = tmp_path / f"csv_{lcs}.csv"
            _write_csv(csv_path, [_make_row(lifecycle_status=lcs)])
            orig = guard.SEED_CSV
            guard.SEED_CSV = csv_path
            try:
                errors = []
                guard.validate_csv(errors)
                lc_errs = [e for e in errors if "lifecycle_status" in e]
                assert lc_errs == [], f"lifecycle_status={lcs} raised: {lc_errs}"
            finally:
                guard.SEED_CSV = orig

    def test_valid_from_after_valid_to_detected(self, tmp_path):
        csv_path = tmp_path / "site_config_plant.csv"
        _write_csv(csv_path, [_make_row(valid_from="2027-01-01", valid_to="2026-01-01")])
        orig = guard.SEED_CSV
        guard.SEED_CSV = csv_path
        try:
            errors = []
            guard.validate_csv(errors)
            assert any("valid_from" in e and "<=" in e for e in errors), errors
        finally:
            guard.SEED_CSV = orig

    def test_duplicate_plant_code_detected(self, tmp_path):
        csv_path = tmp_path / "site_config_plant.csv"
        _write_csv(csv_path, [_GOOD_ROW, _make_row(plant_name="Duplicate")])
        orig = guard.SEED_CSV
        guard.SEED_CSV = csv_path
        try:
            errors = []
            guard.validate_csv(errors)
            assert any("Duplicate" in e and "X999" in e for e in errors), errors
        finally:
            guard.SEED_CSV = orig

    def test_bad_plant_code_format_detected(self, tmp_path):
        csv_path = tmp_path / "site_config_plant.csv"
        _write_csv(csv_path, [_make_row(plant_code="bad")])
        orig = guard.SEED_CSV
        guard.SEED_CSV = csv_path
        try:
            errors = []
            guard.validate_csv(errors)
            assert any("plant_code" in e and "bad" in e for e in errors), errors
        finally:
            guard.SEED_CSV = orig


class TestSyncValidation:
    def test_plant_missing_from_seed_detected(self, tmp_path):
        """Plant in CSV but absent from reference.py seed raises a SYNC error."""
        csv_path = tmp_path / "site_config_plant.csv"
        _write_csv(csv_path, [_GOOD_ROW])

        ref_path = tmp_path / "reference.py"
        ref_path.write_text(_make_fake_reference_py([]), encoding="utf-8")

        orig_csv, orig_ref = guard.SEED_CSV, guard.REFERENCE_PY
        guard.SEED_CSV, guard.REFERENCE_PY = csv_path, ref_path
        try:
            errors = []
            rows = guard.validate_csv(errors)
            guard.validate_reference_py_sync(rows, errors)
            assert any("SYNC" in e and "X999" in e for e in errors), (
                f"Expected SYNC error for X999 missing from seed; got: {errors}"
            )
        finally:
            guard.SEED_CSV, guard.REFERENCE_PY = orig_csv, orig_ref

    def test_orphan_in_seed_detected(self, tmp_path):
        """Plant in seed but not in CSV is flagged."""
        csv_path = tmp_path / "site_config_plant.csv"
        with open(csv_path, "w", newline="", encoding="utf-8") as fh:
            csv.DictWriter(fh, fieldnames=_CSV_COLUMNS).writeheader()

        ref_path = tmp_path / "reference.py"
        ref_path.write_text(_make_fake_reference_py(["X999"]), encoding="utf-8")

        orig_csv, orig_ref = guard.SEED_CSV, guard.REFERENCE_PY
        guard.SEED_CSV, guard.REFERENCE_PY = csv_path, ref_path
        try:
            errors = []
            rows = guard.validate_csv(errors)
            guard.validate_reference_py_sync(rows, errors)
            assert any("SYNC" in e and "X999" in e for e in errors), (
                f"Expected SYNC orphan error for X999; got: {errors}"
            )
        finally:
            guard.SEED_CSV, guard.REFERENCE_PY = orig_csv, orig_ref

    def test_matching_seed_and_csv_passes(self, tmp_path):
        """Plant in both CSV and seed passes sync check."""
        csv_path = tmp_path / "site_config_plant.csv"
        _write_csv(csv_path, [_GOOD_ROW])

        ref_path = tmp_path / "reference.py"
        ref_path.write_text(_make_fake_reference_py(["X999"]), encoding="utf-8")

        orig_csv, orig_ref = guard.SEED_CSV, guard.REFERENCE_PY
        guard.SEED_CSV, guard.REFERENCE_PY = csv_path, ref_path
        try:
            errors = []
            rows = guard.validate_csv(errors)
            guard.validate_reference_py_sync(rows, errors)
            assert errors == [], f"Unexpected errors: {errors}"
        finally:
            guard.SEED_CSV, guard.REFERENCE_PY = orig_csv, orig_ref
