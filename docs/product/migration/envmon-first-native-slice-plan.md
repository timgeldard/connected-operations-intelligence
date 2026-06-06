# EnvMon First Native Slice Plan

**Date:** 2026-05-17
**Tranche:** j.txt
**Status:** DEFERRED — stop condition triggered; source view not confirmed
**Reference:** `docs/migration/envmon-native-groundwork-plan.md`, `docs/migration/envmon-native-candidate-ranking.md`

---

## Stop Condition

j.txt instructs: "Only implement a slice if the required source object and required columns were confirmed in the groundwork tranche. If the groundwork did not confirm enough source detail, do not implement a route."

The i.txt groundwork tranche found **zero Databricks gold views confirmed for EnvMon**. All candidates in `docs/audit/envmon-databricks-source-candidates.md` are speculative — not found in repo code, docs, or Unity Catalog verification. All candidate slices in `docs/migration/envmon-native-candidate-ranking.md` are marked BLOCKED.

**Result: no QuerySpec, no route, no code change, no frontend wiring.** This is not a failure — it is the correct outcome per j.txt stop conditions and the spirit of the safety rules (do not invent missing fields; do not fake missing data).

---

## Groundwork Review (from i.txt)

| Item | Finding |
|---|---|
| Source system | LIMS |
| Gold views confirmed | Zero |
| Legacy-api adapter | None (no V1 path to validate against) |
| Preferred slice | Swab results or monitoring locations — both BLOCKED |
| Fallback slice | None safe |
| Architecture check | All guardrails vacuously pass (no code added) |

---

## Preferred Slice — Deferred

**Slice:** EnvMon monitoring locations / sample points
**Method:** `getEnvMonZones`
**Route would be:** `GET /api/envmon/locations?plant_id=<plant_id>`

**Why selected:** Location master is typically the simplest view (low row count, stable, reference-data pattern). It is a prerequisite for all result-level filtering.

**Why deferred:** No source view confirmed. The required fields cannot be mapped:

| Required field | Source column | Status |
|---|---|---|
| `locationId` | Unknown | **Blocked** |
| `locationName` | Unknown | **Blocked** |
| `plantId` | Unknown | **Blocked** |
| `hygieneZone` | Unknown — enum must be verified | **Blocked** |
| `areaType` | Unknown — enum must be verified | **Blocked** |
| `zoneId` | Unknown | **Blocked** |

---

## Fallback Slice — Also Deferred

**Slice:** Recent EnvMon swab results
**Method:** `getEnvMonSwabResults`
**Route would be:** `GET /api/envmon/swab-results?plant_id=<plant_id>`

**Why also deferred:** Same root cause — no source view confirmed. Individual result rows cannot be mapped without knowing the column names, the `result` enum values in the source, or the sample date column format.

---

## What j.txt Did Instead

j.txt found the stop condition applies and took the documented stop-condition actions:

1. Reviewed all i.txt groundwork outputs ✓
2. Attempted slice selection — both preferred and fallback are BLOCKED ✓
3. Created this plan document documenting the deferred decision ✓
4. Created `docs/deployment/envmon-native-browser-verification.md` (blocked — route not wired) ✓
5. No QuerySpec added ✓
6. No FastAPI route added ✓
7. No frontend wiring changed ✓
8. No tests added (nothing to test) ✓
9. No browser verification claimed ✓

---

## What Is Needed to Un-defer

1. Domain owner identifies the LIMS gold view name in Databricks Unity Catalog
2. DDL verification: `DESCRIBE TABLE connected_plant_uat.<schema>.<view>`
3. Enum verification: `SELECT DISTINCT RESULT`, `SELECT DISTINCT HYGIENE_ZONE`, `SELECT DISTINCT AREA_TYPE`
4. Update `docs/audit/envmon-native-column-verification-checklist.md` with confirmed columns
5. Update `docs/audit/envmon-databricks-source-candidates.md` status from `Unconfirmed` to `confirmed-ddl`
6. Update `docs/migration/envmon-native-candidate-ranking.md` to un-block the confirmed slice
7. Implement QuerySpec, route, mapper, and tests for the unblocked slice
8. Browser-verify in UAT before claiming any BV status

This plan document should be updated when step 6 above is complete and implementation begins.

---

## Guardrail Confirmation

- No SPN/PAT fallback added ✓
- No silent fallback to mock or legacy-api added ✓
- No SQL in React added ✓
- No SQL in FastAPI route handlers added ✓
- No fake browser verification claimed ✓
- No new workspace added ✓
- No broad EnvMon feature expansion ✓
- No invented fields ✓
- No fake missing data ✓
