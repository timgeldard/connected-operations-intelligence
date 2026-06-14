-- Operational Risk Consumption Views (DEV)
-- Target: connected_plant_dev.gold_io_reporting
-- Serves the Operational Risk Centre (spec 16) via the governed contract pattern:
--   app -> vw_consumption_op_risk_* -> *_secured -> gold MV
-- Run once as a UC admin AFTER gold_security_dev.sql.
--
-- Views:
--   vw_consumption_op_risk_operational_risk_live   UNION of deterministic gold MV + query-time
--                                                   data_trust rows (freshness critical domains).
--                                                   Adds time-relative columns at query time.
--   vw_consumption_data_freshness                  Per-domain freshness watermark with query-time
--                                                   age and status classification.

USE CATALOG connected_plant_dev;
CREATE SCHEMA IF NOT EXISTS gold_io_reporting;
USE SCHEMA gold_io_reporting;

-- 1. Operational risk live view
-- Grain: 1 row per risk item (risk_id). Combines the deterministic base MV with
-- query-time data_trust rows for domains that are critically stale.
-- effective_severity escalates base_severity when the planned event is overdue.
CREATE OR REPLACE VIEW vw_consumption_op_risk_operational_risk_live AS
WITH base_items AS (
  SELECT
    risk_id,
    risk_domain,
    plant_code,
    process_line,
    order_number,
    material_code,
    batch_number,
    delivery_number,
    customer_id,
    planned_event_at,
    current_status,
    primary_reason_code,
    secondary_reason_codes,
    responsible_function,
    evidence_confidence,
    base_severity,
    stock_qty_affected,
    orders_affected,
    deliveries_affected,
    customer_impact_flag,
    food_safety_flag
  FROM connected_plant_dev.gold_io_reporting.gold_operational_risk_item_secured
  WHERE risk_domain != 'data_trust'
),
freshness_critical AS (
  -- Data-trust arm: emit risk items for domains critically past their freshness threshold.
  SELECT
    SHA2(CONCAT_WS('|', 'data_trust', domain, 'STALE_SOURCE'), 256)        AS risk_id,
    'data_trust'                                                             AS risk_domain,
    CAST(NULL AS STRING)                                                     AS plant_code,
    CAST(NULL AS STRING)                                                     AS process_line,
    CAST(NULL AS STRING)                                                     AS order_number,
    CAST(NULL AS STRING)                                                     AS material_code,
    CAST(NULL AS STRING)                                                     AS batch_number,
    CAST(NULL AS STRING)                                                     AS delivery_number,
    CAST(NULL AS STRING)                                                     AS customer_id,
    last_refresh_at                                                          AS planned_event_at,
    'OPEN'                                                                   AS current_status,
    'STALE_SOURCE'                                                           AS primary_reason_code,
    ARRAY(domain)                                                            AS secondary_reason_codes,
    'Data Engineering'                                                       AS responsible_function,
    'High'                                                                   AS evidence_confidence,
    'High'                                                                   AS base_severity,
    CAST(NULL AS DOUBLE)                                                     AS stock_qty_affected,
    CAST(NULL AS BIGINT)                                                     AS orders_affected,
    CAST(NULL AS BIGINT)                                                     AS deliveries_affected,
    FALSE                                                                    AS customer_impact_flag,
    FALSE                                                                    AS food_safety_flag
  FROM connected_plant_dev.gold_io_reporting.gold_domain_freshness_watermark_secured
  WHERE TIMESTAMPDIFF(MINUTE, last_refresh_at, CURRENT_TIMESTAMP()) > critical_minutes
),
all_items AS (
  SELECT * FROM base_items
  UNION ALL
  SELECT * FROM freshness_critical
)
SELECT
  risk_id,
  risk_domain,
  plant_code,
  process_line,
  order_number,
  material_code,
  batch_number,
  delivery_number,
  customer_id,
  planned_event_at,
  current_status,
  primary_reason_code,
  secondary_reason_codes,
  responsible_function,
  evidence_confidence,
  base_severity,
  -- Time-relative columns (query time):
  TIMESTAMPDIFF(MINUTE, CURRENT_TIMESTAMP(), planned_event_at) AS minutes_to_event,
  CASE
    WHEN planned_event_at IS NULL                                          THEN 'unknown'
    WHEN planned_event_at < CURRENT_TIMESTAMP()                            THEN 'overdue'
    WHEN planned_event_at <= CURRENT_TIMESTAMP() + INTERVAL 4 HOURS       THEN 'imminent'
    WHEN planned_event_at <= CURRENT_TIMESTAMP() + INTERVAL 24 HOURS      THEN 'today'
    WHEN planned_event_at <= CURRENT_TIMESTAMP() + INTERVAL 72 HOURS      THEN 'upcoming'
    ELSE 'future'
  END                                                                      AS time_horizon,
  -- effective_severity escalates base_severity when overdue:
  CASE
    WHEN evidence_confidence = 'Unknown'                                   THEN 'Unknown'
    WHEN planned_event_at < CURRENT_TIMESTAMP() AND base_severity = 'High' THEN 'Critical'
    WHEN planned_event_at < CURRENT_TIMESTAMP() AND base_severity = 'Medium' THEN 'High'
    ELSE base_severity
  END                                                                      AS effective_severity,
  stock_qty_affected,
  orders_affected,
  deliveries_affected,
  customer_impact_flag,
  food_safety_flag
FROM all_items;

GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.vw_consumption_op_risk_operational_risk_live TO `users`;

-- 2. Data freshness consumption view
-- Grain: 1 row per canonical domain. Age and status computed query-time.
CREATE OR REPLACE VIEW vw_consumption_data_freshness AS
SELECT
  domain,
  last_refresh_at,
  source_table_count,
  warning_minutes,
  critical_minutes,
  TIMESTAMPDIFF(MINUTE, last_refresh_at, CURRENT_TIMESTAMP()) AS age_minutes,
  CASE
    WHEN last_refresh_at IS NULL                                                              THEN 'no_data'
    WHEN TIMESTAMPDIFF(MINUTE, last_refresh_at, CURRENT_TIMESTAMP()) > critical_minutes      THEN 'critical'
    WHEN TIMESTAMPDIFF(MINUTE, last_refresh_at, CURRENT_TIMESTAMP()) > warning_minutes       THEN 'warning'
    ELSE 'fresh'
  END AS status
FROM connected_plant_dev.gold_io_reporting.gold_domain_freshness_watermark_secured;

GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.vw_consumption_data_freshness TO `users`;
