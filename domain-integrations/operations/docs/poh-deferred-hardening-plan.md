# POH Deferred Evidence Hardening Plan

**Created:** 2026-05-21
**Last updated:** 2026-05-21
**Branch:** poh-hardening
**Status:** Completed — Slices 1, 2, 3, 6 (code-fixed; browser UAT remains pending)
**Deferred from:** PR #52

---

## 1. Scope

Focused hardening of Process Order History (POH) component consumption grouping,
negative-movement visibility, and source attribution before broader business UAT.

This is not a redesign. It does not add SAP write-back, new Databricks columns,
UOM conversions, or production-readiness claims.

---

## 2. Current Behaviour

### 2.1 Component Consumption (`order-history-view.tsx` lines 426–464)

**Grouping key:** `materialId` only.

```
byMaterial = new Map<string, ComponentConsumptionRow>()
// map key: movement.materialId
```

All 261 and 262 movements for the same materialId are aggregated into a single
row regardless of batch or UOM. Only the first `261` batchId encountered is kept.
The UOM is set from the first movement's normalised UOM and never updated.

**Post-aggregation filter (line 462):**
```typescript
.filter(row => row.totalQuantity > 0)
```
Rows with net quantity ≤ 0 are silently dropped. If 262 reversals fully cancel
261 issues, the material disappears from evidence entirely.

### 2.2 Produced Output (`order-history-view.tsx` lines 466–516)

**Grouping key:** `materialId :: batchId :: normalised UOM` (three-way composite).

This is already correct and safe. Different batches remain separate. Different
UOMs remain separate.

**Post-aggregation filter (line 514):**
```typescript
.filter(row => row.netQuantity > 0)
```
Same problem as component consumption: fully-reversed output rows are silently
dropped. A 102 reversal that fully cancels a 101 receipt becomes invisible.

### 2.3 UOM Normalisation (`normaliseMovementQuantity`, lines 141–150)

```typescript
// EA → excluded (null)
// G  → KG (÷ 1000)
// all others → trimmed/uppercased as-is
```

Only two normalisation rules apply. If the source contains movements in both KG
and L for the same material, they will have different UOMs after normalisation.
Under the current material-only grouping key, the second UOM's quantity is summed
into the same row as the first, producing an incorrect cross-UOM total.

### 2.4 Source Attribution (`getSectionSource`, line 122)

```typescript
function getSectionSource(query: QueryLike): string {
  if (query.data?.source) return query.data.source
  if (query.isError || (query.data && !query.data.ok)) return 'unavailable'
  return 'unknown'
}
```

Source is read from `AdapterResult.source`. The Databricks adapter sets
`source: 'databricks-api'` on all successful results. The mock adapter sets
`source: 'mock'`. Error paths return `'unavailable'`. Unloaded sections return
`'unknown'`.

There is no X-Data-Source HTTP header from the backend; the source label is
set by the frontend adapter class, which selects the correct tier at
instantiation time. This is correct behaviour.

The Databricks adapter's `getProcessOrderHeader` calls the legacy-api parent
and then overwrites `source: 'databricks-api'` (line 43), which is intentional:
the same URL is used but BACKEND_ADAPTER_MODE selects native execution.

**No source attribution defect is present.** Slice 6 will confirm and document
this, and add tests for the source values returned in each adapter mode.

---

## 3. Identified Risks

| Risk | Severity | Location |
|---|---|---|
| Multiple batches per material collapsed into one row | High | `order-history-view.tsx:427` |
| Different UOMs summed into single quantity | High | `order-history-view.tsx:427` |
| Fully-reversed component rows silently hidden | High | `order-history-view.tsx:462` |
| Only first 261 batchId kept; later batches discarded | High | `order-history-view.tsx:444` |
| Fully-reversed produced-output rows silently hidden | Medium | `order-history-view.tsx:514` |
| No test coverage for multi-batch or mixed-UOM inputs | High | `order-history-view.test.tsx` |
| No test coverage for zero or negative net quantity rows | High | `order-history-view.test.tsx` |

---

## 4. Target Behaviour

### 4.1 Component Consumption Grouping Key

Change from `materialId` to `materialId :: batchId :: normalised UOM`.

Same material + same batch + same UOM → quantities may aggregate.
Same material + different batch → separate rows.
Same material + same batch + different UOM → separate rows.
Same material + missing batch + known batch → separate rows (missing batch key = `''`).
Same material + missing UOM + known UOM → separate rows.

### 4.2 Reversal / Zero-Quantity Visibility

Remove the `.filter(row => row.totalQuantity > 0)` filter from component consumption.
Remove the `.filter(row => row.netQuantity > 0)` filter from produced output.

All rows must remain visible including zero and negative net quantities.
Zero-net rows represent fully-reversed evidence; negative-net rows represent
over-reversal. Both are valid evidence states and must not be hidden.

The UI table already shows `totalQuantity` / `netQuantity` as a number. Negative
values will display as-is. A UI warning may be added if useful, but must not
replace visibility.

### 4.3 Source Attribution

No change to the logic. `getSectionSource` already reads from `AdapterResult.source`
correctly. Slice 6 will add tests and update documentation.

---

## 5. Affected Files

| File | Change |
|---|---|
| `domain-integrations/operations/src/views/order-history-view.tsx` | Component consumption grouping key, filter removal (Slice 2) |
| `domain-integrations/operations/src/views/order-history-view.tsx` | Produced output filter removal (Slice 2) |
| `domain-integrations/operations/src/views/order-history-view.test.tsx` | Multi-batch, mixed-UOM, reversal regression tests (Slice 3) |
| `domain-integrations/operations/docs/poh-deferred-hardening-plan.md` | This file (Slice 1) |
| `domain-integrations/operations/docs/poh-v1-v2-functional-parity.md` | Sync after hardening (Slice 8) |
| `domain-integrations/operations/docs/poh-uat-readiness-notes.md` | Sync after hardening (Slice 8) |

The data contracts (`packages/data-contracts`) do not need changes. The backend
adapter (`apps/api/adapters/poh/poh_databricks_adapter.py`) does not need changes.
The frontend Databricks adapter does not need changes for Slices 2 and 3.

---

## 6. Test Cases To Add (Slice 3)

All tests are unit tests on the pure derivation logic in `order-history-view.tsx`.
No Databricks connection is required.

1. **Same material, same batch, same UOM** — quantities aggregate.
2. **Same material, different batches, same UOM** — rows remain separate.
3. **Same material, same batch, different UOM** — rows remain separate.
4. **Same material, missing batch + known batch** — rows remain separate.
5. **Same material, missing UOM + known UOM** — rows remain separate.
6. **Same material, different batch and different UOM** — rows remain separate.
7. **Mixed positive and negative quantities** — negative row remains visible.
8. **Full reversal: 262 exactly cancels 261** — zero-net row remains visible, not hidden.
9. **Over-reversal: 262 exceeds 261** — negative-net row remains visible.
10. **Zero quantity movement** — row behaviour is explicit, not used to imply no consumption.
11. **Material description shared across batches** — description is not the grouping key.
12. **Produced output: full reversal (102 cancels 101)** — zero-net row remains visible.

---

## 7. Assumptions

- The backend returns one row per goods-movement document line. No pre-aggregation
  occurs in the SQL layer that would already collapse batches.
- `BATCH_ID` in `vw_gold_adp_movement` is the canonical batch identifier for
  component movements. Batch is not derived from material description or other fields.
- UOM normalization (G→KG) is the only agreed conversion. No other conversions
  are in scope.
- The component consumption section renders a table from `componentConsumption`
  derived data. Adding more rows (one per batch/UOM combination) does not require
  architectural changes to the table.

---

## 8. Acceptance Criteria

### Slice 2 (grouping fix)
- [x] Component consumption no longer groups by materialId only.
- [x] Multiple batches for the same material appear as separate rows.
- [x] Mixed UOMs for the same material appear as separate rows.
- [x] Missing batch and known batch for the same material appear as separate rows.
- [x] Rows with zero or negative net quantity are visible (not filtered out).
- [x] Produced output filter also updated — zero/negative rows visible.

### Slice 3 (regression tests)
- [x] 8 regression tests covering TC-1 through TC-8 are present and pass.
- [x] Tests are readable for future agents/developers without repo history context.
- [x] No Databricks connection required.

### Slice 6 (source attribution)
- [x] `getSectionSource` confirmed correct via tests.
- [x] `databricks-api` source renders Databricks badge (test confirmed).
- [x] `mock` source renders Mock/Sandbox badge — does not appear as live/databricks.
- [x] UAT evidence payload captures per-section sources and derives `mixed` overall.

### Slice 8 (docs sync)
- [x] `poh-v1-v2-functional-parity.md` updated to reflect grouping fix.
- [x] `poh-uat-readiness-notes.md` updated to state grouping has been hardened.
- [x] Docs distinguish code-fixed from UAT-verified.
- [x] No production readiness is claimed.

---

## 9. Deferred Items (not in this hardening tranche)

The following items remain deferred after this tranche:

| Item | Reason |
|---|---|
| Slices 4, 5, 7 (reversal hardening, produced-output grouping check, UAT payload update) | May be partially addressed by Slice 2; full coverage assessed after Slices 2–3 |
| POH order-list route | No V2 native route; would require new Databricks source confirmation |
| Header planned/actual quantities/dates | Columns not confirmed in `vw_gold_process_order` DDL |
| Material master join for descriptions | No confirmed V2 join source |
| Downtime / equipment / comments evidence | No confirmed V2 source routes |
| Cross-domain QM / usage-decision link | Deferred to Quality/EnvMon source strategy |
| POH production-readiness claim | Not claimed; requires deployed browser + SAP validation |

---

## 10. Safety Confirmation

- No Databricks columns invented.
- No UOM conversions invented beyond the existing G→KG rule.
- No SAP write-back added.
- No service-principal fallback added.
- No app-side plant authorisation added.
- No production readiness claimed.
