#!/usr/bin/env python3
"""
Generate the governed `storage_type_role_mapping_config` Unity Catalog table SQL from the
version-controlled seed CSV (resources/config/storage_type_role_mapping.csv).

Why: the storage-type → role mapping (LINESIDE / INTERIM / …) was hard-coded inline in the DLT
definition for a single plant (C061 / warehouse 208), so onboarding a plant meant editing Python
and redeploying. This externalises it to a governed Delta config table that admins can maintain
(rows carry valid_from/valid_to + owner + review_status). The silver `storage_type_role_mapping`
table reads this config table when present (and falls back to a small embedded seed otherwise, so
the pipeline never breaks before the table is created).

Run the generated SQL once per env as a UC admin; thereafter maintain the table directly (or
re-seed from the CSV). Outputs resources/sql/storage_type_role_mapping_<env>.sql.
"""
import csv
import os

ENVIRONMENTS = {
    "dev": {"catalog": "connected_plant_dev", "schema": "silver_dev"},
    "uat": {"catalog": "connected_plant_uat", "schema": "silver"},
    "prod": {"catalog": "connected_plant_prod", "schema": "silver"},
}

CSV_PATH = "resources/config/storage_type_role_mapping.csv"
_COLS = ["plant_code", "warehouse_number", "storage_type", "role",
         "valid_from", "valid_to", "owner", "review_status"]


def _sql_literal(col, val):
    if val is None or val == "":
        return "NULL"
    if col in ("valid_from", "valid_to"):
        return f"DATE'{val}'"
    return "'" + val.replace("'", "''") + "'"


def generate_sql():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.makedirs(os.path.join(repo_root, "resources/sql"), exist_ok=True)
    with open(os.path.join(repo_root, CSV_PATH), newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    for env, cfg in ENVIRONMENTS.items():
        table = f"{cfg['catalog']}.{cfg['schema']}.storage_type_role_mapping_config"
        sql = (
            f"-- Governed storage-type → role config ({env.upper()}). Generated from "
            f"{CSV_PATH} by scripts/generate_storage_type_role_sql.py — do not edit manually.\n"
            "-- Run once as a UC admin; thereafter maintain rows directly (or re-seed from the CSV).\n"
            "-- The silver.storage_type_role_mapping DLT table reads APPROVED, in-window rows from here.\n\n"
            f"CREATE TABLE IF NOT EXISTS {table} (\n"
            "  plant_code STRING, warehouse_number STRING, storage_type STRING, role STRING,\n"
            "  valid_from DATE, valid_to DATE, owner STRING, review_status STRING\n"
            ") USING DELTA;\n\n"
            f"-- Reseed from the CSV (idempotent full refresh of the seeded plant(s)):\n"
            f"DELETE FROM {table} WHERE owner = 'wm-config-owner';\n"
        )
        for r in rows:
            vals = ", ".join(_sql_literal(c, r.get(c)) for c in _COLS)
            sql += f"INSERT INTO {table} ({', '.join(_COLS)}) VALUES ({vals});\n"
        out = os.path.join(repo_root, f"resources/sql/storage_type_role_mapping_{env}.sql")
        with open(out, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(sql)
        print(f"Generated: {out}")


if __name__ == "__main__":
    generate_sql()
