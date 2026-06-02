# Stock Reconciliation — Current State Assessment (v1)

**Assessed:** 2026-06-02  
**Assessor:** Tim Geldard  

---

## Current object

`gold.gold_stock_reconciliation` in `gold/warehouse_flow_gold.py`.

## Grain

**1 row per plant × material.**  
No storage-location, warehouse, batch, stock-category, or UoM dimension.

## Sources

| Silver table | Bronze source | Role |
|---|---|---|
| `silver.stock_at_location` | `storagelocationmaterial_mard` (MARD) | IM book stock (non-batch) |
| `silver.storage_bin` | `storagebin_lagp` (LAGP) + `quant_lqua` (LQUA) | WM quant stock |
| `silver.material_valuation` | `materialvaluation_mbew` (MBEW) | Standard price for delta valuation |
| `silver.storage_type_role_mapping` | Config seed + T301T / T320 | Classifies WM storage types as INTERIM or not |

`silver.batch_stock` (MCHB) is defined in the Silver layer but **not used** in v1 gold reconciliation.  
`materialconversion_marm` (MARM) is present in bronze (`materialconversion_marm`) but **not yet wired** into Silver or used in reconciliation.

## Current logic

1. **IM side:** Aggregates MARD unrestricted + quality + blocked + restricted + in-transfer quantities at plant × material. Ignores batch grain.
2. **WM side:** Joins `storage_bin` to `storage_type_role_mapping` (LEFT, with 9xx-prefix fallback for unmapped types). Splits by INTERIM/non-INTERIM role. Aggregates by plant × material.
3. **Delta:** `delta_qty = im_total_qty − wm_total_qty`. Tolerance = max(0.1, 1% of IM qty). Binary mismatch_class: `match` or `variance`.
4. **Valuation:** `inventory_value = im_total_qty × standard_price / price_unit`.
5. **ABC:** Cumulative inventory value within plant (A < 80%, B 80–95%, C > 95%, U = unpriced).
6. **Trust flag:** `is_operationally_trusted = false` if any occupied bin uses the 9xx fallback heuristic.

## Output columns

`plant_code`, `material_code`, `im_total_qty`, `wm_total_qty`, `wm_interim_qty`, `wm_physical_qty`,
`delta_qty`, `standard_price`, `price_unit`, `inventory_value`, `mismatch_class`, `abc_class`,
`is_operationally_trusted`

## Reconciliation control

`gold/recon/reconciliation_job.py` checks grain integrity at `["plant_code", "material_code"]`.

## Known gaps

| Gap | Impact |
|---|---|
| **Batch grain missing** — MARD is used; MCHB (batch breakdown) is not joined | Cannot identify which batch is the source of variance |
| **Storage-location missing** — MARD carries LGORT but it's dropped in the aggregation | Cannot identify which sloc the variance is at |
| **WM-side sloc not available** — LQUA/LAGP do not carry LGORT; T320 maps sloc→warehouse (1:1) but not warehouse→sloc (1:many) | WM stock can only be attributed to a warehouse, not a specific sloc |
| **No UoM normalisation** — MARM not used | Materials with non-standard UoMs may compare incorrectly (risk is low since both MARD and LQUA store in base UoM, but not validated) |
| **No mismatch reason** — single `match/variance` flag only | Cannot distinguish rounding from posting timing from true variance |
| **No stock-category breakdown** — all IM stock categories summed | Cannot see if variance is in unrestricted vs quality vs blocked |
| **Role coverage partial** — only C061/warehouse 208 partially seeded | `is_operationally_trusted = false` for all other plants |

## UAT source profiling (2026-06-02)

| Table | Rows (UAT) | Notes |
|---|---|---|
| `storagelocationmaterial_mard` | ~400k rows | 5,329 distinct plant/sloc combos |
| `batchstock_mchb` | ~3M rows | Very large; C079/9000 alone has 516k rows |
| `quant_lqua` | ~360k quants | 3 BESTQ values: blank (unrestricted), Q (quality), S (blocked) |
| `storagebin_lagp` | — | Used via `silver.storage_bin` |
| `materialconversion_marm` | 1.57M rows | 1.05M materials; 76 alt UoMs; zero invalid denominators |
| T320 (published) | 996 rows | Every (plant, sloc) → exactly 1 warehouse; no sloc with multiple warehouses |

**MARD/MCHB double-count validation (C061):** 750/750 plant-sloc-material combos show MARD.LABST = SUM(MCHB.CLABS) exactly. Confirmed: MCHB is the batch breakdown of MARD, not additive.

**MARM conversion direction:** `qty_base = qty_alt × UMREZ / UMREN` (verified: 1 BOX = 317/100 = 3.17 KG).

## Current tests

`tests/test_gold_warehouse_flow.py`:
- `test_stock_reconciliation_delta_and_match` — delta, match/variance, interim split, ABC, trust flag
- `test_stock_reconciliation_trusted_when_all_config` — trust flag when all roles are CONFIG-sourced
