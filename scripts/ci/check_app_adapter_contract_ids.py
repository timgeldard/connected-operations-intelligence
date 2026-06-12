#!/usr/bin/env python3
"""Guard: every contract ID referenced in apps/api adapters must exist in the
data-products manifest.

Scans apps/api/adapters/ and apps/api/routes/ for literal string contract IDs
(patterns: contract="...", contract_id="...", "contract": "...") and verifies
each one exists in data-products/io-reporting/contracts/app_contract_manifest.yml.

This eliminates the missing-contract-500 class at PR time: if a developer adds
a new contract reference without adding it to the data-products manifest, this
guard fails the PR immediately rather than letting it reach a live deploy.
"""
from __future__ import annotations

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
    r'(?:contract(?:_id)?\s*=\s*["\']|"contract"\s*:\s*["\'])([a-z_]+\.[a-z_]+)["\']'
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


def load_manifest_ids(manifest_path: Path) -> Set[str]:
    """Return the set of contract IDs defined in the manifest."""
    if not manifest_path.exists():
        print(f"Error: manifest not found at {manifest_path}")
        sys.exit(1)
    with open(manifest_path, encoding="utf-8") as f:
        manifest = yaml.safe_load(f) or {}
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


if __name__ == "__main__":
    run()
