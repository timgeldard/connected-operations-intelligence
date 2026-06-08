"""Tests for the Gold security SQL generator's security modes (strict / validation-open / validation-fixture).

Spark-free: the generator is pure string generation. Each test runs in a tmp cwd so it does not touch
the committed resources/sql files.
"""
import importlib.util
import os
import pathlib

import pytest

_HERE = pathlib.Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("gen_gold_security", _HERE / "generate_gold_security_sql.py")
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)


@pytest.fixture(autouse=True)
def _use_tmp_cwd(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)


def _gen(tmp_path, mode, env="uat"):
    gen.generate_sql(env_filter=env, security_mode=mode)
    sql_dir = tmp_path / "resources" / "sql"
    return {p.name: p.read_text(encoding="utf-8") for p in sql_dir.glob("*.sql")}


def test_strict_uses_real_security_model(tmp_path):
    files = _gen(tmp_path, "strict")
    body = files["gold_security_uat.sql"]
    assert "published_uat.security.model" in body
    assert "WHERE EXISTS" in body
    assert "array_contains(filter_plant, plant_code)" in body
    assert "GRANT SELECT ON VIEW" in body
    # strict writes the canonical harden script
    assert "gold_security_harden_uat.sql" in files


def test_validation_open_is_passthrough(tmp_path):
    files = _gen(tmp_path, "validation-open")
    assert "gold_security_uat_validation_open.sql" in files
    body = files["gold_security_uat_validation_open.sql"]
    # same secured view names + grants, but NO security predicate
    assert "_secured AS" in body
    assert "GRANT SELECT ON VIEW" in body
    assert "WHERE EXISTS" not in body
    assert "published_uat.security.model" not in body
    assert "validation-open" in body  # the UAT-only warning header
    # validation modes reuse the strict harden — they do NOT write their own
    assert not any("harden" in n for n in files)


def test_validation_fixture_uses_local_fixture(tmp_path):
    files = _gen(tmp_path, "validation-fixture")
    assert "gold_security_uat_validation_fixture.sql" in files
    body = files["gold_security_uat_validation_fixture.sql"]
    assert "connected_plant_uat.gold_io_reporting.security_model_fixture" in body
    assert "WHERE EXISTS" in body
    assert "published_uat.security.model" not in body
    # fixture mode honours the `enabled` flag so a disabled fixture row grants nothing
    assert "COALESCE(enabled, true)" in body
    assert not any("harden" in n for n in files)


def test_strict_and_open_have_no_enabled_guard(tmp_path):
    # the corporate model has no `enabled` column — only fixture mode adds the guard
    strict = _gen(tmp_path, "strict")["gold_security_uat.sql"]
    opn = _gen(tmp_path, "validation-open")["gold_security_uat_validation_open.sql"]
    assert "COALESCE(enabled" not in strict
    assert "COALESCE(enabled" not in opn


@pytest.mark.parametrize("mode", ["validation-open", "validation-fixture"])
def test_prod_forbids_validation_modes(tmp_path, mode):
    with pytest.raises(SystemExit) as exc:
        gen.generate_sql(env_filter="prod", security_mode=mode)
    assert "forbidden for prod" in str(exc.value)


def test_prod_strict_allowed(tmp_path):
    files = _gen(tmp_path, "strict", env="prod")
    assert "published_prod.security.model" in files["gold_security_prod.sql"]


def test_deterministic(tmp_path):
    a = _gen(tmp_path, "validation-fixture")
    b = _gen(tmp_path, "validation-fixture")
    assert a == b


def test_unknown_mode_rejected(tmp_path):
    with pytest.raises(SystemExit):
        gen.generate_sql(env_filter="uat", security_mode="bogus")


def test_unknown_env_rejected(tmp_path):
    with pytest.raises(SystemExit) as exc:
        gen.generate_sql(env_filter="bogus", security_mode="strict")
    assert "Unknown --env" in str(exc.value)
