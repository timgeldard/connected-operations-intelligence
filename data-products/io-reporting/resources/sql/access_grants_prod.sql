-- Unity Catalog Access Grants for Readiness Tables (PROD).
-- Run as a UC admin after the first DLT pipeline deploy registers the tables in gold.
-- Sets up visibility for data owners, platform teams, and dashboard consumers.

-- 1. Grant SELECT on Readiness rollup tables for dashboard/Power BI consumption
GRANT SELECT ON TABLE connected_plant_prod.gold.gold_plant_readiness_status TO `users`;
GRANT SELECT ON TABLE connected_plant_prod.gold.gold_data_product_safety_status TO `users`;
GRANT SELECT ON TABLE connected_plant_prod.gold.gold_readiness_dashboard_source TO `users`;

-- 2. Grant SELECT on detailed validation tables to allow deep-dive failure analysis
GRANT SELECT ON TABLE connected_plant_prod.gold.gold_storage_type_role_coverage_status TO `users`;
GRANT SELECT ON TABLE connected_plant_prod.gold.gold_movement_type_classification_coverage TO `users`;
GRANT SELECT ON TABLE connected_plant_prod.gold.gold_process_order_staging_validation TO `users`;
GRANT SELECT ON TABLE connected_plant_prod.gold.gold_recipe_line_enrichment_coverage TO `users`;
GRANT SELECT ON TABLE connected_plant_prod.gold.gold_delivery_pick_status_validation TO `users`;
GRANT SELECT ON TABLE connected_plant_prod.gold.gold_stock_reconciliation_readiness TO `users`;
GRANT SELECT ON TABLE connected_plant_prod.gold.gold_plant_freshness_readiness TO `users`;
GRANT SELECT ON TABLE connected_plant_prod.gold.gold_validation_failure_detail TO `users`;
