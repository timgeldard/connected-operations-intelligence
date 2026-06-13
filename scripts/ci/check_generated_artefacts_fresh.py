#!/usr/bin/env python3
"""Guard: committed generated artefacts must match what their generators produce.

A burst of merges repeatedly left generated files stale because nothing fails CI
when a manifest change isn't regenerated. The OKF bundle has `check_okf_bundle_fresh.py`;
this guard covers the OTHER generated artefacts that drifted main red:

  1. data-contracts        scripts/contracts/generate_contracts.py
                           -> packages/data-contracts/src/generated/io-reporting/{contract.json,contract.ts}
  2. contract-metadata SQL data-products/io-reporting/scripts/generate_contract_metadata_sql.py
                           -> resources/sql/contract_metadata_{dev,uat,prod}.sql   (NO prior guard)
  3. warehouse360 valid.   scripts/contracts/generate_warehouse360_validation_sql.py
                           -> data-products/io-reporting/validation/generated/warehouse360_contract_validation_{env}.sql

Mechanism: snapshot the committed bytes, run each generator (which writes to its fixed
output paths), diff, then ALWAYS restore the snapshot so the working tree is left
untouched. Exits non-zero listing the stale artefacts + the fix command.

Run: python3 scripts/ci/check_generated_artefacts_fresh.py
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PROD = REPO_ROOT / "data-products" / "io-reporting"

# (label, generator argv (relative to REPO_ROOT), [output paths], fix-hint)
ARTEFACTS = [
    (
        "data-contracts (contract.json / contract.ts)",
        ["scripts/contracts/generate_contracts.py"],
        [
            "packages/data-contracts/src/generated/io-reporting/contract.json",
            "packages/data-contracts/src/generated/io-reporting/contract.ts",
        ],
        "python scripts/contracts/generate_contracts.py   (or: make contracts)",
    ),
    (
        "contract-metadata SQL",
        ["data-products/io-reporting/scripts/generate_contract_metadata_sql.py"],
        [
            "data-products/io-reporting/resources/sql/contract_metadata_dev.sql",
            "data-products/io-reporting/resources/sql/contract_metadata_uat.sql",
            "data-products/io-reporting/resources/sql/contract_metadata_prod.sql",
        ],
        "python data-products/io-reporting/scripts/generate_contract_metadata_sql.py",
    ),
    (
        "warehouse360 validation SQL",
        ["scripts/contracts/generate_warehouse360_validation_sql.py"],
        [
            "data-products/io-reporting/validation/generated/warehouse360_contract_validation_dev.sql",
            "data-products/io-reporting/validation/generated/warehouse360_contract_validation_uat.sql",
            "data-products/io-reporting/validation/generated/warehouse360_contract_validation_prod.sql",
        ],
        "python scripts/contracts/generate_warehouse360_validation_sql.py",
    ),
]


def _norm(data: bytes | None) -> bytes | None:
    """Normalise line endings so a CRLF working-tree checkout (Windows autocrlf)
    doesn't read as drift against LF generator output. Comparison only — the
    snapshot used for restore keeps the original raw bytes."""
    if data is None:
        return None
    return data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")


def _snapshot(paths: list[Path]) -> dict[Path, bytes | None]:
    return {p: (p.read_bytes() if p.exists() else None) for p in paths}


def _restore(snap: dict[Path, bytes | None]) -> None:
    for p, data in snap.items():
        if data is None:
            if p.exists():
                p.unlink()
        else:
            p.write_bytes(data)


def run() -> int:
    print("Running generated-artefact freshness check...")
    stale: list[str] = []

    for label, argv, out_rel, fix in ARTEFACTS:
        out_paths = [REPO_ROOT / r for r in out_rel]
        snap = _snapshot(out_paths)
        try:
            proc = subprocess.run(
                [sys.executable, *argv],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
            )
            if proc.returncode != 0:
                stale.append(
                    f"  [{label}] generator FAILED (exit {proc.returncode}):\n"
                    f"      {proc.stderr.strip().splitlines()[-1] if proc.stderr.strip() else proc.stdout.strip()[-200:]}"
                )
                continue
            changed = [
                str(p.relative_to(REPO_ROOT)).replace("\\", "/")
                for p in out_paths
                if _norm(p.read_bytes() if p.exists() else None) != _norm(snap[p])
            ]
            if changed:
                stale.append(
                    f"  [{label}] STALE — committed differs from generator output:\n"
                    + "\n".join(f"      {c}" for c in changed)
                    + f"\n      fix: {fix}"
                )
        finally:
            _restore(snap)

    if stale:
        print(
            "\nGenerated-artefact drift detected:\n\n"
            + "\n\n".join(stale)
            + "\n\nMandate: any change to the manifest / governed surface MUST regenerate and commit"
            "\nthe downstream artefacts in the SAME PR (CI blocks on this check).\n",
            file=sys.stderr,
        )
        return 1

    print(f"OK: all {len(ARTEFACTS)} generated-artefact group(s) are fresh.")
    return 0


if __name__ == "__main__":
    sys.exit(run())
