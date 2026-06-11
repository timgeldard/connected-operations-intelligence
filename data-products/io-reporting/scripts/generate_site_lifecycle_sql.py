#!/usr/bin/env python3
"""
Generate the governed `site_lifecycle_config` Unity Catalog table SQL from the
version-controlled review CSV (resources/config/site_lifecycle_review.csv).

Why: the trace product needs a lifecycle status for every plant in the ~550-plant estate,
not just the handful onboarded to io-reporting. This externalises the estate-wide lifecycle
dimension to a governed Delta config table. The silver `site_lifecycle` MV reads this table
when present and falls back to a small seed of the 4 onboarded plants as ACTIVE.

ADR 016 (traceability-window-estate-and-security) defines the lifecycle values:
  ACTIVE         = anchorable + visible (included in the trace product)
  CLOSED         = visible but not anchorable (included with reduced capability)
  SOLD           = excluded from the trace product
  DIVESTED_ON_SAP = excluded from the trace product (SAP replication still active)

effective_lifecycle logic (computed by this generator, not at query time):
  - confirmed_lifecycle non-blank  → effective_lifecycle = confirmed_lifecycle, review_status = CONFIRMED
  - confirmed_lifecycle blank      → effective_lifecycle = proposed_lifecycle,  review_status = PROPOSED

Run the generated SQL once per env as a UC admin; thereafter maintain the table directly (or
re-seed from the CSV). Outputs resources/sql/site_lifecycle_{dev,uat,prod}.sql.
"""
import csv
import os

ENVIRONMENTS = {
    "dev": {"catalog": "connected_plant_dev", "schema": "silver_io_reporting"},
    "uat": {"catalog": "connected_plant_uat", "schema": "silver_io_reporting"},
    "prod": {"catalog": "connected_plant_prod", "schema": "silver_io_reporting"},
}

CSV_PATH = "resources/config/site_lifecycle_review.csv"

# Output columns for site_lifecycle_config (subset of the review CSV, with computed fields).
_COLS = [
    "plant_code", "plant_name", "country", "last_posting",
    "proposed_lifecycle", "confirmed_lifecycle",
    "effective_lifecycle", "review_status",
    "reviewed_by", "notes",
]


def _sql_literal(col, val):
    if val is not None:
        val = val.strip()  # tolerate accidental CSV whitespace
    if val is None or val == "":
        return "NULL"
    if col == "last_posting":
        return f"DATE'{val}'"
    return "'" + val.replace("'", "''") + "'"


def _compute_effective_lifecycle(row):
    """Derive effective_lifecycle and review_status from confirmed/proposed columns."""
    confirmed = (row.get("confirmed_lifecycle") or "").strip()
    proposed = (row.get("proposed_lifecycle") or "").strip()
    if confirmed:
        return confirmed, "CONFIRMED"
    return proposed, "PROPOSED"


def generate_sql():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.makedirs(os.path.join(repo_root, "resources/sql"), exist_ok=True)

    with open(os.path.join(repo_root, CSV_PATH), newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    # Validate required columns exist in the CSV.
    required_csv_cols = {"plant_code", "plant_name", "country", "last_posting",
                         "proposed_lifecycle", "confirmed_lifecycle", "reviewed_by", "notes"}
    if rows:
        missing = required_csv_cols - set(rows[0].keys())
        if missing:
            raise ValueError(f"CSV {CSV_PATH} is missing columns: {sorted(missing)}")

    for env, cfg in ENVIRONMENTS.items():
        table = f"{cfg['catalog']}.{cfg['schema']}.site_lifecycle_config"
        sql = (
            f"-- Governed site lifecycle dimension ({env.upper()}). Generated from\n"
            f"-- {CSV_PATH} by scripts/generate_site_lifecycle_sql.py — do not edit manually.\n"
            f"-- ADR 016: lifecycle_status ∈ ACTIVE / CLOSED / SOLD / DIVESTED_ON_SAP.\n"
            f"-- ACTIVE=anchorable+visible; CLOSED=visible-not-anchorable; SOLD/DIVESTED=excluded.\n"
            f"-- Run once as a UC admin; thereafter maintain rows directly (or re-seed from the CSV).\n\n"
            f"CREATE TABLE IF NOT EXISTS {table} (\n"
            f"  plant_code STRING,\n"
            f"  plant_name STRING,\n"
            f"  country STRING,\n"
            f"  last_posting DATE,\n"
            f"  proposed_lifecycle STRING,\n"
            f"  confirmed_lifecycle STRING,\n"
            f"  effective_lifecycle STRING,\n"
            f"  review_status STRING,\n"
            f"  reviewed_by STRING,\n"
            f"  notes STRING\n"
            f") USING DELTA;\n\n"
            f"-- Reseed from the CSV (idempotent full refresh):\n"
            f"BEGIN;\n"
            f"DELETE FROM {table};\n"
        )

        if rows:
            value_tuples = []
            for r in rows:
                effective_lifecycle, review_status = _compute_effective_lifecycle(r)
                # Build the output row dict with computed fields.
                out_row = {
                    "plant_code": r.get("plant_code"),
                    "plant_name": r.get("plant_name"),
                    "country": r.get("country"),
                    "last_posting": r.get("last_posting"),
                    "proposed_lifecycle": r.get("proposed_lifecycle"),
                    "confirmed_lifecycle": r.get("confirmed_lifecycle"),
                    "effective_lifecycle": effective_lifecycle,
                    "review_status": review_status,
                    "reviewed_by": r.get("reviewed_by"),
                    "notes": r.get("notes"),
                }
                vals = [_sql_literal(c, out_row.get(c)) for c in _COLS]
                value_tuples.append("(" + ", ".join(vals) + ")")

            sql += (
                f"INSERT INTO {table} ({', '.join(_COLS)}) VALUES\n  "
                + ",\n  ".join(value_tuples) + ";\n"
            )

        sql += "COMMIT;\n"

        out = os.path.join(repo_root, f"resources/sql/site_lifecycle_{env}.sql")
        with open(out, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(sql)
        print(f"Generated: {out}")


if __name__ == "__main__":
    generate_sql()
