#!/usr/bin/env python3
"""CI guard: CSV risk_reason_taxonomy ↔ gold_risk_reason_taxonomy DLT function parity.

Checks:
  1. All reason_codes from resources/config/risk_reason_taxonomy.csv appear as F.lit(...)
     references in gold/op_risk_gold.py (or are referenced via REASON_CODES from risk_common.py).
  2. No duplicate reason_codes in the CSV.
  3. Required CSV fields are present in every row.

Exit 0 = OK; exit 1 = violation.

Run from data-products/io-reporting/ or the repo root.
"""
from __future__ import annotations

import csv
import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths — resolve relative to this script's location.
# ---------------------------------------------------------------------------
_HERE = Path(__file__).resolve()
_PRODUCT = _HERE.parents[2]  # data-products/io-reporting/
_CSV = _PRODUCT / "resources" / "config" / "risk_reason_taxonomy.csv"
_OP_RISK_PY = _PRODUCT / "gold" / "op_risk_gold.py"
_RISK_COMMON_PY = _PRODUCT / "gold" / "risk_common.py"

REQUIRED_FIELDS = ("reason_code", "domain", "label", "default_responsible_function", "default_severity_hint")


def check() -> list[str]:
    errors: list[str] = []

    # 1. CSV must exist.
    if not _CSV.exists():
        return [f"{_CSV}: CSV taxonomy file not found"]

    # 2. Parse CSV.
    with open(_CSV, encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    # 3. Required fields present in every row.
    for i, row in enumerate(rows, start=2):  # row 1 = header
        for field in REQUIRED_FIELDS:
            if field not in row or not row[field].strip():
                errors.append(f"{_CSV}:{i}: missing or empty required field '{field}' (row: {row})")

    # 4. No duplicate reason_codes.
    seen: set[str] = set()
    for i, row in enumerate(rows, start=2):
        code = row.get("reason_code", "").strip()
        if not code:
            continue
        if code in seen:
            errors.append(f"{_CSV}:{i}: duplicate reason_code '{code}'")
        seen.add(code)

    csv_codes = {row["reason_code"].strip() for row in rows if row.get("reason_code", "").strip()}

    # 5. Each CSV code must appear in op_risk_gold.py or risk_common.py.
    if not _OP_RISK_PY.exists():
        errors.append(f"{_OP_RISK_PY}: file not found")
        return errors
    if not _RISK_COMMON_PY.exists():
        errors.append(f"{_RISK_COMMON_PY}: file not found")
        return errors

    op_risk_src = _OP_RISK_PY.read_text(encoding="utf-8")
    risk_common_src = _RISK_COMMON_PY.read_text(encoding="utf-8")
    combined_src = op_risk_src + risk_common_src

    for code in sorted(csv_codes):
        # Accept: F.lit("CODE"), "CODE", or REASON_CODES["CODE"] references.
        if f'"{code}"' not in combined_src and f"'{code}'" not in combined_src:
            errors.append(
                f"{_OP_RISK_PY}: reason_code '{code}' from CSV not referenced in "
                f"op_risk_gold.py or risk_common.py — add F.lit(\"{code}\") or load via REASON_CODES"
            )

    return errors


def main() -> int:
    errs = check()
    if errs:
        print("Risk taxonomy parity check: FAILED")
        for e in errs:
            print(f"  - {e}")
        return 1
    print("Risk taxonomy parity check: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
