#!/usr/bin/env python3
"""Guard: apps/api/contracts/app_contract_manifest.yml must NOT be tracked by git.

The single source-of-truth contract manifest lives at
data-products/io-reporting/contracts/app_contract_manifest.yml.
The copy at apps/api/contracts/app_contract_manifest.yml is a gitignored
deploy-time artefact produced by `make prep-app-deploy` — it must NEVER be
committed or re-added to the index.

This guard fails if git tracks the manifest YAML path, preventing the
dual-manifest arrangement from being silently reintroduced.  Other Python
files under apps/api/contracts/ (generated.py, spc.py, __init__.py, etc.)
are legitimate tracked artefacts and are not checked here.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
# The specific file that must never be tracked
FORBIDDEN_TRACKED_PATH = "apps/api/contracts/app_contract_manifest.yml"


def run() -> None:
    result = subprocess.run(
        ["git", "ls-files", FORBIDDEN_TRACKED_PATH],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
    )
    if result.returncode != 0:
        print(f"Error running git ls-files: {result.stderr.strip()}")
        sys.exit(1)

    tracked = result.stdout.strip()
    if tracked:
        print(f"FAIL: {FORBIDDEN_TRACKED_PATH} is tracked by git.")
        print()
        print(
            "apps/api/contracts/app_contract_manifest.yml must NOT be committed.\n"
            "It is a deploy-time build artefact — remove it with:\n"
            "  git rm apps/api/contracts/app_contract_manifest.yml\n"
            "The single source-of-truth manifest is:\n"
            "  data-products/io-reporting/contracts/app_contract_manifest.yml"
        )
        sys.exit(1)

    print(f"OK: {FORBIDDEN_TRACKED_PATH} is not tracked by git.")


if __name__ == "__main__":
    run()
