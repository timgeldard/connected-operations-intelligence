# Reconciliation Hardening Handover

## Branch and PR
- Branch: `codex/harden-sap-databricks-pipelines`
- PR: https://github.com/timgeldard/IOReporting/pull/50
- Previous commits on branch:
  - `293ae23` Harden SAP operations reporting pipelines
  - `1f7f6fc` Harden stock reconciliation roadmap

## Work Completed
- Added `silver.physical_inventory_document` from published SAP `IKPF`/`ISEG` sources.
- Added Gold reconciliation outputs:
  - `gold_movement_reconciliation`
  - `gold_hu_reconciliation`
  - `gold_physical_inventory_recon`
  - `gold_reconciliation_alerts`
- Extended `gold_reconciliation_audit_log` with absolute delta quantity in the audit evidence.
- Added `physical_inventory_document` to freshness contracts.
- Rolled `gold_reconciliation_alerts` into `gold_data_health_summary`.
- Registered the new Gold tables in generated secured serving views.
- Updated data contracts, design spec, source dependency map, roadmap, and reconciliation contract docs.
- Added unit coverage for the movement, HU, physical inventory, alert, and health-summary paths.

## Validation
- `ruff check silver/tables/inbound.py gold/warehouse_flow_gold.py gold/freshness.py tests/test_gold_warehouse_flow.py tests/test_gold_freshness.py scripts/generate_gold_security_sql.py`
  - Result: passed
- `pytest -q tests/test_gold_warehouse_flow.py tests/test_gold_freshness.py`
  - Result: `31 passed, 5 warnings`
- `pytest -q`
  - Result: `228 passed, 5 warnings`

The warnings are existing PySpark `Column.getItem` deprecation warnings in `gold_stock_reconciliation_v2` tests.

## Operational Notes
- `gold_movement_reconciliation` compares IM movement activity with confirmed WM transfer-order activity at date/material/batch grain. WM TOs do not carry SAP IM movement type, so this is an operational timing/activity control rather than a statutory movement-type proof.
- `gold_hu_reconciliation` compares VEKP/VEPO packed quantity with WM quant quantity by material/batch/UOM.
- `gold_physical_inventory_recon` provides count-vs-book status from IKPF/ISEG and flags recount and unposted difference cases.
- `gold_reconciliation_alerts` is deterministic and alert-ready; it does not create incidents directly.

## Remaining Follow-Ups
- Business-owned WM bin/storage-type to storage-location attribution is still needed for true LGORT-level WM reconciliation because LQUA does not carry LGORT.
- Open-transfer and posting-lag reason classification can be refined further once MM/WM users approve the tolerance and timing rules.
- Bundle validation/deployment was not run in this pass because no Databricks profile/target was selected in this turn.
