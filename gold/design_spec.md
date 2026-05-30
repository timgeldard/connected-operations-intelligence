# Gold Layer Design Specification

**Schema:** `connected_plant_uat.gold`  
**Data product:** Integrated Operations — Business Aggregations & KPIs  
**Primary personas:** Plant Manager, Supervisor, Operations Analyst  
**Source:** `connected_plant_uat.silver` (parameterized — see Deployment)

---

## Architecture

```
connected_plant_uat.silver (Silver — clean operational state tables)
          │
          │  Batch / Triggered read (spark.read.table)
          ▼
   Delta Live Tables Pipeline (gold_pipeline)
   Mode: Triggered (batch)
   Target catalog: connected_plant_uat
   Target schema: gold
          │
          └─ Gold tables (Materialized Views)
               Liquid clustering by plant_code + date dimensions
               Change Data Feed enabled
          │
          ▼
   connected_plant_uat.gold
```

### Key design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Pipeline mode | **Triggered (batch)** | More cost-effective for business-level aggregations; near-real-time is not required for OEE/OTIF KPIs |
| Dataset types | **Materialized Views** | Auto-recomputes aggregations to stay correct as Silver tables receive updates |
| Read strategy | **Batch read** (`spark.read.table`) | Prevents streaming state-management overhead for aggregations on streaming tables |
| Clustering | **Liquid clustering** on `plant_code` + dates | Ensures fast retrieval for dashboard queries filtering by plant or time periods |

---

## Deployment

Managed via Declarative Automation Bundle (DAB).

```
resources/
  gold_pipeline.pipeline.yml      # Triggered serverless pipeline definition
gold/
  dlt_gold_pipeline.py            # All gold table definitions
```

---

## Table Catalogue

### `gold_shift_output_summary`
- **Granularity:** 1 row per plant × posting date × material × UOM.
- **Description:** Aggregated produced quantity (receipt type 101 minus reversals 102) and scrap quantity (movements 551/552) to report shift-level outputs.

### `gold_order_otif_metrics`
- **Granularity:** 1 row per process order.
- **Description:** On-Time-In-Full performance metrics, comparing actual vs scheduled completion dates and ordered vs yield quantities.

### `gold_plant_oee_kpis`
- **Granularity:** 1 row per plant.
- **Description:** Summarizes production volumes, scrap, total downtime, and computes overall quality rate.
