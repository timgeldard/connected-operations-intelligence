# Contributing to Connected Operations Intelligence

Thank you for contributing to this monorepo! This repository is an exercise in aligning two distinct codebases (the Databricks DLT pipeline data-product layer and the React/FastAPI application layer) into a single, unified, and governed monorepo.

Please read the following guidelines to ensure a smooth development and review process.

---

## 🔒 Core Architectural Rule

> [!IMPORTANT]
> **Application code (including `apps/web` and `apps/api`) must not directly query raw SAP source tables, Bronze ingestion tables, Silver DLT tables, or Gold pipeline aggregates.**
>
> All application-facing data must be exposed through approved **IOReporting data contracts** and queried strictly via:
> 1. Approved `vw_consumption_*` Unity Catalog views.
> 2. Curated `vw_genie_*` views.

---

## 🌿 Branching Model

We follow a structured branching model:

* **`main`**: The protected default branch. No direct pushes are allowed. All changes must go through a pull request.
* **Feature & Integration Branches**:
  * `import/io-reporting` - Data product layer migrations.
  * `import/connectio-rad-v2` - Application layer migrations.
  * `feature/*` - General feature development (e.g. `feature/contracts-v1`, `feature/apps-api-shell`).

### Pull Request & Merge Policy

1. Create a branch off `main` following the naming convention.
2. Ensure all local validation tests pass before pushing.
3. Open a Pull Request targeting `main`.
4. The PR requires:
   * CI checks to pass.
   * At least one approval from a code owner.
5. Merge via squash commit.

---

## 🛠️ Local Development & Validation

Before submitting a Pull Request, please run the full suite of verification checks.

### Setup

Install the Node.js monorepo workspace dependencies and Python virtual environment:

```bash
make install
```

### Formatting, Linting, & Typechecking

We run checks across both TypeScript packages and Python/DLT assets:

```bash
# Run code linting (Prettier, ESLint, Ruff)
make lint

# Run TypeScript typechecks
make typecheck
```

### Running Tests

We run tests for both python DLT pipelines and frontend/API components:

```bash
make test
```

### Data Contracts Validation and Generation

If you modify the data contracts manifest:

```bash
# Validate and generate typescript interfaces, zod schemas, openapi specifications
make contracts
```

Ensure all generated files are committed and in sync with the manifest.
