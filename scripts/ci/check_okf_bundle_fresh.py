#!/usr/bin/env python3
"""Guard: the committed OKF bundle must match what the generator produces.

Regenerates the OKF bundle to a temporary directory and diffs it against the
committed ``data-products/io-reporting/okf/`` tree.  Exits non-zero with a
clear actionable message if they differ.

Run: python3 scripts/ci/check_okf_bundle_fresh.py

Typical CI invocation (see .github/workflows/ci.yml):
  - name: Check OKF bundle is fresh
    run: python3 scripts/ci/check_okf_bundle_fresh.py
"""
from __future__ import annotations

import filecmp
import os
import sys
import tempfile
from pathlib import Path

# ---------------------------------------------------------------------------
# Resolve repo root and paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATOR = REPO_ROOT / "data-products/io-reporting/scripts/generate_okf_bundle.py"
COMMITTED_OKF = REPO_ROOT / "data-products/io-reporting/okf"
MANIFEST_PATH = REPO_ROOT / "data-products/io-reporting/contracts/app_contract_manifest.yml"

# ---------------------------------------------------------------------------
# Import the generator without executing its main()
# ---------------------------------------------------------------------------

def _import_generator():
    """Import generate_okf_bundle without triggering __main__ side-effects."""
    import importlib.util

    if not GENERATOR.exists():
        print(
            f"Error: generator not found at {GENERATOR}\n"
            "Has data-products/io-reporting/scripts/generate_okf_bundle.py been committed?",
            file=sys.stderr,
        )
        sys.exit(1)

    spec = importlib.util.spec_from_file_location("generate_okf_bundle", GENERATOR)
    mod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


# ---------------------------------------------------------------------------
# Directory comparison helpers
# ---------------------------------------------------------------------------

def _collect_relative_paths(root: Path) -> set[str]:
    """Return relative POSIX paths of all files under root."""
    paths: set[str] = set()
    for dirpath, _dirs, files in os.walk(root):
        for fname in files:
            full = Path(dirpath) / fname
            paths.add(full.relative_to(root).as_posix())
    return paths


def _diff_trees(committed: Path, generated: Path) -> list[str]:
    """Return a list of human-readable difference descriptions."""
    diffs: list[str] = []

    committed_files = _collect_relative_paths(committed)
    generated_files = _collect_relative_paths(generated)

    only_committed = committed_files - generated_files
    only_generated = generated_files - committed_files
    common = committed_files & generated_files

    for f in sorted(only_committed):
        diffs.append(f"  DELETED   (in committed, not in generated): {f}")
    for f in sorted(only_generated):
        diffs.append(f"  ADDED     (in generated, not in committed): {f}")

    for f in sorted(common):
        c_path = committed / f
        g_path = generated / f
        if not filecmp.cmp(c_path, g_path, shallow=False):
            diffs.append(f"  MODIFIED  (content differs):               {f}")

    return diffs


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run() -> None:
    print("Running OKF bundle freshness check...")

    if not COMMITTED_OKF.exists():
        print(
            "ERROR: committed OKF directory not found at:\n"
            f"  {COMMITTED_OKF}\n\n"
            "Run `make generate-okf` locally and commit the okf/ tree.",
            file=sys.stderr,
        )
        sys.exit(1)

    mod = _import_generator()

    with tempfile.TemporaryDirectory(prefix="okf_check_") as tmp:
        fresh_dir = Path(tmp) / "okf"

        # Regenerate to the temp directory (suppress stdout).
        import contextlib
        import io

        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            mod.generate(
                manifest_path=MANIFEST_PATH,
                okf_dir=fresh_dir,
                verbose=False,
            )

        diffs = _diff_trees(COMMITTED_OKF, fresh_dir)

    if diffs:
        diff_lines = "\n".join(diffs)
        print(
            f"\nOKF bundle drift detected -- {len(diffs)} difference(s):\n\n"
            f"{diff_lines}\n\n"
            "To fix: run\n"
            "  make generate-okf\n"
            "and commit the regenerated okf/ tree in the same PR as your "
            "app_contract_manifest.yml change.\n\n"
            "Mandate: any change to data contracts or the governed surface MUST be\n"
            "accompanied by a regenerated OKF bundle (CI blocks on this check).",
            file=sys.stderr,
        )
        sys.exit(1)

    committed_count = len(_collect_relative_paths(COMMITTED_OKF))
    print(
        f"OK: OKF bundle is fresh ({committed_count} file(s) match the generator output)."
    )


if __name__ == "__main__":
    run()
