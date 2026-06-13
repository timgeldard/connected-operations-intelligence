# Spec 21 — Platform Hardening & Governance Extensions (one body of work)

Read `docs/specs/_conventions.md` first. Branch: `feature/platform-extensions`.

The six **valid** items harvested from the external `proposed_extensions_workspaces.md` (the rest
of that 40-item list was rejected as duplication of shipped/planned work). Grouped as one body of
work because they're all small platform-hardening / governance primitives sharing the same
"prevent a real risk class" theme. Build order: the two highest-value guards (1, 2) first.

## 1. RLS matrix CI test suite (highest value)
Closes the architecture review's empty-`tests/` P1 + the security-mode-drift backlog item.
- A test harness that, for each governed consumption/`_secured`/`_live` view, asserts the
  per-user / per-plant RLS behaviour: a user entitled to plant X sees only X; an unentitled user
  sees nothing; a multi-plant user sees the union. Drive it off the **fixture security model**
  (`security_model_fixture`) so it runs offline (no live workspace) — same fixture the app uses
  for UAT. Enumerate the views from `resources/sql/*consumption_views_*.sql` (or the manifest's
  `source_view` list) so new views are auto-covered.
- Deliver: `scripts/ci/test_rls_matrix.py` (or `tests/security/`) + a small runner; wire into CI.
- Acceptance: a deliberately-mis-scoped fixture row (plant leak) makes the suite fail; correct
  scoping passes; every manifest `source_view` is covered (or explicitly skip-listed with reason).

## 2. Aecorsoft CDC / replication-gap detector (highest value)
Would have auto-flagged the QAMR stall and the ZPUS-stops-2023 staleness we hit manually.
- A check that, per bronze source table feeding silver, compares the **max replication watermark
  / business date** against an expected-recency threshold (per-domain, configurable — reuse the
  freshness thresholds from `gold/freshness.py` / spec 16). Flags sources whose newest data is
  older than threshold ("stale/stalled replication"), per plant where applicable.
- This needs live data → it's an **operational guard / job**, not a pure offline CI guard. Build
  it to run against the SQL warehouse (like the recon pattern) and emit a structured report;
  optionally surface into the Data-Trust freshness view (spec 16). Offline-testable parts (the
  threshold logic, the report shaping) get unit tests; the live query is a runbook/job step.
- Acceptance: given a source with a stale max-date, it reports the gap with the lag; a current
  source passes. Document it as a scheduled check (not a PR-blocking CI gate).

## 3. SAP zero-padding / key-normalisation util
- Consolidate the scattered `strip_zeros` / MATNR / AUFNR / CHARG-preservation logic into one
  documented shared helper (silver `helpers.py` already has `strip_zeros` — make it the single
  canonical home, add the MATNR/AUFNR ALPHA conventions + the CHARG "never normalise" rule as
  documented functions, and migrate ad-hoc call sites where trivial). NO behaviour change —
  pure consolidation + docstrings. CHARG must stay exact (the approved-mapping guard enforces it).
- Acceptance: existing silver tests still pass; the helper is the documented single source; no
  CHARG normalisation introduced.

## 4. UC column-masking helper
- A governance primitive: a generator/SQL helper that applies UC column masks (or
  `MASK`/tag-based masking) to columns flagged sensitive (PII / restricted) at the governed view
  layer. Drive it from a tag/flag in the manifest or the UC-metadata YAMLs (spec 16 / the UC
  metadata initiative) so "sensitive" is declared once. Emit the `ALTER ... SET MASK` / masking
  SQL into the per-env metadata SQL (alongside `contract_metadata_{env}.sql`).
- Acceptance: a column flagged sensitive emits the mask SQL; unflagged columns are untouched;
  generated SQL is idempotent. (Coordinate with the UC-metadata generator so it's one publish step.)

## 5. React Query devtools overlay (dev-only QoL)
- Add `@tanstack/react-query-devtools` mounted **dev-only** (gated on `import.meta.env.DEV`) in the
  app shell, so the cadence/caching behaviour (staleTime/refetchInterval per the wall-display
  pattern) is inspectable during development. Zero production impact.
- Acceptance: devtools render in dev, absent in the production bundle; tsc/eslint clean.

## 6. Master Data Health workspace (promotes the parked master-data-quality monitor)
The largest item — a small read-only workspace surfacing master-data completeness/validity.
- Gold: a `gold_master_data_health` aggregate over the silver reference tables (`material`,
  `plant`, `customer`, `vendor`, `material_uom_conversion`, `recipe_process_line`,
  `material_allergen`, `batch_master`) — per-table row counts, key-null rates, orphan/coverage
  metrics (e.g. % materials with a UoM conversion, % with an allergen classification, % batches
  with expiry). Deterministic (no wall-clock). Read-only/advisory.
- App: a small workspace/view (KPI strip + per-table health table). House pattern: contract + OKF
  + consumption view + adapter + registration. ⚠ This part touches the shared wm-gold files
  (manifest/views/security SQL) so it **serialises at merge** with the in-flight Foundation (16)
  + push-despatch (14) builds — expect the regen-rebase loop.
- Acceptance: health metrics reconcile by hand for a fixture; deterministic; read-only.

## Build notes
- Items 1–4 are CI/Python/SQL (disk-comfortable, offline-validatable). Item 5 is dev-frontend
  (tiny). Item 6 is the full-stack one (serialises at merge). Build 1–2 first (highest value).
- Drift-safe dispatch; no `pnpm install` under the tight disk — frontend (5, and 6's view) tsc
  validates in CI. Run the full offline guard battery; the new `check_generated_artefacts_fresh.py`
  must stay green.
