#!/usr/bin/env python3
"""Static guard: every Bronze->Silver output is stage-gate classified, and ENFORCED flows apply the gate.

Driven by source-contracts/silver_stage_gate_inventory.yml + the contract site_stage_gate_contract.md.

Fails if:
  * a Silver output defined in silver/tables/*.py is ABSENT from the inventory (every table must be
    classified ENFORCED / EXEMPT / BLOCKED / NEEDS_MAPPING);
  * an ENFORCED table's file does not apply a gate helper (apply_plant_gate / apply_warehouse_gate);
  * an EXEMPT entry has no exempt_reason;
  * a hard-coded plant filter (literal plant code) appears in transformation code;
  * CHARG is normalised (strip_zeros on a CHARG column) in a file WITHOUT preserving a raw batch field.

NEEDS_MAPPING / BLOCKED are allowed (tracked backlog) — they do not fail the build.
"""
import glob
import os
import re
import sys

try:
    import yaml
except ImportError:
    print("PyYAML required (pip install pyyaml)")
    sys.exit(2)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../.."))
PRODUCT = os.path.join(REPO_ROOT, "data-products/io-reporting")
TABLES_DIR = os.path.join(PRODUCT, "silver", "tables")
INVENTORY = os.path.join(PRODUCT, "source-contracts", "silver_stage_gate_inventory.yml")

GATE_HELPERS = ("apply_plant_gate", "apply_warehouse_gate")
# Literal plant filter: a quoted SAP plant code (e.g. 'C061', "P223") compared/isin in code.
HARDCODED_PLANT_RE = re.compile(
    r"""(WERKS|plant_code|plant_id)["']?\s*(==|\.isin|isin|\.eqNullSafe)\s*[\(\[]?\s*["'][A-Z]\d{3}["']"""
)
STRIP_CHARG_RE = re.compile(r"""strip_zeros\(\s*["'][^"']*CHARG["']\s*\)""")
RAW_BATCH_RE = re.compile(r"""batch_number_raw|CHARG["']\s*\)\s*\.alias\(\s*["'][^"']*_raw""")


def _silver_outputs_in_code():
    """Return {output_name: file_relpath}. Materialized outputs only (skip @dlt.view / stg_ staging)."""
    outputs = {}
    for path in sorted(glob.glob(os.path.join(TABLES_DIR, "*.py"))):
        rel = os.path.relpath(path, REPO_ROOT)
        lines = open(path, encoding="utf-8").read().splitlines()
        i = 0
        while i < len(lines):
            line = lines[i]
            # create_streaming_table(name="X")
            m = re.search(r'create_streaming_table\(\s*name="([^"]+)"', line)
            if not m:
                # name= may be on the next line
                if "create_streaming_table(" in line:
                    for j in range(i, min(i + 4, len(lines))):
                        mm = re.search(r'name="([^"]+)"', lines[j])
                        if mm:
                            outputs[mm.group(1)] = rel
                            break
            else:
                outputs[m.group(1)] = rel
            # @dlt.table  -> scan the decorator stack to the def; capture name= if present else def name
            if re.match(r"\s*@dlt\.table\b", line):
                name = None
                for j in range(i, min(i + 25, len(lines))):
                    mm = re.search(r'name="([^"]+)"', lines[j])
                    if mm and name is None:
                        name = mm.group(1)
                    dm = re.match(r"\s*def\s+(\w+)\(", lines[j])
                    if dm:
                        name = name or dm.group(1)
                        break
                if name:
                    outputs[name] = rel
            i += 1
    # staging views are not materialized outputs
    return {k: v for k, v in outputs.items() if not k.startswith("stg_")}


def _fn_body(src: str, fn_names) -> str | None:
    """Body of the first `def <fn>(` in fn_names, up to the next top-level def/decorator/section marker.
    Returns None if no candidate function is defined in src."""
    lines = src.splitlines()
    start = next(
        (i for i, ln in enumerate(lines) if any(ln.startswith(f"def {fn}(") for fn in fn_names)),
        None,
    )
    if start is None:
        return None
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if lines[j].startswith(("def ", "@dlt", "dlt.")) or lines[j].startswith("# ─"):
            end = j
            break
    return "\n".join(lines[start:end])


def run_checks() -> int:
    print("Running silver stage-gate coverage check...")
    errors = []
    inv = yaml.safe_load(open(INVENTORY, encoding="utf-8"))
    entries = {e["table_name"]: e for e in inv["silver_outputs"]}

    code_outputs = _silver_outputs_in_code()

    # 1. Every code output must be classified.
    for name, rel in sorted(code_outputs.items()):
        if name not in entries:
            errors.append(
                f"[{rel}] Silver output '{name}' is NOT in silver_stage_gate_inventory.yml — "
                f"classify it ENFORCED/EXEMPT/BLOCKED/NEEDS_MAPPING."
            )

    # 2. ENFORCED -> the output's PRODUCING FUNCTION applies a gate helper (per-function, not file-level:
    #    a file-level check lets one gated output mask another that forgot the gate). EXEMPT -> reason.
    file_cache = {}
    for name, e in entries.items():
        status = e.get("current_status")
        rel = e.get("file", "")
        if status == "EXEMPT" and not e.get("exempt_reason"):
            errors.append(f"[{name}] EXEMPT without exempt_reason.")
        if status == "ENFORCED":
            # inventory `file:` paths are relative to the io-reporting product dir
            path = os.path.join(PRODUCT, rel) if rel else None
            src = ""
            if path and os.path.exists(path):
                src = file_cache.setdefault(path, open(path, encoding="utf-8").read())
            # producing function = the materialized name, or its `stg_` staging view (warehouse flows
            # gate inside the stg_ view that feeds create_streaming_table).
            body = _fn_body(src, [name, f"stg_{name}"])
            scope, where = (body, f"function for '{name}'") if body is not None else (src, f"file (fn not found) for '{name}'")
            if not any(h in scope for h in GATE_HELPERS):
                errors.append(
                    f"[{rel}] '{name}' is ENFORCED but the {where} calls no gate helper "
                    f"({' / '.join(GATE_HELPERS)})."
                )

    # 3. No hard-coded plant filters; CHARG normalised must preserve a raw batch field.
    for path in sorted(glob.glob(os.path.join(TABLES_DIR, "*.py"))):
        rel = os.path.relpath(path, REPO_ROOT)
        src = open(path, encoding="utf-8").read()
        for n, ln in enumerate(src.splitlines(), 1):
            if HARDCODED_PLANT_RE.search(ln):
                errors.append(
                    f"[{rel}:{n}] hard-coded plant literal in transformation code — use the gate config, "
                    f"not a literal plant list."
                )
        if STRIP_CHARG_RE.search(src) and not RAW_BATCH_RE.search(src):
            errors.append(
                f"[{rel}] normalises CHARG (strip_zeros) without preserving a raw batch field "
                f"(batch_number_raw). Preserve the raw SAP key."
            )

    if errors:
        print("\nSilver stage-gate coverage check FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(
        f"\nSilver stage-gate coverage check passed: {len(code_outputs)} code outputs, "
        f"{len(entries)} classified."
    )
    return 0


if __name__ == "__main__":
    sys.exit(run_checks())
