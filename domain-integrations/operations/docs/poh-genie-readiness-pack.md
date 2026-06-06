# POH Genie Readiness Pack

**Date:** 2026-05-20  
**Status:** Domain-scoped pilot surface implemented; live Databricks Genie integration still not implemented  
**Domain:** `di-operations` / `process-order-review`

---

## 1. Purpose

This pack defines the safest first question set for a future V2 Process Order History (POH) Genie assistant.

It does **not** approve a live external Genie integration today. It records which V2 POH evidence slices are mature enough to inform the shipped domain-scoped pilot surface, which slices remain conditional, and which topics must stay blocked.

The current V2 implementation is a deterministic POH assistant pilot inside the Process Order Review workspace. It uses the approved POH pack and cites the currently loaded POH panels. It does not call an external LLM or Databricks Genie backend.

---

## 2. Current readiness position

POH is the strongest V1 Genie carry-forward candidate because V1 preserved a governed semantic pack (`space.yaml`, instructions, glossary, joins, expressions, and sample SQL) in source control.

For V2, the current safe scope is narrower:

- `order-operations`, `order-confirmations`, and `order-goods-movements` have native Databricks routes and browser verification records.
- `order-header` is useful but should remain **conditional** because the documentation set is more mixed: SQL/native evidence exists, but the browser-verification trail is less settled than the other three slices.
- Timeline, quality context, staging context, related batches, notes, downtime, OEE, planning, and search/list workflows remain out of scope for a first Genie pack.

---

## 3. Source inventory mapped to V2 panels, queries, and adapters

| User-facing slice | V2 panel / view surface | Query hook | Adapter method | Current source/readiness | Genie pack status |
|---|---|---|---|---|---|
| Process order header | `ProcessOrderHeaderPanel` | `useProcessOrderHeader()` | `ProcessOrderReviewLegacyApiAdapter.getProcessOrderHeader()` | V1 proxy route wired; SQL-layer evidence exists for native header view; browser-verification trail is still less settled than the other native slices | **Conditional** |
| Operations / phases | `OrderOperationsPanel` | `useOrderOperations()` | `ProcessOrderReviewDatabricksApiAdapter.getOrderOperations()` | Browser-verified `databricks-api` on 2026-05-17; 11 operations confirmed for PO `7006965038` | **Approved starting slice** |
| Confirmations | `OrderConfirmationsPanel` | `useOrderConfirmations()` | `ProcessOrderReviewDatabricksApiAdapter.getOrderConfirmations()` | Browser-verified `databricks-api` on 2026-05-18 | **Approved starting slice** |
| Goods movements | `ProcessOrderGoodsMovementsPanel` | `useOrderGoodsMovements()` | `ProcessOrderReviewDatabricksApiAdapter.getOrderGoodsMovements()` | Browser-verified `databricks-api` on 2026-05-18 | **Approved starting slice** |
| Execution timeline | `ExecutionTimelinePanel` | `useExecutionTimeline()` | `getExecutionTimeline()` | Mock-derived / composite timeline; not a validated live Genie slice | **Blocked** |
| Quality context | `OrderQualityContextPanel` | `useOrderQualityContext()` | `getOrderQualityContext()` | Mock / partial parity only | **Blocked** |
| Staging context | `OrderStagingContextPanel` | `useOrderStagingContext()` | `getOrderStagingContext()` | Mock / partial parity only | **Blocked** |
| Related batches | `RelatedBatchContextPanel` | `useRelatedBatchContext()` | `getRelatedBatchContext()` | Mock / partial parity only | **Blocked** |

---

## 4. Approved question list for a future pilot pack

These are the **approved starter questions** for a future POH Genie pilot, provided the answer is limited to the approved slices above and cites them explicitly.

1. Show the operations currently returned for process order `<processOrderId>`.
2. Show the confirmations currently returned for process order `<processOrderId>`.
3. Show the goods movements currently returned for process order `<processOrderId>`.
4. Summarize the currently loaded operations, confirmations, and goods movements for process order `<processOrderId>`.
5. List the visible confirmations and goods movements in chronological order for process order `<processOrderId>`.
6. Count the currently returned operations, confirmations, and goods movements for process order `<processOrderId>`.

### Conditional questions

These questions should remain conditional until the header slice has a cleaner browser-verification trail in the readiness docs:

1. What is the current status, material, and quantity for process order `<processOrderId>`?
2. Summarize the order header together with the returned operations/confirmations/goods movements.

---

## 5. Blocked question list

The following topics must stay blocked from a first V2 POH Genie pilot:

- Why is this order late?
- Which order is most at risk today across the plant?
- Show OEE, schedule adherence, or vessel-planning analytics.
- Explain downtime causes or operator notes/comments.
- Show planning board / day-view / lineside-monitor insights.
- Infer genealogy, related-batch impact, or quality release readiness from POH alone.
- Make staffing, scheduling, release, or escalation recommendations.
- Answer from `ExecutionTimelinePanel`, `OrderQualityContextPanel`, `OrderStagingContextPanel`, or `RelatedBatchContextPanel` as if those slices were fully live.

These topics either depend on mock-only surfaces, partially preserved parity, or broader analytics semantics that are not yet validated in V2.

---

## 6. Citation and answer rules

Any future POH Genie implementation should follow these rules:

1. **Cite the evidence surface in every answer.** Example: “Based on `OrderOperationsPanel` (`databricks-api`) and `OrderConfirmationsPanel` (`databricks-api`)…”
2. **Name the source mode.** If a slice is `mock`, the answer must say so and should usually refuse.
3. **Do not widen scope silently.** If the question asks for downtime, notes, planning, or OEE, the assistant must say those topics are outside the approved POH pack.
4. **Ask for `processOrderId` if it is missing.**
5. **Preserve uncertainty.** Empty arrays, unavailable panels, or missing dates are not evidence that nothing happened.
6. **Do not infer unsupported business logic.** No “late root cause”, “best vessel”, “all clear”, or “release-ready” claims.

---

## 7. Validation dataset / golden examples

| Purpose | Process order | Plant | Current evidence |
|---|---|---|---|
| Operations anchor | `7006965038` | `C113` | Browser-verified on 2026-05-17: 11 operations returned from `poh.get_order_operations` |
| SQL candidate with operations + goods movements | `7006965038` | `C113` | Recorded in `golden-process-orders.md`; SQL-probed against `vw_gold_process_order`, `vw_gold_process_order_phase`, and `vw_gold_adp_movement` |
| SQL candidate with confirmations | `7006965039` | `C113` | Recorded in `golden-process-orders.md`; SQL-probed against `vw_gold_confirmation` |
| Browser-verification anchor for confirmations | `7006967130` | _(see verification log)_ | Browser-verified on 2026-05-18: 2 confirmations returned from `poh.get_order_confirmations` |
| Browser-verification anchor for goods movements | `7006965479` | _(see verification log)_ | Browser-verified on 2026-05-18: 901 movements returned from `poh.get_order_goods_movements` |

### Recommended first pilot anchor

Use **process order `7006965038` / plant `C113`** as the first POH Genie pilot anchor because it already appears in the domain's golden-order ledger and in the operations browser-verification trail.

---

## 8. Explicit out-of-scope topics

The first POH Genie pack should remain out of scope for:

- planning-board and day-view analysis
- lineside monitoring
- cross-domain quality-release reasoning
- per-order downtime and operator notes
- enterprise-wide benchmarking
- vessel planning and equipment recommendations
- unsupported metric-view or semantic-layer assumptions copied from V1 without revalidation

---

## 9. Carry-forward from V1

The following V1 POH Genie concepts should inform a future V2 implementation, but only after revalidation against current V2 contracts and routes:

- domain glossary and business-context separation
- behavioral rules for safe querying
- joins/expressions kept under source control
- ephemeral UI context supplied by the app rather than baked into the semantic pack

V2 should **not** copy V1 sample questions or calculations unchanged when they refer to still-unverified analytics such as OEE benchmarking, vessel planning, or unsupported source objects.

---

## 10. Next gate before implementation

Before any POH Genie UI/runtime work starts, complete these documentation and validation gates:

1. Reconcile the header slice's browser-verification status in the POH readiness docs.
2. Record one canonical pilot order whose header, operations, confirmations, and goods movements are all verified in the same user-facing flow.
3. Freeze a first approved POH question pack using only the slices marked approved or conditional above.
4. Keep the assistant domain-scoped; do not route POH questions through a shell-wide assistant.

---

## 11. References

- `docs/migration/v1-genie-discovery-and-v2-parity-roadmap.md`
- `docs/migration/poh-functional-parity-audit.md`
- `docs/migration/poh-functional-parity-matrix.md`
- `docs/deployment/poh-native-browser-verification.md`
- `docs/deployment/poh-native-slices-browser-verification.md`
- `domain-integrations/operations/docs/golden-process-orders.md`
- `domain-integrations/operations/src/adapters/process-order-review-queries.ts`
- `domain-integrations/operations/src/adapters/process-order-review-databricks-api-adapter.ts`
- `domain-integrations/operations/src/adapters/process-order-review-legacy-api-adapter.ts`
