"""Tests for the security-mode policy guard (prod must use the real model; no validation modes in prod)."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from check_security_mode_policy import scan  # noqa: E402

_CLEAN_PROD = """\
CREATE OR REPLACE VIEW connected_plant_prod.gold_io_reporting.gold_x_secured AS
  SELECT * FROM connected_plant_prod.gold_io_reporting.gold_x
  WHERE EXISTS (
    SELECT 1 FROM published_prod.security.model
    WHERE current_user() = email AND application_key = 'io_reporting' AND LOWER(access_type) = 'full view'
    UNION ALL
    SELECT 1 FROM published_prod.security.model
    WHERE current_user() = email AND application_key = 'io_reporting' AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
  );
GRANT SELECT ON VIEW connected_plant_prod.gold_io_reporting.gold_x_secured TO `users`;
"""


def _write(tmp_path, name, body):
    (tmp_path / name).write_text(body, encoding="utf-8")


def test_clean_prod_passes(tmp_path):
    _write(tmp_path, "gold_security_prod.sql", _CLEAN_PROD)
    assert scan(str(tmp_path)) == []


def test_uat_validation_files_allowed(tmp_path):
    _write(tmp_path, "gold_security_prod.sql", _CLEAN_PROD)
    _write(tmp_path, "gold_security_uat_validation_open.sql", "CREATE OR REPLACE VIEW x_secured AS SELECT * FROM x;")
    _write(tmp_path, "gold_security_uat_validation_fixture.sql",
           "CREATE OR REPLACE VIEW x_secured AS SELECT * FROM x WHERE EXISTS (SELECT 1 FROM a.b.security_model_fixture);")
    assert scan(str(tmp_path)) == []  # UAT validation files do not trip the prod guard


def test_prod_validation_file_forbidden(tmp_path):
    _write(tmp_path, "gold_security_prod.sql", _CLEAN_PROD)
    _write(tmp_path, "gold_security_prod_validation_open.sql", "CREATE OR REPLACE VIEW x_secured AS SELECT * FROM x;")
    errs = scan(str(tmp_path))
    assert any("validation-mode security SQL is forbidden" in e for e in errs)


def test_prod_missing_model_fails(tmp_path):
    _write(tmp_path, "gold_security_prod.sql",
           "CREATE OR REPLACE VIEW x_secured AS SELECT * FROM x WHERE EXISTS (SELECT 1 FROM foo);")
    errs = scan(str(tmp_path))
    assert any("published_prod.security.model" in e for e in errs)


def test_prod_fixture_reference_fails(tmp_path):
    body = _CLEAN_PROD.replace("published_prod.security.model", "connected_plant_prod.gold_io_reporting.security_model_fixture")
    _write(tmp_path, "gold_security_prod.sql", body)
    errs = scan(str(tmp_path))
    assert any("security_model_fixture" in e for e in errs)


def test_prod_passthrough_secured_view_fails(tmp_path):
    _write(tmp_path, "gold_security_prod.sql",
           "CREATE OR REPLACE VIEW connected_plant_prod.gold_io_reporting.gold_x_secured AS\n"
           "  SELECT * FROM connected_plant_prod.gold_io_reporting.gold_x;\n")
    errs = scan(str(tmp_path))
    assert any("pass-through" in e for e in errs)
    assert any("published_prod.security.model" in e for e in errs)  # also missing the model


def test_prod_missing_file_fails(tmp_path):
    errs = scan(str(tmp_path))
    assert any("missing" in e for e in errs)
