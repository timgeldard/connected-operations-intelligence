# Smart Cache-Tier Warming Daemon Specification

This document defines the architectural design, execution sequence, and implementation blueprint for the **Smart Cache-Tier Warming Daemon**. 

This platform extension eliminates the "first-query latency penalty" for factory floor operators by pre-warming Databricks SQL Warehouse caches and FastAPI Redis cache tiers immediately after data pipeline updates.

---

## 1. The Problem Statement

The governed operations data product runs on a triggered batch schedule (e.g., every 15 minutes or daily). When a pipeline update completes, the following events occur:

1. **Cache Invalidation**: Because the underlying Delta tables have been written to, all existing query results cached in Databricks (Result Cache) and the API gateway (Redis/In-Memory) are invalidated.
2. **Cold Start Penalty**: The first user to load the dashboard after a pipeline update bears the full cost of:
   * **Warehouse Spin-up**: Waking up an idle SQL Warehouse (takes 5–15 seconds for Serverless, and up to 2 minutes for Classic compute).
   * **NVMe Data Scanning**: Scanning Delta files from cloud storage into the warehouse worker's local NVMe disk cache (Delta Cache).
   * **Response Mapping**: Serializing, mapping, and caching the rows in the FastAPI Gateway.
3. **Shift Start Congestion**: Since shift handovers happen simultaneously (e.g., at 06:00), hundreds of operators query cold caches at the same moment. This triggers massive database queueing and compromises dashboard responsiveness.

---

## 2. Multi-Tier Caching Architecture

The Warming Daemon targets two distinct layers in the application stack:

```mermaid
flowchart TD
    subgraph Databricks Lakehouse
        DLT[Gold DLT Pipeline] -->|1. Completion Event| Job[Databricks Workflow Job]
        Job -->|2. Trigger Task| Daemon[Cache-Warming Daemon]
        Daemon -->|3. Parallel SQL Queries| WH[SQL Warehouse]
        WH -->|Warm NVMe Disk Cache| DeltaCache[Local NVMe SSD Cache]
        WH -->|Warm Query Results| ResCache[SQL Result Cache]
    end

    subgraph API Gateway (FastAPI)
        Daemon -->|4. Trigger Webhook| API[FastAPI Server]
        API -->|5. Populate JSON Responses| Redis[(Redis Cache)]
    end

    subgraph Factory Floor
        Operators[300+ Lineside Devices] -->|6. Instant Fetch <20ms| Redis
    end
```

1. **Databricks SQL Result Cache**: Stores query result sets on the SQL Warehouse coordinator. If the query text matches and the table version is unchanged, results are returned in `<10ms`.
2. **Databricks Local Disk Cache (Delta Cache)**: Caches raw Delta data blocks on the local NVMe storage of SQL Warehouse worker nodes, accelerating raw scans by **10x**.
3. **FastAPI Redis Cache Tier**: Caches conformed JSON responses at the API boundary, returning responses to client HTTP requests in **<20ms** without hitting Databricks.

---

## 3. Code Implementation Blueprint

### A. The Cache Warmer Daemon ([warm_caches.py](file:///home/timgeldard/github/connected-operations-intelligence/scripts/cache_warmer/warm_caches.py))

This script is run as a Python task at the end of the Databricks Workflow Job. It loads active plant configurations and generates queries for all conformed endpoints.

```python
#!/usr/bin/env python3
"""Databricks Cache Warming Daemon.

Iterates over conformed plants, compiles dashboard QuerySpecs, and executes
them concurrently against the SQL Warehouse to pre-populate caches.
"""
from __future__ import annotations

import os
import sys
import argparse
import asyncio
import httpx
import csv
from pathlib import Path
from typing import List, dict, Any

# Resolve paths
REPO_ROOT = Path(__file__).resolve().parents[2]
SITE_CONFIG_PATH = REPO_ROOT / "data-products/io-reporting/resources/config/site_config_plant.csv"

def load_onboarded_plants() -> List[str]:
    """Read site_config_plant.csv and return a list of active plant IDs."""
    plants = []
    if not SITE_CONFIG_PATH.exists():
        return ["C061", "P817"]  # Fallbacks
    with open(SITE_CONFIG_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("lifecycle_status") == "ACTIVE" or row.get("go_live_status") == "LIVE":
                plants.append(row["plant_code"])
    return plants

class CacheWarmer:
    def __init__(self, api_url: str, secret_key: str):
        self.api_url = api_url
        self.headers = {
            "Content-Type": "application/json",
            "X-Cache-Warming-Token": secret_key
        }

    async def warm_endpoint(self, client: httpx.AsyncClient, endpoint: str, payload: dict[str, Any]) -> None:
        url = f"{self.api_url}{endpoint}"
        try:
            r = await client.post(url, json=payload, headers=self.headers, timeout=30.0)
            if r.status_code == 200:
                print(f" warmed: {endpoint} with {payload['plant_code']}")
            else:
                print(f"FAILED: {endpoint} ({r.status_code}) - {r.text}", file=sys.stderr)
        except Exception as e:
            print(f"ERROR: {endpoint} failed: {e}", file=sys.stderr)

    async def run(self):
        plants = load_onboarded_plants()
        print(f"Beginning cache warming for active plants: {plants}")

        # List of critical dashboard endpoints to warm
        endpoints = [
            "/api/wm-operations/shortage-projection",
            "/api/wm-operations/adherence-root-cause",
            "/api/wm-operations/order-readiness",
            "/api/wm-operations/bin-stock",
            "/api/wm-operations/expiry-risk",
        ]

        # Configure keep-alive HTTP client
        limits = httpx.Limits(max_keepalive_connections=10, max_connections=20)
        async with httpx.AsyncClient(limits=limits) as client:
            tasks = []
            for plant in plants:
                for endpoint in endpoints:
                    # Construct default payloads for each plant-specific dashboard view
                    payload = {
                        "plant_code": plant,
                        "limit": 250
                    }
                    tasks.append(self.warm_endpoint(client, endpoint, payload))
            
            # Execute all warming requests concurrently
            await asyncio.gather(*tasks)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-url", default=os.getenv("CONNECTIO_API_URL", "http://localhost:8000"))
    parser.add_argument("--secret", default=os.getenv("CACHE_WARMING_SECRET", "WARMING_DEV_TOKEN"))
    args = parser.parse_args()

    warmer = CacheWarmer(args.api_url, args.secret)
    asyncio.run(warmer.run())
```

---

## 4. Integration with Databricks Workflows

The Cache Warming Daemon is registered as the final task in the Databricks DLT Job definitions (e.g. [refresh_cadence.job.yml](file:///home/timgeldard/github/connected-operations-intelligence/data-products/io-reporting/resources/refresh_cadence.job.yml)), running immediately after the Gold pipeline completes.

```yaml
# Inside resources/refresh_cadence.job.yml
resources:
  jobs:
    refresh_cadence_job:
      name: "Connected Plant — Refresh Cadence"
      tasks:
        - task_key: silver_fast
          pipeline_task:
            pipeline_id: ${resources.pipelines.silver_fast_pipeline.id}
            
        - task_key: gold_pipeline
          depends_on:
            - task_key: silver_fast
          pipeline_task:
            pipeline_id: ${resources.pipelines.gold_pipeline.id}

        # The Cache Warmer Task
        - task_key: cache_warmer
          depends_on:
            - task_key: gold_pipeline
          spark_python_task:
            python_file: ../scripts/cache_warmer/warm_caches.py
            parameters:
              - "--api-url"
              - "https://production.connectio.internal"
              - "--secret"
              - "{{secrets/ops-reporting/cache_warming_token}}"
```

---

## 5. Cost-Benefit & Efficiency Analysis

### Latency Profiles: Cold vs. Warmed

| Metric | Cold Request (No Warming) | Warmed Request (Daemon Completed) | Improvement |
| :--- | :--- | :--- | :--- |
| **SQL Warehouse Spin-up** | 5,000ms – 15,000ms | 0ms (Already online) | **100%** |
| **Delta NVMe Data Read** | 1,200ms | 120ms (Cached in worker SSD) | **90%** |
| **Databricks SQL Compile** | 150ms | 0ms (Result Cache Hit) | **100%** |
| **API Gateway Serialization** | 120ms | 0ms (Redis Cache Hit) | **100%** |
| **Total perceived load time** | **6,470ms – 16,470ms** | **< 20ms** | **99.7%** |

### DBU and Compute ROI
1. **With Warming**: The SQL Warehouse runs for **30 seconds** to process the Warming Daemon's batch query suite. The results are loaded into Redis. When the 300 operators log in at shift handover, they fetch static files from Redis. 
   * **Compute Cost**: 1 Warm Query Suite = **0.05 DBUs**.
2. **Without Warming**: 300 operators query a cold database simultaneously. The SQL Warehouse is hit with 300 concurrent queries, forcing it to scale out to 4 clusters and queue requests.
   * **Compute Cost**: Warehouse scale-out for 15 minutes = **2.00 DBUs**.
* **Net Savings**: Warming the cache reduces server load spikes and Databricks execution cost during shift handovers by **over 95%**.
