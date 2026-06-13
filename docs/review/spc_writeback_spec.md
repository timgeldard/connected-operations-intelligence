# Position Paper & Specification: Evolving SPC Writebacks & Configurations

This document defines the architectural design, database schemas, and FastAPI/Lakehouse integration blueprints to modernize the **Statistical Process Control (SPC)** writebacks and user configuration persistence. 

It replaces the legacy external V1 SPC proxy with a native, low-latency, and cost-effective **Databricks Lakebase Postgres + Lakehouse Sync** pattern.

---

## 1. Executive Summary

As the ConnectIO platform transitions from a pilot dashboard into a production tool, Statistical Process Control (SPC) charts require interactive operational writebacks:
1. **Control Limit Locking**: Quality engineers must freeze calculated control limits (Mean, Upper Control Limit [UCL], Lower Control Limit [LCL]) for specific Material/Plant/MIC combinations to evaluate subsequent points against static baselines.
2. **User Configuration Persistence**: Operators must save chart layouts, active filters, alert preferences, and visible widgets.

#### **Core Thesis:**
Executing these transactional writes directly against Delta Lake via SQL Warehouses is highly inefficient—leading to high latencies (3–10s), lock contention, and expensive DBU consumption. Conversely, forwarding them to legacy external APIs creates complex integration debt. 

**The Solution:** Use **Lakebase Postgres** for operational reads/writes (sub-50ms latency), and leverage native, zero-DBU **Lakehouse Sync (CDC)** to stream the conformed limits back to Unity Catalog for downstream batch/streaming pipelines.

---

## 2. Technical Architecture & Data Flow

We adopt a **Command Query Responsibility Segregation (CQRS)** pattern. Heavy analytical scans (subgroup measurements) are served directly from Databricks Gold Materialized Views, while transactional updates (locking limits, saving configurations) are written directly to Lakebase Postgres.

```mermaid
flowchart TD
    subgraph Client Layer
        UI[React UI Client] -->|1. Read Analytics| Gold[gold_spc_subgroups]
        UI -->|2. Save Config / Lock Limit| API[FastAPI Gateway]
    end

    subgraph Operational DB Layer (OLTP)
        API -->|3. Low Latency Write| LB[Lakebase Postgres]
        LB -->|spc_locked_limits<br/>spc_user_configs| LBTables[(Postgres Tables)]
    end

    subgraph Lakehouse Layer (OLAP)
        LBTables -->|4. Lakehouse Sync<br/>Native CDC Sync - $0 DBU| UC[(Unity Catalog Delta History)]
        UC -->|5. DLT Pipeline| Silver[silver.spc_locked_limits]
        Silver -->|6. Aggregation Join| Gold
    end
```

---

## 3. Database Schemas (Lakebase Postgres)

These schemas must be created in the `databricks_postgres` database on the target Lakebase branch.

### A. Locked Limits Table
Tracks baseline limit freezes for statistical evaluation. Enables full replica identity to support downstream CDC.

```sql
CREATE TABLE public.spc_locked_limits (
    limit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_code VARCHAR(40) NOT NULL,
    plant_code VARCHAR(10) NOT NULL,
    mic_code VARCHAR(40) NOT NULL,
    operation_code VARCHAR(10) NOT NULL,
    mean_value NUMERIC(12, 4) NOT NULL,
    ucl NUMERIC(12, 4) NOT NULL,
    lcl NUMERIC(12, 4) NOT NULL,
    locked_by VARCHAR(100) NOT NULL,
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_spc_scope UNIQUE (material_code, plant_code, mic_code, operation_code)
);

-- Enable full replication logging to capture old/new states during updates
ALTER TABLE public.spc_locked_limits REPLICA IDENTITY FULL;

-- Index for fast runtime validation checks (updated to include operation_code)
CREATE INDEX idx_spc_limits_lookup ON public.spc_locked_limits (plant_code, material_code, mic_code, operation_code);
```

### B. User Configurations Table
Stores personalized workspace layouts. Utilizes the PostgreSQL `JSONB` data type to support flexible, schema-less UI configurations without needing database migrations.

```sql
CREATE TABLE public.spc_user_configs (
    user_id VARCHAR(100) NOT NULL,
    plant_code VARCHAR(10) NOT NULL,
    config_key VARCHAR(100) NOT NULL,
    config_data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, plant_code, config_key)
);

-- Index for searching within nested JSON parameters
CREATE INDEX idx_spc_user_configs_data ON public.spc_user_configs USING gin (config_data);
```

---

### A. FastAPI Routes ([spc.py](../../apps/api/routes/spc.py))

Implement these endpoints to replace the V1 legacy proxy hooks:

```python
from decimal import Decimal
import math
from typing import Any, Dict
from fastapi import APIRouter, Header, HTTPException, Depends
from pydantic import BaseModel, Field, condecimal, model_validator

from services.spc_writeback_service import (
    SpcWritebackService,
    ValidationError,
    AuthenticationError,
    NotFoundError,
    UpstreamServiceError
)
from shared.query_service.identity import extract_user_identity, UserIdentity

router = APIRouter()

class LockLimitsRequest(BaseModel):
    material_code: str = Field(..., alias="materialCode")
    plant_code: str = Field(..., alias="plantCode")
    mic_code: str = Field(..., alias="micCode")
    operation_code: str = Field(..., alias="operationCode")
    mean_value: condecimal(max_digits=12, decimal_places=4) = Field(..., alias="meanValue")
    ucl: condecimal(max_digits=12, decimal_places=4) = Field(..., alias="ucl")
    lcl: condecimal(max_digits=12, decimal_places=4) = Field(..., alias="lcl")

    @model_validator(mode="after")
    def validate_limit_ranges(self) -> 'LockLimitsRequest':
        for field in ("mean_value", "ucl", "lcl"):
            val = getattr(self, field)
            if not isinstance(val, Decimal) or not math.isfinite(val):
                raise ValueError(f"{field} must be a finite decimal number")

        if self.lcl > self.mean_value:
            raise ValueError("lcl must be less than or equal to mean_value")
        if self.mean_value > self.ucl:
            raise ValueError("mean_value must be less than or equal to ucl")
        return self

class SaveConfigRequest(BaseModel):
    plant_code: str = Field(..., alias="plantCode")
    config_key: str = Field(..., alias="configKey")
    config_data: Dict[str, Any] = Field(..., alias="configData")

@router.post("/spc/lock-limits", status_code=201)
async def lock_spc_limits(
    body: LockLimitsRequest,
    identity: UserIdentity = Depends(extract_user_identity),
):
    # Enforce OAuth authentication and trusted proxy validation
    identity.require_user_oauth()
    
    service = SpcWritebackService()
    try:
        limit_id = await service.lock_limits(body, locked_by=identity.user_id)
        return {"status": "SUCCESS", "limitId": limit_id}
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except AuthenticationError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except UpstreamServiceError as e:
        raise HTTPException(status_code=502, detail="Upstream service communication failure.")
    except Exception as e:
        # Log e server-side here
        raise HTTPException(status_code=500, detail="Internal server error occurred.")

@router.post("/spc/user-config")
async def save_user_config(
    body: SaveConfigRequest,
    identity: UserIdentity = Depends(extract_user_identity),
):
    # Enforce OAuth authentication and trusted proxy validation
    identity.require_user_oauth()
    
    service = SpcWritebackService()
    try:
        await service.save_config(user_id=identity.user_id, request=body)
        return {"status": "SUCCESS"}
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except AuthenticationError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except UpstreamServiceError as e:
        raise HTTPException(status_code=502, detail="Upstream service communication failure.")
    except Exception as e:
        # Log e server-side here
        raise HTTPException(status_code=500, detail="Internal server error occurred.")
```

### B. PySpark DLT Pipeline Ingestion ([reference.py](../../data-products/io-reporting/silver/tables/reference.py))

Add this pipeline step to conjoin the CDC history table `lb_spc_locked_limits_history` into the Silver reporting layer:

```python
@dlt.table(
    name="spc_locked_limits",
    comment="Conformed active SPC control limit baselines replicated from Lakebase Postgres.",
    table_properties={"delta.enableChangeDataFeed": "true"}
)
def spc_locked_limits():
    spark = get_spark()
    
    # Read the native Lakehouse Sync CDC history table
    # Schema name matches the Lakehouse Sync target mapping
    history = spark.read.table("connected_plant.bronze.lb_spc_locked_limits_history")
    
    # Deduplicate changes: select the latest LSN (Log Sequence Number) state per SPC scope
    window_spec = Window.partitionBy("material_code", "plant_code", "mic_code", "operation_code").orderBy(F.col("_pg_lsn").desc())
    
    deduplicated = (
        history
        .withColumn("rn", F.row_number().over(window_spec))
        .filter(F.col("rn") == 1)
        .filter(F.col("_pg_change_type") != "delete") # Exclude deleted limits
    )
    
    return deduplicated.select(
        "limit_id",
        "material_code",
        "plant_code",
        "mic_code",
        "operation_code",
        F.col("mean_value").cast("double").alias("mean_value"),
        F.col("ucl").cast("double").alias("ucl"),
        F.col("lcl").cast("double").alias("lcl"),
        "locked_by",
        F.col("locked_at").alias("_replicated_at")
    )
```

---

## 5. Cost-Benefit & Operational ROI Analysis

### Latency Profiles: Postgres vs. Delta Lake

| Action | Direct Delta Write (SQL Warehouse) | Lakebase Postgres Write | Performance Delta |
| :--- | :--- | :--- | :--- |
| **Save User Config** | ~4,200ms – 7,500ms | **< 30ms** | **> 100x Faster** |
| **Lock Control Limits** | ~4,500ms – 8,000ms | **< 40ms** | **> 100x Faster** |
| **Concurrently Save (10 users)** | Queued latency spikes (>15s) | **< 60ms** (pooled connections) | **Enables scale out** |

### Compute and DBU Savings (Estimated Monthly)
* **Direct Delta writes**: Keeping a SQL Warehouse running continuously to handle random, intermittent user config saves consumes approximately **4.0 DBUs/hour** (Classic Small) or **~2.0 DBUs/hour** (Serverless). 
  * Hourly runs: 24 hours × 30 days × 2 DBUs = **1,440 DBUs/month**.
* **Lakebase Postgres**: Scales to zero when idle. During operational hours, it runs on a 0.5 CU instance (~$0.05/hour compute equivalent).
  * Monthly cost: **<$35/month** total database compute charge.
* **Lakehouse Sync**: Native CDC runs in the background at **$0 DBU cost**, avoiding the need to run scheduled Databricks Jobs to ingest database changes.

---

## 6. Implementation & Validation Plan

### Phase 1: Lakebase Provisioning
1. Set up the Autoscaling project on Azure/AWS with a scale range of `0.5–2.0 CU` (scale-to-zero active for Dev/Staging, disabled for Production).
2. Connect to the endpoint via `psql` and execute the schema creation queries in Section 3.
3. In the Databricks Workspace UI, navigate to the **Lakehouse Sync** tab for the branch and enable automatic replication for the `public` schema.

### Phase 2: API Integration & Mock Tests
1. Implement the FastAPI router and Pydantic schemas in the `spc.py` module.
2. Write unit tests utilizing mock database connections to ensure constraints (e.g. valid float values for limits, limit ranges) are fully validated before execution.

### Phase 3: Pipeline Deployment
1. Add the `spc_locked_limits` table to the Silver pipeline in [reference.py](../../data-products/io-reporting/silver/tables/reference.py).
2. Deploy the data bundle using the Databricks CLI:
   ```bash
   databricks bundle deploy -t dev
   ```
3. Run the pipeline to verify the creation of the deduplicated Delta view.
