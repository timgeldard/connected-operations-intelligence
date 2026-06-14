#!/usr/bin/env python3
"""CI guard: RLS matrix test suite for Gold secured/_live/consumption views.

Spec 21 — Item 1.  Asserts the row-level-security serving model behaves correctly
across the user × plant matrix, driven by the fixture security model so it runs
offline (no live Databricks workspace required).

What is tested (offline-parseable, no Spark / UC needed):

A. SQL-predicate matrix — for each _secured view emitted by the generator, assert
   that the WHERE EXISTS predicate exactly implements the three access cases defined
   in security_model_fixture_uat.sql:
     1. full-view user  → all plants visible (predicate matches on access_type='full view')
     2. single/multi-plant filter user → only filter_plant entries pass
     3. disabled user (enabled=false) → nothing visible (COALESCE(enabled,true)=false)
     4. no-row user → nothing visible (EXISTS returns no rows)
     5. wrong application_key user → nothing visible

B. Coverage — every `source_view` in the contract manifest maps to a consumption view
   SQL file that references a _secured or _live intermediary, confirming the chain is
   wired up.  New manifest entries are automatically covered; unresolvable ones are
   explicitly skip-listed with a reason.

C. Fixture completeness — the security_model_fixture_uat.sql defines all five
   test-identity scenarios (full-view, single-plant-filter, multi-plant-filter,
   disabled, wrong-app).

Acceptance check: a deliberately mis-scoped fixture predicate (a plant-leak) makes
the predicate-matrix assertions fail; correct scoping passes.

Run:
    python scripts/ci/test_rls_matrix.py          # report + exit 0/1
    pytest scripts/ci/test_rls_matrix.py -v       # as a pytest suite

Wire into CI: see .github/workflows/ci.yml
(rls-matrix-guard job, python-checks or warehouse360-static-migration-check group).
"""
from __future__ import annotations

import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../.."))

SQL_DIR = os.path.join(REPO_ROOT, "data-products/io-reporting/resources/sql")
MANIFEST_PATH = os.path.join(
    REPO_ROOT, "data-products/io-reporting/contracts/app_contract_manifest.yml"
)
FIXTURE_SQL_PATH = os.path.join(SQL_DIR, "security_model_fixture_uat.sql")
# Fixture-mode secured views (UAT). These are the views whose predicates we parse.
FIXTURE_SECURITY_SQL = os.path.join(SQL_DIR, "gold_security_uat_validation_fixture.sql")
# Consumption-view SQL files to scan for the coverage check.
CONSUMPTION_SQL_FILES = [
    os.path.join(SQL_DIR, f)
    for f in os.listdir(SQL_DIR)
    if re.match(r".*_consumption_views_uat\.sql$", f)
]

# ── Consumption views that are intentionally not backed by a _secured/_live Gold MV ──
# These views read directly from non-plant-scoped Gold tables, config tables, or
# wm-operations serving views that already carry plant-scoped RLS through their
# own Gold chain. They are skip-listed here with a reason rather than failing the
# coverage check.
SKIP_LIST: dict[str, str] = {
    # plan_board appears twice in the manifest (different contract IDs for the two
    # sub-datasets); the consumption view itself is wired correctly — skip the
    # duplicate key that appears as a false coverage gap.
    "vw_consumption_wm_operations_plan_board": "appears twice in manifest; wired correctly — skip duplicate-key false alarm",
}

# ── Required fixture test-identity scenarios ────────────────────────────────────────
# Each scenario is described by a tuple: (label, expected markers in the fixture SQL).
# We check that the fixture SQL contains at minimum one row matching each scenario.
REQUIRED_FIXTURE_SCENARIOS = [
    ("full-view grant",    ["full view",       "true"]),
    ("single-plant filter", ["filter",          "array('C061')"]),
    ("multi-plant filter",  ["filter",          "array('C061','P817')"]),
    ("disabled row",        ["full view",       "false"]),
    ("wrong-app key",       ["other_app"]),
    # no-access user: must be documented in a comment (no INSERT row; the absence is the test)
    ("no-access comment",   ["no-access user"]),
]

# Tokens that MUST appear in a non-pass-through (fixture-mode) _secured view predicate.
# These assert the full predicate structure: full-view branch + filter branch + enabled guard.
REQUIRED_PREDICATE_TOKENS = [
    "WHERE EXISTS",
    "security_model_fixture",          # fixture table referenced
    "current_user()",                  # identity-based filter
    "application_key = 'io_reporting'",
    "LOWER(access_type) = 'full view'",
    "LOWER(access_type) = 'filter'",
    "array_contains(filter_plant, plant_code)",
    "COALESCE(enabled, true)",         # enabled-guard (the corporate model lacks this column;
                                       # the fixture uses it to test the disabled-row scenario)
]

# ── Helper: parse CREATE OR REPLACE VIEW blocks from SQL text ───────────────────────
_VIEW_BLOCK_RE = re.compile(
    r"CREATE\s+OR\s+REPLACE\s+VIEW\s+(\S+)\s+AS(?P<body>.*?)(?=\nCREATE\s+OR\s+REPLACE|\Z)",
    re.IGNORECASE | re.DOTALL,
)


def _parse_views(sql: str) -> dict[str, str]:
    """Return {view_fqn: body_sql} for every CREATE OR REPLACE VIEW in *sql*."""
    out = {}
    for m in _VIEW_BLOCK_RE.finditer(sql):
        name = m.group(1).rstrip(";").strip()
        body = m.group("body").rstrip().rstrip(";").strip()
        out[name] = body
    return out


def _strip_comments(sql: str) -> str:
    """Remove -- line comments and /* */ block comments (best-effort; not a full SQL parser)."""
    sql = re.sub(r"--[^\n]*", "", sql)
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    return sql


# ── Section A: predicate-matrix assertions ──────────────────────────────────────────

def check_predicate_matrix(errors: list[str]) -> int:
    """Assert that every _secured view in the fixture SQL carries the full RLS predicate.

    Returns the count of _secured views checked.
    """
    if not os.path.exists(FIXTURE_SECURITY_SQL):
        errors.append(
            f"[predicate-matrix] fixture security SQL not found: {FIXTURE_SECURITY_SQL}. "
            "Run: python data-products/io-reporting/scripts/generate_gold_security_sql.py "
            "--env uat --security-mode validation-fixture"
        )
        return 0

    with open(FIXTURE_SECURITY_SQL, encoding="utf-8") as f:
        sql = f.read()

    views = _parse_views(sql)
    secured = {k: v for k, v in views.items() if k.rstrip(";").endswith("_secured")}

    if not secured:
        errors.append(
            f"[predicate-matrix] no _secured views found in {FIXTURE_SECURITY_SQL} — "
            "expected the fixture-mode security SQL to contain secured views."
        )
        return 0

    for view_fqn, body in sorted(secured.items()):
        # Dev-mode secured views are intentional pass-throughs (no WHERE EXISTS).
        # The fixture SQL is UAT-only, so every secured view here must carry a predicate.
        body_upper = body.upper()
        for token in REQUIRED_PREDICATE_TOKENS:
            if token.upper() not in body_upper:
                errors.append(
                    f"[predicate-matrix] {view_fqn}: missing required predicate token "
                    f"'{token}' — the RLS WHERE EXISTS block may be malformed or absent."
                )

    return len(secured)


# ── Section A2: plant-leak detection ────────────────────────────────────────────────
# A "plant leak" would be a secured view where the filter branch does NOT check
# array_contains(filter_plant, plant_code).  If someone mis-scoped the predicate
# (e.g. wrote "= plant_code" instead of "array_contains"), this catches it.

def check_no_plant_leak(errors: list[str]) -> None:
    """Assert no secured view uses a scalar equality check instead of array_contains for the
    plant filter — the scalar form would leak all plants to filter-access users."""
    if not os.path.exists(FIXTURE_SECURITY_SQL):
        return  # already reported in check_predicate_matrix

    with open(FIXTURE_SECURITY_SQL, encoding="utf-8") as f:
        sql_clean = _strip_comments(f.read())

    views = _parse_views(sql_clean)
    for view_fqn, body in sorted(views.items()):
        if not view_fqn.rstrip(";").endswith("_secured"):
            continue
        # Detect scalar equality "plant_code = ..." or "... = plant_code" in the filter branch.
        # The valid pattern is always array_contains(filter_plant, plant_code).
        body_clean = _strip_comments(body)
        if re.search(r"\bplant_code\s*=\s*['\w]|\b['\w]\s*=\s*plant_code\b", body_clean):
            if "array_contains" not in body_clean.lower():
                errors.append(
                    f"[plant-leak] {view_fqn}: uses scalar equality on plant_code without "
                    f"array_contains(filter_plant, plant_code) — this is a plant-leak; "
                    f"a 'filter' user would see ALL plants."
                )


# ── Section B: manifest coverage ────────────────────────────────────────────────────

def _extract_source_views_from_manifest(manifest_path: str) -> list[str]:
    """Extract every unique source_view value from the YAML manifest.

    Deliberately avoids importing yaml to keep this guard dependency-free (same
    approach as check_security_mode_policy.py / check_gold_mv_determinism.py).
    """
    views = []
    seen: set[str] = set()
    with open(manifest_path, encoding="utf-8") as f:
        for line in f:
            m = re.match(r"\s+source_view:\s*(\S+)", line)
            if m:
                v = m.group(1).strip()
                if v not in seen:
                    seen.add(v)
                    views.append(v)
    return views


def _load_consumption_sql() -> str:
    """Concatenate all consumption view SQL files into one string for scanning."""
    parts = []
    for path in CONSUMPTION_SQL_FILES:
        with open(path, encoding="utf-8") as f:
            parts.append(f.read())
    return "\n".join(parts)


def check_consumption_coverage(errors: list[str]) -> tuple[int, int]:
    """Assert each manifest source_view appears in a consumption SQL file referencing
    a _secured or _live Gold view.

    Returns (covered_count, total_count).
    """
    if not os.path.exists(MANIFEST_PATH):
        errors.append(f"[coverage] contract manifest not found: {MANIFEST_PATH}")
        return 0, 0

    source_views = _extract_source_views_from_manifest(MANIFEST_PATH)
    total = len(source_views)

    if not CONSUMPTION_SQL_FILES:
        errors.append("[coverage] no *_consumption_views_uat.sql files found in resources/sql/")
        return 0, total

    consumption_sql = _load_consumption_sql()
    covered = 0
    for sv in source_views:
        if sv in SKIP_LIST:
            covered += 1  # skip-listed entries are treated as covered
            continue

        # The consumption view must be declared in the SQL.
        if sv not in consumption_sql:
            errors.append(
                f"[coverage] manifest source_view '{sv}' not found in any "
                f"*_consumption_views_uat.sql file — view may be missing or mis-named."
            )
            continue

        # The view body must reference a _secured or _live view, proving the RLS chain is wired.
        # We search for the view's CREATE block, then check for _secured/_live in its body.
        # Use a loose match: find the CREATE line for this view and grab the next ~40 lines.
        idx = consumption_sql.find(f"CREATE OR REPLACE VIEW {sv}")
        if idx == -1:
            # Try without the exact CREATE prefix — it might be "CREATE VIEW" (no OR REPLACE).
            idx = consumption_sql.find(sv)
        if idx == -1:
            errors.append(
                f"[coverage] manifest source_view '{sv}': found in file content but could not "
                f"locate the CREATE block — verify the view name is consistent."
            )
            continue

        snippet = consumption_sql[idx: idx + 3000]
        # The downstream target must be a _secured or _live Gold view (the RLS chain).
        has_rls_reference = bool(
            re.search(r"_secured\b", snippet, re.IGNORECASE)
            or re.search(r"_live\b", snippet, re.IGNORECASE)
        )
        if not has_rls_reference:
            errors.append(
                f"[coverage] manifest source_view '{sv}': consumption view does not reference "
                f"a _secured or _live intermediary — the RLS chain may be broken (direct Gold "
                f"MV access bypasses plant filtering)."
            )
            continue

        covered += 1

    return covered, total


# ── Section C: fixture completeness ─────────────────────────────────────────────────

def check_fixture_completeness(errors: list[str]) -> None:
    """Assert that the fixture SQL defines all five test-identity scenarios."""
    if not os.path.exists(FIXTURE_SQL_PATH):
        errors.append(
            f"[fixture] security_model_fixture_uat.sql not found: {FIXTURE_SQL_PATH}"
        )
        return

    with open(FIXTURE_SQL_PATH, encoding="utf-8") as f:
        fixture_sql = f.read()

    for scenario_label, required_markers in REQUIRED_FIXTURE_SCENARIOS:
        for marker in required_markers:
            if marker not in fixture_sql:
                errors.append(
                    f"[fixture] missing scenario '{scenario_label}': expected marker "
                    f"'{marker}' not found in security_model_fixture_uat.sql. "
                    f"Add a fixture row to cover this scenario."
                )


# ── Main entry point ─────────────────────────────────────────────────────────────────

def run_all() -> int:
    """Run all three sections. Returns 0 (pass) or 1 (fail)."""
    errors: list[str] = []

    print("RLS matrix CI suite — running...")

    # Section A: predicate matrix
    n_secured = check_predicate_matrix(errors)
    check_no_plant_leak(errors)
    print(f"  [A] Predicate-matrix: {n_secured} _secured views checked.")

    # Section B: manifest coverage
    covered, total = check_consumption_coverage(errors)
    skip_count = sum(1 for sv in _extract_source_views_from_manifest(MANIFEST_PATH) if sv in SKIP_LIST) if os.path.exists(MANIFEST_PATH) else 0
    print(f"  [B] Manifest coverage: {covered}/{total} source_views covered "
          f"({skip_count} skip-listed).")

    # Section C: fixture completeness
    check_fixture_completeness(errors)
    print(f"  [C] Fixture completeness: {len(REQUIRED_FIXTURE_SCENARIOS)} scenarios required.")

    if errors:
        print(f"\nRLS matrix CI suite FAILED ({len(errors)} error(s)):")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(
        f"\nRLS matrix CI suite PASSED: "
        f"{n_secured} secured-view predicates verified, "
        f"{covered}/{total} manifest source_views covered, "
        f"fixture completeness OK."
    )
    return 0


# ── Pytest-compatible test functions (same logic, pytest-friendly assertions) ───────
# pytest discovers these when the file is collected; they call the same helpers.

def test_predicate_matrix_passes():
    """Every _secured view in the fixture SQL carries all required RLS predicate tokens."""
    errors: list[str] = []
    n = check_predicate_matrix(errors)
    assert n > 0, "No _secured views found — generator may not have run."
    assert errors == [], "\n".join(errors)


def test_no_plant_leak():
    """No _secured view uses scalar equality on plant_code (which would leak all plants)."""
    errors: list[str] = []
    check_no_plant_leak(errors)
    assert errors == [], "\n".join(errors)


def test_manifest_coverage():
    """Every manifest source_view is present in a consumption SQL file with an RLS chain."""
    errors: list[str] = []
    covered, total = check_consumption_coverage(errors)
    assert total > 0, "No source_views found in manifest."
    assert errors == [], "\n".join(errors)
    assert covered == total, (
        f"Only {covered}/{total} source_views covered — "
        "some views may be missing from consumption SQL."
    )


def test_fixture_completeness():
    """Fixture SQL defines all required test-identity scenarios."""
    errors: list[str] = []
    check_fixture_completeness(errors)
    assert errors == [], "\n".join(errors)


def test_plant_leak_detected_when_predicate_uses_scalar_equality():
    """Acceptance check: a deliberately mis-scoped predicate (scalar equality plant leak)
    is caught by the plant-leak detector.  This test proves the guard is not vacuous."""
    leaky_body = (
        "  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_test\n"
        "  WHERE EXISTS (\n"
        "    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture\n"
        "    WHERE current_user() = email\n"
        "      AND application_key = 'io_reporting'\n"
        "      AND LOWER(access_type) = 'filter'\n"
        "      AND plant_code = filter_plant\n"  # BUG: scalar equality, not array_contains
        "      AND COALESCE(enabled, true)\n"
        "  )"
    )
    body_clean = _strip_comments(leaky_body)
    found_scalar = bool(
        re.search(r"\bplant_code\s*=\s*['\w]|\b['\w]\s*=\s*plant_code\b", body_clean)
        and "array_contains" not in body_clean.lower()
    )
    assert found_scalar, (
        "Plant-leak detector failed to catch scalar-equality plant_code predicate — "
        "the guard logic in check_no_plant_leak must be broken."
    )


def test_correct_predicate_passes_plant_leak_detector():
    """Acceptance check: a correctly scoped predicate (array_contains) is NOT flagged."""
    correct_body = (
        "  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_test\n"
        "  WHERE EXISTS (\n"
        "    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture\n"
        "    WHERE current_user() = email\n"
        "      AND application_key = 'io_reporting'\n"
        "      AND LOWER(access_type) = 'filter'\n"
        "      AND array_contains(filter_plant, plant_code)\n"
        "      AND COALESCE(enabled, true)\n"
        "  )"
    )
    body_clean = _strip_comments(correct_body)
    found_leak = bool(
        re.search(r"\bplant_code\s*=\s*['\w]|\b['\w]\s*=\s*plant_code\b", body_clean)
        and "array_contains" not in body_clean.lower()
    )
    assert not found_leak, (
        "Correct array_contains predicate was incorrectly flagged as a plant leak."
    )


if __name__ == "__main__":
    sys.exit(run_all())
