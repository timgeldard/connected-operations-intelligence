# Security & Consumption Model

This document defines the security and consumption model for the IOReporting data product, ensuring that raw tables are isolated and business users access only verified, secured, and ready data.

## 1. Object Access Model

To maintain data security, prevent unauthorized cross-plant data exposure, and ensure users consume only production-ready logic, access is restricted according to the table below:

| Object Type | Access Scope | Intended Audience | Description |
|---|---|---|---|
| **Bronze SAP Replicas** | Read-Only (Restricted) | Data Engineers, Service Principals | Direct, raw replicas of source SAP ECC tables. No business logic. |
| **Raw Silver Tables** | Read-Only (Restricted) | Data Engineers, Service Principals, Power Users | Cleaned, conformed, and standardized domain tables. |
| **Raw Gold MVs/Tables** | No Public Access | Data Engineers, Service Principals | Internal aggregated tables. Not row-filtered or date-trimmed. |
| **Secured Gold Views** | Read-Only (Public) | Business Users, Power BI, Genie Spaces | Row-level secured (RLS) views applying `plant_access_filter`. |
| **Live Gold Views** | Read-Only (Public) | Business Users, Power BI, Genie Spaces | Secured views with date-relative calculations computed at query time. |
| **Readiness Tables** | Read-Only (Public/Admin) | Data Owners, Platform Teams, Dashboard Admins | Validation failure evidence, readiness scores, and configuration coverage. |

---

## 2. Naming Conventions

All Gold and readiness objects follow a strict naming standard to make their security and consumption tier obvious:

| Pattern | Example | Purpose |
|---|---|---|
| `gold_<subject>` | `gold_transfer_order_performance` | Internal MV / Table (Unfiltered, Raw) |
| `gold_<subject>_secured` | `gold_transfer_order_performance_secured` | Row-Level Secured (RLS) consumption view |
| `gold_<subject>_live` | `gold_lineside_stock_live` | Secured view + date-relative logic computed at query time |
| `gold_<subject>_readiness` | `gold_plant_readiness_status` | Readiness or validation-related view / table |

---

## 3. Required Security Controls and Auditing

To enforce this boundary, the following audit controls must be implemented:

1. **MV Selection Block**: No broad business group or general user must have `SELECT` privilege on any raw `gold_<subject>` materialized view or table. Access to raw Gold tables must be revoked from the `users` group.
2. **Serving Layer Enforcement**: All Power BI semantic models, Databricks dashboards, and Genie spaces must target either the `_secured` or `_live` views. They must never query the raw tables directly.
3. **Genie and App Isolation**: Genie spaces must be configured using the serving view schema or specific views, preventing LLMs from querying the raw tables.
4. **Access Logging**: Access to raw Gold tables must be audited and reviewed periodically to ensure no service accounts or dashboards are bypassing the secured boundary.

---

## 4. Approved Consumption Paths

### For Standard Aggregate/Performance Reporting
Users and dashboards should query the `_secured` views:
```sql
SELECT * FROM connected_plant_prod.gold.gold_transfer_order_performance_secured;
```

### For Date-Relative Reporting (e.g. Backlog, Expiry Risk, Lineside Stock)
Dashboards requiring real-time relative day offsets must use the `_live` views:
```sql
SELECT * FROM connected_plant_prod.gold.gold_lineside_stock_live;
```

### For Readiness and Data Product Health
Dashboard administrators can query readiness views to display data health summaries:
```sql
SELECT * FROM connected_plant_prod.gold.gold_plant_readiness_status;
```
