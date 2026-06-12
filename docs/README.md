# Connected Operations Intelligence - Documentation Index

Welcome to the Connected Operations monorepo documentation. The codebase is divided into a strictly governed data pipeline layer (Databricks DLT) and a React/FastAPI application layer.

> [!NOTE]
> Warehouse360 has successfully transitioned from legacy `wh360` runtime views to governed, contract-backed `vw_consumption_warehouse360_*` views.
>
> DEV and UAT validation have successfully passed (revalidated 2026-06-09), and the system is live in `WAREHOUSE360_SOURCE_MODE=governed_contracts` mode.

---

## 1. Platform & Repository Level (`docs/`)

Platform-wide architecture, global standards, validation state, and cross-cutting repository decisions.

* **Architectural Decisions**:
  * [Platform ADRs](adr/) — Conformed architectural decision records (ADRs 0001–0011).
* **Warehouse360 In-Flight Migration & Status**:
  * [Governed Path Status](architecture/warehouse360-governed-path-status.md) — Active status of Warehouse360 migration.
  * [Contract Status](contracts/warehouse360-contract-status.md) — Warehouse360 contracts.
  * [Route-to-Contract Map](contracts/warehouse360-route-to-contract-map.md) — Mapping between app endpoints and contracts.
* **Validation & Runbooks**:
  * [DEV Validation Runbook](runbooks/warehouse360-dev-consumption-view-validation.md) — Running offline schema validation.
  * [UAT Migration Readiness Runbook](runbooks/warehouse360-uat-migration-readiness.md) — Quality checklist for migration progression.

---

## 2. Application Layer (`docs/app/`)

ConnectIO V2 React frontend and FastAPI runtime application architecture, user experience models, and design standards.

* [Application Architecture Overview](app/README.md) — Frontend/backend app structure, environment configuration, and workspace panels.
* [Application ADRs](app/adr/) — UI design, state caching, role awareness, and local data access decisions.

---

## 3. Data Pipeline Layer (`data-products/io-reporting/docs/`)

Databricks Delta Live Tables (DLT) batch and streaming pipelines, SAP ECC ingestion, and reporting aggregation models.

* [Pipeline Architecture & Design Spec](../data-products/io-reporting/silver/design_spec.md) — Silver layer architecture and table catalogue.
* [Pipeline ADRs](../data-products/io-reporting/docs/adr/) — DAB deployment, continuous/triggered modes, and row-level security view policies.
