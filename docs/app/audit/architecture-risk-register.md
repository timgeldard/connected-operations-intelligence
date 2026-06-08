# Architecture Risk Register — Native Databricks Migration

**Date:** 2026-05-17  
**Scope:** ConnectIO RAD V2 — all risks that could compromise data integrity, security, or migration correctness  
**Review trigger:** Update when a new native route is wired or a blocker changes state  
**Reference:** ADR-024, CLAUDE.md, `docs/audit/current-state-after-native-databricks-work.md`

---

## Severity / Likelihood Scale

| Scale | Meaning |
|---|---|
| **Critical** | Data breach, identity bypass, or irreversible production damage |
| **High** | Wrong data returned silently, security boundary broken, or key domain blocked indefinitely |
| **Medium** | Feature degraded or wrong data returned with visible error signal |
| **Low** | Minor gap, cosmetic, or development friction only |
| **Certain / High / Medium / Low** | Likelihood without mitigation |

---

## Active Risks

### R01 — SPN/PAT Fallback Introduced Accidentally

| Field | Value |
|---|---|
| **Severity** | Critical |
| **Likelihood** | Low |
| **Status** | Mitigated |
| **Description** | A service principal or PAT token (stored in app.yaml or env) is used for Databricks SQL reads instead of end-user OAuth. Attacker with network access can query data as the SPN regardless of the user's identity. |
| **Mitigation** | Architecture guardrail test `TestNoSPNOrPATInQueryPath` fails the build if any SPN/PAT flow is introduced. No service credentials in `app.yaml`. `require_user_oauth()` in `QueryExecutor.execute()` rejects missing OAuth with 401. |
| **Residual risk** | A developer bypasses `run_query()` and calls `QueryExecutor.execute()` directly with a fabricated identity. Mitigated by `TestNoDatabricksApiMockFallback`. |

---

### R02 — Silent Fallback from databricks-api to Mock or Legacy-api

| Field | Value |
|---|---|
| **Severity** | High |
| **Likelihood** | Low |
| **Status** | Mitigated |
| **Description** | A route under `BACKEND_ADAPTER_MODE=databricks-api` silently serves mock or V1 data on Databricks error, giving users false confidence in the data. |
| **Mitigation** | Architecture guardrail test `TestNoDatabricksApiMockFallback` checks that no `domain-integrations` fallback wiring exists. POH and CQ routes raise `HTTPException` on all Databricks errors — no catch-and-return-mock. |
| **Residual risk** | New frontend adapter methods could add a `catch → mockData` pattern. The guardrail test must be kept current as adapters are added. |

---

### R03 — DDL Mismatch: Unknown Column Names Cause Silent Empty Results or Query Failure

| Field | Value |
|---|---|
| **Severity** | High |
| **Likelihood** | High (Trace — not yet verified) |
| **Status** | Active — Trace routes blocked |
| **Description** | The Trace2 adapter has 6 unverified column names in `gold_batch_summary_v` and uses `gold_material.language_id` filter without confirming the column exists or the value `'EN'` is correct. A wrong column name causes a 502. A wrong `language_id` value causes empty results or a row-count explosion. |
| **Mitigation** | Trace routes are NOT wired. DDL verification checklist must be completed before wiring — see `docs/audit/trace-native-column-verification-checklist.md`. |
| **Residual risk** | Dev wires the route early to "try it" without completing the DDL checklist. CLAUDE.md prohibits this; `TestQuerySpecObjectQualification` enforces `resolve_domain_object()` use. |

---

### R04 — `vw_gold_process_order_plan` Does Not Exist — CQ Lab Fails Permanently Blocked

| Field | Value |
|---|---|
| **Severity** | High |
| **Likelihood** | Certain (view confirmed missing) |
| **Status** | Active — no resolution in scope |
| **Description** | The `getLabFailures` databricks-api route cannot be implemented because `connected_plant_uat.csm_process_order_history.vw_gold_process_order_plan` does not exist. The data team must create this view before any implementation can proceed. |
| **Mitigation** | Architecture guardrail test `TestCQLabFailuresDeferred` fails if any databricks-api code path for `getLabFailures` is introduced. V1 proxy route exists but returns 503 while V1 is STOPPED. |
| **Residual risk** | View may never be created — domain is permanently blocked in that case. Accept and document. |

---

### R05 — WH360 Requires Catalog Override Not Yet Implemented

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Likelihood** | Certain (architectural gap) |
| **Status** | Active — no WH360 adapter planned until resolved |
| **Description** | The WH360 domain uses the `wh360` schema, separate from `gold` and `csm_process_order_history`. `QueryExecutor` does not currently support a `catalog_override` parameter. If WH360 native routes are wired without this capability, they will fail or query the wrong catalog. |
| **Mitigation** | WH360 is the lowest ADR-024 migration priority. No adapter is being written. When the time comes, `QueryExecutor` must be extended with `catalog_override` before any WH360 QuerySpec is wired. |
| **Residual risk** | Developer writes a WH360 QuerySpec using hardcoded catalog strings instead of `resolve_domain_object()`. `TestQuerySpecObjectQualification` enforces `resolve_domain_object()` — residual risk is low. |

---

### R06 — V1 Apps STOPPED — Legacy-Api Routes Serve 503

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Likelihood** | Certain (current state) |
| **Status** | Active — known production condition |
| **Description** | All three V1-proxy routes (`/trace2/batch-header`, `/wh360/warehouse-summary`, `/cq/lab/fails`) return 503 because V1 apps are STOPPED. These routes have not been browser-verified against live V1 data. |
| **Mitigation** | Prioritise databricks-api wiring over adding new V1 proxy routes. Do not add new V1 proxy routes while V1 is STOPPED. If V1 restarts, browser-verify these routes before claiming legacy-api parity. |
| **Residual risk** | Developers treat these routes as "known working" based on historical records. They have never been browser-verified in this deployment. |

---

### R07 — POH View Field Gaps Return Defaults Silently

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Likelihood** | Certain (design constraint of current views) |
| **Status** | Active — documented and accepted |
| **Description** | `vw_gold_process_order` lacks planned/confirmed quantities, dates, batchId, productionLine, and orderType. `vw_gold_process_order_phase` lacks dates, durations, and work centre. `vw_gold_confirmation` lacks operationText and isFinalConfirmation. `vw_gold_adp_movement` lacks materialDescription. These return 0/empty defaults silently — no error raised. |
| **Mitigation** | Documented in adapter docstrings. Schema fields relaxed to optional so the UI can render partial data gracefully. See `docs/audit/current-state-after-native-databricks-work.md`. |
| **Residual risk** | UI panels display partial data without user-visible indication that fields are absent. This is acceptable for now; re-require fields when richer views become available. |

---

### R08 — Raw OAuth Token Logged Accidentally

| Field | Value |
|---|---|
| **Severity** | High |
| **Likelihood** | Low |
| **Status** | Mitigated |
| **Description** | `x-forwarded-access-token` is included in the Databricks API call header. If it is logged (e.g., by a debug `print()` or structured logger dump), the token is exposed in app logs accessible to other Databricks workspace users. |
| **Mitigation** | Architecture guardrail test `TestNoRawTokenLogging` scans for patterns that would log the raw token. `UserIdentity` intentionally does not implement `__repr__` to prevent accidental log inclusion. |
| **Residual risk** | A Databricks Apps log integration that dumps the full HTTP request headers. Not tested at the platform level. |

---

### R09 — Recursive Trace Traversal

| Field | Value |
|---|---|
| **Severity** | High |
| **Likelihood** | Low |
| **Status** | Mitigated |
| **Description** | A recursive CTE or multi-hop graph expansion in the Trace adapter would cause runaway warehouse query costs and potentially return unbounded result sets. |
| **Mitigation** | `get_trace_graph_spec` implements depth=1 flat SELECT only — no recursive CTE. ADR-024 prohibits recursive traversal. Architecture doc `trace-native-architecture-check.md` confirms this. |
| **Residual risk** | Future developer adds a "depth" parameter without understanding the constraint. Document clearly in ADR and adapter docstring. |

---

### R10 — app.yaml Secret Syntax Error Causes Silent Config Failure

| Field | Value |
|---|---|
| **Severity** | Medium |
| **Likelihood** | Low |
| **Status** | Mitigated by CLAUDE.md documentation |
| **Description** | Databricks Apps requires `valueFrom` to be a plain `scope/key` string. A nested YAML dict form (`valueFrom: { secretScope: ..., secretKey: ... }`) causes an "error reading app.yaml file" at startup and the app fails to start. |
| **Mitigation** | CLAUDE.md contains a CRITICAL note on the correct syntax. Existing `valueFrom: scope/key` entries must not be "corrected" to the nested form. |
| **Residual risk** | A developer unfamiliar with the constraint "fixes" the syntax based on YAML intuition. |

---

### R11 — SPC MVs Unverified for Column Names and Query Shapes

| Field | Value |
|---|---|
| **Severity** | Low |
| **Likelihood** | Medium |
| **Status** | Not started |
| **Description** | The four SPC materialised views (`spc_correlation_source_mv`, `spc_material_dim_mv`, `spc_plant_material_dim_mv`, `spc_process_flow_source_mv`) are confirmed to exist but no DDL verification has been run. The catalog/schema prefix is unconfirmed. Column names are assumed from V1 source inspection only. |
| **Mitigation** | Do not write SPC QuerySpecs until `DESCRIBE TABLE` is run for each MV. This is the same discipline applied to Trace. |
| **Residual risk** | Low — no SPC adapter work is currently planned. |

---

## Risk Summary

| ID | Risk | Severity | Likelihood | Status |
|---|---|---|---|---|
| R01 | SPN/PAT fallback | Critical | Low | Mitigated |
| R02 | Silent mock/legacy fallback | High | Low | Mitigated |
| R03 | Trace DDL mismatch | High | High (Trace) | Active — routes blocked |
| R04 | `vw_gold_process_order_plan` missing | High | Certain | Active — no resolution |
| R05 | WH360 catalog_override missing | Medium | Certain | Active — deferred |
| R06 | V1 STOPPED | Medium | Certain | Active — known state |
| R07 | POH view field gaps | Medium | Certain | Accepted |
| R08 | OAuth token logged | High | Low | Mitigated |
| R09 | Recursive trace traversal | High | Low | Mitigated |
| R10 | app.yaml secret syntax | Medium | Low | Documented |
| R11 | SPC MV columns unverified | Low | Medium | Not started |
