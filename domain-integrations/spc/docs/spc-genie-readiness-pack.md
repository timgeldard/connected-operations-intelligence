# SPC Genie Readiness Pack

**Date:** 2026-05-20  
**Status:** Discovery complete; live Genie scope blocked  
**Domain:** `di-spc` / `spc-monitoring`

---

## 1. Purpose

This pack records why SPC Genie must remain blocked in V2 today, despite clear V1 Genie precedent.

Unlike POH and Traceability, SPC does **not** yet have a safe first live question pack in V2. The blocker is not lack of source data. The blocker is that V2 is still misaligned with the real V1 SPC source and interaction model.

---

## 2. Current readiness position

V1 SPC had an explicit Genie surface:

- `apps/spc/frontend/src/spc/genie/GenieView.tsx`
- `apps/spc/backend/spc_backend/routers/genie.py`

But V2 SPC is still blocked because:

1. **Navigation/request shape mismatch:** V1 is material-centric; V2 still centers plant/work-centre context.
2. **Incorrect signal model assumptions:** V2 documentation previously treated `spc_quality_metrics` like an alarm store, but V1 uses it as an AI/BI Metric View, not a live signal table.
3. **Rule provenance mismatch:** V1 computes rule violations in the frontend/runtime from subgroup data; V2 has not yet finalized whether those rules should remain frontend-computed or move to the API layer.
4. **Adapter/runtime gap:** `SPCMonitoringLegacyApiAdapter` and `SPCMonitoringDatabricksApiAdapter` are still effectively unavailable for real use.

Because of those blockers, **no live SPC Genie starter pack should be approved yet**.

---

## 3. Source inventory mapped to current V2 status

| Area | V1 evidence | Current V2 status | Genie readiness status |
|---|---|---|---|
| Genie UI and backend | V1 has explicit Genie UI and `/api/spc/genie/message` backend route | No V2 Genie runtime implemented | **Blocked** |
| Material-first navigation model | V1 flow is material → plant → MIC → chart | V2 request model still needs `materialId` as a first-class entry parameter | **Blocked** |
| Primary chart source | `connected_plant_uat.gold.spc_quality_metric_subgroup_v` | V2 source mapping not yet verified end-to-end | **Blocked** |
| Locked limits | `spc_locked_limits` with required `material_id` PK dimension | V2 assumptions/schema need reconciliation with V1 source contract | **Blocked** |
| Signal / rule semantics | V1 computes Nelson/WECO rule outcomes from raw subgroup data | V2 has not finalized the authoritative computation layer | **Blocked** |
| AI/BI metrics | `spc_quality_metrics` is a Databricks AI/BI Metric View | V2 must not treat this as a stored alarm table | **Blocked** |
| Adapter factory | `spc-monitoring-adapter-factory.ts` supports `mock`, `legacy-api`, `databricks-api` | `legacy-api`/`databricks-api` modes are feature-flagged and not ready for live use | **Blocked** |

---

## 4. Why SPC differs from POH and Traceability

POH and Traceability each have at least one narrow slice that can be framed as “currently visible, source-cited evidence.”

SPC is different:

- chart interpretation depends on control-limit provenance
- signal interpretation depends on rule semantics
- material selection is foundational to all downstream context
- some “obvious” SPC questions are effectively decisions, not just summaries

That means even seemingly simple questions like “is this process in control?” are unsafe until source mapping and rule provenance are fully settled.

---

## 5. Approved question list

**None.**

No live SPC Genie questions are approved for V2 at this time.

---

## 6. Blocked question list

The following question classes must remain blocked:

- Is this process in control?
- Which MICs are out of control right now?
- Which batches are affected by SPC alarms?
- What is the current Cpk / Ppk / Cp / Pp for this characteristic?
- Should this batch be blocked, investigated, or released?
- Which plant has the worst process capability?
- Summarize recent drift or capability by material.
- Compare process capability across plants.
- Explain SPC signals as if they were persisted source-system facts.
- Use SPC output to recommend QA, batch-release, or regulatory actions.

These are blocked because they depend on unresolved source mapping, unresolved rule-computation provenance, or prohibited decision support.

---

## 7. Candidate future questions after source alignment

These are **not approved now**. They are documentation-only examples of what could become eligible after the blockers are removed:

1. Show the currently loaded chart scope for material `<materialId>`, plant `<plantId>`, and MIC `<micId>`.
2. Summarize the current subgroup window used for this chart.
3. Explain which control-limit source is active for the current chart (`locked` vs computed).
4. List the currently visible rule flags for the selected chart, with provenance.
5. Summarize recent batches linked to the selected signal window.

These future questions should only become eligible once the data model, rule semantics, and route wiring are all proven.

---

## 8. Required gates before any SPC Genie implementation

Before any SPC Genie UI/runtime work starts in V2, all of the following must be complete:

1. **Material-centric request model**
   - `SPCMonitoringAdapterRequest` must treat `materialId` as a required first-class entry parameter.

2. **Route wiring**
   - Implement V2 proxy/native routes for the verified V1 SPC endpoints.

3. **Adapter implementation**
   - `SPCMonitoringLegacyApiAdapter` must map real V1 field shapes.
   - `SPCMonitoringDatabricksApiAdapter` must stop returning unavailable status and map verified native routes only.

4. **DDL / source verification**
   - Verify `spc_quality_metric_subgroup_v`
   - Verify `spc_locked_limits`
   - Verify any metric/materialized views referenced by the chosen first slice

5. **Rule provenance decision**
   - Decide whether WECO/Nelson rule evaluation remains frontend/runtime-computed like V1 or moves into a governed API layer.

6. **Golden candidate identification**
   - Confirm at least one real material/plant/MIC combination with known SPC data in UAT.

7. **Truthfulness framing**
   - Prove that the UI clearly separates computed interpretation from stored source facts.

---

## 9. Safe-answer rules for future SPC Genie work

When SPC eventually becomes eligible, any assistant must follow these rules:

1. **Never say “in control” unless the control-limit source and rule provenance are explicit.**
2. **Cite whether the answer came from raw subgroup data, a computed rule layer, or a locked-limit configuration.**
3. **Treat no returned signals as unknown or unproven, not as evidence of control.**
4. **Keep batch-release and QA decision language blocked.**
5. **Preserve material-centric scoping.** Do not answer broad SPC questions without an explicit material scope.
6. **Do not treat Databricks AI/BI Metric Views as alarm-history facts unless that contract is verified.**

---

## 10. References

- `docs/migration/v1-genie-discovery-and-v2-parity-roadmap.md`
- `domain-integrations/spc/docs/spc-v1-source-discovery.md`
- `docs/migration/spc-functional-parity-audit.md`
- `domain-integrations/spc/src/adapters/spc-monitoring-adapter-factory.ts`
- `domain-integrations/spc/README.md`
