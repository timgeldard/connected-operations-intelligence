# ADR 0002: Data Contract Boundary and Manifest Schema

## Status
Accepted

## Context
As decided in ADR 0001, we enforce a strict boundary between Databricks DLT pipelines and the application layer. To maintain this boundary, we need a formalized schema definition (data contract) for each dataset exposed to the application.

Previously, the contract definition was basic (supporting only id, description, version, source_view, and field list). As the application grows to support production operational scenarios (like plant-level security filtering, SLA alerting, and client-side validation), we need to expand the contract manifest schema to capture these requirements explicitly.

## Decision
We will define and enforce a comprehensive, YAML-based data contract manifest format. Each contract will be registered in `data-products/io-reporting/contracts/app_contract_manifest.yml` and will define:

1. **Identity & Metadata**: Unique ID, semantic version, domain, owner, and lifecycle state (`draft`, `approved`, `deprecated`).
2. **Operational Grain**: Precise description of the dataset grain and its primary key fields.
3. **Freshness SLAs**: Expected, warning, and critical refresh intervals in minutes to monitor data health.
4. **Access Control Policy**: Required plant-level filtering keys and their corresponding entitlement source views.
5. **Strictly Typed Schema**: Supported type types (string, integer, double, date, timestamp, boolean, etc.) with detailed description, unit, and requirement constraints.

The contract manifest will be processed by generator scripts to output:
* `contract.json` (raw definitions for registry use)
* `contract.ts` (TypeScript interfaces for compile-time safety in frontend/API)
* `contract.zod.ts` (Zod schemas for runtime API response validation)
* `contract.openapi.json` (OpenAPI definitions for API documentation)
* `mock-data.ts` (mock datasets for isolated frontend development)
* `contract-registry.ts` (manifest registry metadata)

## Consequences
- **Strong Safety Guarantees**: API routes will validate Databricks query results using generated Zod schemas, shielding the application from unexpected schema changes or null values.
- **Improved Monitoring**: Freshness SLAs declared in the contract are inspectable by both Databricks validation checks and the Web UI (via freshness badges).
- **Independent Frontend Work**: Frontend developers can build UI features using auto-generated mocks before the underlying data pipelines or views are fully deployed.
