# ADR 0005 — Import and Alignment of ConnectIO-RAD-v2

## Status

Accepted

## Context

PR 2 restructured the repository into the intended monorepo shape. Before importing `connectio-rad-v2`, the scaffold was hardened in PR 3. Now, we are importing the application codebase `connectio-rad-v2` into the `connected-operations-intelligence` monorepo.

This is an exercise in aligning two distinct codebases (the Databricks DLT pipeline data-product layer and the React/FastAPI application layer) into a unified, governed monorepo.

We need to establish a clear mapping from the source repository paths to the new monorepo layout while maintaining strict architectural boundaries.

## Decision

We will import the application code and shared packages from `connectio-rad-v2` directly into their conformed monorepo locations.

The mapping of imported directories is as follows:
- `apps/web` → `apps/web` (React frontend)
- `apps/api` → `apps/api` (FastAPI backend/runtime)
- `packages/design-system` → `packages/ui` (Shared UI library)
- `packages/product-model` → `packages/domain-models` (Domain types)
- `packages/data-contracts` → `packages/data-contracts` (TypeScript schemas and clients, combined with conformed generated JSON/TS data contracts under `src/generated/io-reporting`)
- All other packages in `packages/*` → `packages/*`
- All domain integration packages in `domain-integrations/*` → `domain-integrations/*`

This import is strictly structural. We do not perform any immediate functional rewrite or change of the business logic of either repository.

## Consequences

- The two distinct codebases now coexist inside a single monorepo repository.
- Node.js dependencies are managed globally and per-package using `pnpm` workspaces.
- FastAPI Python dependencies remain isolated within the `apps/api` directory to prevent cross-contamination.
- Developers and agents must strictly respect the data boundary: the application layer (`apps/web`, `apps/api`) must only access data using approved, contract-backed consumption views and the generated schemas in `packages/data-contracts`. Direct querying of Bronze/Silver/raw SAP/internal Gold tables is strictly forbidden.
