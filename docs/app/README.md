# ConnectIO V2 — Architecture Overview

> [!NOTE]
> This repository is an exercise in aligning two distinct codebases (the Databricks DLT pipeline data-product layer and the React/FastAPI application layer) into a single, unified, and governed monorepo.

ConnectIO V2 replaces the legacy app-centric launcher (Trace, SPC, EnvMon, POH, Warehouse360) with a
workspace-first operational platform. Users navigate by jobs-to-be-done — "Trace a batch", "Release a
process order", "Review SPC alarms" — and the shell assembles the relevant evidence panels automatically.
App names become internal implementation details; domain-integration packages contribute workspaces to a
shared registry rather than exposing standalone entry points.

## Package DAG

```
product-model ──► data-contracts
                          │
telemetry   feature-flags │
     │                    ▼
     └──────► design-system ◄── (shadcn/Radix — contained here only)
                          │
              auth-scope  personalization
                    │           │
                    └─────┬─────┘
                          ▼
              evidence-panel-runtime
                          │
                          ▼
               workspace-runtime
                          │
                          ▼
             domain-integrations/*
                          │
                          ▼
                       apps/web
                       apps/api (Python FastAPI — independent)
```

## Folder Structure

```
packages/                  10 shared TypeScript packages
  auth-scope/              Permission checking and scope resolution
  data-contracts/          Zod schemas and inferred types shared across the stack
  design-system/           Kerry-branded shadcn/Radix components (boundary enforced)
  evidence-panel-runtime/  7-state display machine and panel host components
  feature-flags/           Flag evaluation hooks
  personalization/         Pinned and recent workspace persistence
  product-model/           WorkspaceRegistration, EvidencePanelRegistration, lifecycle helpers
  python-db/               Python shared_db package (Databricks SQL executor)
  source-adapters/         Typed adapters for upstream data sources
  telemetry/               Structured event logging
  workspace-runtime/       WorkspaceProvider, WorkspaceContext, layout components

domain-integrations/       8 domain-integration packages
  analytics/
  envmon/
  maintenance/
  operations/
  quality/
  spc/
  traceability/
  warehouse/

apps/
  web/                     React 18 + Vite unified shell (http://localhost:4200)
  api/                     Python FastAPI backend — Databricks Apps (http://localhost:8000)

docs/
  README.md                This file
  adr/                     Architecture Decision Records
```

## How to Run

```bash
# Install TypeScript dependencies
npm install

# Dev server — shell at http://localhost:4200
npx nx run web:dev

# API server — at http://localhost:8000
cd apps/api && uvicorn main:app --reload --port 8000

# Storybook — design-system component catalogue
npx nx run design-system:storybook

# All TypeScript tests
npm run test

# Python tests
cd apps/api && uv run pytest
```

## How to Test

```bash
# Unit tests — pure logic packages
npx vitest run packages/product-model packages/data-contracts

# Component tests — runtime packages
npx vitest run packages/evidence-panel-runtime packages/workspace-runtime

# E2E smoke suite
npx playwright test --grep @smoke

# Python API tests
cd apps/api && uv run pytest
```

## Boundary Rules

**Design system**: All `@radix-ui/*`, `clsx`, `tailwind-merge`, and `lucide-react` imports are confined to
`packages/design-system`. All other packages and apps import from `@connectio/design-system` only. A
`no-restricted-imports` ESLint rule enforces this boundary at typecheck time.

**Cross-integration imports**: Domain-integration packages (`domain-integrations/*`) must not import from
each other. Each integration depends on shared packages only. Cross-domain data flows through the workspace
shell via `WorkspaceContext` and `EvidencePanelRegistration.allowedConsumerWorkspaces`.

**Panel dependency direction**: Evidence panels (`evidence-panel-runtime`) must not import from
`workspace-runtime`. The dependency is strictly one-way — workspaces host panels, panels do not reference
workspaces.

**Databricks SQL**: All SQL execution uses `packages/python-db` (`shared_db`). Direct `import databricks`
is prohibited in application code.
