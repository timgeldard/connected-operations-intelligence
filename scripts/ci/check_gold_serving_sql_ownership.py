#!/usr/bin/env python3
"""CI check to enforce secured/live serving-view ownership boundaries.

Rules:
1. gold_security_*.sql must not contain date-relative logic (e.g. current_date).
2. gold_security_*.sql views must be pass-throughs (SELECT * FROM <base> [WHERE EXISTS ...]).
3. gold_serving_views_*.sql (live views) may contain current_date.
4. warehouse360_consumption_views_*.sql must not re-calculate date-relative fields using current_date.
"""

import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SQL_DIR = os.path.join(REPO_ROOT, "data-products/io-reporting/resources/sql")

FORBIDDEN_SECURED_PATTERNS = [
    r"current_date",
    r"date_sub",
    r"date_add",
    r"datediff",
    r"days_to_",
    r"risk_band",
    r"expiry_bucket",
    r"min_days_to_expiry",
]


def check_secured_view_statement(stmt: str) -> str:
    """Validate that a secured view is a simple pass-through."""
    # Strip comments first
    stmt_clean = re.sub(r'--.*$', '', stmt, flags=re.MULTILINE)
    stmt_clean = re.sub(r'/\*.*?\*/', '', stmt_clean, flags=re.DOTALL).strip()
    if not stmt_clean:
        return None

    match_view = re.search(r'CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([^\s]+)\s+AS\s+(.*)', stmt_clean, re.IGNORECASE | re.DOTALL)
    if not match_view:
        # Ignore non-view statements (like GRANT or variable declarations)
        return None

    view_name = match_view.group(1).strip()
    body = match_view.group(2).strip()

    # Check for pass-through: SELECT * FROM <base> [WHERE EXISTS ...]
    match_select = re.match(r'SELECT\s+\*\s+FROM\s+([^\s;]+)(.*)', body, re.IGNORECASE | re.DOTALL)
    if not match_select:
        return f"View '{view_name}' is not a pass-through SELECT * (found: '{body[:100]}...')"

    remainder = match_select.group(2).strip()
    if remainder:
        remainder_clean = remainder.rstrip(';').strip()
        if remainder_clean:
            if not re.match(r'^WHERE\s+EXISTS\s*\(', remainder_clean, re.IGNORECASE | re.DOTALL):
                return f"View '{view_name}' has invalid logic/remainder after SELECT * (found: '{remainder_clean[:100]}...')"

    return None


def run_checks() -> list[str]:
    errors = []

    # Verify that SQL directory exists
    if not os.path.exists(SQL_DIR):
        errors.append(f"SQL resources directory does not exist: {SQL_DIR}")
        return errors

    # Find relevant files
    files = os.listdir(SQL_DIR)
    secured_files = ["gold_security_dev.sql", "gold_security_uat.sql", "gold_security_prod.sql"]
    secured_files = [f for f in secured_files if f in files]
    consumption_files = [f for f in files if f.startswith("warehouse360_consumption_views_") and f.endswith(".sql")]

    # Check 1 & 2: Secured views must not contain date-relative logic and must be pass-throughs
    for sf in secured_files:
        file_path = os.path.join(SQL_DIR, sf)
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Strip comments before checking for forbidden patterns
        content_clean = re.sub(r'--.*$', '', content, flags=re.MULTILINE)
        content_clean = re.sub(r'/\*.*?\*/', '', content_clean, flags=re.DOTALL)

        # Check Rule 1: No forbidden date-relative patterns in the file
        for pattern in FORBIDDEN_SECURED_PATTERNS:
            if re.search(pattern, content_clean, re.IGNORECASE):
                errors.append(f"[{sf}] Violation: Contains forbidden pattern '{pattern}'")

        # Check Rule 2: Pass-through structure for views
        statements = content.split(";")
        for stmt in statements:
            err = check_secured_view_statement(stmt)
            if err:
                errors.append(f"[{sf}] Violation: {err}")

    # Check 4: Consumption views must not contain current_date()
    for cf in consumption_files:
        file_path = os.path.join(SQL_DIR, cf)
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Strip comments before checking for current_date
        content_clean = re.sub(r'--.*$', '', content, flags=re.MULTILINE)
        content_clean = re.sub(r'/\*.*?\*/', '', content_clean, flags=re.DOTALL)

        if "current_date" in content_clean.lower():
            errors.append(f"[{cf}] Violation: Re-calculates date-relative fields using 'current_date()'")

    return errors


def main() -> int:
    errors = run_checks()
    if errors:
        print("ERROR: Gold Serving SQL Ownership Guard failed:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    print("Gold Serving SQL Ownership Guard: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
