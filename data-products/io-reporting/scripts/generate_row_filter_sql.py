#!/usr/bin/env python3
"""
Generate environment-specific Row Filter SQL scripts for Unity Catalog.

Silver row filters were removed in favour of schema-level access control: civilians do not
have USAGE/SELECT on the silver_io_reporting schema. Plant-level access control is enforced
at the Gold secured-view layer via the central published_<env>.security.model CSM pattern
(see scripts/generate_gold_security_sql.py and docs/adr/012-gold-row-level-security.md).

This script is retained as a no-op placeholder so the CI/CD generator pipeline stays intact.
"""
import os

ENVIRONMENTS = {
    "dev": {
        "catalog": "connected_plant_dev",
        "schema": "silver_dev",
        "filename": "resources/sql/row_filter_dev.sql",
    },
    "uat": {
        "catalog": "connected_plant_uat",
        "schema": "silver_io_reporting",
        "filename": "resources/sql/row_filter_uat.sql",
    },
    "prod": {
        "catalog": "connected_plant_prod",
        "schema": "silver_io_reporting",
        "filename": "resources/sql/row_filter_prod.sql",
    },
}

TEMPLATE = """-- Silver row filters — {env_upper}
-- Row filters on {catalog}.{schema} have been removed.
-- Access control is enforced at schema level: the consumer group ('users') does not have
-- USAGE or SELECT on this schema. Plant-level filtering for consumers is applied at the
-- Gold secured-view layer via the published_<env>.security.model CSM pattern.
-- See scripts/generate_gold_security_sql.py and docs/adr/012-gold-row-level-security.md.
-- WARNING: Generated automatically by scripts/generate_row_filter_sql.py. Do not edit manually.
"""


def generate_sql():
    os.makedirs("resources/sql", exist_ok=True)
    for env, config in ENVIRONMENTS.items():
        content = TEMPLATE.format(env_upper=env.upper(), **config)
        with open(config["filename"], "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Generated: {config['filename']}")


if __name__ == "__main__":
    generate_sql()
