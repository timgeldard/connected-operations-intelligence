# Claude Design POC Consolidation Plan

This repository should be treated as the place where strong Claude Design POCs
become coherent consumer applications on top of governed app-facing contracts.
The legacy integration layer was useful experimentation, but it is not the
product direction and should not dominate planning.

## Direction

The product motion is:

1. Design the best user experience in Claude Design or a similar rapid design
   environment.
2. Bring the strongest POCs into the repo as first-class consumer apps.
3. Bind those apps to typed app-facing contracts where data is ready.
4. Surface caveats where data is partial, static, mock, calculated, or
   governance-pending.
5. Let the governed data layer catch up behind the app without forcing the app
   back into legacy-screen parity.

## What changes from the previous approach

| Old centre of gravity | New centre of gravity |
|---|---|
| Preserve or bridge legacy screens. | Consolidate designed POCs into coherent apps. |
| Treat frontend as a reference consumer. | Treat frontend as the primary product experience. |
| Organise work by adapter/route parity. | Organise work by user journey and app maturity. |
| Panels own query, evidence state, and visual layout. | App views own experience; controllers/data bindings provide typed props and caveats. |
| Legacy availability drives app shape. | User experience drives app shape; data maturity determines visible caveats. |

## Architecture target

Designed applications should be registered separately from low-level workspace
navigation. A consumer-app registry records:

- the source of the design POC
- the user job-to-be-done
- current app-experience maturity
- current data-product maturity
- whether data is static, mock-contract, API-contract, or governed-live
- caveats that must be visible in the app
- artifact paths for briefs, screenshots, or imported POC files

This keeps the repo honest: a beautiful POC can advance as an app experience
without pretending its data products are production-ready.

## Execution sequence

### Phase 1 - Inventory and register designed apps

- Add a `ConsumerApplicationRegistration` model.
- Create a `consumerAppRegistry` alongside `workspaceRegistry`.
- Register the current designed/POC-derived experiences:
  - Batch Traceability / `trace-consumer`
  - ConnectedQuality Lab Board / `connected-quality-lab-board`
  - Warehouse 360 Cockpit / `warehouse-360-overview`
  - SPC Monitoring / `spc-monitoring`

### Phase 2 - Stabilise the app assembly seam

- Stop using legacy parity as the default acceptance test for designed apps.
- For each app, define the narrow data-binding contract the designed view needs.
- Keep data caveats as product-facing UI requirements, not backend footnotes.
- Prefer typed API contracts or static/mock contracts over importing legacy
  adapter internals into designed components.

### Phase 3 - Extract designed views from wiring

- Split large POC files into:
  - `*.app.tsx` or `*.view.tsx` for visual/interaction design
  - `*.bindings.ts` for typed data mapping
  - `*.caveats.ts` for visible trust/caveat copy
- Keep the designed view replaceable without editing route/proxy/adapter code.

### Phase 4 - Replace hardcoded shell mounting

- Move from `WorkspaceViews.tsx` switch statements toward app/workspace
  registration-driven mounting.
- Preserve explicit exceptions only where there is a real shell-level need.

### Phase 5 - Data layer catches up behind the app

- Add or mature data products only from app-facing contract needs.
- Avoid adding legacy routes unless they are explicitly needed for a current app
  and have a route-readiness spec.
- Treat old legacy adapters as optional migration scaffolding, not the source of
  truth for what the app should become.

## Implemented slices

This branch implements Phase 1 groundwork:

- adds consumer-application registration types to `@connectio/product-model`
- adds an app-level registry for the current Claude Design/POC-derived
  experiences in `apps/web`
- documents the revised execution path away from legacy parity and toward POC
  consolidation
- starts the Trace Consumer pilot split under `domain-integrations/traceability/src/trace-consumer/`
  by extracting search fixtures, typed bindings, caveat copy, and workspace
  registration from the monolithic designed workspace
- adds the ConnectedQuality Lab Board standalone Claude export as a fullscreen
  adapter-wired POC screen under `domain-integrations/quality/src/lab-board-standalone/`,
  including a live plant filter defaulting to C351 for UAT checks

## Review checklist

- Does the PR improve the path from designed POC to mounted app?
- Does it avoid over-investing in legacy parity?
- Are app maturity and data maturity tracked separately?
- Are caveats visible requirements for the user experience?
- Can the visual app evolve without rewriting data-layer plumbing?
