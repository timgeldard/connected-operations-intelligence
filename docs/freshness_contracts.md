# Freshness contracts

Per-Silver-table replication freshness SLAs, surfaced by `gold_data_freshness_status` and enforced
(for critical tables) by `gold_critical_freshness_gate` (`gold/freshness.py`). This replaces the
earlier single-table `gold_freshness_gate` (which checked only `goods_movement`). Keep this table in
sync with `FRESHNESS_CONTRACTS` in `gold/freshness.py`.

**Status values:** `FRESH` (lag ≤ SLA) · `STALE` (lag > SLA) · `NO_DATA` (table empty/absent) ·
`STATIC` (seed/config table with no `_replicated_at` watermark — never STALE).

| Silver table | Domain | Criticality | SLA (min) | Watermarked |
|---|---|---:|---:|:--:|
| `goods_movement` | production/warehouse | critical | 120 | yes |
| `process_order` | production | critical | 120 | yes |
| `process_order_operation` | production | high | 240 | yes |
| `pi_sheet_execution` | production | high | 480 | yes |
| `downtime_event` | production/quality | high | 120 | yes |
| `warehouse_transfer_order` | warehouse | critical | 240 | yes |
| `warehouse_transfer_requirement` | warehouse | critical | 240 | yes |
| `storage_bin` | stock/warehouse | critical | 480 | yes |
| `batch_stock` | stock | critical | 480 | yes |
| `reservation_requirement` | warehouse | high | 240 | yes |
| `outbound_delivery` | outbound | high | 480 | yes |
| `stock_at_location` | stock | high | 480 | yes |
| `purchase_order` | inbound | medium | 1440 | yes (central_services) |
| `handling_unit` | inbound/HU | medium | 240 | yes (central_services) |
| `material` | reference | medium | 1440 | yes |
| `movement_type_classification` | reference | high | — | no (T156-backed overlay; no `_replicated_at` watermark) |
| `storage_type_role_mapping` | reference/config | high | — | no (seed/config table) |
| `process_order_staging_reference_mapping_config` | reference/config | high | — | no (seed/config table) |

## How it works
- **`gold_data_freshness_status`** — one row per table above: `latest_replicated_at`,
  `max_lag_minutes` (now − latest), `freshness_sla_minutes`, `freshness_status`, `checked_at`.
  Surface this on the operations dashboard so users can see "data fresh as of …" / stale warnings.
- **`gold_critical_freshness_gate`** — `@dlt.expect_or_fail` that fails the Gold run when a
  **critical** table is `STALE` or `NO_DATA` (`blocking_critical_table_count = 0`). Non-critical lag
  is reported but does not block, avoiding false pipeline failures while still catching silent
  critical-data outages and empty critical inputs.
- **`gold_data_health_summary`** — one row per health area, rolling freshness up with config
  coverage, process-order staging validation, stock reconciliation severity, and a pointer to the
  DLT event log for expectation violations.

## Notes / follow-ups
- SLAs distinguish continuous operational streams from triggered/current-state refreshes. Tune per
  source replication cadence and Gold job schedule before enabling the critical gate in production.
- Lag uses `_replicated_at` (Aecorsoft `AEDATTM`) — see the ordering-assumption note in
  `silver/design_spec.md`.
- The legacy `gold_freshness_gate` (goods_movement only) can be retired once this is validated in UAT.
