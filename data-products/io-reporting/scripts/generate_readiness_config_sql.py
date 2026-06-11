#!/usr/bin/env python3
"""
Generate governed readiness configuration table SQL scripts from conformed CSV seeds.
Creates/reseeds:
- site_config_plant
- site_config_warehouse
- site_config_storage_type_role
- site_config_movement_type_classification
- site_config_staging_method
- site_config_kpi_enablement
"""
import csv
from pathlib import Path

ENVIRONMENTS = {
    "dev": {"catalog": "connected_plant_dev", "schema": "silver_dev"},
    "uat": {"catalog": "connected_plant_uat", "schema": "silver_io_reporting"},
    "prod": {"catalog": "connected_plant_prod", "schema": "silver_io_reporting"},
}

CONFIG_TABLES = {
    "site_config_plant": {
        "csv": "resources/config/site_config_plant.csv",
        "columns": {
            "plant_code": "STRING", "plant_name": "STRING", "country": "STRING",
            "region": "STRING", "business_unit": "STRING", "timezone": "STRING",
            "sap_system_id": "STRING", "go_live_status": "STRING", "wm_enabled_flag": "BOOLEAN",
            "hu_enabled_flag": "BOOLEAN", "qm_enabled_flag": "BOOLEAN", "spc_enabled_flag": "BOOLEAN",
            "batch_managed_flag": "BOOLEAN",
            "process_manufacturing_flag": "BOOLEAN", "default_language_code": "STRING",
            "valid_from": "DATE", "valid_to": "DATE", "is_active": "BOOLEAN",
            "config_owner": "STRING", "last_validated_at": "DATE"
        }
    },
    "site_config_warehouse": {
        "csv": "resources/config/site_config_warehouse.csv",
        "columns": {
            "plant_code": "STRING", "warehouse_number": "STRING", "warehouse_description": "STRING",
            "relationship_type": "STRING", "wm_usage_type": "STRING", "is_shared_warehouse": "BOOLEAN",
            "valid_from": "DATE", "valid_to": "DATE", "is_active": "BOOLEAN", "config_owner": "STRING"
        }
    },
    "site_config_storage_type_role": {
        "csv": "resources/config/site_config_storage_type_role.csv",
        "columns": {
            "plant_code": "STRING", "warehouse_number": "STRING", "storage_type": "STRING",
            "storage_type_description": "STRING", "storage_role": "STRING", "role_confidence": "STRING",
            "is_wm_managed": "BOOLEAN", "include_in_lineside_stock": "BOOLEAN",
            "include_in_staging": "BOOLEAN", "include_in_reconciliation": "BOOLEAN",
            "valid_from": "DATE", "valid_to": "DATE", "validated_by": "STRING", "validated_at": "DATE"
        }
    },
    "site_config_movement_type_classification": {
        "csv": "resources/config/site_config_movement_type_classification.csv",
        "columns": {
            "plant_code": "STRING", "movement_type_code": "STRING", "movement_text": "STRING",
            "event_category": "STRING", "is_production_receipt": "BOOLEAN",
            "is_production_consumption": "BOOLEAN", "is_scrap": "BOOLEAN", "is_reversal": "BOOLEAN",
            "reversal_of_movement_type": "STRING", "is_inbound_receipt": "BOOLEAN",
            "is_outbound_issue": "BOOLEAN", "is_stock_adjustment": "BOOLEAN",
            "classification_source": "STRING", "validation_status": "STRING",
            "valid_from": "DATE", "valid_to": "DATE"
        }
    },
    "site_config_staging_method": {
        "csv": "resources/config/site_config_staging_method.csv",
        "columns": {
            "plant_code": "STRING", "warehouse_number": "STRING", "production_supply_area": "STRING",
            "storage_type": "STRING", "staging_method": "STRING", "sap_reference_pattern": "STRING",
            "requires_batch_scan": "BOOLEAN", "requires_sscc": "BOOLEAN",
            "validation_status": "STRING", "valid_from": "DATE", "valid_to": "DATE"
        }
    },
    "site_config_kpi_enablement": {
        "csv": "resources/config/site_config_kpi_enablement.csv",
        "columns": {
            "plant_code": "STRING", "data_product_name": "STRING", "kpi_name": "STRING",
            "enablement_status": "STRING", "reason_code": "STRING", "approved_by": "STRING",
            "approved_at": "DATE", "review_due_at": "DATE"
        }
    }
}


def _sql_literal(col, val, col_type):
    if val is not None:
        val = val.strip()
    if val is None or val == "":
        return "NULL"
    if col_type == "BOOLEAN":
        return val.lower()
    if col_type == "DATE":
        return f"DATE'{val}'"
    return "'" + val.replace("'", "''") + "'"


def generate_sql():
    repo_root = Path(__file__).resolve().parent.parent
    (repo_root / "resources" / "sql").mkdir(parents=True, exist_ok=True)

    for env, cfg in ENVIRONMENTS.items():
        sql = (
            f"-- Governed readiness configuration ({env.upper()}).\n"
            f"-- WARNING: Generated automatically by scripts/generate_readiness_config_sql.py. Do not edit manually.\n\n"
        )
        for tbl_name, tbl_cfg in CONFIG_TABLES.items():
            table = f"{cfg['catalog']}.{cfg['schema']}.{tbl_name}"
            cols_def = ", ".join(f"{c} {t}" for c, t in tbl_cfg["columns"].items())

            csv_path = repo_root / tbl_cfg["csv"]
            if not csv_path.exists():
                print(f"Warning: {csv_path} does not exist.")
                continue

            with open(csv_path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames or []
                expected_cols = list(tbl_cfg["columns"].keys())
                missing_cols = [col for col in expected_cols if col not in fieldnames]
                if missing_cols:
                    raise ValueError(f"CSV file {csv_path} is missing expected columns: {missing_cols}")
                rows = list(reader)

            formatted_cols = cols_def.replace(', ', ',\n  ')
            sql += (
                f"-- ── {tbl_name} ──\n"
                f"CREATE TABLE IF NOT EXISTS {table} (\n"
                f"  {formatted_cols}\n"
                f") USING DELTA;\n\n"
            )

            # Check if this table has owner or approved_by or validated_by to delete wm-config-owner
            owner_col = None
            if "config_owner" in tbl_cfg["columns"]:
                owner_col = "config_owner"
            elif "validated_by" in tbl_cfg["columns"]:
                owner_col = "validated_by"
            elif "approved_by" in tbl_cfg["columns"]:
                owner_col = "approved_by"

            sql += "BEGIN;\n"
            if owner_col:
                sql += f"DELETE FROM {table} WHERE {owner_col} = 'wm-config-owner';\n"
            else:
                # Fallback delete for classification/staging
                sql += f"DELETE FROM {table} WHERE plant_code = 'C061' OR plant_code IS NULL;\n"

            if rows:
                col_names = list(tbl_cfg["columns"].keys())
                value_tuples = []
                for r in rows:
                    tuple_vals = []
                    for c in col_names:
                        col_type = tbl_cfg["columns"][c]
                        tuple_vals.append(_sql_literal(c, r.get(c), col_type))
                    value_tuples.append("(" + ", ".join(tuple_vals) + ")")

                sql += (
                    f"INSERT INTO {table} ({', '.join(col_names)}) VALUES\n  "
                    + ",\n  ".join(value_tuples) + ";\n"
                )
            sql += "COMMIT;\n\n"

        out_path = repo_root / "resources" / "sql" / f"site_config_{env}.sql"
        with open(out_path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(sql)
        print(f"Generated: {out_path}")


if __name__ == "__main__":
    generate_sql()
