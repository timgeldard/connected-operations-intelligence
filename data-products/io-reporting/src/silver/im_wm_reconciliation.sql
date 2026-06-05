-- Companion Databricks SQL definition for IM vs WM stock reconciliation.
-- The production Lakeflow implementation lives in gold/warehouse_flow_gold.py
-- as gold_stock_reconciliation_v2. Run this in the Silver schema if a SQL view
-- is needed for analyst exploration or ad-hoc validation.

CREATE OR REPLACE VIEW im_wm_reconciliation AS
WITH im AS (
  SELECT
    s.plant_code,
    coalesce(m.warehouse_number, '__NO_WM_MAPPING__') AS warehouse_number,
    s.material_code,
    coalesce(s.batch_number, '__NONE__') AS batch_number,
    s.base_uom,
    'UNRESTRICTED' AS stock_category,
    sum(coalesce(s.unrestricted_quantity, 0.0)) AS im_quantity
  FROM batch_stock AS s
  LEFT JOIN warehouse_storage_location_mapping AS m
    ON s.plant_code = m.plant_code
   AND s.storage_location_code = m.storage_location_code
  GROUP BY
    s.plant_code,
    coalesce(m.warehouse_number, '__NO_WM_MAPPING__'),
    s.material_code,
    coalesce(s.batch_number, '__NONE__'),
    s.base_uom
),
wm AS (
  SELECT
    plant_code,
    warehouse_number,
    material_code,
    coalesce(batch_number, '__NONE__') AS batch_number,
    base_uom,
    CASE coalesce(stock_category_code, '')
      WHEN '' THEN 'UNRESTRICTED'
      WHEN 'Q' THEN 'QUALITY'
      WHEN 'S' THEN 'BLOCKED'
      ELSE 'OTHER'
    END AS stock_category,
    sum(coalesce(total_quantity, 0.0)) AS wm_quantity
  FROM storage_bin
  WHERE quant_number IS NOT NULL
  GROUP BY
    plant_code,
    warehouse_number,
    material_code,
    coalesce(batch_number, '__NONE__'),
    base_uom,
    CASE coalesce(stock_category_code, '')
      WHEN '' THEN 'UNRESTRICTED'
      WHEN 'Q' THEN 'QUALITY'
      WHEN 'S' THEN 'BLOCKED'
      ELSE 'OTHER'
    END
)
SELECT
  coalesce(im.plant_code, wm.plant_code) AS plant_code,
  coalesce(im.warehouse_number, wm.warehouse_number) AS warehouse_number,
  coalesce(im.material_code, wm.material_code) AS material_code,
  coalesce(im.batch_number, wm.batch_number) AS batch_number,
  coalesce(im.base_uom, wm.base_uom) AS base_uom,
  coalesce(im.stock_category, wm.stock_category) AS stock_category,
  coalesce(im.im_quantity, 0.0) AS im_quantity,
  coalesce(wm.wm_quantity, 0.0) AS wm_quantity,
  coalesce(wm.wm_quantity, 0.0) - coalesce(im.im_quantity, 0.0) AS delta_quantity,
  abs(coalesce(wm.wm_quantity, 0.0) - coalesce(im.im_quantity, 0.0)) AS abs_delta_quantity,
  CASE
    WHEN abs(coalesce(wm.wm_quantity, 0.0) - coalesce(im.im_quantity, 0.0)) <= 0.001 THEN 'MATCHED'
    WHEN coalesce(im.warehouse_number, wm.warehouse_number) = '__NO_WM_MAPPING__' THEN 'WM_MANAGED_SLOC_MAPPING_MISSING'
    WHEN coalesce(im.im_quantity, 0.0) > 0.0 AND coalesce(wm.wm_quantity, 0.0) = 0.0 THEN 'BATCH_MISSING_IN_WM'
    WHEN coalesce(wm.wm_quantity, 0.0) > 0.0 AND coalesce(im.im_quantity, 0.0) = 0.0 THEN 'BATCH_MISSING_IN_IM'
    ELSE 'TRUE_VARIANCE'
  END AS variance_category
FROM im
FULL OUTER JOIN wm
  ON im.plant_code = wm.plant_code
 AND im.warehouse_number = wm.warehouse_number
 AND im.material_code = wm.material_code
 AND im.batch_number = wm.batch_number
 AND im.base_uom = wm.base_uom
 AND im.stock_category = wm.stock_category;
