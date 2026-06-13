"""Unit tests for scripts/onboarding/onboard_plant.py

Tests:
  - validate_entry: good config passes.
  - validate_entry: missing required fields caught.
  - validate_entry: non-boolean flag type caught.
  - validate_entry: invalid go_live_status caught.
  - validate_entry: invalid lifecycle_status caught (must use ADR 016 vocab).
  - validate_entry: valid_from > valid_to caught.
  - validate_entry: bad plant_code format caught.
  - validate_entry: intra-file duplicate plant_code caught.
  - emit_csv_row: round-trips correctly to CSV column order.
  - emit_python_snippet: contains plant_code and spc_enabled_flag comment.
  - main: good config YAML exits 0 and prints VALIDATION PASSED.
  - main: bad config YAML exits 1 and prints VALIDATION FAILED.
  - main: duplicate against existing CSV is caught.
"""
import sys
from datetime import date
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import onboard_plant as script

_GOOD_ENTRY = {
    "plant_code": "X999",
    "plant_name": "Test Plant [MFG]",
    "country": "IE",
    "region": "Europe",
    "business_unit": "Operations",
    "timezone": "Europe/Dublin",
    "sap_system_id": "ECC",
    "go_live_status": "PRODUCTION",
    "wm_enabled_flag": True,
    "hu_enabled_flag": True,
    "qm_enabled_flag": True,
    "spc_enabled_flag": True,
    "lifecycle_status": "ACTIVE",
    "batch_managed_flag": True,
    "process_manufacturing_flag": True,
    "default_language_code": "EN",
    "valid_from": date(2026, 1, 1),
    "valid_to": date(9999, 12, 31),
    "is_active": True,
    "config_owner": "wm-config-owner",
    "last_validated_at": date(2026, 6, 13),
}


def _e(**overrides) -> dict:
    entry = dict(_GOOD_ENTRY)
    entry.update(overrides)
    return entry


class TestValidateEntry:
    def test_good_entry_passes(self):
        errors = script.validate_entry(dict(_GOOD_ENTRY), set())
        assert errors == [], f"Unexpected errors: {errors}"

    def test_missing_field_detected(self):
        entry = {k: v for k, v in _GOOD_ENTRY.items() if k != "plant_name"}
        errors = script.validate_entry(entry, set())
        assert any("plant_name" in e and "Missing" in e for e in errors), errors

    def test_non_boolean_flag_detected(self):
        errors = script.validate_entry(_e(wm_enabled_flag="true"), set())
        assert any("wm_enabled_flag" in e and "bool" in e for e in errors), errors

    def test_invalid_go_live_status_detected(self):
        errors = script.validate_entry(_e(go_live_status="LIVE"), set())
        assert any("go_live_status" in e and "LIVE" in e for e in errors), errors

    def test_invalid_lifecycle_status_detected(self):
        """lifecycle_status PRODUCTION is a go_live_status value, not ADR 016 vocab."""
        errors = script.validate_entry(_e(lifecycle_status="PRODUCTION"), set())
        assert any("lifecycle_status" in e and "PRODUCTION" in e for e in errors), errors

    def test_valid_lifecycle_statuses_accepted(self):
        for lcs in ("ACTIVE", "CLOSED", "SOLD", "DIVESTED_ON_SAP"):
            errors = script.validate_entry(_e(lifecycle_status=lcs), set())
            lc_errs = [e for e in errors if "lifecycle_status" in e]
            assert lc_errs == [], f"lifecycle_status={lcs} raised: {lc_errs}"

    def test_valid_from_after_valid_to(self):
        errors = script.validate_entry(
            _e(valid_from=date(2027, 1, 1), valid_to=date(2026, 1, 1)), set()
        )
        assert any("valid_from" in e and "<=" in e for e in errors), errors

    def test_bad_plant_code_format(self):
        errors = script.validate_entry(_e(plant_code="bad"), set())
        assert any("plant_code" in e and "bad" in e for e in errors), errors

    def test_plant_code_lowercase_rejected(self):
        errors = script.validate_entry(_e(plant_code="c061"), set())
        assert any("plant_code" in e for e in errors), errors

    def test_intra_file_duplicate_detected(self):
        seen = {"X999"}
        errors = script.validate_entry(dict(_GOOD_ENTRY), seen)
        assert any("Duplicate" in e and "X999" in e for e in errors), errors

    def test_unexpected_field_detected(self):
        entry = dict(_GOOD_ENTRY)
        entry["extra_field"] = "oops"
        errors = script.validate_entry(entry, set())
        assert any("extra_field" in e for e in errors), errors


class TestEmitters:
    def test_emit_csv_row_column_order(self):
        row_str = script.emit_csv_row(_GOOD_ENTRY)
        parts = row_str.split(",")
        assert parts[0] == "X999"
        assert parts[1] == "Test Plant [MFG]"
        # Boolean fields should be lowercase
        assert "true" in row_str
        assert "True" not in row_str  # Python bool repr must not appear

    def test_emit_csv_row_boolean_lowercase(self):
        row_str = script.emit_csv_row(_GOOD_ENTRY)
        assert "True" not in row_str, "CSV booleans must be lowercase true/false"
        assert "False" not in row_str

    def test_emit_python_snippet_contains_plant_code(self):
        snippet = script.emit_python_snippet(_GOOD_ENTRY)
        assert "X999" in snippet
        assert "spc_enabled_flag" in snippet

    def test_emit_python_snippet_contains_lifecycle_comment(self):
        snippet = script.emit_python_snippet(_GOOD_ENTRY)
        assert "lifecycle_status" in snippet
        assert "ADR 016" in snippet


class TestMainCli:
    def test_good_config_exits_zero(self, tmp_path, capsys):
        config_path = tmp_path / "plant.yml"
        config_path.write_text(yaml.dump([{
            k: str(v) if isinstance(v, date) else v
            for k, v in _GOOD_ENTRY.items()
        }]), encoding="utf-8")
        orig_csv = script.SEED_CSV
        script.SEED_CSV = tmp_path / "empty_seed.csv"  # no existing plants
        try:
            rc = script.main([str(config_path), "--skip-duplicate-check"])
            assert rc == 0
            captured = capsys.readouterr()
            assert "VALIDATION PASSED" in captured.out
        finally:
            script.SEED_CSV = orig_csv

    def test_bad_config_exits_nonzero(self, tmp_path, capsys):
        config_path = tmp_path / "bad.yml"
        config_path.write_text(yaml.dump([{"plant_code": "bad"}]), encoding="utf-8")
        rc = script.main([str(config_path), "--skip-duplicate-check"])
        assert rc != 0
        captured = capsys.readouterr()
        assert "VALIDATION FAILED" in captured.out

    def test_duplicate_against_csv_detected(self, tmp_path, capsys):
        """A plant_code already in the CSV seed is rejected without --skip-duplicate-check."""
        import csv as csv_mod
        csv_path = tmp_path / "seed.csv"
        cols = list(script.CSV_COLUMNS)
        with open(csv_path, "w", newline="", encoding="utf-8") as fh:
            writer = csv_mod.DictWriter(fh, fieldnames=cols)
            writer.writeheader()
            writer.writerow({
                k: ("true" if isinstance(_GOOD_ENTRY.get(k), bool) and _GOOD_ENTRY[k]
                    else "false" if isinstance(_GOOD_ENTRY.get(k), bool) and not _GOOD_ENTRY[k]
                    else str(_GOOD_ENTRY.get(k, "")))
                for k in cols
            })
        config_path = tmp_path / "plant.yml"
        config_path.write_text(yaml.dump([{
            k: str(v) if isinstance(v, date) else v
            for k, v in _GOOD_ENTRY.items()
        }]), encoding="utf-8")
        orig_csv = script.SEED_CSV
        script.SEED_CSV = csv_path
        try:
            rc = script.main([str(config_path)])
            assert rc != 0
            captured = capsys.readouterr()
            assert "VALIDATION FAILED" in captured.out
        finally:
            script.SEED_CSV = orig_csv

    def test_nonexistent_file_exits_nonzero(self, tmp_path, capsys):
        rc = script.main([str(tmp_path / "no_such.yml")])
        assert rc != 0
