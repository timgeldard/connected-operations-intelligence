#!/usr/bin/env python3
"""CI guard: scan consumption SQL views for prohibited action verbs.

Scans data-products/io-reporting/resources/sql/*consumption*.sql for wording that
implies direct actions (release, approve, confirm, reschedule, etc.) in risk/quality
contexts. These views are read-only advisory surfaces; action language is prohibited.

Prohibited patterns (case-insensitive, in SQL view bodies):
  - \\bRelease\\b          (but NOT in column names ending with _date or _status)
  - \\bApprove\\b
  - \\bConfirm TO\\b or \\bConfirm batch\\b
  - \\bReschedule\\b
  - \\bCleared\\b          (as an imperative, e.g. "Cleared for shipment")
  - Safe to ship

Mode:
  Default (report-only): prints WARNINGs, exits 0.
  --strict              : exits 1 on any finding.

Usage:
  python scripts/ci/check_advisory_wording.py [--strict] [--help]

Run from the repo root.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
SQL_DIR = REPO_ROOT / "data-products" / "io-reporting" / "resources" / "sql"

# ---------------------------------------------------------------------------
# Prohibited patterns: (compiled_regex, description)
# ---------------------------------------------------------------------------

# Matches 'Release' as a standalone word but NOT as part of column names like
# release_date, release_status, quality_release_status, etc.
_RELEASE = re.compile(r"\bRelease\b(?!\s*_)", re.IGNORECASE)
_APPROVE = re.compile(r"\bApprove\b", re.IGNORECASE)
_CONFIRM_TO = re.compile(r"\bConfirm\s+TO\b", re.IGNORECASE)
_CONFIRM_BATCH = re.compile(r"\bConfirm\s+batch\b", re.IGNORECASE)
_RESCHEDULE = re.compile(r"\bReschedule\b", re.IGNORECASE)
_CLEARED = re.compile(r"\bCleared\b(?!\s*_)", re.IGNORECASE)
_SAFE_TO_SHIP = re.compile(r"Safe\s+to\s+ship", re.IGNORECASE)

PROHIBITED_PATTERNS: list[tuple[re.Pattern, str]] = [
    (_RELEASE, "prohibited action verb: Release (use 'released' / 'release_status' column name forms only)"),
    (_APPROVE, "prohibited action verb: Approve"),
    (_CONFIRM_TO, "prohibited action phrase: Confirm TO"),
    (_CONFIRM_BATCH, "prohibited action phrase: Confirm batch"),
    (_RESCHEDULE, "prohibited action verb: Reschedule"),
    (_CLEARED, "prohibited action verb: Cleared (use 'cleared_for_shipment' column name forms only)"),
    (_SAFE_TO_SHIP, "prohibited action phrase: Safe to ship"),
]


def scan_file(path: Path) -> list[str]:
    """Return list of warning strings for a single SQL file."""
    findings: list[str] = []
    with open(path, encoding="utf-8") as fh:
        lines = fh.readlines()
    for lineno, line in enumerate(lines, start=1):
        # Skip pure SQL comment lines (advisory intent in comments is OK).
        stripped = line.lstrip()
        if stripped.startswith("--"):
            continue
        for pattern, description in PROHIBITED_PATTERNS:
            if pattern.search(line):
                findings.append(
                    f"WARNING: {path.name}:{lineno} — {description}\n"
                    f"         {line.rstrip()}"
                )
    return findings


def find_consumption_sql_files(sql_dir: Path) -> list[Path]:
    """Return all *consumption*.sql files under sql_dir."""
    if not sql_dir.exists():
        return []
    return sorted(
        p for p in sql_dir.iterdir()
        if p.is_file() and "consumption" in p.name.lower() and p.suffix == ".sql"
    )


def run(strict: bool = False, sql_dir: Path | None = None) -> int:
    """Scan files and return exit code. Testable without sys.exit."""
    target_dir = sql_dir or SQL_DIR
    files = find_consumption_sql_files(target_dir)

    if not files:
        print(f"check_advisory_wording: no *consumption*.sql files found under {target_dir}")
        return 0

    all_findings: list[str] = []
    for f in files:
        all_findings.extend(scan_file(f))

    if all_findings:
        for finding in all_findings:
            print(finding)
        if strict:
            print(
                f"\ncheck_advisory_wording: FAILED (--strict) — {len(all_findings)} prohibited wording instance(s)."
            )
            return 1
        print(
            f"\ncheck_advisory_wording: {len(all_findings)} warning(s) — report-only mode (pass --strict to fail)."
        )
        return 0

    print(f"check_advisory_wording: OK — {len(files)} file(s) scanned, no prohibited wording.")
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 when any prohibited wording is found (default: report-only, exit 0).",
    )
    args = parser.parse_args(argv)
    return run(strict=args.strict)


if __name__ == "__main__":
    sys.exit(main())
