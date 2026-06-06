# Warehouse360 DEV Data Product Deployment Runbook

## Purpose
This runbook provides step-by-step instructions to validate and deploy the governed IOReporting data-product layer to the DEV environment, including deploying the pipeline bundle, executing serving and secured view SQL, creating the Warehouse360 consumption views, applying row-level security (RLS), and verifying the deployment.

---

## 1. Prerequisites

### 1.1 Databricks CLI Setup
Ensure you have the Databricks CLI installed (version `>= v0.292.0` or `>= v1.0.0`):
```bash
databricks --version
```

### 1.2 Authentication Profile
Ensure your development profile (`TG`) is configured and authenticated. If you haven't set it up, run:
```bash
databricks auth login --profile TG --host <your-dev-workspace-url>
```
Verify that the credentials work:
```bash
databricks current-user me --profile TG
```

---

## 2. Deploy IOReporting Bundle

Deploy the Declarative Automation Bundle (DAB) to the DEV environment.

### 2.1 Validate the Bundle Configuration
Run the validation tool in the bundle root (`data-products/io-reporting`):
```bash
cd data-products/io-reporting
databricks bundle validate -t dev_sample --profile TG
```
*Note: If dev_sample is deployed, it relies entirely on dev catalog sample data (no external reach). If deploying dev_uat_source, use target `dev_uat_source`.*

### 2.2 Deploy the Bundle
Deploy the pipelines and configuration:
```bash
databricks bundle deploy -t dev_sample --profile TG
```
This deploys the pipelines and target schemas:
- Target Catalog: `connected_plant_dev`
- Silver Schema: `silver_dev`
- Gold Schema: `gold_dev`

---

## 3. Pipeline Refresh and Schema Verification

### 3.1 Start Pipeline Update
Navigate to the Databricks UI and start the deployed `silver_fast_pipeline`, `silver_slow_pipeline`, and `gold_pipeline`, or run:
```bash
databricks pipelines start-update --pipeline-id <dev-pipeline-id> --profile TG
```

### 3.2 Verify Schema Existence
Verify that the target schemas contain the expected tables:
```bash
databricks catalogs list --profile TG
databricks schemas list connected_plant_dev --profile TG
databricks tables list connected_plant_dev gold_dev --profile TG
```

---

## 4. Deploy Serving & Secured Views

The gold tables are raw and unfiltered. To enforce row-level security (RLS) and calculate dynamic date fields at query time, you must deploy the secured and serving views.

### 4.1 Apply Gold Security SQL (Secured Views)
Execute the generated security SQL to create the `*_secured` views in the `gold_dev` schema. In DEV, these views act as pass-throughs returning all records:
```bash
# Run the SQL script using databricks CLI or your query workspace
databricks labs sandbox run-sql --file resources/sql/gold_security_dev.sql --profile TG
```

### 4.2 Apply Gold Serving Views SQL (Live Views)
Execute the serving view SQL to create the `*_live` views, which compute dynamic fields (like days to goods issue) on top of the secured views:
```bash
databricks labs sandbox run-sql --file resources/sql/gold_serving_views_dev.sql --profile TG
```

---

## 5. Create Warehouse360 Consumption Views (`vw_consumption_*`)

The Warehouse360 app and dashboards consume stable `vw_consumption_warehouse360_*` views. In DEV, create these views in `connected_plant_dev.gold_dev` wrapping the `*_live` or `*_secured` serving views.

Execute the following DDL in your workspace:

```sql
USE CATALOG connected_plant_dev;
USE SCHEMA gold_dev;

-- 1. Overview
CREATE OR REPLACE VIEW vw_consumption_warehouse360_overview AS
SELECT
  plant_code AS plant_id,
  CAST(snapshot_date AS TIMESTAMP) AS snapshot_ts,
  active_order_count AS orders_total,
  CAST(NULL AS LONG) AS orders_red,
  CAST(NULL AS LONG) AS orders_amber,
  open_tr_item_count AS trs_open,
  open_to_item_count AS tos_open,
  open_delivery_count AS deliveries_today,
  CAST(NULL AS LONG) AS deliveries_at_risk,
  open_inbound_item_count AS inbound_open,
  blocked_bin_count AS bins_blocked,
  total_bin_count AS bins_total,
  CAST(bin_utilisation_pct AS DECIMAL(5,2)) AS bin_util_pct
FROM connected_plant_dev.gold_dev.gold_warehouse_kpi_snapshot_secured;

-- 2. Inbound Backlog
CREATE OR REPLACE VIEW vw_consumption_warehouse360_inbound_backlog AS
SELECT
  plant_id,
  po_id,
  po_item,
  doc_type,
  vendor_id,
  vendor_name,
  storage_loc,
  material_id,
  material_name,
  ordered_qty,
  gr_qty,
  uom,
  delivery_date,
  po_date,
  open_qty,
  qa_status,
  oldest_po_age_days,
  inbound_backlog_risk_band
FROM connected_plant_dev.gold_dev.gold_inbound_po_backlog_enhanced_live;

-- 3. Outbound Backlog
CREATE OR REPLACE VIEW vw_consumption_warehouse360_outbound_backlog AS
SELECT
  plant_id,
  delivery_id,
  delivery_type,
  customer_id,
  customer_name,
  carrier,
  planned_goods_issue_date AS planned_gi_date,
  actual_goods_issue_date AS actual_gi_date,
  delivery_date,
  gross_weight,
  pick_fraction AS pick_pct,
  line_count,
  risk_band AS risk,
  is_shipped AS shipped
FROM connected_plant_dev.gold_dev.gold_delivery_pick_status_live;

-- 4. Staging Workload
CREATE OR REPLACE VIEW vw_consumption_warehouse360_staging_workload AS
SELECT
  plant_id,
  order_id,
  material_id,
  order_qty,
  uom,
  material_name,
  scheduled_start_date AS sched_start,
  scheduled_finish_date AS sched_finish,
  staging_fraction AS staging_pct,
  to_items_total,
  to_items_done,
  days_to_start * 1440 AS mins_to_start, -- Convert days to minutes
  risk_band AS risk,
  reservation_no,
  batch_id,
  sap_order
FROM connected_plant_dev.gold_dev.gold_process_order_staging_live;

-- 5. Stock Exceptions
CREATE OR REPLACE VIEW vw_consumption_warehouse360_stock_exceptions AS
SELECT
  plant_id,
  material_id,
  batch_id,
  storage_location_id AS storage_loc,
  highest_expiry_risk_bucket AS exception_type,
  total_stock_qty AS qty,
  minimum_days_to_expiry,
  has_minimum_shelf_life_breach
FROM connected_plant_dev.gold_dev.gold_stock_expiry_risk_live;

-- 6. Shortfalls
CREATE OR REPLACE VIEW vw_consumption_warehouse360_shortfalls AS
SELECT
  plant_id,
  material_id,
  open_tr_qty AS shortfall_qty,
  open_tr_items AS open_items_count,
  oldest_tr_creation_date AS oldest_tr_date
FROM connected_plant_dev.gold_dev.gold_transfer_requirement_backlog;

-- 7. IM/WM Reconciliation
CREATE OR REPLACE VIEW vw_consumption_warehouse360_im_wm_reconciliation AS
-- Placeholder select until reconciliation exception source view is confirmed in DEV
SELECT
  plant_id,
  material_id,
  batch_id,
  storage_location_id AS storage_loc,
  exception_type,
  severity,
  sla_hours,
  qty,
  bin_id,
  detail_text,
  detected_date
FROM connected_plant_dev.gold_dev.gold_warehouse_exceptions; -- (Verify actual name)
```

### 5.2 Grant Select Privileges
Grant SELECT privileges to the consumer group:
```sql
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.vw_consumption_warehouse360_overview TO `users`;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.vw_consumption_warehouse360_inbound_backlog TO `users`;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.vw_consumption_warehouse360_outbound_backlog TO `users`;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.vw_consumption_warehouse360_staging_workload TO `users`;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.vw_consumption_warehouse360_stock_exceptions TO `users`;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.vw_consumption_warehouse360_shortfalls TO `users`;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.vw_consumption_warehouse360_im_wm_reconciliation TO `users`;
```

---

## 6. Post-Deployment Checklist & Verification

Verify each view to ensure it meets the design standards before writing contracts:

| View | Exists? | Row Count | `plant_id` non-null? | Unique PK check? | Freshness field present? |
|---|---|---|---|---|---|
| `vw_consumption_warehouse360_overview` | | | | | |
| `vw_consumption_warehouse360_inbound_backlog` | | | | | |
| `vw_consumption_warehouse360_outbound_backlog` | | | | | |
| `vw_consumption_warehouse360_staging_workload` | | | | | |
| `vw_consumption_warehouse360_stock_exceptions` | | | | | |
| `vw_consumption_warehouse360_shortfalls` | | | | | |
| `vw_consumption_warehouse360_im_wm_reconciliation` | | | | | |
