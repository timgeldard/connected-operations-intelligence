# Runbook: Aecorsoft CDC Replication-Gap Detector

**Spec:** 21, Item 2 — Aecorsoft CDC gap detector  
**Script:** `data-products/io-reporting/scripts/check_cdc_replication_gaps.py`  
**Tests:** `data-products/io-reporting/tests/test_cdc_gap_detector.py` (offline — no Spark)  
**Motivation:** The QAMR stall (3 of 4 QM plants stopped replicating, discovered manually)
and the ZPUS-stops-2023 staleness.

---

## What it does

Queries each bronze source table (`connected_plant_<env>.sap.*`) for its maximum
`AEDATTM` replication watermark (the Aecorsoft CDC timestamp).  Compares the lag
against the per-table SLA defined in `gold/freshness.py::FRESHNESS_CONTRACTS`.
Reports each stream as `FRESH`, `STALE`, or `ABSENT`, and exits non-zero if any
actionable gaps are found.

**Key design decisions:**
- Reuses `FRESHNESS_CONTRACTS` thresholds — no separate config to maintain.
- QM tables (`inspection_qamr`, etc.) are not in `FRESHNESS_CONTRACTS` (they have no
  plant field, so Silver cannot check them via the normal freshness gate).  The detector
  adds them with a 24 h default SLA (`QM_DEFAULT_SLA_MINUTES`).
- Pure-Python classification logic (`classify_stream`, `build_report`, `summarise`)
  is covered by offline unit tests (`test_cdc_gap_detector.py`).
- The live-query path (`query_bronze_watermarks`) requires Databricks access and is
  run as a scheduled job or on-demand via this runbook.

---

## On-demand execution (inside Databricks — notebook or job)

### Option A — attach as a spark_python_task job step

Create a new task in the existing `refresh_cadence.job.yml` or a separate ops job:

```yaml
tasks:
  - task_key: cdc_gap_check
    spark_python_task:
      python_file: /data-products/io-reporting/scripts/check_cdc_replication_gaps.py
      parameters:
        - "--catalog"
        - "connected_plant_uat"   # or connected_plant_prod
        - "--schema"
        - "sap"
        - "--report-path"
        - "/tmp/cdc_gap_report.json"
    job_cluster_key: gold_pipeline_cluster
    timeout_seconds: 300
```

### Option B — run interactively in a Databricks notebook

```python
# %python
import subprocess, sys
result = subprocess.run(
    [sys.executable,
     "/Workspace/data-products/io-reporting/scripts/check_cdc_replication_gaps.py",
     "--catalog", "connected_plant_uat",
     "--schema", "sap",
     "--report-path", "/tmp/cdc_gap_report.json"],
    capture_output=True, text=True
)
print(result.stdout)
if result.returncode == 1:
    print("GAPS DETECTED — see above for details.")
elif result.returncode == 2:
    print("ERROR — check stderr:", result.stderr)
```

Or import and call directly inside a Databricks cell (Spark is already available):

```python
# %python
from pyspark.sql import SparkSession
import sys; sys.path.insert(0, "/Workspace/data-products/io-reporting")
from scripts.check_cdc_replication_gaps import run

spark = SparkSession.builder.getOrCreate()
exit_code = run(catalog="connected_plant_uat", schema="sap", report_path="/tmp/cdc_gap.json", spark=spark)
print("Exit code:", exit_code)  # 0 = no gaps, 1 = gaps found
```

### Option C — CLI via the Databricks Statement Execution API

```bash
# Requires databricks CLI >= v0.288.0 and a SQL warehouse ID.
databricks statement execute \
  --warehouse-id <WAREHOUSE_ID> \
  --statement "$(cat <<'EOF'
SELECT
  bronze_table,
  MAX(AEDATTM) AS max_watermark,
  TIMESTAMPDIFF(MINUTE, MAX(AEDATTM), NOW()) AS lag_minutes
FROM connected_plant_uat.sap.inventorymovement_mseg
GROUP BY bronze_table
EOF
)"
```

For a full structured run, use a job (Option A) — the script handles all tables in one
invocation.

---

## Scheduled check (recommended)

Add to the `refresh_cadence.job.yml` as a post-pipeline health-check step (not a
blocking gate — report only).  Run after the fast pipeline refresh so the watermarks
reflect the latest successful ingestion:

```yaml
- task_key: cdc_gap_check
  depends_on:
    - task_key: silver_fast_pipeline
  spark_python_task:
    python_file: /data-products/io-reporting/scripts/check_cdc_replication_gaps.py
    parameters: ["--catalog", "${env_catalog}", "--schema", "sap",
                 "--report-path", "/tmp/cdc_gap_${env}.json"]
  on_failure: EMAIL   # alert ops, do not fail the whole job
```

Do NOT use as a blocking gate until the cadences are tuned per environment — initial
deployment should be report-only (exit 0 regardless) until baseline lags are understood.

---

## Interpreting the report

| Status | Meaning | Action |
|--------|---------|--------|
| `FRESH` | Lag ≤ SLA — replication is current | None |
| `STALE` | Lag > SLA — replication is running behind | Check Aecorsoft run logs; verify the job completed |
| `ABSENT` | No rows in bronze table | Table may never have been replicated — open an ingestion request (`docs/ingestion_requests.md`) or check the replication schedule |

**QM tables (`qm_result`, `qm_individual_value`, etc.):**  These carry no per-plant
column on the bronze side.  A stall affects ALL plants simultaneously.  The 24 h default
SLA (`QM_DEFAULT_SLA_MINUTES`) is a conservative starting point; tune per the Aecorsoft
replication schedule once baseline behaviour is confirmed.

---

## Adding new tables

1. Find the bronze table name in the silver pipeline source:
   ```bash
   grep -n "f\"{BRONZE}" data-products/io-reporting/silver/tables/*.py
   ```
2. Add to `BRONZE_SOURCE_MAP` in `scripts/check_cdc_replication_gaps.py`.
3. If the table is not in `FRESHNESS_CONTRACTS`, add it there with a criticality and SLA
   (and update `docs/freshness_contracts.md`).
4. Run `python -m pytest tests/test_cdc_gap_detector.py -v --noconftest` to verify.

---

## Offline unit tests

The classification logic is pure Python — no Spark or Databricks required:

```bash
cd data-products/io-reporting
python -m pytest tests/test_cdc_gap_detector.py -v --noconftest
```

These tests run in the `python-checks` CI job (see `.github/workflows/ci.yml`).

---

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | All streams FRESH — no actionable gaps |
| `1` | One or more STALE or ABSENT streams — gaps detected |
| `2` | Configuration or connectivity error |
