# Business rules & assumptions

Governed register of the site-/process-specific assumptions baked into the Silver and Gold logic.
Several were previously only code comments — surfacing them here makes them reviewable, testable, and
plant-aware. Each rule carries a **validation query** (runnable Spark SQL) intended to be promoted to
a `gold_validation_*` view in a later hardening step (Phase 4.2); until then run it ad-hoc.

Conventions: `silver` / `gold` below are the env-qualified schemas
(`connected_plant_<env>.silver` / `.<gold_schema>`). **Status:** `Unverified` → `UAT verified` →
`Prod verified`. Owners are placeholders pending assignment.

---

## BR-PP-001 — Process orders are AUFK `AUTYP = '40'`
- **Used by:** `silver.process_order` (→ `gold_order_otif_metrics`, `gold_shift_output_summary`, `gold_process_order_staging`, `gold_plant_production_quality_summary`)
- **Source fields:** `AUFK.AUTYP`, `AUFK.AUART` (`silver.helpers.PP_PI_ORDER_CATEGORY = "40"`, `PP_PI_ORDER_TYPES = None`)
- **Assumption:** PP-PI process orders are order category `40` (verified live: AUART ZI01/ZI02/ZI05/…; `AUTYP='10'` returns zero rows). `PP_PI_ORDER_TYPES = None` keeps **all** type-40 orders (incl. ZI10/ZI11 setup/cleaning).
- **Plant applicability:** all plants (AUART allowlist may need to be plant-confirmed).
- **Validation:** non-empty population + AUART distribution looks like process orders.
  ```sql
  SELECT order_type, COUNT(*) AS orders
  FROM silver.process_order
  GROUP BY order_type ORDER BY orders DESC;
  -- expect ZIxx process types, non-zero; investigate unexpected AUART values
  ```
- **Risk:** wrong AUTYP empties every production/staging KPI; an over-broad AUART allowlist inflates output/OEE with setup/cleaning orders.
- **Status:** UAT verified (AUTYP). AUART allowlist: Unverified. **Owner:** PP process owner.

## BR-WM-002 — Transfer-order source reference = process-order number
- **Used by:** `gold_process_order_staging`, `gold_process_order_staging_validation`
- **Source fields:** `warehouse_transfer_order.source_reference_number` (LTAK-BENUM) ↔ `process_order.order_number`; scoped to `source_reference_type = 'F'` (LTAK-BETYP).
- **Assumption:** for staging TOs, LTAK-BETYP='F' identifies process-order staging and BENUM holds the process-order AUFNR. TOs with other BETYP values are not process-order staging and are excluded.
- **Plant applicability:** validated for all warehouses with F-type staging TOs (see `gold_process_order_staging_validation`). Plants with no BETYP='F' TOs are NOT_APPLICABLE.
- **Live validation (connected_plant_uat, 2026-06-02):**
  - BETYP='F' ranges from ~5% (warehouse 104) to ~24% (warehouse 102) of TOs per warehouse; the remaining TOs use blank/'X'/'P'/'L'/'D'.
  - BENUM↔AUFNR (AUTYP='40') match rate: **100% across all warehouses** with F-type TOs (zero anomalies in Q2b scan).
  - Persistent validation: `gold_process_order_staging_validation` computes per-plant/warehouse VALIDATED / NOT_VALIDATED / NOT_APPLICABLE status on every Gold pipeline run.
- **Risk:** non-PP/PI staging TOs silently excluded; staging % and `risk_band` wrong where the mapping differs. AUART allowlist (BR-PP-001) may include setup/cleaning orders in staging counts.
- **Status:** UAT validated (BETYP='F' scope + BENUM match). **Owner:** Warehouse process owner.

## BR-WM-003 — Storage-type roles come from `storage_type_role_mapping` (9xx interim fallback)
- **Used by:** `gold_lineside_stock` (role `LINESIDE`), `gold_stock_reconciliation` (interim vs physical split)
- **Source fields:** `silver.storage_type_role_mapping(plant_code, warehouse_number, storage_type, role)`; fallback: storage type `LIKE '9%'` treated as interim.
- **Assumption:** the role-mapping config is populated for the plants/warehouses in scope; unmapped non-9xx storage types are treated as physical/non-lineside.
- **Plant applicability:** per plant × warehouse (config-driven).
- **Validation:** storage types present in stock but absent from the mapping.
  ```sql
  SELECT b.plant_code, b.warehouse_number, b.storage_type, COUNT(*) AS quants
  FROM silver.storage_bin b
  LEFT JOIN silver.storage_type_role_mapping m
    ON b.plant_code = m.plant_code AND b.warehouse_number = m.warehouse_number
   AND b.storage_type = m.storage_type
  WHERE b.quant_number IS NOT NULL AND m.role IS NULL
  GROUP BY b.plant_code, b.warehouse_number, b.storage_type
  ORDER BY quants DESC;
  -- non-empty (excluding intended 9xx-fallback types) = mapping gaps
  ```
- **Risk:** mis-classified line-side / interim stock → wrong line-side view and reconciliation interim split.
- **Live validation (connected_plant_uat, 2026-06-02):** 140 warehouses / 3,464 ST combos in bronze LAGP; only C061/warehouse 208 is partially seeded (6 non-9xx STs config-mapped, rest default to PHYSICAL fallback). `gold_storage_type_role_coverage_status` computes VALIDATED / PARTIAL / MISSING per warehouse on every Gold run and is the recommended way to track coverage going forward.
- **Status:** Coverage infrastructure in place; per-warehouse role correctness unverified (requires WM config owner sign-off per warehouse). **Owner:** WM config owner.

## BR-MM-004 — Movement-type classification is complete
- **Used by:** `gold_shift_output_summary`, `gold_inbound_outbound_throughput` (inner join to `movement_type_classification`)
- **Source fields:** `goods_movement.movement_type_code` ↔ `silver.movement_type_classification.movement_type_code`
- **Assumption:** every BWART present in goods movements is classified. Unclassified codes are **dropped by the inner join** → silently excluded from output/throughput.
- **Plant applicability:** all plants.
- **Validation:** movement codes with volume that are unclassified.
  ```sql
  SELECT g.movement_type_code, COUNT(*) AS movements, SUM(g.quantity) AS qty
  FROM silver.goods_movement g
  LEFT JOIN silver.movement_type_classification c USING (movement_type_code)
  WHERE c.movement_type_code IS NULL
  GROUP BY g.movement_type_code ORDER BY movements DESC;
  -- any rows = output/throughput is silently understated; classify them
  ```
- **Risk:** under-stated production output / throughput; silent data loss.
- **Status:** Unverified. **Owner:** PP/MM data owner.

## BR-WM-005 — Dispensary backlog = RESB movement `261`, open, not deletion-flagged
- **Used by:** `gold_dispensary_backlog`
- **Source fields:** `reservation_requirement.movement_type_code = '261'`, `is_deletion_flagged`, `open_quantity > 0`
- **Assumption:** line-pick (dispensary) demand is exactly BWART 261 component reservations.
- **Validation:** BWART distribution to confirm 261 is the dispensary pick family.
  ```sql
  SELECT movement_type_code, COUNT(*) AS lines, SUM(open_quantity) AS open_qty
  FROM silver.reservation_requirement
  WHERE NOT coalesce(is_deletion_flagged, false)
  GROUP BY movement_type_code ORDER BY lines DESC;
  ```
- **Risk:** other component-pick movement types excluded if the plant uses more than 261.
- **Status:** Unverified. **Owner:** Dispensary/WM owner.

## BR-IM-006 — IM↔WM reconciliation is plant × material only (coarse, directional)
- **Used by:** `gold_stock_reconciliation` (and the variance branch of `gold_warehouse_exceptions`)
- **Source fields:** `stock_at_location` (MARD), `storage_bin` (WM), `material_valuation` (MBEW); tolerance `max(0.1, 1% IM)`
- **Assumption:** plant×material totals are comparable. **No** storage-location, batch, stock-category, or UoM normalisation — so UoM differences and sloc/batch offsets surface as false variances.
- **Validation:** materials with mixed base UoM across IM/WM (spurious variance source).
  ```sql
  SELECT material_code, COUNT(DISTINCT base_uom) AS uom_count
  FROM (SELECT material_code, base_uom FROM silver.batch_stock
        UNION SELECT material_code, base_uom FROM silver.storage_bin WHERE quant_number IS NOT NULL)
  GROUP BY material_code HAVING COUNT(DISTINCT base_uom) > 1;
  -- any rows = UoM-driven false variances until MARM normalisation (ADR 009)
  ```
- **Risk:** false positives/negatives in real plants; do not treat as authoritative. **Directional only.**
- **Status:** Unverified. **Owner:** Inventory owner. **Rebuild:** ADR 009.

## BR-INB-007 — `gold_inbound_po_backlog` is open-PO backlog, not GR status
- **Used by:** `gold_inbound_po_backlog`
- **Source fields:** `purchase_order` (EKKO/EKPO) `is_delivery_complete`, `is_item_deleted`
- **Assumption:** "inbound" = PO items not flagged delivery-complete. Does **not** consult GR history (EKBE/MSEG 101), inbound deliveries/ASNs, or remaining-vs-received quantity.
- **Validation:** **cannot be validated** until EKBE/MSEG GR history is ingested (source gap — see `docs/ingestion_requests.md`). Until then the rule stands by definition; a true GR model is Phase 9.
- **Risk:** over-counts backlog (items received but not yet flagged complete appear open).
- **Status:** Unverified (blocked on source). **Owner:** Procurement/inbound owner.

## BR-HU-008 — SSCC approximated from VEKP `EXIDV`
- **Used by:** `gold_handling_unit_summary`
- **Source fields:** `handling_unit.sscc` (VEKP EXIDV)
- **Assumption:** EXIDV is a usable SSCC. The WMA-E-50 execution tables (`ZWM_SSCC_CREATE`, `ZWM_PALLETID`, `ZTR_SPLIT`) that hold the true pre-generated SSCC / pallet lineage are **not replicated** (ADR 007).
- **Validation:** HUs with null or duplicated SSCC.
  ```sql
  SELECT
    SUM(CASE WHEN sscc IS NULL THEN 1 ELSE 0 END) AS null_sscc,
    COUNT(*) - COUNT(DISTINCT sscc) AS duplicate_sscc
  FROM silver.handling_unit;
  ```
- **Risk:** SSCC-level tracking is approximate; pallet/TR-split execution detail unavailable.
- **Status:** Unverified (blocked on source). **Owner:** WM/logistics owner.

## BR-EXC-009 — Exception severity & SLA thresholds are provisional
- **Used by:** `gold_warehouse_exceptions`
- **Source fields:** per-branch age/qty thresholds, `severity (1–4)`, `sla_hours`
- **Assumption:** the aging windows (e.g. QI > 14d, blocked > 3d, open TO > 24h) and severity mapping reflect operational policy.
- **Validation:** exception-type volume + age distribution for business review.
  ```sql
  SELECT exception_type, severity, COUNT(*) AS n, ROUND(AVG(age_hours), 1) AS avg_age_hours
  FROM gold.gold_warehouse_exceptions
  GROUP BY exception_type, severity ORDER BY n DESC;
  ```
- **Risk:** mis-tuned thresholds cause alert fatigue or missed exceptions.
- **Status:** Unverified. **Owner:** Warehouse operations lead.

---

## Next steps (hardening Phase 4.2/4.3)
- Promote each validation query to a `gold_validation_*` view so coverage is monitored continuously.
- For outputs on unverified logic (BR-WM-002, BR-IM-006), consider an `assumption_status` column
  (e.g. `TO_SOURCE_REFERENCE_MAPPING_UNVERIFIED`) until the rule is plant-confirmed.
- Track each rule's owner / validation result / decision date alongside the roadmap.
