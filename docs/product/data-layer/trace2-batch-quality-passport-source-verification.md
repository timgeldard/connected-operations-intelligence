# Trace2 batch quality passport — source-verification (partial spec)

> Implementation note for the `POST /api/trace2/batch-quality-passport`
> partial-spec adapter rewrite. Companion to
> [`warehouse360-outbound-source-verification.md`](./warehouse360-outbound-source-verification.md)
> and
> [`warehouse360-inbound-source-verification.md`](./warehouse360-inbound-source-verification.md).
> No production-readiness claim is made by this document. No browser-UAT
> claim is made by this document.

## 1. Why this document exists

The
[Databricks repository compatibility audit](../audit/2026-05-25-databricks-repository-compatibility-audit.md)
(Finding #2) recorded that `trace2.get_batch_quality_passport_partial`
projected seven columns that do not exist in the live UAT Unity Catalog
views. Because the partial query is the **first** of five sequential
fetches in the route, `POST /api/trace2/batch-quality-passport` returned
HTTP 502 (`UNRESOLVED_COLUMN`) for every call in `databricks-api` mode and
never reached the remaining four queries.

This doc records the live DDL evidence and the mapping decisions taken in
the accompanying adapter rewrite.

## 2. Verification method

| Item                | Value                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog / schema    | `connected_plant_uat.gold`                                                                                                                                  |
| Live object 1       | `gold_batch_summary_v`                                                                                                                                      |
| Live object 2       | `gold_batch_production_history_v`                                                                                                                           |
| Audit date          | 2026-05-25                                                                                                                                                  |
| Workspace           | `https://adb-604667594731808.8.azuredatabricks.net` (UAT)                                                                                                   |
| SQL warehouse       | `e76480b94bea6ed5` (`connected_plant_uat`, HEALTHY)                                                                                                         |
| Verification method | `DESCRIBE TABLE` via the SQL Statement Execution API using the auditor's end-user OAuth token (`databricks api post /api/2.0/sql/statements --profile uat`) |
| Auditor             | Tim Geldard (`tim.geldard@kerry.com`)                                                                                                                       |

## 3. Live DDL summaries

### `connected_plant_uat.gold.gold_batch_summary_v`

```
MATERIAL_ID                : string
BATCH_ID                   : string
MANUFACTURE_DATE           : date
SHELF_LIFE_EXPIRATION_DATE : date
MATERIAL_NAME              : string
MATERIAL_TYPE              : string
MATERIAL_DESC_SHORT        : string
days_to_expiry             : int
shelf_life_status          : string
```

There is no `PROCESS_ORDER_ID`, `START_DATE`, `CONFIRMED_DATE`,
`PLANNED_QTY`, `ACTUAL_QTY`, `PRODUCTION_LINE`, or `OPERATOR` column on
this view. The view is a batch-level shelf-life / identity summary, not
a production-event record.

### `connected_plant_uat.gold.gold_batch_production_history_v`

```
PROCESS_ORDER_ID : string
BATCH_ID         : string
PLANT_ID         : string
MATERIAL_ID      : string
POSTING_DATE     : date
BATCH_QTY        : decimal(23,3)
UOM              : string
quality_status   : string
```

The view records a single batch-level production posting per row. It has
no `START_DATE`, `CONFIRMED_DATE`, `PLANNED_QTY`, `ACTUAL_QTY`,
`PRODUCTION_LINE`, or `OPERATOR` column — those concepts are not modelled
in the gold layer today.

## 4. Columns removed (absent from live DDL)

The pre-fix SQL projected seven columns that do not exist. Each is
removed by the accompanying adapter rewrite:

| Removed projection   | Reason                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `b.PROCESS_ORDER_ID` | `gold_batch_summary_v` has no `PROCESS_ORDER_ID` column — the source lives on `gold_batch_production_history_v` instead. |
| `ph.START_DATE`      | `gold_batch_production_history_v` has no `START_DATE` column — only `POSTING_DATE`.                                      |
| `ph.CONFIRMED_DATE`  | `gold_batch_production_history_v` has no `CONFIRMED_DATE` column.                                                        |
| `ph.PLANNED_QTY`     | `gold_batch_production_history_v` has no `PLANNED_QTY` column — only `BATCH_QTY`.                                        |
| `ph.ACTUAL_QTY`      | `gold_batch_production_history_v` has no `ACTUAL_QTY` column — `BATCH_QTY` carries the actual recorded quantity.         |
| `ph.PRODUCTION_LINE` | No `PRODUCTION_LINE` column on the view.                                                                                 |
| `ph.OPERATOR`        | No `OPERATOR` column on the view.                                                                                        |

## 5. Columns now used (verified live)

| Contract field (response body)                   | Source projection                          | Source view                       | Source type   | Notes                                                                                                                                                                                                           |
| ------------------------------------------------ | ------------------------------------------ | --------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity.processOrderId` / `production.orderId` | `ph.PROCESS_ORDER_ID AS process_order_id`  | `gold_batch_production_history_v` | string        | Direct rename. Moved from `gold_batch_summary_v` (where the column does not exist).                                                                                                                             |
| `production.startedAt`                           | `ph.POSTING_DATE AS production_started_at` | `gold_batch_production_history_v` | date          | **Caveat (see §6.1):** POSTING_DATE is the production-posting date, not a confirmed production start timestamp.                                                                                                 |
| `production.actualQty`                           | `ph.BATCH_QTY AS production_actual_qty`    | `gold_batch_production_history_v` | decimal(23,3) | **Caveat (see §6.2):** BATCH_QTY is the actual batch quantity recorded on the posting, not a planned quantity.                                                                                                  |
| (unsurfaced for now)                             | `ph.UOM AS production_uom`                 | `gold_batch_production_history_v` | string        | Selected but not currently mapped onto the `Production` contract section (which exposes no production-UoM field). The row key is kept so a future contract addition can consume it without re-touching the SQL. |

The five-way join shape is otherwise unchanged: `gold_batch_stock_v` ⨝
`gold_batch_summary_v` ⨝ `gold_material` ⨝ `gold_plant` ⨝
`gold_batch_production_history_v` (LEFT JOIN on
`MATERIAL_ID + BATCH_ID`).

## 6. Source caveats — what the new mappings are NOT

### 6.1 `production.startedAt` ← `POSTING_DATE` is NOT a confirmed start timestamp

`POSTING_DATE` is the date the batch production posting was recorded in
the source system. It is the best available production-evidence
timestamp on the live view, but it is **not** a confirmed production
start time. The live view has no `START_DATE` / `CONFIRMED_DATE` columns;
those concepts are not modelled in the gold layer.

The mapper's docstring records this. The contract field name
`startedAt` is preserved (the contract `Production.started_at` is
`str`, not Optional). A future contract revision could rename to
`postedAt` to make the semantic explicit; this PR does not change the
contract.

### 6.2 `production.actualQty` ← `BATCH_QTY` is NOT a planned quantity

`BATCH_QTY` is the actual batch quantity recorded on the
production-history posting. It is **not** a planned quantity. The live
view exposes no planned-vs-actual split. The `production.plannedQty`
contract field stays at the contract default of `0.0` (the field is
required `float` in the generated `Production` model).

### 6.3 `production.yield` cannot be derived without a planned quantity

`yield = actualQty / plannedQty` is computed only when `plannedQty > 0`.
Because `plannedQty` always falls back to `0.0` (no source), the
computed `yield` is always `0.0` in the post-audit response. The
contract field is required `float`; the contract default keeps the
response body shape stable.

## 7. Fields intentionally returned as `null`

This PR **relaxed** the seven `PassportProductionSchema` fields below to
`z.<type>().nullable().optional()` in
[`packages/data-contracts/src/schemas/batch-quality-passport.ts`](../../packages/data-contracts/src/schemas/batch-quality-passport.ts)
and regenerated the Pydantic contract
(`apps/api/contracts/generated.py`). The mapper now emits `None`
source-truthfully — empty strings and zero defaults that formerly
satisfied the required-field contract are gone:

| Contract field (post-relaxation)                       | Now emitted | Reason                                                                          |
| ------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------- |
| `production.line` _(nullable+optional)_                | `None`      | No `PRODUCTION_LINE` column on `gold_batch_production_history_v`.               |
| `production.operator` _(nullable+optional)_            | `None`      | No `OPERATOR` column on `gold_batch_production_history_v`.                      |
| `production.confirmedAt` _(nullable+optional)_         | `None`      | No `CONFIRMED_DATE` column on `gold_batch_production_history_v`.                |
| `production.plannedQty` _(nullable+optional)_          | `None`      | No `PLANNED_QTY` column on `gold_batch_production_history_v`.                   |
| `production.yield` _(nullable+optional)_               | `None`      | Cannot be derived without `plannedQty` (see §6.3); no governed yield available. |
| `production.originatingCustomer` _(nullable+optional)_ | `None`      | Not exposed on `gold_batch_production_history_v`.                               |
| `production.notes` _(nullable+optional)_               | `None`      | Not exposed on `gold_batch_production_history_v`.                               |

`production.orderId`, `production.startedAt`, and `production.actualQty`
remain **required** on the contract because they have live sources
(`ph.PROCESS_ORDER_ID`, `ph.POSTING_DATE`, `ph.BATCH_QTY` respectively).
The PR did not change any of those three field shapes.

The previous `build_batch_quality_passport` overrides that replaced
empty `originatingCustomer` / `notes` with reassuring strings (`"—"` and
`"Source: gold_batch_production_history_v"`) have been removed so the
mapper's `None` survives to the wire.

The mapper's intermediate `_unverifiedSections` marker now includes
`"production"` (because three of the section's fields come from live
UAT and the rest are null) and the stale `"signoff"` entry — which was
renamed to `"usageDecisionEvidence"` long before this PR — is replaced
with the current wire-contract field name. The marker is not present on
the wire (the final `BatchQualityPassport` Pydantic model has
`extra='forbid'`); it is intermediate metadata used inside the adapter.

## 8. Runtime impact of the fix

Before (broken):

- `POST /api/trace2/batch-quality-passport` returned HTTP 502 in
  `databricks-api` mode. The first of five sequential calls
  (`get_batch_quality_passport_partial_spec`) failed with
  `UNRESOLVED_COLUMN` and `run_repository_fetch` mapped that to a
  generic Databricks-query-execution-failed HTTP 502.

After (this PR):

- The partial query resolves every column against live DDL.
- The route proceeds to the remaining four queries
  (`get_batch_quality_passport_coa_spec`,
  `get_batch_quality_passport_lots_spec`,
  `get_batch_quality_passport_summary_spec`,
  `get_batch_quality_passport_balance_spec`) which were already
  source-aligned and were not modified by this PR.
- The route remains read-only — no writes to Databricks, no writes to
  SAP, no schema mutations.
- The `Production` section now sources three fields (`orderId`,
  `startedAt`, `actualQty`) from the live view; the other seven fields
  (`line`, `operator`, `confirmedAt`, `plannedQty`, `yield`,
  `originatingCustomer`, `notes`) are emitted as `null` per the
  contract relaxation in §7. All other top-level passport sections
  retain their pre-PR shape; no field is added to or removed from the
  wire envelope.
- `response_model=BatchQualityPassport` stays enabled. The generated
  Pydantic contract (`apps/api/contracts/generated.py`) was
  regenerated in lock-step with the Zod relaxation and committed in
  this PR.

## 9. Items still unresolved pending source / governance

| Item                                                                                                                                                                                                                                                | Why unresolved                                                                                                                                        | Whose decision             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Is `POSTING_DATE` the correct source for `production.startedAt`, or should the contract field rename to `postedAt` to make the semantic explicit?                                                                                                   | The pre-existing contract field name is ambiguous. The live view has no `START_DATE` column.                                                          | Trace team + frontend      |
| Where (if anywhere) in the gold layer can governed values for `Production.line`, `Production.operator`, `Production.confirmedAt`, `Production.plannedQty`, `Production.yield`, `Production.originatingCustomer`, and `Production.notes` be sourced? | The Zod contract was relaxed to nullable+optional in this PR (see §7) so the API can be source-truthful, but the underlying business questions stand. | Data platform + Trace team |
| Where (if anywhere) in the gold layer do production line / operator / planned-quantity / actual-vs-planned splits live? Is there a sibling MES / OEE view that could supply them?                                                                   | The current production-history view is batch-level only. A line-event view would unlock the six currently-defaulted fields.                           | Data platform              |
| Should `production.uom` be added to the contract so the new `ph.UOM` projection can surface?                                                                                                                                                        | The mapper already reads the row key; it is just not on the contract.                                                                                 | Trace team                 |

## 10. Forbidden until source / governance changes land

- **No** invented production line names, operator names, planned
  quantities, confirmed-at timestamps, originating customers, or notes —
  the relaxed-contract fields are `null` when no live source exists.
  Reintroducing `""`, `"—"`, or any other fixed sentinel would
  re-create the fake-default pattern this PR removes.
- **No** computed `yield` value: the dividend `plannedQty` is `null`
  and no governed yield source exists, so `production.yield` is
  emitted as `null`.
- **No** default-to-zero on `actualQty` when `BATCH_QTY` is null — the
  mapper's existing `float(... or 0)` is retained for `actualQty`
  only, with the source caveat documented in §6.2.
- **No** production-readiness claim. **No** browser-UAT claim.

## 11. Cross-references

- [`docs/audit/2026-05-25-databricks-repository-compatibility-audit.md`](../audit/2026-05-25-databricks-repository-compatibility-audit.md) — origin audit (Finding #2)
- [`docs/data-layer/warehouse360-outbound-source-verification.md`](./warehouse360-outbound-source-verification.md) — sibling source-verification doc (same audit, different route)
- [`apps/api/adapters/trace2/trace2_databricks_adapter.py`](../../apps/api/adapters/trace2/trace2_databricks_adapter.py) — adapter rewritten by the accompanying PR
- [`apps/api/contracts/generated.py`](../../apps/api/contracts/generated.py) — `BatchQualityPassport`, `Production`, `Identity`, `Stock` generated Pydantic models
- [`packages/data-contracts/src/schemas/`](../../packages/data-contracts/src/schemas/) — Zod source for the passport schemas (the relaxation candidates listed in §9)
