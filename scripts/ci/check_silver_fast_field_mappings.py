#!/usr/bin/env python3
"""Static guard: lock in the APPROVED silver_fast SAP WM/MM field mappings.

Functional sign-off (2026-06-07) fixed the silver_fast staging flows that previously failed analysis
on absent SAP columns. This guard prevents regression to the wrong/absent fields. See
source-contracts/sap/silver_fast_field_reconciliation.md and sap_unresolved_sources.yml.

It matches the FIELD-ACCESS form (a quoted `alias.FIELD` column reference), NOT bare token
substrings, so the explanatory comments in warehouse_fast.py (which legitimately name the old fields
to document the history) do not trip the guard.

Bans:
  * LTAP/LTBP invalid quantity columns:  alias.ANFME / .ENMNG / .ISPOS / .ENQTY  (absent on every
    table, so checked file-wide)
  * MSEG VBELN used as the delivery reference (use VBELN_IM/VBELP_IM):  alias.VBELN  (not VBELN_IM).
    Scoped to the `stg_goods_movement` body — VBELN is a real column on LTAK (transfer-order header),
    so a file-wide ban would false-positive on the legitimate `h.VBELN` there.
MCHB batch_stock invariants (scoped to the `def batch_stock()` body):
  * no apply_changes / streaming-CDC pattern (it is a snapshot/current-state materialized view)
  * no `stg_batch_stock` streaming view name
  * no read of MEINS / AERUNID / AERECNO / RecordActivity from the MCHB source alias `s` (base_uom
    comes from MARA; MCHB carries no CDC metadata)
  * MUST read materialmaster_mara (positive assertion — base_uom enrichment)
CHARG exact-preservation (repo-wide across all silver/tables/*.py):
  * CHARG is an exact SAP identifier — NO strip_zeros / trim / upper / pad / regexp on CHARG;
  * batch_number and batch_number_raw must each be a direct F.col("...CHARG...").alias(...).
"""
import glob
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../.."))
PRODUCT = os.path.join(REPO_ROOT, "data-products/io-reporting")
TABLES_DIR = os.path.join(PRODUCT, "silver", "tables")
TRANSFORM = os.path.join(PRODUCT, "silver", "tables", "warehouse_fast.py")

# Field-access bans: a quoted field reference, with an OPTIONAL alias prefix, so BOTH bare "ANFME" and
# alias-qualified "i.ANFME" are caught. The closing quote pins the exact field (VBELN != VBELN_IM).
INVALID_QTY_RE = re.compile(r"""["'](?:\w+\.)?(ANFME|ENMNG|ISPOS|ENQTY)["']""")
MSEG_VBELN_RE = re.compile(r"""["'](?:\w+\.)?VBELN["']""")  # bare/aliased VBELN; VBELN_IM/VBELP_IM allowed

# CHARG exact-preservation (repo-wide across silver transforms). CHARG is an exact SAP identifier:
# no strip_zeros / trim / display-normalisation. batch_number and batch_number_raw must both be a
# direct F.col(...CHARG...). See source-contracts/site_stage_gate_contract.md.
CHARG_STRIP_RE = re.compile(r"""strip_zeros\([^)]*CHARG""")
CHARG_TRIM_RE = re.compile(r"""(?:F\.)?trim\([^)]*CHARG""")
CHARG_OTHER_XFORM_RE = re.compile(
    r"""(?:upper|lower|lpad|rpad|substring|regexp_replace|ltrim|rtrim)\([^)]*CHARG"""
)
BATCH_ALIAS_RE = re.compile(r"""\.alias\(\s*["']batch_number(?:_raw)?["']\s*\)""")
BATCH_ALLOWED_RE = re.compile(
    r"""F\.col\(\s*["'][^"']*CHARG["']\s*\)\.alias\(\s*["']batch_number(?:_raw)?["']\s*\)"""
)


def _extract_fn_body(text: str, fn_name: str) -> str:
    """Return the source of `def <fn_name>()` (the body, up to the next top-level
    def/decorator/section marker). Used to scope per-flow invariants."""
    lines = text.splitlines()
    start = next((i for i, ln in enumerate(lines) if ln.startswith(f"def {fn_name}(")), None)
    if start is None:
        return ""
    end = len(lines)
    for j in range(start + 1, len(lines)):
        ln = lines[j]
        if ln.startswith(("def ", "@dlt", "dlt.")) or ln.startswith("# ─"):
            end = j
            break
    return "\n".join(lines[start:end])


def run_checks() -> int:
    print("Running silver_fast approved-mapping check...")
    errors = []

    if not os.path.exists(TRANSFORM):
        print(f"  - ERROR: {TRANSFORM} not found")
        return 1
    text = open(TRANSFORM, encoding="utf-8").read()
    rel = os.path.relpath(TRANSFORM, REPO_ROOT)

    # File-wide: invalid LTAP/LTBP quantity fields (absent on every table → safe to ban anywhere).
    for i, line in enumerate(text.splitlines(), 1):
        if INVALID_QTY_RE.search(line):
            errors.append(
                f"[{rel}:{i}] references an invalid LTAP/LTBP quantity field (ANFME/ENMNG/ISPOS/ENQTY) — "
                f"use the approved fields VSOLM (requested) / VISTA (confirmed, picked alias) / "
                f"greatest(MENGE-TAMEN,0) (open). See silver_fast_field_reconciliation.md"
            )

    # MSEG VBELN-as-delivery: scoped to stg_goods_movement (VBELN is legitimate on LTAK elsewhere).
    mseg_body = _extract_fn_body(text, "stg_goods_movement")
    if not mseg_body:
        errors.append(f"[{rel}] could not locate `def stg_goods_movement()`")
    elif MSEG_VBELN_RE.search(mseg_body):
        errors.append(
            f"[{rel}] stg_goods_movement references MSEG VBELN as the delivery reference — use "
            f"VBELN_IM/VBELP_IM (the IM delivery reference). See silver_fast_field_reconciliation.md"
        )

    # MCHB batch_stock snapshot/current-state invariants (scoped to the function body).
    body = _extract_fn_body(text, "batch_stock")
    if not body:
        errors.append(f"[{rel}] could not locate `def batch_stock()` — expected the MCHB snapshot MV")
    else:
        if "apply_changes" in body or "create_streaming_table" in body:
            errors.append(
                f"[{rel}] batch_stock uses apply_changes/create_streaming_table — MCHB must be a "
                f"snapshot/current-state materialized view (no CDC; MCHB lacks AERUNID/AERECNO)"
            )
        if "stg_batch_stock" in body:
            errors.append(
                f"[{rel}] batch_stock references the removed `stg_batch_stock` streaming view — "
                f"MCHB is now a single snapshot @dlt.table"
            )
        if re.search(r"""["']s\.(MEINS|AERUNID|AERECNO|RecordActivity)["']""", body):
            errors.append(
                f"[{rel}] batch_stock reads MEINS/AERUNID/AERECNO/RecordActivity from the MCHB source — "
                f"these are absent on MCHB; base_uom must come from MARA.MEINS and there is no CDC sequencing"
            )
        if "materialmaster_mara" not in body:
            errors.append(
                f"[{rel}] batch_stock does not read materialmaster_mara — base_uom must be enriched "
                f"from MARA.MEINS (MCHB carries no unit)"
            )

    # ── CHARG exact-preservation (repo-wide across silver transforms) ──────────────────────────────
    for path in sorted(glob.glob(os.path.join(TABLES_DIR, "*.py"))):
        frel = os.path.relpath(path, REPO_ROOT)
        for i, line in enumerate(open(path, encoding="utf-8").read().splitlines(), 1):
            if CHARG_STRIP_RE.search(line):
                errors.append(f"[{frel}:{i}] strip_zeros() applied to CHARG — CHARG is an exact SAP "
                              f"identifier; preserve as replicated (F.col(...CHARG...)).")
            if CHARG_TRIM_RE.search(line):
                errors.append(f"[{frel}:{i}] trim() applied to CHARG — do not trim an exact batch identifier.")
            if CHARG_OTHER_XFORM_RE.search(line):
                errors.append(f"[{frel}:{i}] CHARG is transformed (upper/lower/pad/regexp/...) — preserve exactly.")
            # batch_number / batch_number_raw must be a direct F.col(...CHARG...) — nothing else.
            if BATCH_ALIAS_RE.search(line) and not BATCH_ALLOWED_RE.search(line):
                errors.append(
                    f"[{frel}:{i}] batch_number/batch_number_raw must be a direct "
                    f'F.col("...CHARG...").alias(...) — got a transformed or non-CHARG expression.'
                )

    if errors:
        print("\nsilver_fast approved-mapping check FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("\nsilver_fast approved-mapping check passed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(run_checks())
