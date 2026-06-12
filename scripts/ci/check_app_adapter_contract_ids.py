#!/usr/bin/env python3
"""Guard: every contract reference in apps/api adapters must exist in the
data-products manifest — at ID level AND column level.

ID level: scans apps/api/adapters/ and apps/api/routes/ for literal string
contract IDs (patterns: contract="...", contract_id="...", "contract": "...")
and verifies each one exists in
data-products/io-reporting/contracts/app_contract_manifest.yml.

Column level (consumer-driven contract test): for adapter dataset specs of the
shape dict(contract="...", columns="a, b, c", ...) — the SIMPLE_DATASETS
pattern — every column the adapter selects must be declared in that contract's
``fields`` list. A producer renaming/removing a field the app consumes turns
into a red PR here instead of a runtime 500.
"""
from __future__ import annotations

import ast
import functools
import re
import sys
from pathlib import Path
from typing import Set

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = REPO_ROOT / "data-products/io-reporting/contracts/app_contract_manifest.yml"

# Directories to scan for contract ID references
SCAN_DIRS = [
    REPO_ROOT / "apps/api/adapters",
    REPO_ROOT / "apps/api/routes",
]

# Patterns that match literal contract ID strings in Python source code:
#   contract="wm_operations.worklist"
#   contract_id="warehouse360.overview"
#   "contract": "wm_operations.outbound"
CONTRACT_ID_RE = re.compile(
    r'(?:contract(?:_id)?\s*=\s*["\']|"contract"\s*:\s*["\'])([a-z0-9_]+\.[a-z0-9_]+)["\']'
)


def collect_referenced_ids(scan_dirs: list[Path]) -> dict[str, list[str]]:
    """Return mapping of contract_id -> list of file:line occurrences."""
    refs: dict[str, list[str]] = {}
    for scan_dir in scan_dirs:
        if not scan_dir.exists():
            continue
        for py_file in scan_dir.rglob("*.py"):
            source = py_file.read_text(encoding="utf-8", errors="replace")
            for lineno, line in enumerate(source.splitlines(), start=1):
                for match in CONTRACT_ID_RE.finditer(line):
                    cid = match.group(1)
                    location = f"{py_file.relative_to(REPO_ROOT)}:{lineno}"
                    refs.setdefault(cid, []).append(location)
    return refs


def collect_column_specs(scan_dirs: list[Path]) -> list[tuple[str, list[str], str]]:
    """Return (contract_id, columns, location) for every dict(contract=..., columns=...) spec.

    Uses the AST so multi-line implicit string concatenation in ``columns`` is
    handled exactly as Python sees it.
    """
    specs: list[tuple[str, list[str], str]] = []
    for scan_dir in scan_dirs:
        if not scan_dir.exists():
            continue
        for py_file in scan_dir.rglob("*.py"):
            source = py_file.read_text(encoding="utf-8", errors="replace")
            try:
                tree = ast.parse(source)
            except SyntaxError:
                continue
            for node in ast.walk(tree):
                if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "dict"):
                    continue
                kw = {k.arg: k.value for k in node.keywords if k.arg}
                contract_node, columns_node = kw.get("contract"), kw.get("columns")
                if not (
                    isinstance(contract_node, ast.Constant) and isinstance(contract_node.value, str)
                    and isinstance(columns_node, ast.Constant) and isinstance(columns_node.value, str)
                ):
                    continue
                columns = [c.strip() for c in columns_node.value.split(",") if c.strip()]
                location = f"{py_file.relative_to(REPO_ROOT)}:{node.lineno}"
                specs.append((contract_node.value, columns, location))
    return specs


@functools.lru_cache(maxsize=None)
def _load_manifest_yaml(manifest_path: Path) -> dict:
    """Parse and cache the manifest YAML.  Called at most once per path per process."""
    if not manifest_path.exists():
        print(f"Error: manifest not found at {manifest_path}")
        sys.exit(1)
    with open(manifest_path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_manifest_fields(manifest_path: Path) -> dict[str, Set[str]]:
    """Return contract_id -> set of declared field names (only for contracts with fields)."""
    manifest = _load_manifest_yaml(manifest_path)
    out: dict[str, Set[str]] = {}
    for c in manifest.get("contracts", []):
        if "id" in c and isinstance(c.get("fields"), list):
            out[c["id"]] = {f["name"] for f in c["fields"] if isinstance(f, dict) and "name" in f}
    return out


def load_manifest_ids(manifest_path: Path) -> Set[str]:
    """Return the set of contract IDs defined in the manifest."""
    manifest = _load_manifest_yaml(manifest_path)
    return {c["id"] for c in manifest.get("contracts", []) if "id" in c}


def run() -> None:
    print("Running apps/api adapter contract-ID coverage check...")

    referenced = collect_referenced_ids(SCAN_DIRS)
    if not referenced:
        print("Warning: no contract IDs found in adapters/routes — check scan patterns.")
        sys.exit(0)

    manifest_ids = load_manifest_ids(MANIFEST_PATH)

    errors: list[str] = []
    for cid in sorted(referenced):
        if cid not in manifest_ids:
            locations = ", ".join(referenced[cid][:5])
            errors.append(
                f"  MISSING: '{cid}'\n"
                f"    Referenced at: {locations}\n"
                f"    Not found in: data-products/io-reporting/contracts/app_contract_manifest.yml"
            )

    if errors:
        print(f"\nContract ID coverage check FAILED — {len(errors)} missing contract(s):\n")
        for err in errors:
            print(err)
        print(
            "\nTo fix: add the missing contract(s) to the data-products manifest and ensure\n"
            "the corresponding consumption view exists in the gold serving layer."
        )
        sys.exit(1)

    print(
        f"OK: all {len(referenced)} contract ID(s) referenced in apps/api adapters/routes\n"
        f"    are present in the data-products manifest ({len(manifest_ids)} total contracts)."
    )

    # ── Column level: adapter-selected columns must be declared contract fields ──
    manifest_fields = load_manifest_fields(MANIFEST_PATH)
    column_specs = collect_column_specs(SCAN_DIRS)
    col_errors: list[str] = []
    checked = 0
    for cid, columns, location in column_specs:
        fields = manifest_fields.get(cid)
        if fields is None:
            # Contract exists (verified above) but declares no fields list — skip.
            continue
        checked += 1
        missing = [c for c in columns if c not in fields]
        if missing:
            col_errors.append(
                f"  COLUMN MISMATCH: contract '{cid}' ({location})\n"
                f"    Adapter selects columns not declared in the contract's fields: {', '.join(missing)}"
            )

    if col_errors:
        print(f"\nContract column coverage check FAILED — {len(col_errors)} spec(s) with mismatches:\n")
        for err in col_errors:
            print(err)
        print(
            "\nTo fix: either declare the column(s) in the contract's fields in the\n"
            "data-products manifest (and ensure the consumption view exposes them),\n"
            "or remove them from the adapter's column list."
        )
        sys.exit(1)

    print(
        f"OK: all adapter column lists match contract fields "
        f"({checked} dataset spec(s) checked at column level)."
    )


if __name__ == "__main__":
    run()
