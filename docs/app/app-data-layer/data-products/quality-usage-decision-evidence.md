# Data Product Spec — `QualityUsageDecisionEvidence`

Authoritative definition of the **Quality Usage Decision Evidence** data
product. This document is the spec that PRs must reconcile against when
they touch the QM usage-decision surface (schema, route, mapper, UI).

## 1. At a glance

| Aspect | Value |
|---|---|
| Business object | **Inspection lot** (SAP QM) and its usage-decision record |
| Data product pattern | `Evidence` (immutable, source-backed facts; see [`data-product-patterns.md`](../data-product-patterns.md)) |
| Owner domain | Quality |
| Lifecycle | `pilot` |
| Maturity (today) | **L3 — Route implemented**; mapper tests now covered separately (this PR family) |
| Production readiness | **Blocked** — browser UAT not captured; lot-selection governance frozen at Option A |
| Read-only | Yes — no SAP write-back, no release/reject mutation, no e-signature |

## 2. Why this data product exists

SAP QM records a `USAGE_DECISION_CODE` against every inspection lot. That
code is the strongest available evidence that QC has reviewed the lot and
recorded a decision. Downstream consumers (Batch Release, Trace
Investigation, Customer Recall) need to be able to **show that evidence**
without **synthesising a batch-level decision** the source does not give us.

**Concrete need:** a Trace investigation must surface "did QC record a
decision on this batch's inspection lots, and what was it?" — without
implying release authority.

## 3. Option A — Strict Lot-Level Evidence (governance decision)

`QualityUsageDecisionEvidence` operates under **Option A** governance, as
recorded in `docs/data-layer/data-layer-implementation-backlog.md` row 5
(**Done — Option A**).

### Option A rule

> The route emits one `QualityInspectionLotEvidence` row per inspection lot
> for the queried batch. It MUST NOT collapse multiple lots into a
> "batch-level" decision. The UI is responsible for surfacing all lots
> individually (or annotating ambiguity when multiple lots exist).

### Why Option A, not aggregation

- A batch can have **N inspection lots**. SAP does not define a "winning"
  lot.
- A `MULTIPLE_LOTS_WARNING` is surfaced when N > 1 so the consumer cannot
  silently truncate.
- Any aggregation rule (e.g. "latest accepted lot wins") is a **governance
  decision** that has not been authorised by the Kerry QM process owner.
  Until that decision is recorded in a new ADR, aggregation is forbidden.

### Forbidden claims (enforced in tests)

These labels MUST NOT appear in any response payload, panel title, or
adapter return value at the batch level:

- `Released`
- `Approved`
- `Cleared`
- `Can release`
- `Signed off`
- `Approved for shipment`

These labels MAY appear **per-lot** when sourced verbatim from the governed
label dictionary (§5) — never as a derived state.

## 4. Source mapping

| Source object | Used for | Verified |
|---|---|---|
| `connected_plant_uat.gold.gold_inspection_usage_decision` | `USAGE_DECISION_CODE`, `USAGE_DECISION_COUNTER`, `USAGE_DECISION_CREATED_DATE`, `USAGE_DECISION_UPDATED_TIME` | Yes |
| `connected_plant_uat.gold.gold_inspection_lot` | `INSPECTION_LOT_ID`, `MATERIAL_ID`, `BATCH_ID`, `PLANT_ID`, `PROCESS_ORDER_ID`, `INSPECTION_TYPE`, lifecycle dates | Yes |

### Join

`gold_inspection_usage_decision LEFT JOIN gold_inspection_lot
ON INSPECTION_LOT_ID = INSPECTION_LOT_ID`

The mapper uses `ROW_NUMBER() OVER (PARTITION BY INSPECTION_LOT_ID ORDER
BY USAGE_DECISION_COUNTER DESC, USAGE_DECISION_CREATED_DATE DESC,
USAGE_DECISION_UPDATED_TIME DESC) AS rn` and keeps only `rn = 1` — i.e.
the latest UD record **per lot**. This is the only aggregation allowed
under Option A: latest UD per lot, never across lots.

## 5. Governed label dictionary

These are the 9 governed UD codes the mapper recognises. New codes that
arrive from the source MUST be presented with `usageDecisionText` =
`"Unknown ({raw_code})"` and `usageDecisionMappingStatus =
'unverified'` until a Kerry QM process owner approves the label.

| Code | Label | Class |
|---|---|---|
| `A` | Accepted | accept |
| `AE` | Accepted (variant / EM) | accept |
| `AC` | Accepted with concession | accept-with-concession |
| `ACE` | Accepted with concession (variant / EM) | accept-with-concession |
| `A9` | Accepted — batch restricted | accept-restricted |
| `R` | Rejected | reject |
| `RE` | Rejected (variant / EM) | reject |
| `RR` | Rejected — batch restricted globally | reject-global |
| `""` (empty) | Pending — lot open, stock in QI, no decision taken | pending |

The mapping itself lives in `apps/api/adapters/quality/quality_databricks_adapter.py::UD_LABELS`.
That dictionary is the single authoritative source for label text — UI
must never re-derive a label from the code.

## 6. Contract

`QualityUsageDecisionEvidence` is delivered through **two** contracts. They
share semantics but differ in surface scope. PRs MUST reconcile against
**both** when touching this product.

### 6.1 Primary contract — `QualityInspectionLotEvidence`

File: `packages/data-contracts/src/schemas/quality-readonly-evidence.ts`
Symbol: `QualityInspectionLotEvidenceSchema`

This is the **canonical** lot-level evidence shape returned by
`POST /api/quality/read-only-evidence` inside `QualityEvidenceResponse.inspectionLots[]`.

Key fields (governed):

| Field | Classification | Notes |
|---|---|---|
| `inspectionLotId` | `source-field` | SAP inspection lot ID |
| `materialId` / `batchId` / `plantId` / `processOrderId` | `source-field` | All nullable; join may miss |
| `inspectionType` / `inspectionLotStatus` | `source-field` | nullable |
| `createdAt` / `startedAt` / `completedAt` | `source-field` | ISO datetime; nullable |
| `usageDecisionCode` | `source-field` | Raw code; never invent |
| `usageDecisionText` | `source-field` | From `UD_LABELS`; "Unknown (X)" when not in dictionary |
| `usageDecisionMappingStatus` | `application-derived` | `source-only \| verified \| unverified \| unavailable \| not-mapped` |
| `usageDecisionCreatedAt` | `source-field` | nullable |

### 6.2 Embedded contract — `PassportUsageDecisionEvidence`

File: `packages/data-contracts/src/schemas/batch-quality-passport.ts`
Symbol: `PassportUsageDecisionEvidenceSchema`

This is the **compact embedded form** the BatchQualityPassport surfaces in
its `usageDecisionEvidence[]` array. It is intentionally smaller — only the
fields a one-row UI rendering needs.

| Field | Notes |
|---|---|
| `role` | Always `"QA reviewer"` today (no second row is emitted under Option A) |
| `decisionBy` | The `CREATED_BY` of the inspection-lot UD record |
| `decisionType` | `usage-decision-recorded \| inspection-completed \| none` |
| `recordedAt` | Source timestamp |

### 6.3 Relationship between the two contracts

```
                  +-----------------------------------------+
                  |       QualityInspectionLotEvidence      |  ← canonical
                  +-----------------------------------------+
                                    |
                                    | (compact projection;
                                    |  one entry per latest
                                    |  accepted lot only)
                                    v
                  +-----------------------------------------+
                  |     PassportUsageDecisionEvidence       |  ← embedded
                  +-----------------------------------------+
```

The Passport contract is a **derived view**, not an alternative source of
truth. When the canonical shape changes, the passport variant must
follow. Tests for both live in:

- `apps/api/tests/adapters/quality/test_quality_databricks_adapter.py`
- `apps/api/tests/adapters/trace2/test_trace_app_mappers.py::TestBuildBatchQualityPassport` (passport projection)

## 7. Mapping-status taxonomy

`usageDecisionMappingStatus` records the mapper's confidence in the label:

| Value | When |
|---|---|
| `source-only` | The source row had a UD code; no label dictionary applied (raw passthrough) |
| `verified` | The code matched the governed `UD_LABELS` dictionary |
| `unverified` | The code was present but absent from `UD_LABELS` — needs governance |
| `unavailable` | No UD record returned by the join |
| `not-mapped` | UD code is `NULL`; lot is in QI / pending |

The UI MUST treat anything other than `verified` as a softer signal —
"evidence present but label not governed".

## 8. Field classification audit (post-PR-#82)

Every field in `QualityInspectionLotEvidenceSchema` carries a
`[classification: …]` marker. Confirmed in code today:

| Classification | Field count | Examples |
|---|---|---|
| `source-field` | 10 | `inspectionLotId`, `usageDecisionCode`, `usageDecisionText` |
| `application-derived` | 1 | `usageDecisionMappingStatus` |
| `application-heuristic` | 0 | — |
| `governed` | 0 | — |
| `unclassified` | 0 | — |

The contract is fully classified.

## 9. Route

| Aspect | Value |
|---|---|
| Method · path | `POST /api/quality/read-only-evidence` |
| Router file | `apps/api/routes/quality.py` |
| `response_model` | `QualityEvidenceResponse` |
| Adapter mode guard | Returns the unavailable-skeleton (`status: 'pending-source-verification'`) when `BACKEND_ADAPTER_MODE != 'databricks-api'` |
| Auth | End-user OAuth identity via `x-forwarded-access-token` (per ADR-024) |

Mode-guard semantics in the unavailable branch:

- `source = 'databricks-api'` — the intended source, not `'unavailable'`
- `status = 'pending-source-verification'`
- `warnings` MUST contain "not be interpreted as accepted or released"

This is **NOT** an unavailable-source state — it is a readiness-pending
state. See `route-readiness-standard.md`.

## 10. Test surface

| Test file | Coverage |
|---|---|
| `apps/api/tests/adapters/quality/test_quality_databricks_adapter.py` | QuerySpec construction; row mapping for single lot / multi lot / empty / empty-code cases; governed label dictionary; multiple-lots warning |
| `apps/api/tests/test_quality_readonly_evidence.py` | Route exists; unavailable state; no governed release-authority leak; required-body validation |
| `apps/api/tests/routes/test_quality_routes.py` | Databricks-mode happy path; mode-guard `pending-source-verification` path; required identifiers |
| `apps/api/tests/adapters/trace2/test_trace_app_mappers.py` | Passport projection (one-accept-only rule; no signoff key; no governed release keys) |

## 11. Known caveats

1. **No `usage-decision-recorded` for rejected lots.** The passport projection
   only emits the latest **accepted** lot. Rejected lots still appear in
   the canonical inspection-lots list but do not surface as "decision
   evidence" rows in the passport hero. This is deliberate — surfacing
   a rejection at the top of a passport would be misread as a recall flag.
2. **Multi-lot ambiguity.** When a batch has N > 1 inspection lots, the
   `multipleLotsWarning` summary field is set. The UI MUST render this
   warning prominently — it is the user's only signal that ambiguity exists.
3. **No COA, no MIC results in this slice.** `QualityEvidenceResponse`
   reserves slots for `micResults` and `coaResults` but the mapper does
   not populate them today. Empty arrays are valid; consumers must not
   infer "no MIC failures" from an empty list.

## 12. Production-readiness gate

To move from **L3** to **L4 → L5 → L6**, the following must close. Each
gate is its own PR.

| Gate | Status | Action to close |
|---|---|---|
| Mapper tests on all 9 UD codes + Option A rule | Partial — covered for 4 codes in existing tests | Add direct mapper tests for `AE`, `AC`, `ACE`, `A9`, `RE`, `RR` |
| Mapping-status taxonomy tested across all 5 values | Not covered | Add mapper tests asserting each `usageDecisionMappingStatus` transition |
| Reference UI consumer (read-only) | Not present | Wire `QualityUsageDecisionPanel` to the route — read-only display, no aggregation |
| Browser-UAT evidence | Not captured | Run the runbook from `route-readiness-standard.md` against a known UAT batch with at least one UD record |
| Governance ADR on aggregation rule (if ever changed) | Not required at L4–L6 — Option A stands | Only required if the Kerry QM process owner ever authorises aggregation |

## 13. Forbidden in any future PR touching this product

- Adding a batch-level `release` / `approved` / `cleared` field synthesised across lots
- Surfacing `usageDecisionEvidence` as `signoff` / `eSignature` / `released` in any UI
- Treating `decisionType: 'usage-decision-recorded'` as approval — it records an SAP audit event, not an authority decision
- Deriving labels client-side from the UD code (the dictionary lives in the backend; consume `usageDecisionText` verbatim)
- Discarding the `multipleLotsWarning` summary when N > 1

## 14. Cross-references

- ADR-024 — native Databricks data-access architecture
- `docs/app-data-layer/data-product-maturity-model.md`
- `docs/app-data-layer/field-classification-standard.md`
- `docs/app-data-layer/route-readiness-standard.md`
- `docs/app-data-layer/evidence-pack-standard.md`
- `docs/app-data-layer/domain-data-product-catalog.md` (entry #9)
- `docs/data-layer/contract-route-coverage-matrix.md` (row: `QualityUsageDecisionEvidenceSchema`)
- `docs/data-layer/data-layer-implementation-backlog.md` row 5 — Option A governance decision
