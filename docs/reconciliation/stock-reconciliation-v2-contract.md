# Stock Reconciliation v2 — Data Contract

**Version:** 2.0  
**Status:** Implemented (2026-06-02)  
**Supersedes:** v1 in `gold_stock_reconciliation` (kept as directional summary)  
**ADR reference:** `docs/adr/009-stock-reconciliation-detailed.md`

---

## Problem

v1 (`gold_stock_reconciliation`) is plant × material grain. Analysts cannot answer
"why does IM not match WM for this material/batch/stock-category?" — the mismatch reason,
batch identity, and stock-category breakdown are all absent.

---

## Grain

**`gold_stock_reconciliation_v2`** — 1 row per:

```
plant_code | warehouse_number | material_code | batch_number | stock_category | base_uom
```

**Important constraint:** WM (LQUA) does not carry storage-location (LGORT). T320 maps
storage-location → warehouse (1:1), but a warehouse may serve multiple storage-locations.
Consequently the grain omits `storage_location_code` on the WM side. The IM side is
aggregated across all storage-locations that feed the same warehouse (via T320 join) before
the IM↔WM comparison. Adding sloc-grain requires a future WM configuration layer that
maps bins to storage-locations — tracked in ADR-009.

---

## Sources

| Silver table | Bronze source | Role |
|---|---|---|
| `silver.batch_stock` | MCHB | IM stock for batch-managed materials |
| `silver.stock_at_location` | MARD | IM stock for non-batch materials |
| `silver.material` | MARA / MARC | `batch_management_required`, `base_uom` |
| `silver.storage_bin` | LQUA + LAGP | WM quant stock |
| `silver.warehouse_storage_location_mapping` | T320 (published) | sloc → warehouse bridge |
| `silver.material_uom_conversion` | MARM | UoM conversion factor (detection only in v2) |
| `silver.material_valuation` | MBEW | Delta valuation |

---

## IM side

**Routing rule** (based on `silver.material.batch_management_required`):

- `batch_management_required = true` → source from `silver.batch_stock` (MCHB), one row per
  (plant, sloc, material, batch, stock_category)
- `batch_management_required = false` → source from `silver.stock_at_location` (MARD), with
  `batch_number = '__NONE__'`

**Verified:** MARD.LABST = SUM(MCHB.CLABS) at C061 for all 750 matched combos (2026-06-02).
The two sources are the total/breakdown of the same stock — do not union both.

**Stock categories surfaced from IM:**

| MARD/MCHB field | Stock category |
|---|---|
| `unrestricted_quantity` (LABST/CLABS) | UNRESTRICTED |
| `quality_inspection_quantity` (INSME/CINSM) | QUALITY |
| `blocked_quantity` (SPEME/CSPEM) | BLOCKED |

(RESTRICTED, IN_TRANSFER, RETURNS_BLOCKED are present in MARD/MCHB but have no direct WM
equivalent — excluded from v2 comparison; left as a documented gap.)

**T320 join:** IM is aggregated from sloc grain to warehouse grain using `warehouse_storage_location_mapping`
(plant, sloc → warehouse). Slocs not in T320 → `warehouse_number = '__NO_WM_MAPPING__'`.

---

## WM side

Source: `silver.storage_bin` (occupied bins: `quant_number IS NOT NULL`).

**BESTQ → stock_category mapping (confirmed from UAT LQUA):**

| LQUA BESTQ | Stock category | Count in UAT |
|---|---|---|
| `` (blank) | UNRESTRICTED | 313,700 quants |
| `Q` | QUALITY | 33,106 quants |
| `S` | BLOCKED | 14,046 quants |

---

## Delta and tolerance

```
delta_quantity = wm_quantity - im_quantity
tolerance = greatest(0.001, abs(im_quantity) * 0.001)
is_reconciled = abs(delta_quantity) <= tolerance
```

Tolerance is 0.1% of IM quantity with a 0.001 floor (tighter than v1's 1% floor of 0.1).
A configurable `stock_reconciliation_tolerance_config` table is reserved for future
plant/material-type-specific overrides.

---

## Mismatch reasons (implemented in v2)

| Reason | Condition |
|---|---|
| `MATCHED` | `abs(delta) <= tolerance` |
| `WM_MANAGED_SLOC_MAPPING_MISSING` | IM sloc has no T320 entry |
| `UOM_CONVERSION_MISSING` | `silver.material_uom_conversion` has no row for this material (detection only; quantities are both in base UoM so impact is typically zero) |
| `BATCH_MISSING_IN_WM` | IM qty > 0, WM qty is NULL/0 |
| `BATCH_MISSING_IN_IM` | WM qty > 0, IM qty is NULL/0 |
| `TRUE_VARIANCE` | Both sides have qty, delta exceeds tolerance |

**Documented allowed values (not yet implemented — reserved for future phases):**

`OPEN_TRANSFER_ORDER_IMPACT`, `QUALITY_STOCK_MISMATCH`, `BLOCKED_STOCK_MISMATCH`,
`UNRESTRICTED_STOCK_MISMATCH`, `NEGATIVE_STOCK`, `ROUNDING_ONLY`, `UNKNOWN`

---

## Mismatch severity

| Severity | Conditions |
|---|---|
| `INFO` | `MATCHED` |
| `MEDIUM` | `UOM_CONVERSION_MISSING`, `BATCH_MISSING_IN_IM`, `BATCH_MISSING_IN_WM` |
| `HIGH` | `WM_MANAGED_SLOC_MAPPING_MISSING`, `TRUE_VARIANCE` |

---

## Output columns

### `gold_stock_reconciliation_v2`
```
plant_code, warehouse_number, material_code, batch_number,
stock_category, base_uom,
im_quantity, wm_quantity, delta_quantity,
abs_delta_quantity, tolerance_quantity, is_reconciled,
unit_price, price_unit, delta_value,
mismatch_reason, mismatch_severity, is_operationally_trusted
```

### `gold_stock_reconciliation_exceptions_v2` (DLT view)
Filters `is_reconciled = false`. Adds `material_description` from `silver.material`.

### `gold_stock_reconciliation_summary_v2` (DLT view)
Grain: plant × warehouse × mismatch_reason × mismatch_severity.
Measures: `exception_count`, `abs_delta_quantity_total`, `abs_delta_value_total`.

---

## Relationship to v1

`gold_stock_reconciliation` (v1) is kept as a directional plant × material summary.
Once v2 is validated against SAP transactions (MB52/MMBE/LX02/LX03 comparators), v1 can be
deprecated or replaced with a rollup from v2.

---

## Reconciliation control

`gold/recon/reconciliation_job.py` grain-check added for v2 at the 6-key natural key.

---

## Known gaps / follow-ups

- **Storage-location grain**: WM (LQUA) has no LGORT — the sloc-grain join requires a
  future WM bin→sloc configuration layer (ADR-009 §3.2).
- **IN_TRANSFER / RESTRICTED stock**: not compared in v2 (no WM equivalent).
- **Open-TO impact**: LQUA `open_transfer_quantity` (TRAME) is available in `storage_bin`
  but not yet used to explain timing-related variances.
- **UoM normalisation**: MARM is wired into silver (`material_uom_conversion`) for
  detectability but both MARD and LQUA store in base UoM — normalisation logic is a no-op
  for standard cases; unusual configs may need it.
- **Material-Ledger valuation**: `delta_value` uses standard price (MBEW.STPRS), not actual
  cost. ML-reconciled values require a separate MBEW extension.
