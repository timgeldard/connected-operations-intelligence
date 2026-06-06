# SPC Rule / Signal Source Verification

**Date:** 2026-05-21
**Status:** Verified 2026-05-21 — no signal/alarm/rule/violation tables found; spc_nelson_rule_flags_mv NOT FOUND; rule violations confirmed client-side
**Catalog target:** `connected_plant_uat.gold`

> **IMPORTANT:** The signal source classification below is based on reading V1 source code only.
> The absence or presence of stored signal tables in the UAT catalog must be confirmed by running
> the discovery queries in Section 3. Do not claim any Databricks object contains or does not
> contain signals without running those queries.

---

## 1. Purpose

This document establishes where SPC rule signals (WECO, Nelson) come from before V2 SPC
routes are implemented. The classification determines:

1. Whether V2 needs a stored signal table or can compute signals at runtime
2. Whether the `SPCAlarmHistoryPanel` has any live data source
3. Whether `spc_nelson_rule_flags_mv` is the correct source for scorecard colouring
4. Whether a new V2 signal-storage design is needed, or whether V1's approach should be preserved

---

## 2. V1 Signal Architecture (from source code analysis)

### 2.1 Real-time signal detection — frontend-computed

From `apps/spc/frontend/src/spc/calculations.runtime.ts` (V1 source):

```typescript
export function detectRules(
  values: number[],
  limits: Limits,
  ruleSet: RuleSet = 'weco'
): SPCSignal[] {
  return ruleSet === 'nelson'
    ? detectNelsonRules(values, limits)
    : detectWECORules(values, limits)
}
```

Both `detectWECORules` and `detectNelsonRules` are **pure functions** with no database access.
They receive an array of numeric values and limit objects, and return `SPCSignal[]` objects
containing rule codes, descriptions, and affected point indices.

This means: real-time SPC rule signals are **computed at render time in the browser**.
They are NOT stored in any Databricks table.

### 2.2 WECO rule set (Western Electric, 4 rules)

From V1 `calculations.runtime.ts`:

| Rule code | Name | Definition |
|-----------|------|-----------|
| `WE1` | Beyond 3 sigma | One or more points beyond ±3σ (outside UCL/LCL) |
| `WE2` | 2-of-3 beyond 2 sigma | 2 out of 3 consecutive points beyond ±2σ on same side |
| `WE3` | 4-of-5 beyond 1 sigma | 4 out of 5 consecutive points beyond ±1σ on same side |
| `WE4` | 8 in a row on one side | 8 consecutive points on the same side of the centreline |

### 2.3 Nelson rule set (8 rules)

From V1 `calculations.runtime.ts`:

| Rule code | Name | Definition |
|-----------|------|-----------|
| `N1` | Beyond 3 sigma | Same as WE1 |
| `N2` | 9 in a row on one side | 9 consecutive points on same side of CL |
| `N3` | 6 in a row trending | 6 consecutive points continuously increasing or decreasing |
| `N4` | 14 alternating | 14 consecutive points alternating up/down |
| `N5` | 2-of-3 beyond 2 sigma | Same as WE2 |
| `N6` | 4-of-5 beyond 1 sigma | Same as WE3 |
| `N7` | 15 within 1 sigma | 15 consecutive points within ±1σ (hugging) |
| `N8` | 8 outside 1 sigma | 8 consecutive points outside ±1σ on either side |

### 2.4 Batch-level rule flag summaries — stored in `spc_nelson_rule_flags_mv`

V1 also has a materialized view `spc_nelson_rule_flags_mv` that pre-computes batch-level rule
flag summaries. This is used for:
- Scorecard status colouring (which MICs have had recent rule violations)
- Overview KPI tile for "active signals"
- Related batch identification

**Key distinction:** `spc_nelson_rule_flags_mv` is NOT a real-time signal store. It is a 4-hour
refreshed aggregate at `(material_id, plant_id, mic_id, batch_id)` grain. It tells you which
batches had rule violations, but not the specific point or timestamp of each signal.

### 2.5 What is absent

| Item | V1 Evidence | Implication for V2 |
|------|-------------|-------------------|
| Real-time signal storage table | None found | V2 signals must be computed, not fetched |
| Alarm acknowledgement table | None found | V2 `SPCAlarmHistoryPanel` has no live source |
| Signal lifecycle tracking | None found | `active/acknowledged/investigating/resolved` status has no V1 source |
| Per-point signal IDs | Generated client-side in V1 | V2 must also generate them, not look them up |

---

## 3. Databricks Discovery Queries

Run these to confirm the signal storage situation.

### 3.1 Check for any signal or alarm tables

```sql
SHOW TABLES IN connected_plant_uat.gold LIKE '*signal*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*alarm*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*rule*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*violation*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*breach*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*event*';
```

Expected result from V1 source analysis: no results for signal/alarm/violation tables.
If any results are found: they were added after the V1 code analysis and should be investigated.

### 3.2 Confirm `spc_nelson_rule_flags_mv` exists and its structure

```sql
SHOW TABLES IN connected_plant_uat.gold LIKE 'spc_nelson_rule_flags_mv';

DESCRIBE TABLE connected_plant_uat.gold.spc_nelson_rule_flags_mv;

SELECT * FROM connected_plant_uat.gold.spc_nelson_rule_flags_mv LIMIT 20;
```

### 3.3 Confirm `spc_quality_metrics` is NOT a signal table

```sql
DESCRIBE EXTENDED connected_plant_uat.gold.spc_quality_metrics;
-- Look for "Type" field — expected: METRIC_VIEW (AI/BI governance view, not a signal table)
```

```sql
-- Also look at its DDL
SHOW CREATE TABLE connected_plant_uat.gold.spc_quality_metrics;
-- Expected: "WITH METRICS LANGUAGE YAML" clause
```

---

## 4. V1 Code References to Inspect

When V1 repository access is available, examine these files for full context:

| File | Purpose |
|------|---------|
| `apps/spc/frontend/src/spc/calculations.runtime.ts` | `detectWECORules`, `detectNelsonRules` implementations |
| `apps/spc/frontend/src/spc/computeAnalytics.ts` | Control limit calculation using AIAG constants |
| `apps/spc/frontend/src/spc/spcConstants.ts` | AIAG constants: d2, d3, c4, A2, A3, D3, D4 |
| `apps/spc/frontend/src/spc/charts/XbarChart.tsx` | Control chart render with signal overlay |
| `apps/spc/frontend/src/spc/components/StatusPill.tsx` | in-control / warning / out-of-control status |
| `apps/spc/backend/spc_backend/domain/control_charts.py` | Python SPC maths (pure domain, no DB) |
| `apps/spc/scripts/migrations/012_create_spc_nelson_rule_flags_mv.sql` | Nelson flags MV definition |

---

## 5. Classification Table

| Rule/Signal Concept | V1 Evidence | Databricks Object | Stored or Calculated? | V2 Recommendation | Risk |
|---------------------|-------------|-------------------|-----------------------|-------------------|------|
| WECO real-time signals (WE1–WE4) | `detectWECORules()` in `calculations.runtime.ts` — pure function | None | Frontend-calculated at render time | Preserve V1 approach: compute in V2 frontend from chart data | Low — established V1 pattern |
| Nelson real-time signals (N1–N8) | `detectNelsonRules()` in `calculations.runtime.ts` — pure function | None | Frontend-calculated at render time | Same as WECO | Low |
| Batch-level rule flag summaries | `spc_nelson_rule_flags_mv` migration 012 | `spc_nelson_rule_flags_mv` (MV, 4h refresh) | Pre-computed (4h stale) | Use for scorecard/overview colouring only; not for chart signal overlay | Medium — staleness risk |
| Alarm history / lifecycle | None found in V1 | None | Does not exist | V2 `SPCAlarmHistoryPanel` has no live source; must remain mock or be explicitly deferred | High — design gap |
| Signal IDs | Generated client-side | None | Generated | Generate deterministically from rule code + point index | Low |
| Signal severity | Derived from rule code (N1/WE1 = critical) | None | Derived | Implement severity mapping in V2 frontend | Low |
| Alarm acknowledgement | None found | None | Does not exist | V2 acknowledgement actions must remain mock-only | High |

---

## 6. Critical Statement

**"No signals returned" is NOT equivalent to "in control."**

This statement is already reflected in the V2 SPC UX via the UX Truthfulness Checklist and the
`spc-known-limitations.md` document. It must also be reflected in any live implementation:

- If the chart data cannot be loaded (adapter error), the UI must show "Signals unavailable",
  not "No signals / In control".
- If the chart data loads but the rule engine produces no violations, the UI must show
  "No signals returned from rule engine" — not "In control" or "Passing".
- If the V2 adapter is in mock mode, signals are simulated and must be labeled accordingly.

---

## 7. Evidence Capture

Fill in after running discovery queries.

| Check | Status | Finding | Date | Verified By |
|-------|--------|---------|------|-------------|
| Signal/alarm tables absent in UAT catalog | not run | — | — | — |
| `spc_quality_metrics` confirmed as Metric View (not signal table) | not run | — | — | — |
| `spc_nelson_rule_flags_mv` exists and has rows | not run | — | — | — |
| `spc_nelson_rule_flags_mv` column schema confirmed | not run | — | — | — |
| Rule flag grain confirmed `(material_id, plant_id, mic_id, batch_id)` | not run | — | — | — |
| No new signal/violation tables found | not run | — | — | — |


## Evidence Captured 2026-05-21

**Verified by:** tim.geldard@kerry.com via Databricks CLI, warehouse `e76480b94bea6ed5` (`connected_plant_uat`)
**Date:** 2026-05-21

### Signal/Alarm/Rule/Violation Table Discovery

All pattern queries returned 0 results:

| Query Pattern | Result | Confirmed Absent? |
|---------------|--------|-------------------|
| `SHOW TABLES LIKE '*signal*'` | 0 objects | Yes |
| `SHOW TABLES LIKE '*alarm*'` | 0 objects | Yes |
| `SHOW TABLES LIKE '*rule*'` | 0 objects | Yes |
| `SHOW TABLES LIKE '*violation*'` | 0 objects | Yes |

**Conclusion: No signal, alarm, rule, or violation storage tables exist in `connected_plant_uat.gold`.**

### `spc_nelson_rule_flags_mv` — NOT FOUND

`spc_nelson_rule_flags_mv` was NOT FOUND in `connected_plant_uat.gold`.

- Migration 012 (`012_create_spc_nelson_rule_flags_mv.sql`) has NOT been applied in UAT
- Batch-level rule flag summaries are therefore unavailable from Databricks
- The V2 scorecard colouring feature based on this MV cannot use a live data source

### `spc_exclusions` — Present (6 rows)

`spc_exclusions` IS present with 6 rows. This table stores data exclusion records (points excluded from control chart calculations) and is NOT a signal store.

Schema confirmed:
`event_id`, `material_id`, `mic_id`, `mic_name`, `plant_id`, `stratify_all`, `chart_type`,
`date_from`, `date_to`, `rule_set`, `justification`, `action`, `excluded_count`,
`excluded_points_json`, `before_limits_json`, `after_limits_json`, `user_id`, `event_ts`,
`stratify_by`, `operation_id`

### V2 Signal Architecture — Confirmed

From V2 codebase analysis:
- V2 has WECO/Nelson detection functions in `domain-integrations/spc/src/utils/calculations.runtime.test.ts` (imported from calculations module)
- V2 signal adapter (`spc-signals-adapter.ts`) is mock-only (Phase 1 stub)
- Rule violations are computed client-side — this matches V1 architecture

**Classification: Rule violations calculated client-side (V2 frontend/adapter layer). No stored signal source in Databricks.**

### Updated Evidence Capture Table

| Check | Status | Finding | Date | Verified By |
|-------|--------|---------|------|-------------|
| Signal/alarm tables absent in UAT catalog | verified | 0 objects for *signal*, *alarm*, *rule*, *violation* | 2026-05-21 | tim.geldard@kerry.com |
| `spc_quality_metrics` confirmed as Metric View (not signal table) | verified | METRIC_VIEW confirmed; SELECT * returns empty | 2026-05-21 | tim.geldard@kerry.com |
| `spc_nelson_rule_flags_mv` exists and has rows | not found | Object NOT FOUND — migration 012 not applied | 2026-05-21 | tim.geldard@kerry.com |
| `spc_nelson_rule_flags_mv` column schema confirmed | not found | Object NOT FOUND | 2026-05-21 | tim.geldard@kerry.com |
| Rule flag grain confirmed | not found | Object NOT FOUND; grain cannot be assessed | 2026-05-21 | tim.geldard@kerry.com |
| No new signal/violation tables found | verified | 0 results for all signal/rule/violation patterns | 2026-05-21 | tim.geldard@kerry.com |
| `spc_exclusions` exists and has rows | verified | 6 rows confirmed | 2026-05-21 | tim.geldard@kerry.com |
| V2 signal computation approach confirmed | verified | Client-side WECO/Nelson in V2 codebase; spc-signals-adapter is mock-only | 2026-05-21 | tim.geldard@kerry.com |
