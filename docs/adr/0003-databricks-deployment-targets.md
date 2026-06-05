# ADR 0003: Databricks Deployment Targets and Environment Isolation

## Status
Accepted

## Context
Deploying Delta Live Tables (DLT) pipelines and jobs across different development and testing environments requires clear isolation. We must ensure that developer experimentation, automated CI checks, UAT, and production run on distinct compute and storage catalogs without interfering with each other or leaking sensitive data.

## Decision
We will standardize on four distinct Databricks Asset Bundle (DAB) deployment targets within `databricks.yml`:

1. **`dev_sample`**:
   - **Purpose**: Developer testing and local bundle validation.
   - **Source/Target**: Reads from sample/stub directories instead of production/UAT source systems to minimize compute costs and data dependency.
   - **Mode**: Development mode (cluster stays active or auto-terminates quickly, logs are verbose).

2. **`dev_uat_source`**:
   - **Purpose**: High-fidelity developer testing using UAT-level source data.
   - **Source/Target**: Reads from UAT source catalog but writes to personal developer schemas/catalogs.

3. **`uat`**:
   - **Purpose**: User Acceptance Testing and QA.
   - **Source/Target**: Reads from UAT source and writes to UAT target catalog.
   - **Mode**: Production mode (runs on scheduled or continuous jobs, optimized clusters).

4. **`prod`**:
   - **Purpose**: Live production workload.
   - **Source/Target**: Reads from production source and writes to production target catalog.
   - **Mode**: Production mode.

## Consequences
- **Environment Safety**: Developers cannot accidentally overwrite production or UAT schemas during bundle deployments.
- **Resource Management**: Bundle configuration remains DRY (Don't Repeat Yourself) by sharing common resource definitions and overriding catalog parameters per target.
- **Cost Control**: `dev_sample` runs on smaller, auto-terminating clusters and uses subsetted data.
