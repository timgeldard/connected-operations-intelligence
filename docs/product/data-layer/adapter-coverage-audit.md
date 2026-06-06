# Adapter Coverage Audit

> Snapshot: 2026-05-21. Built from direct code inspection of all domain adapter files under `domain-integrations/*/src/adapters/`.
> See also: [data-layer-completion-inventory.md](./data-layer-completion-inventory.md) for capability-level status.

## Risk classification

| Risk level | Meaning |
|---|---|
| **CRITICAL** | Live mode can silently return mock or unavailable data as if it were live |
| **HIGH** | Misleading comment or pattern that could cause unsafe fallback during development |
| **MEDIUM** | Unverified route; mock returned for a method in a mode where a live route exists elsewhere |
| **LOW** | Intentional mock-only or unavailable-state; correctly labelled |
| **NONE** | Fully aligned: mode, source badge, error behavior, and fallback all correct |

---

## Confirmed risky patterns (read first)

### CRITICAL — CQ Lab `getLabPlants()` silently falls back to mock on any exception

**File:** `domain-integrations/quality/src/adapters/connected-quality-lab-legacy-api-adapter.ts:112`

```
} catch {
  return super.getLabPlants()   // ← returns mock with no source indicator
}
```

The `getLabFailures()` method in the same adapter returns a proper error `AdapterResult` on catch — but `getLabPlants()` catches all errors and returns mock plant data with `source: 'mock'`. If the V1 CQ Lab endpoint is unavailable, the frontend silently displays mock plants as if they were real. No error state, no unavailable state, no source caveat.

**Impact:** User sees mock CQ Lab plant data silently. Source badge shows `mock` not `legacy-api`.
**Required fix:** Replace `catch { return super.getLabPlants() }` with an error `AdapterResult` that surfaces the failure.

---

### HIGH — POH legacy-api adapter comment says "Falls back to mock on any error" but code returns error AdapterResult

**File:** `domain-integrations/operations/src/adapters/process-order-review-legacy-api-adapter.ts:22`

The JSDoc comment reads: *"Falls back to mock on any error until verified."*

The actual catch block at line 74–79 returns `{ ok: false, error: {...}, displayState: 'error' }` — **not** `super.getProcessOrderHeader()`. The fallback-to-mock behaviour described in the comment does not match the code.

**Impact:** Comment misleads reviewers into thinking mock data is returned on error. The actual behavior is correct (error surfaced). But the discrepancy could cause future developers to assume a fallback exists and not investigate failures.
**Required fix:** Update the JSDoc comment to match actual behavior.

---

### MEDIUM — POH operations/confirmations/goods-movements are mock-only in `legacy-api` mode

These three methods are only overridden in `ProcessOrderReviewDatabricksApiAdapter`. The legacy-api adapter (`ProcessOrderReviewLegacyApiAdapter`) does not override them. In `legacy-api` mode, calling `getOrderOperations()`, `getOrderConfirmations()`, or `getOrderGoodsMovements()` silently returns mock data.

**Impact:** A deployment in `legacy-api` mode (e.g., Databricks Apps with V1 API access but not native Databricks) would show mock operations/confirmations/goods-movements while showing a real order header. Mixed live/mock data in the same view with no clear signal.
**Note:** The backend routes for these methods are native-Databricks-only (no V1 endpoint). In `databricks-api` mode they work correctly. The issue is only in `legacy-api` mode.

---

### MEDIUM — SPC legacy-api adapter wires 3 methods to unverified V1 proxy; all others silently mock

`SPCMonitoringLegacyApiAdapter` overrides `getMonitoredCharacteristics()`, `getControlChartSeries()`, and `getCharacteristicCapability()` with V1 proxy calls. The other 5 methods (`getSPCMonitoringContext()`, `getSPCSummary()`, `getActiveSPCSignals()`, `getSPCAlarmHistory()`, `getSPCRelatedBatches()`) fall through to the mock adapter via `super`.

None of the 3 overridden methods have been browser-verified against a live V1 SPC backend. If the V1 SPC URL is wrong or the endpoint is not found, these methods return an error `AdapterResult` — but a user running in legacy-api mode would also silently receive mock data for the 5 un-overridden methods.

**Impact:** Mixed live-attempt/mock in the same SPC cockpit. User cannot tell which panels are live and which are mock.

---

## Full adapter method coverage

### Traceability — `Trace2Adapter` / `Trace2LegacyApiAdapter`

| Method | Override tier | Backend route | Fallback behaviour | Source badge | Error/no-record | Tests | Risk | Next action |
|---|---|---|---|---|---|---|---|---|
| `getBatchHeaderSummary()` | legacy-api + databricks-api | `POST /api/trace2/batch-header` | Guard: if params absent → mock; catch → error AdapterResult (source: legacy-api) | `legacy-api` (amber) or `databricks-api` (green) depending on BACKEND_ADAPTER_MODE | 4xx → error displayed; 404 → not-found banner | Legacy-api adapter tests; unit tests | **NONE** — correctly labelled; browser-verified | — |
| `getTraceGraph()` | databricks-api | `POST /api/trace2/trace-graph` | No mock fallback; no legacy-api fallback (explicit comment) | `databricks-api` (green) | error returned; truncation banner on partial graph | Graph mapper tests; adapter tests | **NONE** — browser-verified 2026-05-18 | — |
| `getCustomerExposureSummary()` | databricks-api | `POST /api/trace2/customer-deliveries` (primary) + `/customer-exposure` route also exists | No mock fallback; no legacy-api fallback | `databricks-api` | 404 with explicit "do not interpret as zero exposure" message | Adapter tests | **LOW** — no-record message is explicit and correct | Verify LINK_TYPE='DELIVERY' in live UAT |
| `getMassBalanceSummary()` | databricks-api | `POST /api/trace2/mass-balance` | No mock fallback; no legacy-api fallback | `databricks-api` | 404 with "do not interpret as balanced mass balance" message | Adapter tests | **LOW** — correct no-record handling | Resolve TRACE-P1-010/011 |
| `getSupplierExposureSummary()` | databricks-api | `POST /api/trace2/supplier-exposure` | No mock fallback | `databricks-api` | Empty array = zero suppliers, explicitly valid | Adapter tests | **LOW** | — |
| `getProductionHistory()` | databricks-api | `POST /api/trace2/production-history` | No mock fallback | `databricks-api` | Empty array = no history, valid | Adapter tests | **LOW** | — |
| `getInvestigationContext()` | mock only | None | N/A | none | mock fixture returned | Mock adapter tests | **LOW** — intentionally mock | — |
| `getEventTimeline()` | mock only | None | N/A | none | mock fixture | Mock adapter tests | **LOW** | — |
| `getCoAReleaseStatus()` | mock only | None | N/A | none | mock fixture | Mock adapter tests | **LOW** | Source not identified |
| `getRiskSignals()` | mock only | None | N/A | none | mock fixture | Mock adapter tests | **LOW** | Source not identified |
| `getRelatedInvestigations()` | mock only | None | N/A | none | mock fixture | Mock adapter tests | **LOW** | — |
| `getTraceExposureForRelease()` | mock only | None | N/A | none | mock fixture | Mock adapter tests | **LOW** | — |

---

### POH — `ProcessOrderReviewAdapter` / `ProcessOrderReviewLegacyApiAdapter` / `ProcessOrderReviewDatabricksApiAdapter`

| Method | Override tier | Backend route | Fallback behaviour | Source badge | Error/no-record | Tests | Risk | Next action |
|---|---|---|---|---|---|---|---|---|
| `getProcessOrderHeader()` | legacy-api (proxy) + databricks-api (native, same route) | `POST /api/por/order-header` | Guard: if params absent → super (mock); catch → error AdapterResult. Comment says "mock fallback" — comment is inaccurate. | `legacy-api` or `databricks-api` (via databricks adapter: `{ ...result, source: 'databricks-api' }`) | HTTP errors → error AdapterResult | Unit tests; legacy-api tests; databricks-api tests; PR #62 source attribution tests | **HIGH** — JSDoc comment misleads; actual code is safe | Fix JSDoc comment to match actual fallback behavior |
| `getOrderOperations()` | databricks-api only | `GET /api/por/order-operations` | In legacy-api mode: not overridden → mock silently | `databricks-api` (green) when live | Error AdapterResult on HTTP failure | Databricks-api adapter tests | **MEDIUM** — mock in legacy-api mode with no signal | Document legacy-api mode gap; consider adding `displayState: 'unavailable'` return in legacy-api mode |
| `getOrderConfirmations()` | databricks-api only | `GET /api/por/order-confirmations` | In legacy-api mode: not overridden → mock silently | `databricks-api` (green) when live | Error AdapterResult | Databricks-api adapter tests | **MEDIUM** — same as operations | Same |
| `getOrderGoodsMovements()` | databricks-api only | `GET /api/por/order-goods-movements` | In legacy-api mode: not overridden → mock silently | `databricks-api` (green) when live | Error AdapterResult; zero/negative rows preserved (PR #62) | Databricks-api tests; PR #62 component/output tests | **MEDIUM** — same as operations | Same |
| `getProcessOrderReviewContext()` | mock only | None | N/A | none | mock | Mock tests | **LOW** | — |
| `getOrderProgressSummary()` | mock only | None | N/A | none | mock | Mock tests | **LOW** | No source identified |
| `getExecutionTimeline()` | mock only | None | N/A | none | mock | Mock tests | **LOW** | No source identified |
| `getOrderQualityContext()` | mock only | None | N/A | none | mock | Mock tests | **LOW** | — |
| `getOrderStagingContext()` | mock only | None | N/A | none | mock | Mock tests | **LOW** | — |
| `getRelatedBatchContext()` | mock only | None | N/A | none | mock | Mock tests | **LOW** | — |
| `getSectionSource()` (derived) | N/A | N/A | Derives source from AdapterResult.source | Drives section-level source badge | N/A | TC-1–TC-8 (PR #62) | **NONE** — correct | — |

---

### Quality — `ConnectedQualityLabAdapter` / `ConnectedQualityLabLegacyApiAdapter`

| Method | Override tier | Backend route | Fallback behaviour | Source badge | Error/no-record | Tests | Risk | Next action |
|---|---|---|---|---|---|---|---|---|
| `getLabFailures()` | legacy-api | `GET /api/cq/lab/fails` | Guard: if params absent → super (mock); catch → error AdapterResult (source: legacy-api) | `legacy-api` (amber) | HTTP errors → error AdapterResult with source:legacy-api | Legacy-api tests; adapter tests | **MEDIUM** — route not browser-verified | Browser-verify against V1 |
| `getLabPlants()` | legacy-api | `GET /api/cq/lab/plants` | **CRITICAL**: catch block calls `super.getLabPlants()` → silently returns mock plant list | Should be `legacy-api` (amber) on success; but on error shows mock with no badge | No-record = empty plants array. Error → silently returns mock. | Legacy-api tests; adapter tests | **CRITICAL — see risk summary above** | Fix catch block to return error AdapterResult; remove fallback to super |

---

### Quality — `QualityReadOnlyEvidenceAdapter`

| Method | Override tier | Backend route | Fallback behaviour | Source badge | Error/no-record | Tests | Risk | Next action |
|---|---|---|---|---|---|---|---|---|
| `getQualityEvidence()` | unavailable-state (explicit skeleton route) | `POST /api/quality/read-only-evidence` | Returns `{ ok: true, data: { summary: { status: 'pending-source-verification' ... } } }` from API | `databricks-api` (API returns unavailable) | N/A — always returns unavailable state | Route and adapter tests; 196 source-truthfulness tests | **NONE** — correctly labelled | Wire live route after lot-selection rule confirmed |

---

### Quality — `QualityReleaseAdapter` (mock)

| Method | Override tier | Backend route | Fallback behaviour | Source badge | Error/no-record | Tests | Risk | Next action |
|---|---|---|---|---|---|---|---|---|
| `getReleaseContext()`, `getReleaseQueue()`, `getReleaseSummary()`, `getQualityResults()`, `getCoAReadiness()`, `getDeviations()`, `getDecisionHistory()` | mock only | None | N/A | none | mock fixtures | Mock adapter tests | **LOW** — intentionally mock; production-blocked | No action — out of scope |

---

### SPC — `SPCMonitoringAdapter` / `SPCMonitoringLegacyApiAdapter` / `SPCMonitoringDatabricksApiAdapter`

| Method | Override tier | Backend route | Fallback behaviour | Source badge | Error/no-record | Tests | Risk | Next action |
|---|---|---|---|---|---|---|---|---|
| `getMonitoredCharacteristics()` | legacy-api (unverified V1 proxy) | `GET /api/spc/characteristics` | Catch → error AdapterResult; no mock fallback in override | `legacy-api` (amber) if called via that adapter | Error → error displayed | Legacy-api adapter tests | **MEDIUM** — V1 proxy not verified; V1 URL not confirmed | Confirm V1 SPC URL; browser-verify |
| `getControlChartSeries()` | legacy-api (unverified V1 proxy) | `POST /api/spc/chart-data` | Catch → error AdapterResult | `legacy-api` | Error displayed | Adapter tests | **MEDIUM** — V1 proxy not verified | Same |
| `getCharacteristicCapability()` | legacy-api (unverified V1 proxy) | `GET /api/spc/capability` | Catch → error AdapterResult | `legacy-api` | Error displayed | Adapter tests | **MEDIUM** — V1 proxy not verified; source `spc_capability_detail_mv` NOT FOUND | V1 proxy only path; native source missing |
| `getSPCMonitoringContext()` | mock only (legacy-api adapter: not overridden) | None | In legacy-api mode → mock via super | none (mock) | mock fixture | Mock adapter tests | **MEDIUM** — user in legacy-api mode gets mock context alongside live characteristics | — |
| `getSPCSummary()` | mock only | None | N/A | none | mock | Mock tests | **LOW** | No source identified |
| `getActiveSPCSignals()` | mock only | None | N/A | none | mock | Mock tests | **LOW** | `spc_nelson_rule_flags_mv` NOT FOUND |
| `getSPCAlarmHistory()` | mock only | None | N/A | none | mock | Mock tests | **LOW** | No persistent alarm table identified |
| `getSPCRelatedBatches()` | mock only | None | N/A | none | mock | Mock tests | **LOW** | No source identified |
| **All methods** — `SPCMonitoringDatabricksApiAdapter` | unavailable-state (explicit) | None | Returns `{ ok: false, error: { code: 'not-found' }, ... }` — all methods; explicit "SPC Databricks adapter unavailable" message | — | All return explicit error | Adapter tests; spc-placeholder-adapters.test.ts | **NONE** — correctly labelled as unavailable | Wire native route when prerequisite checklist gates pass |
| `getSPCSignals()` — `SPCSignalsAdapter` | mock only | None | N/A | none | mock | SPCSignals adapter tests | **LOW** | `spc_nelson_rule_flags_mv` NOT FOUND |

---

### Warehouse — `Warehouse360Adapter` / `Warehouse360LegacyApiAdapter`

| Method | Override tier | Backend route | Fallback behaviour | Source badge | Error/no-record | Tests | Risk | Next action |
|---|---|---|---|---|---|---|---|---|
| `getWarehouse360Summary()` | legacy-api (proxy, unverified) | `POST /api/wh360/warehouse-summary` | Guard: if params absent → super (mock); catch → error AdapterResult (source:legacy-api) | `legacy-api` (amber) | Error AdapterResult | Legacy-api adapter tests | **MEDIUM** — route not verified; source not identified | Browser-verify |
| `getWarehouseOverview()` | databricks-api (native route) | `GET /api/warehouse360/overview` | Guard: if params absent → super (mock); catch → error AdapterResult (source:databricks-api) | `databricks-api` (green) | Error AdapterResult | Adapter tests | **MEDIUM** — source not identified; not browser-E2E-verified | Run Warehouse schema alignment |
| `getWarehouseInbound()` | databricks-api | `GET /api/warehouse360/inbound` | Same as overview | `databricks-api` | Error AdapterResult | Adapter tests | **MEDIUM** — source not identified | Same |
| `getWarehouseOutbound()` | databricks-api | `GET /api/warehouse360/outbound` | Same | `databricks-api` | Error AdapterResult | Adapter tests | **MEDIUM** | Same |
| `getWarehouseStaging()` | databricks-api | `GET /api/warehouse360/staging` | Same | `databricks-api` | Error AdapterResult | Adapter tests | **MEDIUM** | Same |
| `getWarehouseExceptionItems()` | databricks-api | `GET /api/warehouse360/exceptions` | Same | `databricks-api` | Error AdapterResult | Adapter tests | **MEDIUM** | Same |
| `getWarehouse360Context()`, `getStockOverview()`, `getOpenHolds()`, `getGoodsMovements()`, `getReplenishmentNeeds()`, `getLocationCapacities()`, `getNearExpiryStock()`, `getWarehouseExceptions()` | mock only | None | N/A | none | mock fixture | Mock tests | **LOW** | No source identified |

---

### EnvMon — `EnvMonAdapter`

| Method | Override tier | Backend route | Fallback behaviour | Source badge | Error/no-record | Tests | Risk | Next action |
|---|---|---|---|---|---|---|---|---|
| `getNativeSiteSummary()` | databricks-api (inline on base adapter) | `GET /api/envmon/site-summary` | Catch → error AdapterResult (source:databricks-api) | `databricks-api` (green) | Returns zero-value shape if no data | 99 adapter tests | **NONE** — correctly labelled | Browser-verify in UAT |
| `getNativeSwabResults()` | databricks-api (inline on base adapter) | `GET /api/envmon/swab-results` | Catch → error AdapterResult (source:databricks-api) | `databricks-api` (green) | Returns empty array | Adapter tests | **NONE** — correctly labelled | Browser-verify in UAT |
| `getEnvMonSiteSummary()`, `getEnvMonSwabResults()` | mock only (base class methods) | None | N/A | none (mock) | mock fixture | Mock tests | **LOW** — distinct from native methods | These mock methods should not be confused with the native methods |
| `getEnvMonZones()`, `getEnvMonAlerts()`, `getEnvMonTrends()`, `getEnvMonHeatmap()`, `getEnvMonCorrectiveActions()`, `getEnvMonSwabVectors()` | mock only | None | N/A | none | mock fixture | Mock tests | **LOW** | Heatmap production-blocked; others no source identified |

---

### Maintenance & Production Staging

| Domain | Adapter class | Methods | Override tier | Risk |
|---|---|---|---|---|
| Maintenance | `MaintenanceReliabilityAdapter` | 7 methods (context, KPIs, work orders, PM tasks, availability, reliability, backlog) | mock only | **LOW** — intentional mock; no source identified |
| Maintenance | `MaintenanceConstraintsAdapter` | 1 method (`getMaintenanceConstraintsForPlan`) | mock only | **LOW** |
| Production Staging | `ProductionStagingAdapter` | 9 methods (context, readiness, orders, pick tasks, zone capacity, shortfalls, move requests, picking waves, alerts) | mock only | **LOW** — intentional mock; no source identified |

---

## Risk summary

| Risk level | Count | Items |
|---|---|---|
| CRITICAL | 1 | `getLabPlants()` — catch falls back to mock silently |
| HIGH | 1 | POH `getProcessOrderHeader()` JSDoc comment inaccurate ("falls back to mock" when code returns error) |
| MEDIUM | 7 | POH ops/confirmations/movements in legacy-api mode; SPC 3 unverified proxies + mixed mock in legacy-api mode; Warehouse unverified routes; Warehouse360Summary unverified |
| LOW | — | All intentional mock-only methods (correctly labelled) |
| NONE | — | All Traceability databricks-api methods; POH databricks-api methods; EnvMon native methods; QualityReadOnlyEvidenceAdapter; SPCMonitoringDatabricksApiAdapter |

## Patterns absent that should be present

| Gap | Domain(s) | Impact |
|---|---|---|
| Operations/Confirmations/GoodsMovements have no `unavailable` state in `legacy-api` mode | POH | Mixed live header + mock operations data; no warning |
| `response_model` absent on batch-header, order-header, all EnvMon and Warehouse routes | Traceability, POH, EnvMon, Warehouse | Backend doesn't validate response shape against contract |
| No mode-gating check on the SPC V1 proxy routes (`/api/spc/*`) | SPC | Routes callable in any mode; no 503 if databricks-api mode is set and no native route exists |
| Service-principal fallback | None found | No service-principal fallback paths found — compliant with CLAUDE.md security rule |
