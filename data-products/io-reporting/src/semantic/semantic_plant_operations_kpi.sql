-- Curated plant operations KPI view.
-- Run in the Gold schema after the secured/live serving views are created.

CREATE OR REPLACE VIEW semantic_plant_operations_kpi AS
SELECT
  coalesce(s.plant_code, q.plant_code) AS plant_code,
  s.completed_order_count,
  s.on_time_order_count,
  s.in_full_order_count,
  s.avg_fill_rate,
  q.total_ordered_qty,
  q.total_yield_qty,
  q.total_scrap_qty,
  q.total_downtime_minutes,
  q.quality_rate,
  c.open_component_count,
  c.component_open_qty,
  c.fully_covered_component_count
FROM (
  SELECT
    plant_code,
    count(*) AS completed_order_count,
    sum(CASE WHEN is_on_time = 1 THEN 1 ELSE 0 END) AS on_time_order_count,
    sum(CASE WHEN is_in_full = 1 THEN 1 ELSE 0 END) AS in_full_order_count,
    avg(fill_rate) AS avg_fill_rate
  FROM gold_process_order_schedule_adherence_secured
  GROUP BY plant_code
) AS s
FULL OUTER JOIN gold_plant_production_quality_summary_secured AS q
  ON s.plant_code = q.plant_code
LEFT JOIN (
  SELECT
    plant_code,
    count(*) AS open_component_count,
    sum(open_quantity) AS component_open_qty,
    sum(CASE WHEN is_fully_covered THEN 1 ELSE 0 END) AS fully_covered_component_count
  FROM gold_process_order_component_status_secured
  GROUP BY plant_code
) AS c
  ON coalesce(s.plant_code, q.plant_code) = c.plant_code;
