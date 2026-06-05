# ADR 0004: Scaffold Hardening Before App Import

## Status
Accepted

## Context
The repository was restructured into a monorepo in PR 2. Before importing the `connectio-rad-v2` application, we must ensure the monorepo scaffold is internally consistent, fully validated, and that we have automated guardrails in place. Without a clean, hardened structure, importing a large application codebase poses a risk of introducing incorrect dependencies or violating our architectural boundaries.

## Decision
We will harden the monorepo scaffold before importing any application code. This includes the following corrective actions:
- **Root Documentation**: Update the root `README.md` to use relative repository links, specify the FastAPI backend runtime layer, and clarify that the application codebase has not yet been imported.
- **YAML Contract Manifest**: Update `data-products/io-reporting/contracts/app_contract_manifest.yml` with top-level metadata, versioning, explicit data boundary rules, and align the first draft contract (`warehouse360.overview`) with our conformed naming conventions.
- **Contract Validation**: Strengthen `scripts/contracts/validate_contracts.py` to enforce strict validation of expected freshness SLA bounds, lifecycle categories, non-empty primary keys, unique field names, and consumption view prefixes.
- **Contract Code Generation**: Update `scripts/contracts/generate_contracts.py` to output both TypeScript interfaces and camelCase metadata constants (representing SLAs, keys, views, and policies) to avoid duplicate hardcoding.
- **Makefile Command Alignment**: Simplify root `Makefile` targets to execute commands from the repo root and correct python paths.
- **CI Enforcement**: Align `.github/workflows/ci.yml` so that contract validation and generation drift checks are strict and blocking.

We also intentionally defer the import of `connectio-rad-v2` until this scaffold is verified and merged.

## Consequences
- **Stable Targets**: The application codebase will be imported into clean, validated directories (`apps/web`, `apps/api`, `packages/data-contracts`, `packages/queryspecs`, `packages/ui`, and `domain-integrations/*`).
- **Data Boundary Guarantee**: The contract validation and code generation ensure application developers have auto-generated types and metadata backed strictly by conformed consumption views (`vw_consumption_*`).
- **Reliable Local Tooling**: Developers can run `make install`, `make lint`, `make typecheck`, `make test`, and `make contracts` from the root without directory-switching errors.
