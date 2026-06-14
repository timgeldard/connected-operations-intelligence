#!/usr/bin/env python3
"""CI guard: no artefact may set VACUUM retention below 168 h or shorten Delta
log/file retention on silver tables without an allowlisted reviewed reason.

ADR 017 decision 6 (hard rule):
  Silver tables serve CDF to downstream incremental consumers. Aggressive VACUUM
  retention (e.g. RETAIN 24 HOURS) destroys unconsumed change history and is prohibited
  without a specific reviewed reason.

What this guard scans:
  1. SQL artefacts under data-products/io-reporting/resources/sql/ and
     scripts/ci/**/*.sql — for VACUUM ... RETAIN <N> HOUR/MINUTE/SECOND patterns.
  2. Python source files under data-products/io-reporting/ — for spark.sql("VACUUM ...")
     string literals carrying RETAIN with a short value.
  3. YAML pipeline/job configs under data-products/io-reporting/resources/ — for
     delta.deletedFileRetentionDuration and delta.logRetentionDuration properties that
     set a non-default (< 7 days) retention on a silver table without an allowlist entry.

Failing conditions:
  - VACUUM ... RETAIN <N> HOURS where N < 168 (7 days)
  - VACUUM ... RETAIN <N> MINUTES  (always below 168h)
  - VACUUM ... RETAIN <N> SECONDS  (always below 168h)
  - delta.deletedFileRetentionDuration or delta.logRetentionDuration with a value
    that resolves to less than 168 hours, unless the table is in ALLOWLIST below.

Allowlist: if a genuinely short retention is approved (e.g. a transient audit table),
add an entry to ALLOWLIST below with the reviewed reason.  CI reviewers enforce that
allowlist entries are accompanied by an ADR or a documented decision.

Exit 0 = clean; exit 1 = violation.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import NamedTuple

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
PRODUCT = REPO_ROOT / "data-products" / "io-reporting"

DEFAULT_RETENTION_HOURS = 168  # 7 days — Databricks / Delta default

# Scan SQL files in these globs (relative to REPO_ROOT)
SQL_GLOBS = [
    "data-products/io-reporting/resources/sql/*.sql",
    "data-products/io-reporting/scripts/*.sql",
    "scripts/ci/*.sql",
]

# Scan Python files in this directory tree for spark.sql("VACUUM ...") literals
PYTHON_SCAN_DIR = PRODUCT

# Scan YAML pipeline/job config files
YAML_SCAN_DIR = PRODUCT / "resources"

# ---------------------------------------------------------------------------
# Allowlist — reviewed short-retention exceptions
# ---------------------------------------------------------------------------
# Format: {object_name_or_path: reason_string}
# object_name_or_path is matched as a substring of the file path or table name.
# Reviewers MUST verify that an entry here is accompanied by an ADR or design doc
# explaining why sub-168h retention is safe for that specific object.
ALLOWLIST: dict[str, str] = {
    # Example (do not add without review):
    # "gold_spc_query_audit": "ADR 016 — 90-day audit table; no downstream CDF consumers",
}

# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

# Matches: VACUUM [table] RETAIN <number> HOUR[S]|MINUTE[S]|SECOND[S]|DAY[S]
# Captures: value (float), unit
_VACUUM_RE = re.compile(
    r"\bVACUUM\b[^;]*?\bRETAIN\b\s+(?P<value>[0-9]+(?:\.[0-9]+)?)\s+"
    r"(?P<unit>HOUR[S]?|MINUTE[S]?|SECOND[S]?|DAY[S]?)",
    re.IGNORECASE,
)

# Matches delta property values like "interval 24 hours", "24h", "P7D", "168 hours", etc.
# We only flag the explicit short-form numeric intervals; ISO 8601 durations ("P7D") are
# the Databricks default and we treat them as safe/unknown (do not parse ISO 8601 here).
_DELTA_PROP_RE = re.compile(
    r"(?:delta\.deletedFileRetentionDuration|delta\.logRetentionDuration)"
    r"\s*[=:]\s*['\"]?(?:interval\s+)?(?P<value>[0-9]+(?:\.[0-9]+)?)\s*"
    r"(?P<unit>hour[s]?|minute[s]?|second[s]?|day[s]?)['\"]?",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class Violation(NamedTuple):
    path: str
    lineno: int
    message: str


def _to_hours(value: float, unit: str) -> float:
    u = unit.lower().rstrip("s")
    if u == "hour":
        return value
    if u == "minute":
        return value / 60.0
    if u == "second":
        return value / 3600.0
    if u == "day":
        return value * 24.0
    return value  # unknown unit — return as-is (conservative: won't flag)


def _is_allowlisted(path_str: str, match_context: str) -> str | None:
    """Return the allowlist reason if the path or context matches an allowlist entry, else None."""
    for key, reason in ALLOWLIST.items():
        if key in path_str or key in match_context:
            return reason
    return None


def _scan_sql_content(source: str, rel: str) -> list[Violation]:
    violations: list[Violation] = []
    lines = source.splitlines()
    for lineno, line in enumerate(lines, start=1):
        # Skip comment lines
        stripped = line.strip()
        if stripped.startswith("--"):
            continue

        for m in _VACUUM_RE.finditer(line):
            value = float(m.group("value"))
            unit = m.group("unit")
            hours = _to_hours(value, unit)
            if hours < DEFAULT_RETENTION_HOURS:
                allowlist_reason = _is_allowlisted(rel, line)
                if allowlist_reason:
                    continue
                violations.append(Violation(
                    path=rel,
                    lineno=lineno,
                    message=(
                        f"VACUUM RETAIN {value} {unit} ({hours:.1f} h) is below the "
                        f"{DEFAULT_RETENTION_HOURS} h minimum. Silver tables serve CDF to "
                        "downstream incremental consumers — short retention destroys "
                        "unconsumed change history (ADR 017 decision 6). Add an allowlist "
                        "entry in scripts/ci/check_vacuum_retention.py with a reviewed reason "
                        "if this is intentional."
                    ),
                ))

        for m in _DELTA_PROP_RE.finditer(line):
            value = float(m.group("value"))
            unit = m.group("unit")
            hours = _to_hours(value, unit)
            if hours < DEFAULT_RETENTION_HOURS:
                allowlist_reason = _is_allowlisted(rel, line)
                if allowlist_reason:
                    continue
                violations.append(Violation(
                    path=rel,
                    lineno=lineno,
                    message=(
                        f"Delta retention property set to {value} {unit} ({hours:.1f} h), "
                        f"below the {DEFAULT_RETENTION_HOURS} h minimum on a silver/gold "
                        "table artefact (ADR 017 decision 6). Add an allowlist entry in "
                        "scripts/ci/check_vacuum_retention.py with a reviewed reason."
                    ),
                ))

    return violations


def scan_sql_files() -> list[Violation]:
    import glob as _glob
    violations: list[Violation] = []
    for pattern in SQL_GLOBS:
        for path_str in _glob.glob(str(REPO_ROOT / pattern)):
            rel = str(Path(path_str).relative_to(REPO_ROOT)).replace(os.sep, "/")
            try:
                source = Path(path_str).read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            violations.extend(_scan_sql_content(source, rel))
    return violations


def scan_python_files() -> list[Violation]:
    """Scan Python source files for spark.sql("VACUUM ...") string literals."""
    import ast

    violations: list[Violation] = []
    for path in sorted(PYTHON_SCAN_DIR.rglob("*.py")):
        rel = str(path.relative_to(REPO_ROOT)).replace(os.sep, "/")
        try:
            source = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        # Fast pre-filter: skip files with no VACUUM keyword
        if "VACUUM" not in source.upper():
            continue

        try:
            tree = ast.parse(source, filename=rel)
        except SyntaxError:
            continue

        for node in ast.walk(tree):
            if not isinstance(node, ast.Constant):
                continue
            if not isinstance(node.value, str):
                continue
            sql_literal = node.value
            if "VACUUM" not in sql_literal.upper():
                continue
            for m in _VACUUM_RE.finditer(sql_literal):
                value = float(m.group("value"))
                unit = m.group("unit")
                hours = _to_hours(value, unit)
                if hours < DEFAULT_RETENTION_HOURS:
                    allowlist_reason = _is_allowlisted(rel, sql_literal)
                    if allowlist_reason:
                        continue
                    violations.append(Violation(
                        path=rel,
                        lineno=node.lineno,
                        message=(
                            f"SQL string literal contains VACUUM RETAIN {value} {unit} "
                            f"({hours:.1f} h), below the {DEFAULT_RETENTION_HOURS} h minimum "
                            "(ADR 017 decision 6)."
                        ),
                    ))

    return violations


def scan_yaml_files() -> list[Violation]:
    """Scan YAML pipeline/job config for explicit short-retention Delta properties."""
    violations: list[Violation] = []
    for path in sorted(YAML_SCAN_DIR.rglob("*.yml")):
        rel = str(path.relative_to(REPO_ROOT)).replace(os.sep, "/")
        try:
            source = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        if "deletedFileRetentionDuration" not in source and "logRetentionDuration" not in source:
            continue

        violations.extend(_scan_sql_content(source, rel))

    return violations


# ---------------------------------------------------------------------------
# Self-test helpers (used in unit tests)
# ---------------------------------------------------------------------------

def scan_source(source: str, rel: str) -> list[Violation]:
    """Pure function for unit testing: scan a single source string."""
    return _scan_sql_content(source, rel)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def check() -> list[Violation]:
    violations: list[Violation] = []
    violations.extend(scan_sql_files())
    violations.extend(scan_python_files())
    violations.extend(scan_yaml_files())
    return violations


def main() -> int:
    errs = check()
    if errs:
        print("VACUUM retention guard: FAILED")
        for e in errs:
            print(f"  {e.path}:{e.lineno}: {e.message}")
        return 1
    print(
        f"VACUUM retention guard: OK (no artefacts set retention below "
        f"{DEFAULT_RETENTION_HOURS} h)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
