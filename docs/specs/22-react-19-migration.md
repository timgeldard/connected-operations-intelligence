# Spec 22 — React 19 Migration (upgrade + take full advantage)

Read `docs/specs/_conventions.md` first. Branch: `feature/react-19`.

## Objective

Move the whole frontend from **React 18.3.1 → React 19** and *leverage* what 19 actually buys a
read-only, react-query-driven dashboard app — not just a version bump. The single biggest win
here is the **React Compiler** (the codebase has **452 `useMemo`/`useCallback` call sites** and
only **7 `forwardRef` files**), so auto-memoization is the headline benefit, not Actions/forms
(which a read-only app barely uses).

Scope: every workspace package — `apps/web`, `domain-integrations/*` (wm-operations, quality,
spc, traceability, warehouse, …), and `packages/*` (ui, workspace-runtime, data-contracts).
Stack today: React 18.3.1, Vite 6, TypeScript ~5.6.3, pnpm 10, RTL 16.3.0 (all React-19-capable).

## Phase 1 — Baseline upgrade (get to green on 19)

1. Bump `react`, `react-dom`, `@types/react`, `@types/react-dom` to 19.x across **all**
   package.json files (root + every workspace); align the pnpm catalog/overrides so a single
   React version resolves (no duplicate React — verify with `pnpm why react`).
2. Handle the real React-19 breaking changes (audit + fix):
   - Removed APIs: `propTypes`/`defaultProps` on **function** components (move to TS defaults),
     legacy string refs, legacy Context (`childContextTypes`), `ReactDOM.render`/`hydrate` and
     `react-dom/test-utils` `act` (use `react-dom/client` `createRoot` / `react` `act`),
     `ReactDOM.findDOMNode`.
   - Stricter types: `ref` is now a regular prop; the JSX namespace moved (`React.JSX`); `useRef`
     now **requires an argument**; `ReactElement` ref typing changes — fix the type fallout.
   - Test libs: confirm RTL 16.3 + the test runner are on React-19-compatible versions; update
     `@testing-library/*` if needed (also closes the pre-existing `vitest`/RTL devDep gaps in the
     `quality` and `spc` packages flagged in the review).
3. **Third-party audit (the real risk):** enumerate every UI/runtime dep that renders React
   (the design-system package, any chart/table/icon libs, react-query, react-router if used) and
   confirm each declares React 19 in peer deps or works; pin/upgrade as needed. Do NOT hand-wave
   this — list them in the report.
4. Gate: `pnpm install` resolves cleanly; `pnpm -r typecheck`, `pnpm -r build`, `pnpm -r test`
   all green on 19. **forwardRef is NOT touched in Phase 1** (it still works in 19 — deprecation,
   not removal).

## Phase 2 — Enable the React Compiler (the headline win)

1. Add `babel-plugin-react-compiler` via the Vite React plugin config (per-package or root),
   targeting React 19. Add `eslint-plugin-react-compiler` and fix any **rules-of-React**
   violations it surfaces (these are real latent bugs — conditional hooks, mutation during
   render, etc.); a clean compiler-eslint pass is the acceptance bar.
2. Verify the compiler is active (build output / `react-compiler-runtime` presence) and that the
   app still behaves identically (the compiler is conservative — it bails out of unsafe
   components rather than miscompiling). Capture a before/after on a couple of heavy views
   (e.g. planning-board, lineside) to confirm no behaviour change.
3. **Then** progressively remove now-redundant manual memoization — but ONLY where the compiler
   demonstrably covers it (don't bulk-delete 452 sites blindly). Prioritise the views with the
   densest manual memoization. Each removal must keep tests green and the compiler-eslint clean.
   This is incremental and can spill into a follow-up PR.

## Phase 3 — Leverage features that fit a read-only dashboard

Adopt where they add real value (skip Actions/`useActionState`/`useOptimistic` — minimal in a
read-only app, beyond maybe the lab-board manual-refresh/filter):
- **`ref` as a prop** → retire the 7 `forwardRef` wrappers (low-risk cleanup).
- **`useTransition` for non-blocking UI** → wrap heavy filter / tab / plant-picker / date-window
  state changes (planning-board, trends, lineside, SPC) so the UI stays responsive while the
  dependent views recompute — a genuine UX win for the big dashboards.
- **Document Metadata** → hoist per-workspace `<title>`/`<meta>` natively (replace any manual
  document.title juggling).
- **`use()`** → tidy conditional context consumption where it simplifies (keep react-query as the
  server-state cache — `use()` complements, not replaces, it; only use `use()` for promises/context
  where it's clearly cleaner).
- **Owner-stack dev diagnostics + ref cleanup callbacks** → adopt opportunistically (better DX).

## Risks & guardrails
- **Single React version** — a duplicate React (two copies in the tree) breaks hooks; assert one
  resolved version after the bump.
- **Third-party compat is the real unknown** — Phase 1 step 3 is the gating audit; if a critical
  dep lags React 19, that dep is the blocker, not React.
- **React Compiler is opt-out-per-component-safe** but new — keep `eslint-plugin-react-compiler`
  as a CI gate; if a package is too noisy, scope the compiler to stable packages first.
- **Don't interleave with the active hardening P1s** (mock-home-data, RLS, contract bypass) — this
  is its own window; it competes for the same review attention (the #167 review's reason for
  originally deferring — overridden by explicit product-owner direction).

## Build sequencing (for the agent)
**First PR = Phase 1 + Phase 2 *enablement*** (on React 19, build/typecheck/test green across all
packages, compiler + its eslint plugin active and clean). The bulk memo-removal (Phase 2 step 3)
and the Phase 3 feature leverage land as **follow-up PRs** so the migration PR stays reviewable.
This is a frontend-wide change → it **requires `pnpm install`** (unlike the Python builds); needs
disk headroom for node_modules.

## Acceptance
- All packages resolve a single React 19, and `pnpm -r typecheck`/`build`/`test` are green.
- React Compiler enabled; `eslint-plugin-react-compiler` clean (rules-of-React violations fixed).
- Third-party React-19 compat audited + recorded; no duplicate React.
- (Follow-up) forwardRef retired (7 files); `useTransition` on the heavy dashboards' filter
  changes; document metadata hoisted; a measurable reduction in manual memo sites with no
  behaviour/perf regression.
