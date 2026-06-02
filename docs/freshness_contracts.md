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
| `warehouse_transfer_order` | warehouse | critical | 120 | yes |
| `warehouse_transfer_requirement` | warehouse | critical | 120 | yes |
| `storage_bin` | stock/warehouse | critical | 120 | yes |
| `batch_stock` | stock | critical | 240 | yes |
| `reservation_requirement` | warehouse | high | 120 | yes |
| `outbound_delivery` | outbound | high | 240 | yes |
| `stock_at_location` | stock | high | 240 | yes |
| `purchase_order` | inbound | medium | 1440 | yes (central_services) |
| `handling_unit` | inbound/HU | medium | 240 | yes (central_services) |
| `material` | reference | medium | 1440 | yes |
| `movement_type_classification` | reference | high | — | no (T156-backed overlay; no `_replicated_at` watermark) |

## How it works
- **`gold_data_freshness_status`** — one row per table above: `latest_replicated_at`,
  `max_lag_minutes` (now − latest), `freshness_sla_minutes`, `freshness_status`, `checked_at`.
  Surface this on the operations dashboard so users can see "data fresh as of …" / stale warnings.
- **`gold_critical_freshness_gate`** — `@dlt.expect_or_fail` that fails the Gold run when a
  **critical** table is `STALE` or `NO_DATA` (`blocking_critical_table_count = 0`). Non-critical lag
  is reported but does not block, avoiding false pipeline failures while still catching silent
  critical-data outages and empty critical inputs.

## Notes / follow-ups
- SLAs are initial estimates; tune per operational tolerance.
- Lag uses `_replicated_at` (Aecorsoft `AEDATTM`) — see the ordering-assumption note in
  `silver/design_spec.md`.
- The legacy `gold_freshness_gate` (goods_movement only) can be retired once this is validated in UAT.
