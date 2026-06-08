#!/usr/bin/env python3
"""Generator for Warehouse360 read-only contract validation SQL queries.

Reads warehouse360_view_expectations.yml and outputs DEV, UAT, and PROD validation SQL files.
Supports --check mode for CI integration.
"""

import argparse
import os
import sys

import yaml

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXPECTATIONS_PATH = os.path.join(REPO_ROOT, "data-products/io-reporting/contracts/warehouse360_view_expectations.yml")
OUTPUT_DIR = os.path.join(REPO_ROOT, "data-products/io-reporting/validation/generated")


def generate_sql_for_env(env: str, config: dict) -> str:
    env_config = config.get("environment_targets", {}).get(env)
    if not env_config:
        raise ValueError(f"Environment '{env}' config not found in targets.")

    catalog = env_config.get("catalog")
    schema = env_config.get("schema")
    if not catalog:
        raise ValueError(f"Catalog not specified for environment '{env}' in targets.")
    if not schema:
        raise ValueError(f"Schema not specified for environment '{env}' in targets.")
    views = config.get("views", [])

    sql_parts = []

    for view in views:
        # Skip if not runtime ready
        if view.get("status") == "not_runtime_ready":
            continue

        view_name = view["name"]
        contract_id = view.get("contract_id", "")
        expected_grain = view.get("expected_grain", "")
        must_not_be_null = view.get("must_not_be_null", [])
        primary_key = view.get("primary_key", [])
        row_level_key = view.get("row_level_key")
        freshness_column = view.get("freshness_column")

        # Validate columns against expected_columns
        expected_cols_set = {c.get("name") for c in view.get("expected_columns", []) if c.get("name")}
        if primary_key:
            missing_pk = [col for col in primary_key if col not in expected_cols_set]
            if missing_pk:
                raise ValueError(f"View '{view_name}': primary_key columns not in expected_columns: {missing_pk}")
        if must_not_be_null:
            missing_nn = [col for col in must_not_be_null if col not in expected_cols_set]
            if missing_nn:
                raise ValueError(f"View '{view_name}': must_not_be_null columns not in expected_columns: {missing_nn}")
        if freshness_column and freshness_column not in expected_cols_set:
            raise ValueError(f"View '{view_name}': freshness_column '{freshness_column}' not in expected_columns")

        # Exists check for plant_id
        has_plant_id = "plant_id" in expected_cols_set

        full_view_name = f"{catalog}.{schema}.{view_name}"

        # 1. Header
        sql_parts.append(
            f"-- ============================================================================\n"
            f"-- Contract: {contract_id}\n"
            f"-- View: {full_view_name}\n"
            f"-- Grain: {expected_grain}\n"
            f"-- ============================================================================"
        )

        # 2. Describe Table
        sql_parts.append(f"DESCRIBE TABLE {full_view_name};")

        # 3. Row Count
        sql_parts.append(
            f"SELECT\n"
            f"  '{view_name}' AS view_name,\n"
            f"  COUNT(*) AS row_count\n"
            f"FROM {full_view_name};"
        )

        # 4. Required non-null checks
        if must_not_be_null:
            null_exprs = []
            for col in must_not_be_null:
                null_exprs.append(f"  COUNT_IF({col} IS NULL) AS null_{col}_rows")
            null_exprs_str = ",\n".join(null_exprs)
            sql_parts.append(
                f"SELECT\n"
                f"  '{view_name}' AS view_name,\n"
                f"  COUNT(*) AS total_rows,\n"
                f"{null_exprs_str}\n"
                f"FROM {full_view_name};"
            )

        # 5. Primary key duplicate check
        if primary_key:
            pk_cols_str = ", ".join(primary_key)
            sql_parts.append(
                f"SELECT\n"
                f"  '{view_name}' AS view_name,\n"
                f"  COUNT(*) AS total_rows,\n"
                f"  COUNT(DISTINCT struct({pk_cols_str})) AS distinct_pk_rows,\n"
                f"  COUNT(*) - COUNT(DISTINCT struct({pk_cols_str})) AS duplicate_pk_rows\n"
                f"FROM {full_view_name};"
            )

        # 6. Freshness check
        if freshness_column:
            sql_parts.append(
                f"SELECT\n"
                f"  '{view_name}' AS view_name,\n"
                f"  MAX({freshness_column}) AS max_freshness_ts\n"
                f"FROM {full_view_name};"
            )

        # 7. Plant scope / Top visible plants check
        if row_level_key == "plant_id" or has_plant_id:
            sql_parts.append(
                f"SELECT\n"
                f"  plant_id,\n"
                f"  COUNT(*) AS rows\n"
                f"FROM {full_view_name}\n"
                f"GROUP BY plant_id\n"
                f"ORDER BY rows DESC\n"
                f"LIMIT 20;"
            )

    return "\n\n".join(sql_parts) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Warehouse360 contract validation SQL.")
    parser.add_argument(
        "--check", action="store_true",
        help="Verify committed SQL files match expectations and exit non-zero on drift.",
    )
    args = parser.parse_args()

    if not os.path.exists(EXPECTATIONS_PATH):
        print(f"Expectations YAML not found: {EXPECTATIONS_PATH}", file=sys.stderr)
        return 1

    try:
        with open(EXPECTATIONS_PATH, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
    except yaml.YAMLError as e:
        print(f"Failed to parse expectations YAML file at {EXPECTATIONS_PATH}: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Failed to read expectations YAML file at {EXPECTATIONS_PATH}: {e}", file=sys.stderr)
        return 1

    environments = list(config.get("environment_targets", {}).keys())
    drift_detected = False
    missing_files = []
    drifted_files = []

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for env in environments:
        generated_sql = generate_sql_for_env(env, config)
        output_file_name = f"warehouse360_contract_validation_{env}.sql"
        output_path = os.path.join(OUTPUT_DIR, output_file_name)

        if args.check:
            if not os.path.exists(output_path):
                missing_files.append(output_path)
                drift_detected = True
            else:
                with open(output_path, "r", encoding="utf-8") as f:
                    existing_sql = f.read()
                if existing_sql != generated_sql:
                    drifted_files.append(output_path)
                    drift_detected = True
        else:
            with open(output_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(generated_sql)
            print(f"Generated validation SQL written to: {output_path}")

    if args.check:
        if drift_detected:
            if missing_files:
                print("Missing generated SQL files:", file=sys.stderr)
                for f in missing_files:
                    print(f"  - {f}", file=sys.stderr)
            if drifted_files:
                print("Out-of-date generated SQL files:", file=sys.stderr)
                for f in drifted_files:
                    print(f"  - {f}", file=sys.stderr)
            print("\nPlease regenerate SQL files by running:", file=sys.stderr)
            print("  python3 scripts/contracts/generate_warehouse360_validation_sql.py", file=sys.stderr)
            return 1
        else:
            print("All generated validation SQL files are up-to-date.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
