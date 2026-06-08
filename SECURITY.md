# Security Policy

## Supported Versions

Only the current `main` branch is supported for security updates. 

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please do not report it in public issues. Instead, report it by emailing the project maintainers directly (e.g. `@timgeldard` or internal security contacts).

Please include:
* A description of the vulnerability.
* Steps to reproduce the issue.
* Any potential impact or exploit scenarios.

We will acknowledge receipt of your vulnerability report within 48 hours and work with you to resolve it.

## Data Access and Permissions Security

To maintain security boundaries between the data engineering and application layers:
1. **Row-level security (RLS)**: Plant-level restrictions must be applied via approved row-level filter expressions.
2. **Unity Catalog Grants**: Access to raw, Bronze, Silver, or Gold **base** tables must not be granted to the `users` consumer group or the application runtime service principals directly. Consumer access flows only through governed views: the plant-scoped `gold_io_reporting` `*_secured` views (which enforce row-level security and are the layer the `vw_consumption_*` views build on) and the `vw_consumption_*` / `vw_genie_*` views under audited schemas. Enforced in CI by `scripts/ci/check_gold_grants_policy.py`, which fails if any `GRANT ... TO \`users\`` targets a base Gold table rather than a `*_secured` / `vw_consumption_*` / `vw_genie_*` view (or a table explicitly listed as a documented exception in that guard).
   - **Readiness / validation tables** (`gold_*readiness*`, `gold_*validation*`, `gold_*coverage*`, …) are platform-health data and are **not** consumer-granted in the first wave. The earlier `access_grants_{uat,prod}.sql` grants on the `gold` schema were removed in 2026-06: they targeted a schema where those tables do not live (they deploy to `gold_io_reporting`) and contradicted this rule. If one is genuinely needed by a dashboard, expose it through a `*_secured` view (plant-scoped) — or, for genuinely plant-agnostic platform-health data, add it to the documented-exception list in the grants guard with a rationale — never a direct base-table grant.
3. **Secret Management**: Do not commit secrets, tokens, or passwords to git. Use Databricks Secret Scopes or environment variables in the application configuration.
