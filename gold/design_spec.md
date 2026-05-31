# Gold Layer Design Specification

**Schema:** `${var.catalog}.${var.gold_schema}`  
**Data product:** Integrated Operations — Business Aggregations & KPIs  
**Primary personas:** Plant Manager, Supervisor, Operations Analyst  
**Source:** `${var.catalog}.${var.schema}` (parameterized — see Deployment)

---

## Architecture

```
${var.catalog}.${var.schema} (Silver — clean conformed tables)
          │
          │  Batch / Triggered read (spark.read.table)
          ▼
   Delta Live Tables Pipeline (gold_pipeline)
   Mode: Triggered (batch)
   Target catalog: ${var.catalog}
   Target schema: ${var.gold_schema}
          │
          └─ Gold tables (Materialized Views)
               Liquid clustering by plant_code + date dimensions
               Change Data Feed enabled
          │
          ▼
   ${var.catalog}.${var.gold_schema}
```

### Key design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Pipeline mode | **Triggered (batch)** | More cost-effective for business-level aggregations; near-real-time is not required for KPIs |
| Dataset types | **Materialized Views** | Auto-recomputes aggregations to stay correct as Silver tables receive updates |
| Read strategy | **Batch read** (`spark.read.table`) | Prevents streaming state-management overhead for aggregations on streaming tables |
| Clustering | **Liquid clustering** on `plant_code` + dates | Ensures fast retrieval for dashboard queries filtering by plant or time periods |
| Security/performance tradeoff | **Read row-filtered Silver tables** | Silver remains secure for direct access. Databricks may full-refresh Gold MVs sourced from row-filtered tables; monitor refresh cost before widening Gold scope. |

---

## Deployment

Managed via Declarative Automation Bundle (DAB).

### Environment Target Matrix

| Target | Output Catalog (`${var.catalog}`) | Silver Schema (`${var.schema}`) | Gold Schema (`${var.gold_schema}`) | Source Catalog (`${var.source_catalog}`) | Source Schema (`${var.source_schema}`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **dev_uat_source** | `connected_plant_dev` | `silver_dev` | `gold_dev` | `connected_plant_uat` (Compromise) | `sap` |
| **dev_sample** | `connected_plant_dev` | `silver_dev` | `gold_dev` | `connected_plant_dev` | `sap_sample` |
| **uat** | `connected_plant_uat` | `silver` | `gold` | `connected_plant_uat` | `sap` |
| **prod** | `connected_plant_prod` | `silver` | `gold` | `connected_plant_prod` | `sap` |

---

## Table Catalogue

### `gold_shift_output_summary`
- **Granularity:** 1 row per plant × posting date × material × UOM.
- **Description:** Aggregated daily produced quantity (receipt type 101 minus reversals 102) and scrap quantity (movements 551/552). The historical table name is retained for compatibility; no shift dimension is present until a shift calendar is introduced.

### `gold_order_otif_metrics`
- **Granularity:** 1 row per process order.
- **Description:** Internal process-order schedule-adherence metrics, comparing actual vs scheduled completion dates and ordered vs yield quantities. This is not customer-delivery OTIF.

### `gold_plant_production_quality_summary`
- **Granularity:** 1 row per plant.
- **Description:** Summarizes production volumes, scrap, total downtime, and computes overall quality rate (yield / (yield + scrap)).
