# SPC Databricks Verification Results Summary

**Status:** Verified 2026-05-21
**Verified by:** tim.geldard@kerry.com via Databricks CLI
**Warehouse:** `e76480b94bea6ed5` (`connected_plant_uat`, medium, running)
**Catalog:** `connected_plant_uat.gold`
**Branch:** `feature/spc-databricks-verification-evidence`

---

## 1. Executive Summary

All primary SPC Databricks objects exist and are accessible in `connected_plant_uat.gold`. The SPC data model is substantially richer than the V1 source analysis suggested, with 22 objects found versus 17 expected. However, two important expected objects are missing: `spc_capability_detail_mv` and `spc_nelson_rule_flags_mv`. The subgroup data model has significantly different column names from V1 expectations. `spc_locked_limits` has only 1 row — a test fixture, not production-representative. Rule/signal violations are computed client-side with no stored source in Databricks.

**Recommendation: Do not proceed with native V2 direct Databricks SPC route yet.** Proceed first with a bounded V1 proxy bridge while resolving the grain, schema-alignment, and limits-availability gaps identified below.

---

## 2. Objects Found

| Object | Type | Rows | In V1 Source Analysis |
|--------|------|------|-----------------------|
| `spc_quality_metric_subgroup_v` | VIEW | large (use MV) | Yes |
| `spc_quality_metric_subgroup_mv` | MANAGED Delta (MV by convention) | 73,452,925 | **No — unexpected** |
| `spc_locked_limits` | MANAGED Delta | 1 | Yes |
| `spc_characteristic_dim_mv` | MANAGED Delta | 3,017,410 | Yes |
| `spc_material_dim_mv` | MATERIALIZED_VIEW | 138,051 | Yes |
| `spc_plant_material_dim_mv` | MANAGED Delta | 87,336 | Yes |
| `spc_batch_dim_mv` | MANAGED Delta | 2,164,058 | Yes |
| `spc_exclusions` | MANAGED Delta | 6 | Yes |
| `spc_mic_chart_config` | MANAGED Delta | 0 | Yes |
| `spc_quality_metrics` | METRIC_VIEW | n/a (not row-queryable) | Yes |
| `spc_attribute_quality_metrics` | likely METRIC_VIEW | n/a | Yes |
| `spc_attribute_metric_source_v` | VIEW | not counted | Yes |
| `spc_attribute_subgroup_mv` | MANAGED Delta (MV) | not counted | **No — unexpected** |
| `spc_correlation_source_mv` | MANAGED Delta (MV) | not counted | Yes |
| `spc_correlation_source_v` | VIEW | not counted | **No — unexpected** |
| `spc_lineage_graph_mv` | MANAGED Delta (MV) | not counted | **No — unexpected** |
| `spc_mic_routing_v` | VIEW | not counted | **No — unexpected** |
| `spc_process_flow_metrics` | likely METRIC_VIEW | n/a | Yes |
| `spc_process_flow_source_mv` | MANAGED Delta (MV) | not counted | **No — unexpected** |
| `spc_process_flow_source_v` | VIEW | not counted | **No — unexpected** |
| `spc_query_audit` | MANAGED Delta | not counted | Yes |
| `spc_unified_mic_key_v` | VIEW | not counted | **No — unexpected** |

---

## 3. Objects Missing

| Object | Expected from V1 Source | Impact |
|--------|------------------------|--------|
| `spc_capability_detail_mv` | Yes — stores Cp/Cpk/Pp/Ppk | Capability metrics unavailable from Databricks. Migration not applied in UAT. |
| `spc_nelson_rule_flags_mv` | Yes — stores precomputed Nelson rule flags | No stored rule flags. Migration not applied. |

No signal, alarm, rule, or violation tables exist in `connected_plant_uat.gold`.

---

## 4. Object Types

| Object | Confirmed Type | Notes |
|--------|----------------|-------|
| `spc_quality_metric_subgroup_v` | VIEW | Underlying SQL view — use MV for performance |
| `spc_quality_metric_subgroup_mv` | MANAGED Delta (materialized by convention) | 73M rows; clustering on material_id, mic_id; preferred for V2 queries |
| `spc_locked_limits` | MANAGED Delta | PK: (material_id, mic_id, plant_id, operation_id, chart_type) |
| `spc_material_dim_mv` | MATERIALIZED_VIEW | Databricks native MV; RECOMPUTED refresh |
| `spc_quality_metrics` | METRIC_VIEW | AI/BI; SELECT returns empty; not queryable as regular table |

---

## 5. Schema Findings

### `spc_quality_metric_subgroup_v` / `_mv` (34 columns)

**Key differences from V1 expectations:**

| V1 Expected Column | Actual Status | Replacement |
|--------------------|--------------|-------------|
| `result_value` | NOT present | `value` |
| `sample_id` | NOT present | none (no sample-level key) |
| `sample_timestamp` | NOT present | `batch_date`, `first_posting_date`, `last_posting_date` |
| `subgroup_mean` | NOT present | derive as `sum_value / batch_n` |
| `subgroup_range` | NOT present | `batch_range` |
| `subgroup_sd` | NOT present | derive from `sum_squares` |
| `inspection_lot_id` | NOT present | not in this view |
| `unit_of_measure` | NOT present — no physical UOM column found | absent; `normality_type`/`normality_method` are statistical distribution metadata (not UOM) |

**New columns not in V1 expectations:** `batch_n` (sample count per batch), `sum_value`, `sum_squares`, `min_value`, `max_value`, `batch_range`, `any_rejection`, `any_acceptance`, `unified_mic_key`, `subgroup_rep`, `normality_type`, `normality_method`, `normality_signature`, `spec_type`, `nominal_target`, `tolerance_half_width`, `raw_tolerance`, `spec_signature`, `material_name`, `plant_name`, `mic_name`.

### `spc_locked_limits` (19 columns)

Confirmed present. Key clarification: `baseline_from`/`baseline_to` (not `effective_from`/`effective_to`). Spec limits (`lsl_spec`, `usl_spec`) are NOT stored here — they are in the subgroup view. No `usl`/`lsl` columns.

---

## 6. Grain Findings

| Object | Grain Conclusion | Confidence |
|--------|-----------------|------------|
| `spc_quality_metric_subgroup_mv` | Individual measurement level — one row per quality measurement within a batch. `batch_n` = total samples; `subgroup_rep` is NOT a reliable unique key within a batch. No clean single-column PK. `P999` sentinel plant rows are not real material data. | medium |
| `spc_locked_limits` | `(material_id, mic_id, plant_id, operation_id, chart_type)` — confirmed unique | high |
| `spc_characteristic_dim_mv` | `(material_id, mic_id)` — confirmed unique per clustering | high |

---

## 7. Navigation Model Conclusion

**Confirmed material-centric navigation.**

Recommended V2 request shape:
- `materialId` (required — primary key)
- `plantId` (required — filter scope)
- `micId` (required — quality characteristic)
- `operationId` (optional — sequential number 00000001–00000009+, NOT a SAP work centre)
- `dateFrom` / `dateTo` (optional — filter on `batch_date`)

**Important:** `operation_id` values observed are sequential numbers (`00000001`, `00000003`, `00000004`, `00000005`) — they are an internal sequence identifier for inspection operations, NOT SAP work centre codes. Do not map V2 `workCentreId` to `operation_id` without further governance confirmation.

**Plant ID types:** Plant IDs include both SPC-internal codes (P-prefix: P523, P851, P775, P768) and SAP plant codes (C-prefix: C037). The mapping between these namespaces is not confirmed.

---

## 8. Control Limit Provenance Conclusion

**UAT-suitable with caveats — 1 test fixture row only.**

- `spc_locked_limits` contains exactly 1 row: `material_id=20047111, mic_id=0060, plant_id=C037, chart_type=imr`
- Locked by `domhnall.odonovan@kerry.ie` on 2026-04-06
- CL=3.24, UCL=5.54, LCL=0.95 (salt content %, reasonable values)
- `baseline_from`/`baseline_to` empty; `spec_signature` empty; `locking_note` empty
- Spec limits are NOT in this table — they are in `lsl_spec`/`usl_spec` on the subgroup view (0.0 for the golden candidate — not populated)
- **This is a UAT test row, not a production control limit set. V2 must not treat 1 locked limit row as production-ready.**
- `live` limits mode (computed from subgroup data at runtime) is the primary control limit source for most materials.

---

## 9. Rule/Signal Source Conclusion

**Classification: Calculated client-side. No stored signal source in Databricks.**

- No signal/alarm/rule/violation tables exist in `connected_plant_uat.gold`
- `spc_nelson_rule_flags_mv` NOT FOUND — migration not applied
- V2 has WECO and Nelson rule detection functions in `domain-integrations/spc/src/utils/` (frontend/adapter layer)
- V2 `spc-signals-adapter.ts` is mock-only (Phase 1 stub)
- Future V2 implementation: WECO/Nelson rules must be computed in the V2 frontend or backend from subgroup point data and locked limits — NOT read from a stored source
- UI wording must distinguish "calculated signal" from "stored signal" — these are calculated signals

---

## 10. Capability Source Conclusion

**Classification: Capability (Cp/Cpk/Pp/Ppk) unavailable from Databricks source.**

- `spc_capability_detail_mv` NOT FOUND — migration not applied in UAT
- `spc_quality_metrics` (METRIC_VIEW) has aggregate measures (`sigma_within`, `ooc_rate`, `mean_value`, `stddev_overall`) but NOT Cp/Cpk/Pp/Ppk
- Subgroup data (`sum_value`, `sum_squares`, `batch_n`, `normality_type`) could support backend capability calculation
- **V2 options:** (a) compute capability in V2 backend from subgroup data; (b) defer capability display until `spc_capability_detail_mv` is deployed in UAT; (c) display as unavailable with caveats

---

## 11. Golden Candidates

| Candidate | material_id | plant_id | mic_id | mic_name | operation_id | Batch Points | Locked Limits | Status |
|-----------|-------------|----------|--------|----------|--------------|-------------|---------------|--------|
| Primary | 20047111 | C037 | 0060 | Salt (Rapid Analyser) | 00000001 | 271 | 1 row (imr) | partially-verified |
| Data-rich | 20642328 | P523 | 0010 | pH | 00000004 | 60,673 | 0 rows | partially-verified |
| Multi-MIC | 20372893 | P775 | 0030-0070 | various | 00000001 | 42,094 each | 0 rows | partially-verified |

**Primary candidate notes:** Salt (Rapid Analyser), plant C037. Only material with locked limits. Spec limits (`lsl_spec`, `usl_spec`) are 0.0 — not populated. Suitable for control-chart rendering test.

**Data-rich candidate notes:** pH for OATLY-SBUX BARISTA 12X946ML at plant P523 (Ste. Claire [MFG]). Spec limits present (7.2–7.8). No locked limits. Suitable for spec-limit-only chart test with large data volume.

---

## 12. V2 Implementation Recommendation

**Recommendation: Proceed with V1 legacy bridge first; do not start native direct Databricks SPC route yet.**

Reasons for deferring native direct Databricks route:
1. **Schema mismatch:** Subgroup view column names differ significantly from V1/V2 contract expectations. All contract mappings need updating before a native route can be built correctly.
2. **Grain unclear:** True grain of `spc_quality_metric_subgroup_mv` is measurement-level but no clean PK exists. Row deduplication strategy is undefined.
3. **Sparse control limits:** 1 locked limit row in UAT is not enough to validate the limit rendering flow.
4. **Capability unavailable:** `spc_capability_detail_mv` missing — capability metrics cannot be served without backend calculation logic.
5. **Rule violations computed, not stored:** No stored signal source. Rule computation must be part of V2 backend or frontend logic.
6. **Plant ID namespace ambiguity:** P-prefix and C-prefix plant IDs coexist; mapping is unconfirmed.

**Safer path:**
- Wire V1 SPC legacy-api proxy route (V1 app is reachable at configured endpoint)
- Use V1 app's existing data model, rule computation, and capability calculation
- Plan native Databricks route as a future tranche after: (a) schema alignment PR, (b) grain confirmed with data platform, (c) more locked limits seeded in UAT, (d) `spc_capability_detail_mv` deployed

**If native route must proceed first:**
- Use `spc_quality_metric_subgroup_mv` (not the view) for performance
- Map `value` (not `result_value`), `batch_n`, `sum_value`, `batch_range` to V2 contract
- Compute mean as `sum_value / batch_n`
- Use `batch_date` as the chart time axis
- Compute WECO/Nelson signals in V2 backend (no stored source)
- Show capability as unavailable until `spc_capability_detail_mv` is deployed
- Use `spc_locked_limits` only for material 20047111/C037/0060 in UAT (only 1 row available)

---

## 13. Remaining Blockers

| Blocker | Impact | Path to resolve |
|---------|--------|----------------|
| Column names differ from V1/V2 contract | All subgroup data mappings need updating before native route | Update `spc-v2-contract-mapping.md`; align V2 contract fields |
| Grain unclear (`subgroup_rep` not unique key) | Row deduplication strategy undefined | Confirm with data platform team which columns form the measurement-level PK |
| `spc_locked_limits` has 1 test row | Cannot validate limit flow at scale | Seed more locked limits in UAT; or use `live` mode (runtime computed) only initially |
| `spc_capability_detail_mv` missing | Capability metrics unavailable | Data platform to deploy migration; or V2 backend to compute from subgroup |
| `spc_nelson_rule_flags_mv` missing | No precomputed rule flags | Confirm if V1 MV pipeline is running; use client-side calculation instead |
| Plant ID namespace (P-prefix vs C-prefix) | Cannot confirm plant-scope queries cross plant systems | Data platform to confirm mapping |
| `operation_id` is not SAP work centre | `workCentreId` in V2 contract cannot be populated | Governance decision on operation_id meaning; or omit workCentreId initially |
| `spc_quality_metrics` METRIC_VIEW not row-queryable | Cannot serve aggregate metrics via SQL warehouse | Use subgroup MV for all row-level queries; document that METRIC_VIEW is BI/dashboard-only |
| Spec limits 0.0 for primary golden candidate | Cannot verify spec-limit display | Use data-rich candidate (20642328/P523/0010/pH) for spec-limit UAT |

---

## 14. Tests / Checks Run

```
git diff --check — passed; no whitespace errors
```

Docs-only changes; no runtime code changed. No runtime tests required.

All SQL queries executed via Databricks CLI `api post /api/2.0/sql/statements` against warehouse `e76480b94bea6ed5` using authenticated OAuth identity `tim.geldard@kerry.com`. No service-principal fallback used.

---

## 15. Confirmations

- No Databricks columns were invented — all columns recorded from live DESCRIBE TABLE output
- No fake candidates were created — all candidates from live COUNT/SELECT queries
- No control-limit approval was invented — 1 row found; limitations stated
- No rule/signal source was invented — confirmed absent from catalog; classification based on V1 source + V2 code search
- No capability calculation was invented — `spc_capability_detail_mv` missing; stated unavailable
- Specification limits were not confused with control limits — clearly separated throughout
- "No signals returned" was not treated as "in control" — classified as calculated client-side
- No native SPC route was added
- No SPC runtime behaviour changed
- No SAP QM write-back was added
- No e-signature/GxP workflow was added
- No production SPC readiness was claimed
- No service-principal fallback was added
- No app-side plant authorization was added

---

## 16. Follow-on: Contract alignment (2026-05-21)

After this verification pack landed, the contract-alignment tranche
(`feature/spc-native-contract-alignment`, Slices 1-7) reconciled V2 SPC
contracts, fixtures, helper mappings, and an implementation plan to the
verified schema. **No native runtime route is wired** by that tranche; the
V1 legacy bridge remains the recommended short-term path. See:

- [`spc-native-contract-alignment-audit.md`](./spc-native-contract-alignment-audit.md) — 25 outdated V2 assumptions reconciled
- [`spc-v2-contract-mapping.md`](./spc-v2-contract-mapping.md) — rewritten against verified columns
- [`spc-native-route-prerequisite-plan.md`](./spc-native-route-prerequisite-plan.md) — proposed `POST /api/spc/chart-data` shape and go/no-go
- `domain-integrations/spc/src/fixtures/verified-databricks-spc.ts` — PR #65-derived row fixtures
- `domain-integrations/spc/src/utils/native-databricks-mapping.ts` — pure mapper helpers
- `domain-integrations/spc/src/utils/native-databricks-mapping.test.ts` — 55 tests including field-name guards
