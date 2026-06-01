# Position paper — Unity Catalog security: should this repo adopt the CSM consumption-view approach?

**Status:** Position / recommendation (for review)
**Audience:** Data platform owners, Connected Plant governance, this product's maintainers
**Decision requested:** how plant-level access control should be enforced and served for the
Integrated-Operations data product, and whether to adopt the platform's existing **CSM
consumption-view** pattern.

---

## 1. TL;DR recommendation

**Adopt a hybrid, not an either/or.**

1. **Keep Unity Catalog row-level enforcement as the security *primitive*** on the physical
   tables (the repo's `plant_access_filter` row filters on Silver, and the new in-job row filter on
   the Gold snapshot tables). Row filters are the only mechanism that protects **every** access
   path — Power BI, ad-hoc SQL, notebooks, the `genie`/assistant, JDBC — not just the curated one.
   A consumption view alone does **not** secure the base table: anyone granted `SELECT` on the
   underlying table bypasses it.
2. **Adopt the CSM *consumption-view* pattern for serving**, because it is the platform's
   established consumption contract and the repo already moved this way for the Gold MVs
   (`*_secured` views, ADR 012). Align naming/shape with CSM so downstream consumers see one
   consistent pattern across products.
3. **Consolidate on one access-control source of truth.** The single most important issue is **not**
   views-vs-filters — it is that the repo currently defines plant entitlement **independently**
   (`current_user_attribute('allowed_plants')` + a `silver_admin` bypass) from however CSM derives
   plant scope. Two divergent entitlement models is the real governance risk. Pick one
   (recommended: the platform/CSM security model) and have both layers consume it.

So: **don't replace row filters with CSM views; put CSM-style views *on top of* row-filtered
tables, and unify the entitlement source.**

---

## 2. The two approaches

### A. Repo approach (UC-native row filters)
- A UC function `…silver.plant_access_filter(plant_code)` returns TRUE when the invoking user's
  `allowed_plants` attribute contains the row's plant (with a `silver_admin` bypass).
- Attached to Silver tables via `ALTER TABLE … SET ROW FILTER … ON (plant_code)`
  (`scripts/generate_row_filter_sql.py`).
- Gold MVs are left "trusted" (ADR 005: a row filter on an MV forces full refreshes); plant trim is
  now served by `*_secured` views and the snapshot tables carry a real filter (ADR 012).
- Enforcement is **at the engine**: it applies no matter how the table is queried.

### B. CSM approach (consumption views)
- The platform already exposes plant-filtered **consumption views** (e.g.
  `connected_plant_uat.csm_process_order_history`) that pre-filter by plant and present a curated
  shape for downstream consumption.
- Enforcement is **at the view**: consumers are pointed at the view; the base table is governed
  separately (ideally not granted to consumers at all).

These are **not mutually exclusive** — A secures the data, B curates and serves it.

---

## 3. Comparison

| Dimension | A. Row filters (repo) | B. CSM consumption views |
|---|---|---|
| **Enforcement surface** | **All paths** (BI, ad-hoc SQL, notebooks, Genie). Strongest. | Only the curated view; base table needs separate lockdown or it leaks. |
| **MV / performance cost** | Filtering an **MV** forces full refreshes (why Gold MVs stay trusted). On plain tables: negligible. | No refresh cost — a view is just a query rewrite. Good fit for MVs. |
| **Single source of truth** | Strong *within the repo*, but **divergent** from the platform model if CSM derives plant scope differently. | Whatever CSM uses — if that's the canonical platform model, this is the alignment win. |
| **Consumer experience** | Consumers query real tables; trimming is invisible. | Consistent platform-wide consumption contract; curated columns/semantics. |
| **Maintainability** | Generator keeps the filter list in sync; one function. | A view per served object; must track schema drift + grants. |
| **Auditability** | Filter + attribute are inspectable in `information_schema.row_filters`. | View definitions + grants; lineage via `system.access.*`. |
| **Reusability across products** | Repo-local convention. | Platform-wide, reused by other Connected Plant products. |

---

## 4. Key risks

- **Relying on CSM views *instead of* row filters** → base tables remain readable by anyone with a
  direct grant; a single mis-grant or a curious analyst with SQL access sees all plants. This is the
  classic "view-only security" failure. **Do not do this.**
- **Two entitlement models** (repo `allowed_plants` vs CSM's plant scope) → a user authorised for
  plant C061 in one and not the other; drift, audit gaps, and "why can I see X here but not there".
  This is the highest-priority item to resolve.
- **Leaving Gold MVs unfiltered with no served view** (the pre-ADR-012 state) → cross-plant leakage
  on any direct Gold grant. ADR 012 closes this with `*_secured` views.
- **Row filters on MVs** → full-refresh cost; avoid (ADR 005). Use views over MVs, filters on
  physical tables (Silver, snapshots).

---

## 5. Recommendation in detail

1. **Security primitive = row filters on physical tables.** Keep them on Silver; keep the in-job
   filter on snapshot tables (ADR 012). This is defense-in-depth and the only thing that holds for
   ad-hoc access.
2. **Serving = CSM-style consumption views.** Re-shape the Gold `*_secured` views to match the CSM
   naming/column conventions so downstream tooling treats this product like any other. Consumers get
   **view grants only**; base tables/MVs are granted to admins/service principals only.
3. **Unify entitlement.** Replace the repo-local `allowed_plants` definition with the **platform/CSM
   security model** as the single source — have `plant_access_filter` (or its replacement) read the
   *same* mapping CSM uses. If CSM's plant scoping is itself just consumption views with no
   underlying RLS, then the platform should add row-level enforcement and this product should
   contribute its filter function as the shared primitive.
4. **Cluster/role tiers** (ADR 005 cluster-lead tier) plug into the same unified model once a
   governed plant→cluster source exists.

**Net:** adopt the CSM *pattern* for serving and (critically) its *entitlement source*; retain UC
row-level enforcement underneath. The repo is already most of the way there (ADR 012); the missing
piece is consolidating the entitlement source of truth with the platform.

---

## 6. Open questions (need platform input)
- Does CSM enforce plant scope with **row-level security on base tables**, or only via view
  predicates? (Determines whether CSM is a true security boundary or a serving convenience.)
- What is the **canonical plant-entitlement source** (the `allowed_plants` attribute, a mapping
  table, an IdP group)? This product should consume it, not define its own.
- Should this product **publish into the CSM layer** (contribute `csm_*` views) rather than expose
  its own `gold.*_secured` views, to present one consumption surface?
- Naming/ownership: if Gold consolidates into a shared schema (the open `gold` collision decision),
  align secured-view naming with CSM conventions at the same time.

## 7. References
- ADR 005 — Gold trusted-layer / row-filter-off rationale.
- ADR 012 — Gold secured serving views + snapshot row filters.
- `scripts/generate_row_filter_sql.py`, `scripts/generate_gold_security_sql.py`.
- `connected_plant_uat.csm_process_order_history` (platform CSM consumption views).
