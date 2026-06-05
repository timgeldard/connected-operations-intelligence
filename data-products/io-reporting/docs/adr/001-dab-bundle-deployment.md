# ADR-001: Deploy pipeline via Declarative Automation Bundle (DAB)

**Status:** Accepted  
**Date:** 2026-05-30

## Context

The silver pipeline needs a repeatable, version-controlled deployment mechanism. Options considered:

1. **DLT UI / manual configuration** — configure each pipeline setting by hand in the Databricks UI; no version history, no multi-environment support.
2. **Terraform** — full infrastructure-as-code; requires maintaining a Terraform state backend and provider version, adds external dependency.
3. **Declarative Automation Bundle (DAB)** — Databricks-native bundle format; version-controlled YAML, multi-target (dev/prod), deployed via the Databricks CLI.

## Decision

Use a DAB bundle (`databricks.yml` + one pipeline resource file per pipeline in `resources/`).

## Consequences

- Pipeline settings (catalog, schema, mode, notifications, restart window) are version-controlled alongside the transformation code.
- Dev and prod targets are explicit; `schema: silver_dev` for dev provides write isolation.
- `databricks bundle validate` catches configuration errors before deploy.
- Requires Databricks CLI ≥ v0.288.0.
- No Terraform state backend to manage.
- The `source_catalog` / `source_schema` variables allow overriding the bronze source per target once a dev bronze exists.
