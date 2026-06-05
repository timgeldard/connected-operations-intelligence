# ADR 0001: Monorepo Boundary and Data Access Architecture

## Status
Accepted

## Context
Prior to this decision, the **IOReporting** data pipelines (Databricks DLT) and
the **connectio-rad-v2** application (React frontend, Node/TypeScript API) resided
in separate repositories. While developing them independently allowed fast initial
iterations, it introduced several friction points:
1. Out-of-sync schema changes between the pipelines (Gold aggregates) and the application.
2. Inconsistent definitions of data contracts and API types.
3. Complex multi-repo CI/CD workflows and deployment synchronization.

To address these challenges, we are merging both repositories into a single monorepo
named `connected-operations-intelligence`.

## Decision
We will consolidate both codebases into a single monorepo, using `pnpm` workspaces
for frontend/Node.js packages and standard directories for Python. However, we
will maintain a **strict logical boundary** between data pipelines and application
code.

### Monorepo Structure
- `data-products/io-reporting/`: Contains the Databricks Delta Live Tables (DLT)
 data pipelines and internal pipeline unit tests.
- `apps/web` & `apps/api`: Contains the application runtime layer.
- `packages/data-contracts/`: Contains the generated schemas and types representing
the approved boundary contracts.

### Strict Data Boundary Rule
> [!IMPORTANT]
> **Application code (in `apps/` or `packages/`) is strictly prohibited from directly
querying raw SAP tables, Bronze ingestion tables, Silver DLT tables, or Gold pipeline
aggregates.**

All application-facing data must be exposed through approved **IOReporting contracts**
defined in the contract manifest (`data-products/io-reporting/contracts/app_contract_manifest.yml`).

The application layer must query data strictly through:
1. **Consumption Views (`vw_consumption_*`)**: Curated, row-level-secured views
exposed by Unity Catalog.
2. **Genie Views (`vw_genie_*`)**: Curated semantic views intended for natural language/Genie
integration.

## Consequences
- **Loose Coupling:** The DLT pipeline implementation can evolve (e.g., refactoring
Silver/Gold tables, changing indices, optimization) without breaking the application
runtime, provided the consumption views and contract interfaces remain stable.
- **Contract Enforcement:** Contract definitions are validated in CI and generated
as client-ready JSON and TypeScript types inside `packages/data-contracts`, serving
as a single source of truth.
- **Enhanced Security:** Row-level security and plant-level entitlements are enforced
at the consumption view layer, preventing civilian data access bypasses from the
application.
- **Unified CI:** Single-source validation ensures contract changes are checked
against the application types on every PR.
