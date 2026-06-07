#!/usr/bin/env python3
"""Static guard: no spark.catalog.tableExists in DLT pipeline source.

`spark.catalog.tableExists` is a BLOCKED Py4J API in the DLT/Lakeflow serverless environment
(PY4J_BLOCKED_API) — it fails at graph construction and is unreliable at pipeline runtime. Pipeline
code must use the lazy `spark.read.table` probe instead (silver.helpers.relation_exists /
bronze_table_exists / bronze_columns_exist, or gold._shared.table_exists).

Scope: the Silver and Gold DLT pipeline source (`silver/`, `gold/`). The standalone job scripts
under `gold/recon/` and `gold/snapshots/` are EXCLUDED — they run as spark_python_task jobs in a
normal (non-DLT) Spark context where `catalog.tableExists` is permitted.
"""
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../.."))
PRODUCT = os.path.join(REPO_ROOT, "data-products/io-reporting")

SCAN_DIRS = ["silver", "gold"]
EXCLUDE_DIRS = {os.path.join(PRODUCT, "gold", "recon"), os.path.join(PRODUCT, "gold", "snapshots")}
# Match the method CALL (trailing paren) so prose/docstring mentions don't trip the guard.
BLOCKED_RE = re.compile(r"\.catalog\.tableExists\s*\(")


def run_checks() -> int:
    print("Running blocked-spark-API check (no catalog.tableExists in pipeline code)...")
    errors = []
    for d in SCAN_DIRS:
        for root, _dirs, files in os.walk(os.path.join(PRODUCT, d)):
            if "__pycache__" in root or any(root.startswith(x) for x in EXCLUDE_DIRS):
                continue
            for fn in files:
                if not fn.endswith(".py"):
                    continue
                path = os.path.join(root, fn)
                for i, line in enumerate(open(path, encoding="utf-8").read().splitlines(), 1):
                    if BLOCKED_RE.search(line):
                        rel = os.path.relpath(path, REPO_ROOT)
                        errors.append(
                            f"[{rel}:{i}] uses spark.catalog.tableExists — blocked in DLT serverless; "
                            f"use a lazy spark.read.table probe (relation_exists / table_exists)"
                        )

    if errors:
        print("\nBlocked-spark-API check FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("\nBlocked-spark-API check passed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(run_checks())
