-- Unity Catalog Grant Audit Script
-- Run to audit database access control grants for the IOReporting serving boundary.
-- This verifies:
-- 1. No broad consumer groups (e.g. `users`) have direct SELECT privileges on raw Gold tables.
-- 2. Consuming groups have SELECT privileges only on conformed views (*_secured, *_live).
-- 3. Access is granted to readiness tables as expected.

-- Query 1: Audit direct SELECT on raw Gold tables (should return 0 rows for `users` / broad groups)
SELECT 
  table_catalog, 
  table_schema, 
  table_name, 
  grantee, 
  privilege_type,
  is_grantable
FROM system.information_schema.table_privileges
WHERE table_schema = 'gold'
  AND table_name NOT LIKE '%_secured'
  AND table_name NOT LIKE '%_live'
  AND table_name NOT LIKE '%_status'
  AND table_name NOT LIKE '%_coverage%'
  AND table_name NOT LIKE '%_validation%'
  AND table_name NOT LIKE '%_readiness%'
  AND table_name NOT LIKE '%_detail%'
  AND table_name NOT LIKE '%_source'
  AND grantee = 'users'
ORDER BY table_name, grantee;

-- Query 2: Audit conformed view SELECT access (should show `users` group has SELECT)
SELECT 
  table_catalog, 
  table_schema, 
  table_name, 
  grantee, 
  privilege_type
FROM system.information_schema.table_privileges
WHERE table_schema = 'gold'
  AND (table_name LIKE '%_secured' OR table_name LIKE '%_live')
  AND grantee = 'users'
ORDER BY table_name, grantee;

-- Query 3: Audit readiness table SELECT access (should show `users` group has SELECT)
SELECT 
  table_catalog, 
  table_schema, 
  table_name, 
  grantee, 
  privilege_type
FROM system.information_schema.table_privileges
WHERE table_schema = 'gold'
  AND (
    table_name LIKE '%_status' 
    OR table_name LIKE '%_coverage%' 
    OR table_name LIKE '%_validation%' 
    OR table_name LIKE '%_readiness%' 
    OR table_name LIKE '%_detail%' 
    OR table_name LIKE '%_source'
  )
  AND grantee = 'users'
ORDER BY table_name, grantee;
