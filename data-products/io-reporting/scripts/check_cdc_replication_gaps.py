#!/usr/bin/env python3
"""Aecorsoft CDC / replication-gap detector — Spec 21, Item 2.

Detects gaps and stalls in the SAP→Bronze CDC replication that feeds Silver.  Motivated by the
QAMR stall that sat undetected (3 of 4 QM plants stopped replicating), and the ZPUS staleness
discovered manually.

The detector compares, per bronze source table, the max ``AEDATTM`` replication watermark
against the expected-recency threshold defined in ``gold.freshness.FRESHNESS_CONTRACTS``.  It
reports sources whose newest data is older than the threshold as STALE or ABSENT.

Design:
- LIVE query against the SQL warehouse (Databricks Statement Execution API or spark.sql).
  Must run against a workspace where the bronze catalog (connected_plant_uat.sap or
  connected_plant_prod.sap) is accessible.
- Offline-testable parts: the threshold logic, the report shaping, and the per-table
  STALE/ABSENT/FRESH classification are pure Python/dict and are covered by unit tests
  (``tests/test_cdc_gap_detector.py``).
- The live-query path is encapsulated in ``query_bronze_watermarks``, which accepts an
  optional ``spark`` argument so the unit tests can inject a mock without Spark.

Quickstart (runbook):
    # Inside a Databricks notebook or spark_python_task, or via the Statement Execution API:
    python data-products/io-reporting/scripts/check_cdc_replication_gaps.py \\
        --catalog connected_plant_uat \\
        --schema sap \\
        --report-path /tmp/cdc_gap_report.json

    # Standalone (uses Statement Execution API via databricks-sdk):
    databricks statement execute --warehouse-id <id> \\
        --statement "SELECT ..." \\
        (see the runbook in data-products/io-reporting/docs/runbooks/cdc_gap_detector_runbook.md)

Exit codes:
    0  — no STALE or ABSENT streams detected
    1  — one or more STALE or ABSENT streams detected (actionable gaps found)
    2  — configuration / connectivity error (check --catalog / --schema / credentials)

See also: gold/freshness.py (FRESHNESS_CONTRACTS — thresholds reused here).
          docs/runbooks/cdc_gap_detector_runbook.md — scheduled-check setup.
"""
from __future__ import annotations

import argparse
import datetime
import json
import sys
from typing import Any

# ── CDC metadata column (Aecorsoft). Silver maps this to _replicated_at. ─────────────
CDC_WATERMARK_COLUMN = "AEDATTM"

# ── Per-table bronze source map ───────────────────────────────────────────────────────
# Maps the Silver table name (matching FRESHNESS_CONTRACTS) to one or more bronze source
# tables that feed it.  Where a Silver table is assembled from a header+item pair, the
# item table (which carries AEDATTM) is used as the replication-freshness proxy.
#
# Tables without an AEDATTM column (seed/config tables: movement_type_classification,
# storage_type_role_mapping, process_order_staging_reference_mapping_config) carry
# has_watermark=False in FRESHNESS_CONTRACTS and are excluded here.
#
# Key insight for QM: QAMR / QASR have no per-plant column on the bronze table.  The
# gap detector checks the table-level watermark only (no per-plant split for QM tables).
# The plant scoping is done in Silver/Gold via QALS join — if QAMR stops replicating,
# ALL plants are affected simultaneously.
BRONZE_SOURCE_MAP: dict[str, list[str]] = {
    # fast-tier SAP operational tables
    "goods_movement":               ["inventorymovement_mseg"],
    "process_order":                ["ordermaster_aufk"],
    "process_order_operation":      ["processorderobject_afvc"],
    "pi_sheet_execution":           ["actualpistartenddatetime_zmanpex_e04_002"],
    "downtime_event":               ["downtime_zpexpm_dwnt"],
    "warehouse_transfer_order":     ["transferorderobjects_ltap"],
    "warehouse_transfer_requirement": ["transferrequirementobjects_ltbp"],
    "batch_stock":                  ["batchstock_mchb"],
    "reservation_requirement":      ["reservationrequirement_resb"],
    "outbound_delivery":            ["deliveryobjects_lips"],
    # slow-tier
    "storage_bin":                  ["storagebinobject_lagp"],
    "stock_at_location":            ["stockatlocation_mard"],
    "material":                     ["materialmaster_mara"],
    "physical_inventory_document":  ["inventorydocumentobject_ikpf"],
    # published/central_services source (second bronze path)
    "purchase_order":               ["procurementorderobject_ekko"],
    "handling_unit":                ["handlingunit_vekp"],
    # QM quality tables (AEDATTM-only, no plant field on the bronze table — see design note)
    # These are not in FRESHNESS_CONTRACTS but are added here as CDC-gap candidates because
    # the QAMR stall was the motivating incident for this detector (spec 21, item 2).
    "qm_inspection_lot":            ["inspection_qals"],
    "qm_usage_decision":            ["inspection_qave"],
    "qm_result":                    ["inspection_qamr"],
    "qm_individual_value":          ["inspection_qasr"],
}

# QM tables above are not in FRESHNESS_CONTRACTS and have no SLA defined there.
# Assign a sensible default SLA for the gap detector (24 h = 1440 min).
QM_DEFAULT_SLA_MINUTES = 1440


def _freshness_contracts() -> list[dict]:
    """Load FRESHNESS_CONTRACTS from gold.freshness, falling back to an empty list.

    The import is lazy so this script can be syntax-checked / unit-tested without
    Databricks or PySpark installed.
    """
    try:
        from gold.freshness import FRESHNESS_CONTRACTS  # type: ignore[import]
        return FRESHNESS_CONTRACTS
    except Exception:  # noqa: BLE001
        return []


def _sla_for_table(silver_table: str) -> int | None:
    """Return the SLA in minutes for *silver_table* from FRESHNESS_CONTRACTS, or None if absent."""
    for c in _freshness_contracts():
        if c["table"] == silver_table and c.get("has_watermark", True):
            return int(c["sla_minutes"])
    # QM tables not in FRESHNESS_CONTRACTS: use default
    if silver_table in ("qm_inspection_lot", "qm_usage_decision", "qm_result", "qm_individual_value"):
        return QM_DEFAULT_SLA_MINUTES
    return None


# ── Core classification logic (pure — no Spark, fully unit-testable) ─────────────────

def classify_stream(
    silver_table: str,
    bronze_table: str,
    max_watermark: datetime.datetime | None,
    sla_minutes: int | None,
    checked_at: datetime.datetime,
) -> dict[str, Any]:
    """Classify a single bronze stream and return a structured report row.

    Args:
        silver_table:   Silver table name (for labelling).
        bronze_table:   Bronze source table name checked.
        max_watermark:  Latest AEDATTM observed in the bronze table, or None if absent/empty.
        sla_minutes:    Configured recency threshold (from FRESHNESS_CONTRACTS).
                        None → use QM_DEFAULT_SLA_MINUTES.
        checked_at:     Snapshot time (for lag calculation).

    Returns a dict with keys: silver_table, bronze_table, max_watermark_utc,
        lag_minutes, sla_minutes, status, gap_hours (human-readable), notes.
    """
    effective_sla = sla_minutes if sla_minutes is not None else QM_DEFAULT_SLA_MINUTES

    if max_watermark is None:
        status = "ABSENT"
        lag_minutes = None
        gap_hours = None
        notes = f"No rows found in {bronze_table} — table may not be replicated."
    else:
        lag_seconds = (checked_at - max_watermark).total_seconds()
        lag_minutes_f = lag_seconds / 60.0
        lag_minutes = round(lag_minutes_f, 1)
        gap_hours = round(lag_minutes_f / 60.0, 1)
        if lag_minutes_f > effective_sla:
            status = "STALE"
            notes = (
                f"Lag {lag_minutes:.0f}m exceeds SLA {effective_sla}m "
                f"({gap_hours:.1f}h behind). Latest CDC watermark: {max_watermark.isoformat()}."
            )
        else:
            status = "FRESH"
            notes = f"Within SLA ({lag_minutes:.0f}m lag vs {effective_sla}m SLA)."

    return {
        "silver_table": silver_table,
        "bronze_table": bronze_table,
        "max_watermark_utc": max_watermark.isoformat() if max_watermark else None,
        "lag_minutes": lag_minutes,
        "sla_minutes": effective_sla,
        "gap_hours": gap_hours,
        "status": status,
        "notes": notes,
        "checked_at_utc": checked_at.isoformat(),
    }


def build_report(
    watermarks: dict[str, datetime.datetime | None],
    sla_map: dict[str, int | None],
    checked_at: datetime.datetime,
) -> list[dict[str, Any]]:
    """Build the full gap report from watermark observations and SLA map.

    Args:
        watermarks:  {bronze_table → max AEDATTM (or None if absent)}.
        sla_map:     {silver_table → sla_minutes (from FRESHNESS_CONTRACTS)}.
        checked_at:  Snapshot datetime for lag calculation.

    Returns a list of report rows, sorted by status (ABSENT, STALE, FRESH) then silver_table.
    """
    rows = []
    for silver_table, bronze_tables in BRONZE_SOURCE_MAP.items():
        sla = sla_map.get(silver_table)
        for bronze_table in bronze_tables:
            max_wm = watermarks.get(bronze_table)
            row = classify_stream(silver_table, bronze_table, max_wm, sla, checked_at)
            rows.append(row)

    # Sort: ABSENT first, then STALE, then FRESH; within each group by silver_table.
    _order = {"ABSENT": 0, "STALE": 1, "FRESH": 2}
    rows.sort(key=lambda r: (_order.get(r["status"], 9), r["silver_table"]))
    return rows


def summarise(report: list[dict[str, Any]]) -> dict[str, Any]:
    """Return a summary dict with counts by status and list of actionable streams."""
    absent = [r for r in report if r["status"] == "ABSENT"]
    stale = [r for r in report if r["status"] == "STALE"]
    fresh = [r for r in report if r["status"] == "FRESH"]
    return {
        "total_streams": len(report),
        "absent_count": len(absent),
        "stale_count": len(stale),
        "fresh_count": len(fresh),
        "actionable_streams": [r["silver_table"] for r in absent + stale],
        "has_gaps": bool(absent or stale),
    }


# ── Live query path (Databricks / Spark — not exercised by unit tests) ───────────────

def query_bronze_watermarks(
    catalog: str,
    schema: str,
    spark=None,
) -> dict[str, datetime.datetime | None]:
    """Query each bronze table for its max AEDATTM watermark.

    Args:
        catalog:  Source catalog (e.g. 'connected_plant_uat').
        schema:   Source schema (e.g. 'sap').
        spark:    Optional SparkSession.  If None, uses getOrCreate().

    Returns {bronze_table_name → max_AEDATTM (datetime or None)}.

    Tables that do not exist (not yet replicated) are reported as None.
    """
    if spark is None:
        from pyspark.sql import SparkSession  # noqa: PLC0415
        spark = SparkSession.builder.getOrCreate()

    results: dict[str, datetime.datetime | None] = {}
    all_bronze = sorted({bt for bts in BRONZE_SOURCE_MAP.values() for bt in bts})

    for bronze_table in all_bronze:
        fq = f"`{catalog}`.`{schema}`.`{bronze_table}`"
        try:
            row = spark.sql(
                f"SELECT MAX({CDC_WATERMARK_COLUMN}) AS max_wm FROM {fq}"
            ).first()
            max_wm = row["max_wm"] if row else None
            # PySpark returns Timestamp as datetime.datetime
            if max_wm is not None and not isinstance(max_wm, datetime.datetime):
                # Handle date-only or string types defensively
                if hasattr(max_wm, "isoformat"):
                    max_wm = datetime.datetime.fromisoformat(str(max_wm))
                else:
                    max_wm = None
            results[bronze_table] = max_wm
        except Exception as exc:  # noqa: BLE001
            print(
                f"WARNING: could not query {fq}: {exc}",
                file=sys.stderr,
            )
            results[bronze_table] = None

    return results


def _print_report(report: list[dict[str, Any]], summary: dict[str, Any]) -> None:
    """Print a human-readable report to stdout."""
    print("\n══ Aecorsoft CDC replication-gap report ══")
    print(f"  Checked at (UTC): {report[0]['checked_at_utc'] if report else 'n/a'}")
    print(f"  Total streams:    {summary['total_streams']}")
    print(f"  ABSENT:           {summary['absent_count']}")
    print(f"  STALE:            {summary['stale_count']}")
    print(f"  FRESH:            {summary['fresh_count']}")

    if summary["has_gaps"]:
        print("\n  ── Actionable gaps (ABSENT / STALE) ──")
        for r in report:
            if r["status"] in ("ABSENT", "STALE"):
                print(
                    f"  [{r['status']:6s}] {r['silver_table']:45s} "
                    f"(bronze: {r['bronze_table']}) — {r['notes']}"
                )
    else:
        print("\n  All monitored CDC streams are within SLA.")


def run(catalog: str, schema: str, report_path: str | None = None, spark=None) -> int:
    """Run the gap detector and optionally write a JSON report.

    Returns 0 if no gaps, 1 if gaps detected, 2 on error.
    """
    checked_at = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).replace(tzinfo=None)

    try:
        watermarks = query_bronze_watermarks(catalog, schema, spark=spark)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: failed to query bronze watermarks: {exc}", file=sys.stderr)
        return 2

    sla_map = {sv: _sla_for_table(sv) for sv in BRONZE_SOURCE_MAP}
    report = build_report(watermarks, sla_map, checked_at)
    summary = summarise(report)

    _print_report(report, summary)

    if report_path:
        output = {"summary": summary, "rows": report}
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, default=str)
        print(f"\nReport written to: {report_path}")

    return 1 if summary["has_gaps"] else 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Aecorsoft CDC replication-gap detector. Queries bronze source tables for max "
            "AEDATTM watermark and flags stale/absent streams vs FRESHNESS_CONTRACTS SLAs."
        )
    )
    parser.add_argument(
        "--catalog", default="connected_plant_uat",
        help="Bronze source catalog (default: connected_plant_uat).",
    )
    parser.add_argument(
        "--schema", default="sap",
        help="Bronze source schema (default: sap).",
    )
    parser.add_argument(
        "--report-path", default=None,
        help="Optional path to write a structured JSON report.",
    )
    args = parser.parse_args(argv)
    return run(catalog=args.catalog, schema=args.schema, report_path=args.report_path)


if __name__ == "__main__":
    sys.exit(main())
