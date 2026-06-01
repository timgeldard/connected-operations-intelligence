#!/usr/bin/env python3
"""
Generate environment-specific Row Filter SQL scripts for Unity Catalog.
Outputs SQL scripts to resources/sql/ for dev, uat, and prod environments.
"""
import os

# Target configurations
ENVIRONMENTS = {
    "dev": {
        "catalog": "connected_plant_dev",
        "schema": "silver_dev",
        "admin_group": "silver_admin",
        "filename": "resources/sql/row_filter_dev.sql"
    },
    "uat": {
        "catalog": "connected_plant_uat",
        "schema": "silver",
        "admin_group": "silver_admin",
        "filename": "resources/sql/row_filter_uat.sql"
    },
    "prod": {
        "catalog": "connected_plant_prod",
        "schema": "silver",
        "admin_group": "silver_admin",
        "filename": "resources/sql/row_filter_prod.sql"
    }
}

# All silver tables that have a plant_code column to apply the row filter to.
TABLES = [
    "process_order",
    "process_order_operation",
    "pi_sheet_execution",
    "goods_movement",
    "batch_stock",
    "warehouse_transfer_order",
    "warehouse_transfer_requirement",
    "downtime_event",
    "quality_inspection_lot",
    "material",
    "storage_location",
    "work_centre",
    "capacity_utilisation",
    "storage_bin",
    "plant",
    "reservation_requirement",
    "outbound_delivery",
    "stock_at_location",
    "purchase_order",
    "handling_unit",
]

TEMPLATE = """-- Unity Catalog Row Filter — plant-level access control for silver tables ({env_upper}).
-- Run once as a Unity Catalog admin after the first {env_lower} deploy.
-- Requires: CREATE FUNCTION privilege on {catalog}.{schema}.
-- Ordering is intentional: CREATE OR REPLACE FUNCTION must run before any ALTER TABLE SET ROW FILTER.
-- WARNING: Generated automatically by scripts/generate_row_filter_sql.py. Do not edit manually.

CREATE OR REPLACE FUNCTION {catalog}.{schema}.plant_access_filter(plant_code STRING)
RETURNS BOOLEAN
RETURN CASE
  WHEN IS_ACCOUNT_GROUP_MEMBER('{admin_group}') THEN TRUE
  WHEN plant_code = 'SHARED' AND current_user_attribute('allowed_plants') IS NOT NULL THEN TRUE
  ELSE array_contains(
    transform(split(current_user_attribute('allowed_plants'), ','), x -> trim(x)),
    plant_code
  )
END;

-- Apply to all silver tables with a plant_code column.
"""

def generate_sql():
    # Make sure output directory exists
    os.makedirs("resources/sql", exist_ok=True)

    for env, config in ENVIRONMENTS.items():
        sql_content = TEMPLATE.format(
            env_upper=env.upper(),
            env_lower=env,
            catalog=config["catalog"],
            schema=config["schema"],
            admin_group=config["admin_group"]
        )

        for table in TABLES:
            fq_table = f"{config['catalog']}.{config['schema']}.{table}"
            fq_filter = f"{config['catalog']}.{config['schema']}.plant_access_filter"
            sql_content += f"\nALTER TABLE {fq_table}\n  SET ROW FILTER {fq_filter} ON (plant_code);\n"

        with open(config["filename"], "w", encoding="utf-8") as f:
            f.write(sql_content)
        print(f"Generated: {config['filename']}")

if __name__ == "__main__":
    generate_sql()
