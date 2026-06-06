# V2 Shell Genie Decision Record

**Date:** 2026-05-20  
**Status:** Deferred  
**Scope:** `workspace-runtime` / shell UX / cross-domain assistant surface

---

## 1. Decision

**Do not add a shell-wide V2 Genie assistant yet.**

Any future global assistant surface in the V2 shell is deferred until domain-scoped Genie packs are validated, source-citation behavior is proven, and cross-domain context handling is stable enough to avoid over-broad or misleading answers.

---

## 2. Why this is deferred

V1 had a platform-level Genie assistant, but V2 should not recreate that surface by default.

The reasons are structural:

1. **Mixed evidence maturity across domains**
   - POH has a narrow, plausible first pack.
   - Traceability has a narrow, plausible first pack.
   - SPC remains blocked.
   - Warehouse, Quality, EnvMon, Maintenance, and Production Staging do not yet have approved Genie packs.

2. **Different source modes inside one answer**
   - Some approved trace answers already span `legacy-api` and `databricks-api`.
   - A shell-wide surface would make it too easy to hide those distinctions unless citation behavior is already proven.

3. **Cross-domain context is still guarded**
   - V2's active investigation context runtime is feature-flagged and intentionally conservative.
   - A shell assistant must not outpace the context runtime and start making unstated joins across workspaces.

4. **Truthfulness risk**
   - A global assistant can easily translate “no result”, “not loaded”, or “mock-only” into false certainty.
   - That risk is highest in operational, quality, and recall-adjacent workflows.

---

## 3. What is allowed now

The current approved direction is:

- domain-scoped readiness packs only
- no shell-level assistant runtime
- no global “Ask Genie” entry point in the shell
- no cross-domain natural-language joins beyond what an approved domain pack explicitly allows

This keeps Genie work aligned with the evidence-panel and source-truthfulness model already in V2.

---

## 4. Preconditions for reconsidering a shell-wide assistant

All of the following must be true before a shell-wide assistant is reconsidered:

1. **At least two domain packs are validated in practice**
   - Not just documented
   - Proven through real user-facing validation with clear approved question sets

2. **Citation model is proven**
   - Answers consistently identify the contributing panel/workspace and source mode
   - Cross-domain answers identify which domains contributed evidence

3. **Cross-domain context runtime is stable**
   - The `runtime.enableCrossDomainContext` model is behaving predictably
   - Required context is explicit, not inferred loosely

4. **Blocked-domain behavior is proven**
   - The assistant refuses questions from domains with no approved pack
   - The assistant refuses mixed questions that cross into blocked topics

5. **Freshness and availability language is proven**
   - The assistant does not treat query time as source freshness
   - The assistant does not translate unavailable evidence into negative evidence

6. **Governance review is completed**
   - Product, architecture, and UAT leads agree that a shell-level entry point will not overstate domain readiness

---

## 5. What a future shell assistant must do

If this decision is revisited later, the shell assistant must:

1. **Route through approved domain packs only**
2. **Preserve domain ownership**
3. **Expose source mode in answers**
4. **Refuse blocked or unsupported domains**
5. **Keep cross-domain joins explicit**
6. **Avoid decision authority**
7. **Respect context gating from workspace-runtime**

The shell must be an orchestration layer over approved domain assistants, not a free-form analytics surface that bypasses them.

---

## 6. What a future shell assistant must not do

- infer answers from domains with no approved readiness pack
- join mock-only and live evidence without disclosure
- hide whether evidence came from `mock`, `legacy-api`, or `databricks-api`
- answer quality-release, recall-closure, QA approval, SAP-posting, or regulatory questions
- fabricate cross-domain joins or metrics
- answer broad “what is going on across the plant?” questions unless the contributing packs and context are explicit

---

## 7. Current conclusion

The correct V2 sequence is:

1. establish domain-scoped packs
2. validate domain citation behavior
3. prove blocked-domain refusal behavior
4. then reconsider a shell-wide assistant

Until then, a shell-level Genie surface is more likely to weaken source truthfulness than improve usability.

---

## 8. References

- `docs/migration/v1-genie-discovery-and-v2-parity-roadmap.md`
- `domain-integrations/operations/docs/poh-genie-readiness-pack.md`
- `domain-integrations/traceability/docs/traceability-genie-readiness-pack.md`
- `domain-integrations/spc/docs/spc-genie-readiness-pack.md`
- `docs/adr/ADR-026-cross-domain-workspace-context.md`
- `docs/governance/workspace-and-panel-registry.md`
