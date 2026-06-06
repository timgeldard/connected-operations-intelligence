# Connected Operations Intelligence

Welcome to the internal monorepo for **Connected Operations Intelligence**, bringing together the pre-production code for data engineering pipelines and the application runtime layer.

> [!NOTE]
> This repository is an exercise in aligning two distinct codebases (the Databricks DLT pipeline data-product layer and the React/FastAPI application layer) into a single, unified, and governed monorepo.

This monorepo contains:

- **IOReporting** ([data-products/io-reporting](data-products/io-reporting)) — the governed SAP/Databricks data product layer.
- **Application Layer** — the React frontend, FastAPI backend/runtime, and domain integrations imported from the `connectio-rad-v2` codebase (`apps/web`, `apps/api`, `packages/*`, and `domain-integrations/*`).

---

## 🏗️ Repository Layout

The repository is organized as a monorepo using `pnpm` workspaces for frontend/Node.js packages and standard paths for Python:

```
├── .github/workflows/              # CI/CD Workflows
├── apps/
│   ├── api/                        # FastAPI backend/runtime layer
│   └── web/                        # React frontend layer
├── data-products/
│   └── io-reporting/               # Databricks DLT Data Pipelines (SAP -> Silver -> Gold)
├── docs/                           # Documentation Library
│   ├── adr/                        # Architectural Decision Records (ADRs)
│   ├── architecture/               # Technical designs, security models, ingestion flows
│   ├── data-contracts/             # Existing data contract mappings and freshness contracts
│   ├── deployment/                 # Deployment guides, hardening plan, reconciliation controls
│   ├── product/                    # Product roadmap, business rules, user stories, index
│   └── runbooks/                   # Runbooks for operations and onboarding
├── domain-integrations/            # Domain integrations / adapters
│   ├── operations/
│   ├── quality/
│   ├── spc/
│   ├── traceability/
│   └── warehouse/
├── packages/                       # Shared packages inside the workspace
│   ├── config/                     # Shared configurations
│   ├── data-contracts/             # Approved client-facing data contract schemas and types
│   ├── domain-models/              # Domain entities and business model schemas
│   ├── queryspecs/                 # Query specifications and filter logic builders
│   └── ui/                         # Shared UI component library
├── scripts/                        # Repository helper and automation scripts
│   ├── ci/                         # CI-specific scripts
│   └── contracts/                  # Contract validation and code generation scripts
└── tests/                          # Monorepo-level test suites
    ├── contract/                   # Contract conformance tests
    ├── e2e/                        # End-to-end tests
    └── integration/                # Integration tests
```

---

## 🔒 Data Boundary and Architectural Rules

To ensure performance, data integrity, and strict adherence to security and governance protocols, we enforce a strict **data boundary** between data pipelines and application code:

> [!IMPORTANT]
> **Core Architectural Rule:**
> Application code (including `apps/web` and `apps/api`) **must not** directly query raw SAP source tables, Bronze ingestion tables, Silver DLT tables, or Gold pipeline aggregates.
>
> All application-facing data must be exposed through approved **IOReporting data contracts** and queried strictly via:
> 1. Approved `vw_consumption_*` Unity Catalog views.
> 2. Curated `vw_genie_*` views.

### Rationale
- **Decoupling Schema Evolution:** Moving DLT internal tables (Silver/Gold) should not break application code.
- **Access Control & Row-Level Security:** Entitlements and row-level security filters (e.g., plant-level restrictions) are applied and verified at the consumption view layer.
- **Contract Conformance:** Standardizing on generated data contracts avoids runtime validation surprises.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- `pnpm` (v8+ recommended)
- Python (v3.11+)
- Databricks CLI (v0.288.0+ for DLT deployment)

### Setup & Installation
Install all Node.js and Python dependencies:
```bash
make install
```

### Running Checks
Run formatting, linting, typechecking, and tests:
```bash
make lint
make typecheck
make test
```

### Contracts Validation and Generation
Generate JSON and TypeScript contracts from the data contracts manifest:
```bash
make contracts
```
