# `wh360_deliveries_v` source-verification — outbound route

> Implementation note for the `GET /api/warehouse360/outbound` adapter
> rewrite. Companion to
> [`warehouse360-inbound-source-verification.md`](./warehouse360-inbound-source-verification.md)
> and
> [`warehouse360-staging-source-verification.md`](./warehouse360-staging-source-verification.md).
> No production-readiness claim is made by this document.

## 1. Why this document exists

The
[Databricks repository compatibility audit](../audit/2026-05-25-databricks-repository-compatibility-audit.md)
(Finding #1) recorded that `get_warehouse_outbound_spec` projected
SAP-style UPPER_CASE line-item columns that do not exist in the live
delivery-header view. `GET /api/warehouse360/outbound` returned HTTP 502
in `databricks-api` mode for every call.

This doc records the live DDL evidence, the mapping decisions taken in
the accompanying adapter rewrite, and the gaps that intentionally remain
null.

## 2. Verification method

| Item                    | Value                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog / schema / view | `connected_plant_uat.wh360.wh360_deliveries_v`                                                                                                              |
| Audit date              | 2026-05-25                                                                                                                                                  |
| Workspace               | `https://adb-604667594731808.8.azuredatabricks.net` (UAT)                                                                                                   |
| SQL warehouse           | `e76480b94bea6ed5` (`connected_plant_uat`, HEALTHY)                                                                                                         |
| Verification method     | `DESCRIBE TABLE` via the SQL Statement Execution API using the auditor's end-user OAuth token (`databricks api post /api/2.0/sql/statements --profile uat`) |
| Auditor                 | Tim Geldard (`tim.geldard@kerry.com`)                                                                                                                       |

## 3. Live DDL summary

```
delivery_id        : string
delivery_type      : string
plant_id           : string
customer_id        : string
customer_name      : string
carrier            : string
lgnum              : string
planned_gi_date    : string
actual_gi_date     : string
loading_date       : string
delivery_date      : string
gross_weight       : decimal(15,3)
weight_uom         : string
packages           : string
wm_status          : string
mins_to_cutoff     : decimal(27,6)
pick_pct           : decimal(38,11)
line_count         : bigint
risk               : string
shipped            : boolean
```

`wh360_deliveries_v` is **delivery-header grain**: one row per delivery,
not one row per delivery-line. The view does not expose line-item /
material / batch / sales-order / storage-location / exception-reason
fields.

## 4. Contract-to-source mapping (post-rewrite)

`Warehouse360OutboundItemSchema`
([`packages/data-contracts/src/schemas/warehouse-360-overview.ts`](../../packages/data-contracts/src/schemas/warehouse-360-overview.ts)
line 248) mapped against the live `wh360_deliveries_v` columns:

| Contract field                     | Source column     | Type          | Mapping                                | Confidence        | Notes                                                                                    |
| ---------------------------------- | ----------------- | ------------- | -------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| `deliveryId`                       | `delivery_id`     | string        | direct rename, str-cast                | High              | source-field                                                                             |
| `deliveryItemId`                   | **absent**        | n/a           | `None`                                 | High              | header-grain view; line items are not modelled here                                      |
| `customerId`                       | `customer_id`     | string        | direct rename                          | High              | source-field                                                                             |
| `salesOrderId`                     | **absent**        | n/a           | `None`                                 | High              | not exposed on the delivery-header view                                                  |
| `materialId` (**required string**) | **absent**        | n/a           | `""` (contract requirement)            | n/a               | see §5 — empty string keeps the response body shape stable until the contract is relaxed |
| `materialDescription`              | **absent**        | n/a           | `None`                                 | High              | not exposed                                                                              |
| `batchId`                          | **absent**        | n/a           | `None`                                 | High              | not exposed                                                                              |
| `plantId`                          | `plant_id`        | string        | direct rename                          | High              | source-field                                                                             |
| `storageLocation`                  | **absent**        | n/a           | `None`                                 | High              | not exposed                                                                              |
| `warehouseNumber`                  | `lgnum`           | string        | rename                                 | High              | source-field                                                                             |
| `plannedGoodsIssueDate`            | `planned_gi_date` | string        | `_format_datetime` (ISO normalisation) | High              | source is string-typed, not date-typed                                                   |
| `actualGoodsIssueDate`             | `actual_gi_date`  | string        | `_format_datetime` (ISO normalisation) | High              | source is string-typed, not date-typed                                                   |
| `quantity`                         | `gross_weight`    | decimal(15,3) | float cast                             | Medium (semantic) | application-derived — see §4.1                                                           |
| `unitOfMeasure`                    | `weight_uom`      | string        | direct rename                          | High              | paired with `quantity` so the unit is explicit on the wire                               |
| `status`                           | `wm_status`       | string        | echo verbatim                          | Medium            | wm_status is the WM-system status string; not coerced into a governed enum               |
| `exceptionReason`                  | **absent**        | n/a           | `None`                                 | High              | exceptions live in `imwm_exceptions_v`                                                   |

### 4.1 `quantity` ← `gross_weight` (application-derived)

`Warehouse360OutboundItemSchema.quantity` is `z.number().nullable().optional()`
with no UoM annotation in the contract; `unitOfMeasure` is a sibling
nullable field. The delivery-header view exposes a single physical
measure — `gross_weight` (paired with `weight_uom`) — and no line-level
"quantity" (which would require the line-grain view). Mapping
`quantity ← gross_weight` surfaces the available measure with the UoM
explicitly populated so consumers cannot misread the weight as a count.

This is classified as **application-derived** because the contract field
name (`quantity`) and the source field name (`gross_weight`) are not
semantically identical. A future contract revision could rename
`quantity` → `grossWeight` to make the semantics explicit; the current
PR does not change the contract.

### 4.2 Optional filter binding

| Filter                                                           | SQL placeholder                 | Param key      | Symmetry           |
| ---------------------------------------------------------------- | ------------------------------- | -------------- | ------------------ |
| `warehouse_id` (always supplied — the route validates non-empty) | `lgnum = :warehouse_id`         | `warehouse_id` | bound iff supplied |
| `plant_id`                                                       | `plant_id = :plant_id`          | `plant_id`     | bound iff supplied |
| `date_from`                                                      | `planned_gi_date >= :date_from` | `date_from`    | bound iff supplied |
| `date_to`                                                        | `planned_gi_date <= :date_to`   | `date_to`      | bound iff supplied |

`planned_gi_date` is `string`-typed in the source; ISO `YYYY-MM-DD`
lexical comparison is correct for the date-range filter. This matches
the same caveat already documented for the inbound and staging routes
(string-typed source-date columns).

## 5. Fields intentionally returned as `None`

`deliveryItemId`, `salesOrderId`, `materialDescription`, `batchId`,
`storageLocation`, `exceptionReason` are absent from the live
delivery-header view. The mapper emits `None` for each, in keeping with
the project's rule that _"missing values must remain null / unavailable
/ not evaluated as appropriate."_

### `materialId` — contract-required field, source absent

The generated `Warehouse360OutboundItem.material_id` is `str` (required,
not `Optional[str]`) because the Zod source
(`Warehouse360OutboundItemSchema.materialId: z.string()`) declares it
required. The header-grain delivery view has no material identifier at
all.

The mapper emits empty string (`""`) for `materialId` to keep the
generated-contract response body shape stable. This matches the
established convention used by the inbound, staging, and exception
mappers (and the TypeScript legacy-api adapter — see
[`domain-integrations/warehouse/src/adapters/warehouse-360-legacy-api-adapter.ts`](../../domain-integrations/warehouse/src/adapters/warehouse-360-legacy-api-adapter.ts)
line 329: _"materialId is the only required string on
Warehouse360OutboundItem"_).

This is the **one deviation** from the audit follow-up brief's bullet
6, which lists `materialId` among the fields that should be `None`.
Honouring the brief literally would require relaxing
`Warehouse360OutboundItemSchema.materialId` to
`z.string().nullable().optional()` and regenerating the pydantic
contract — a generated-contract / frontend-typing change that the
follow-up PR is scoped to avoid (per the brief: _"contract impact:
none"_, _"generated assets: none"_, _"No frontend changes"_).

**Tracked as a follow-up:** relax `materialId` to nullable+optional in a
separate, narrowly-scoped contract PR so the outbound mapper can emit
`None` source-truthfully. The same relaxation should be considered for
the parallel `materialId` requirement on inbound / staging / exception
schemas, which face the same source-truthful gap when source
`material_id` is null.

## 6. Runtime impact of the fix

Before (broken):

- `GET /api/warehouse360/outbound` returned HTTP 502 in
  `databricks-api` mode (`UNRESOLVED_COLUMN`).

After (this PR):

- The route resolves every column against live DDL.
- The route remains read-only — no writes to Databricks, no writes to
  SAP, no schema mutations.
- Response body shape is unchanged (every contract field is still
  present). Source-truthful nulls replace the previous fake empty-string
  values for the six absent fields listed in §5.
- `response_model=list[Warehouse360OutboundItem]` stays enabled.

## 7. Items still unresolved pending source / governance

| Item                                                                                                                                                              | Why unresolved                                                                                                                              | Whose decision            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Is there a sibling line-grain delivery view exposing `delivery_item_id`, `sales_order_id`, `material_id`, `material_description`, `batch_id`, `storage_location`? | The delivery-header view alone does not surface them. A line-grain view (if it exists) would unlock the six currently-null contract fields. | Data platform             |
| Should `quantity` be renamed `grossWeight` in the contract to make the semantic explicit?                                                                         | Reduces ambiguity and stops consumers from treating a weight as a count.                                                                    | Inventory team + frontend |
| Should `materialId` be relaxed to `z.string().nullable().optional()` across the four wh360 schemas (inbound, outbound, staging, exceptions)?                      | The header-grain views do not always carry a material identifier; the empty-string fallback is fake-data.                                   | Inventory team            |
| `risk`, `shipped`, `pick_pct`, `mins_to_cutoff` are present in the source but not in the contract. Should they be surfaced?                                       | The current contract is line-oriented; these are delivery-fulfilment fields better suited to a separate panel.                              | Inventory team            |

## 8. Forbidden until source / governance changes land

- **No** invented `material_id` / `batch_id` values — `""` for
  `materialId` is the documented contract-required fallback, not a real
  value.
- **No** default-to-zero on `quantity` when `gross_weight` is null — the
  mapper emits `None`.
- **No** governed enum coercion of `wm_status` — the contract field
  `status` is `z.string().nullable().optional()` and the mapper echoes
  the source string.
- **No** production-readiness claim. **No** browser-UAT claim.

## 9. Cross-references

- [`docs/audit/2026-05-25-databricks-repository-compatibility-audit.md`](../audit/2026-05-25-databricks-repository-compatibility-audit.md) — origin audit (Finding #1)
- [`docs/data-layer/warehouse360-inbound-source-verification.md`](./warehouse360-inbound-source-verification.md) — sibling document for the inbound route
- [`docs/data-layer/warehouse360-staging-source-verification.md`](./warehouse360-staging-source-verification.md) — sibling document for the staging route
- [`docs/data-layer/warehouse360-imwm-exceptions-source-verification.md`](./warehouse360-imwm-exceptions-source-verification.md) — sibling document for the exceptions route
- [`apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py`](../../apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py) — adapter rewritten by the accompanying PR
- [`packages/data-contracts/src/schemas/warehouse-360-overview.ts`](../../packages/data-contracts/src/schemas/warehouse-360-overview.ts) — Zod source for `Warehouse360OutboundItemSchema`
