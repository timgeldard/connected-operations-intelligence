#!/usr/bin/env python3
"""Static guard: seed tables with all-NULL columns must use an explicit Spark schema.

`site_config_movement_type_classification` sets `plant_code=None` in every seed row, so
`spark.createDataFrame(data)` (no schema) fails at runtime with CANNOT_DETERMINE_TYPE. This
guards against regressing to a schema-less createDataFrame in that seed.
"""
import ast
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "../.."))
REFERENCE_PY = os.path.join(REPO_ROOT, "data-products/io-reporting/silver/tables/reference.py")

# Seed functions that must pass an explicit schema to createDataFrame (all-NULL column present).
SCHEMA_REQUIRED_SEEDS = {"site_config_movement_type_classification"}


def run_checks() -> int:
    print("Running seed explicit-schema check...")
    errors = []
    tree = ast.parse(open(REFERENCE_PY, encoding="utf-8").read(), filename=REFERENCE_PY)

    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef) or node.name not in SCHEMA_REQUIRED_SEEDS:
            continue
        for call in ast.walk(node):
            if (
                isinstance(call, ast.Call)
                and isinstance(call.func, ast.Attribute)
                and call.func.attr == "createDataFrame"
            ):
                # require a 2nd positional arg (schema) or a schema= kwarg
                has_schema = len(call.args) >= 2 or any(k.arg == "schema" for k in call.keywords)
                if not has_schema:
                    errors.append(
                        f"[{node.name}] createDataFrame at line {call.lineno} has no explicit schema "
                        f"— all-NULL seed columns will fail with CANNOT_DETERMINE_TYPE"
                    )

    if errors:
        print("\nSeed explicit-schema check FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("\nSeed explicit-schema check passed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(run_checks())
