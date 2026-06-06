# POH Execution Timeline — Native Databricks Preparation

**Date:** 2026-05-17  
**Tranche:** h.txt  
**Status:** DEFERRED — timestamp coverage insufficient to implement safely  
**Decision:** Do not implement `getExecutionTimeline` native path until blocking items below are resolved.

---

## What `getExecutionTimeline` needs

The `getExecutionTimeline` method in `process-order-review-adapter.ts` produces a timeline of phase/operation events for a process order — e.g., scheduled start, actual start, completion, confirmation.

To build this from Databricks, each timeline event requires at minimum:

- A **timestamp** (datetime, not date-only) indicating when the event occurred
- An **event type** discriminator (scheduled vs actual; start vs end)
- A **stable entity identifier** (operationId or phaseId to group events)

---

## What the current views provide

### vw_gold_process_order_phase (operations)

Confirmed columns from DDL (2026-05-17):

| Column | Type | Has timestamp? |
|---|---|---|
| `AUFNR` | str | No — identifier only |
| `VORNR` | str | No — operation number |
| `LTXA1` | str | No — operation text |
| `STEUS` | str | No — control key |
| `ARBPL` | str | No — work center |
| `PHAS` | str | No — phase |
| Dates | Not confirmed | No date or timestamp columns confirmed in view |

The phase view has no confirmed timestamp columns. Without start/end datetimes for each operation, a meaningful timeline cannot be constructed.

### vw_gold_confirmation (confirmations)

Confirmed columns include `ERSDA` (date) + `ERSTM` (time) = `confirmedAt`. This gives a point-in-time "confirmation posted" event per operation — but only for confirmed operations, not for all operations, and not for scheduled vs actual start/end.

---

## Why implementation is blocked

| Requirement | Available? | Notes |
|---|---|---|
| Scheduled start datetime per operation | No | Not in `vw_gold_process_order_phase` |
| Actual start datetime per operation | No | Not in `vw_gold_process_order_phase` |
| Scheduled end datetime per operation | No | Not in `vw_gold_process_order_phase` |
| Actual end datetime per operation | No | Not in `vw_gold_process_order_phase` |
| Confirmation timestamp | Yes | `ERSDA` + `ERSTM` in `vw_gold_confirmation` |
| Process order header dates | Partial | `vw_gold_process_order` has dates but they are order-level, not operation-level |

A timeline built only from confirmation timestamps would:
1. Exclude unconfirmed operations entirely
2. Show only the confirmation event — not scheduled/actual start/end
3. Not match the V1 timeline shape (`scheduledStart`, `actualStart`, `actualEnd` per operation)

This would be a misleading partial implementation, not a parity-equivalent one.

---

## What is needed to unblock

1. **Confirm whether `vw_gold_process_order_phase` exposes date/time columns** that are not captured in the current DDL snapshot. Run:
   ```sql
   DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_process_order_phase;
   ```
   Look for columns matching SAP field names: `FSAVD` (basic start date), `FSAVZ` (basic start time), `FEAVD` (basic finish date), `FEAVZ` (basic finish time), `ISDD` (actual start date), `ISDZ` (actual start time), `IEDD` (actual end date), `IEDZ` (actual end time).

2. **If no operation-level timestamps exist in the phase view**, determine whether a separate view — e.g., `vw_gold_process_order_dates` or a batch-level SAP operations history table — is available in `connected_plant_uat`.

3. **Update `docs/audit/native-databricks-column-verification-checklist.md`** with results and proceed to implementation only if confirmed timestamps exist.

---

## Impact on frontend

The Confirmations panel and Goods Movements panel do not depend on `getExecutionTimeline` — they have their own routes and are independently executable.

The frontend `ExecutionTimeline` component currently renders mock data via the base adapter. Deferring the native path has no impact on other panels or routes.

---

## Do not implement until

- [ ] At least `actualStart` and `actualEnd` timestamps are confirmed for each operation (not just the order header)
- [ ] The mapper can produce a timeline without invented or derived-without-evidence values
- [ ] DDL is manually verified in Databricks SQL editor (not inferred from V1 code or documentation)
