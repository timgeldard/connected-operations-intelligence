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
2. **Unity Catalog Grants**: Access to raw, Bronze, Silver, or Gold tables must not be granted to the application runtime service principles directly. Permissions should only be granted to the `vw_consumption_*` and `vw_genie_*` views under audited schemas.
3. **Secret Management**: Do not commit secrets, tokens, or passwords to git. Use Databricks Secret Scopes or environment variables in the application configuration.
