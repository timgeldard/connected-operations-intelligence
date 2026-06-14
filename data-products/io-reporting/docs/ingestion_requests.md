# Ingestion / source requests — warehouse operations data product

Hand-off list of source dependencies the warehouse data product needs from the
platform / replication teams. Code that consumes each item is already in the repo
(behind the lazy second-source helper or documented as a limitation) — these are the
**external** actions required to reach full fidelity. See ADR 006 / ADR 007.

## 1. Replicate WMA-E-50 execution tables into `connected_plant_<env>.sap`
Not currently replicated in any catalog. Until they land, handling units (VEKP/VEPO)
only **approximate** SSCC and the staging/campaign execution detail cannot be reproduced.

| SAP table | Needed for |
|---|---|
| `ZWM_SSCC_CREATE` | True pre-generated SSCC + pallet status (vs. HU approximation) |
| `ZWM_PALLETID` | Pallet-ID lineage for staged SSCCs |
| `ZTR_SPLIT` | TR split type / campaign / auto-SSCC config |
| `ZSCMWM_RFCTR` | Per-warehouse RF control flags (staging behaviour) |
| `ZSCMWM_DISPNSARY` | Dispensary storage-type configuration |
| `ZMANPEX_INTERF` | Movement/label GAP configuration |
| `COCH` / `COME` / `COMH` | Control recipe / PI-sheet status (if PI-sheet staging is in scope) |

## 2. Confirm the second bronze source per target
The product reads plant/customer/vendor/PO/HU masters from a published catalog via the
`published_catalog` / `published_schema` bundle variables (`databricks.yml`).

| Target | Assumed published source | Confirm |
|---|---|---|
| `dev_uat_source` | `published_uat.central_services` | ✅ verified present |
| `dev_sample` | `published_uat.central_services` | sample catalog has none — intentional (reads live UAT) |
| `uat` | `published_uat.central_services` | ✅ verified present |
| `prod` | `published_prod.central_services` | ⛔ **confirm catalog name exists / is accessible** |
| `prod` (security) | `published_prod.security.model` | ⛔ **confirm exists with `io_reporting` rows before prod consumer access** |

Tables consumed there (already verified in UAT): `plantcode_t001w`, `customermaster_kna1`,
`vendormaster_lfa1`, `procurementorderobject_ekko/_ekpo`, `handlingunit_vekp/_vepo`.

## 3. ~~Decision~~ Silver / Gold schema for uat/prod — ✅ resolved 2026-06-03
UAT and prod use **dedicated product schemas** `silver_io_reporting` / `gold_io_reporting`
in their respective catalogs (`connected_plant_uat`, `connected_plant_prod`). This avoids
name-collision with the shared platform `silver` / `gold` schemas (which already hold
`gold_process_order`, `gold_plant`, etc.). Dev targets continue to use `silver_dev` /
`gold_dev` in the clean `connected_plant_dev` catalog.

## 4. Next-phase dependencies (roadmap — see docs/data-product-roadmap.md, ADRs 008–010)
- **Shift calendar (ADR 008):** no SAP shift master in bronze (no `TC37A`/`TC37`). Need per-plant
  shift-calendar config (external Excel→Bronze or seeded), and optionally request `TC37A`/`TC37`
  replication into `…sap`.
- **Detailed reconciliation (ADR 009):** ~~ingest **`MARM`**~~ — **MARM is already ingested** as `connected_plant_uat.sap.materialconversion_marm` (1.57M rows, 1.05M materials, confirmed 2026-06-02). `silver.material_uom_conversion` is now wired into the slow pipeline. Remaining dependency: populate `silver.warehouse_storage_location_mapping` (T320 already in `published_uat.central_services.warehouseforplant_t320` — also now wired).
- **Lineage/dictionary (ADR 010):** grants on `system.access.table_lineage` /
  `system.access.column_lineage` for the principal running the dictionary generator.
- **Aecorsoft Field Rules Review (Cost Optimization):** Review Aecorsoft's functionality to apply rules/transformations directly to fields at replication/ingestion time. Applying basic filters, type casting, or zero-stripping at the replication level could reduce the storage and compute costs of raw bronze staging (mitigating hidden costs of reproducing full SAP columns/rows before filtering in Silver).

## 5. Push Despatch pallet/SSCC live log (ZPUSH_DISPATCH) — Spec 14 deferred KPI

ZPUSH_DISPATCH (the Push Despatch RF log table) is **not replicated** to any bronze catalog.
Until it lands, pallet-level (SSCC-grain) KPIs for Push Despatch are unavailable; the gold
model falls back to HU count from `handling_unit` (where available) or NULL.

| SAP object | Needed for |
|---|---|
| `ZPUSH_DISPATCH` | Pallet / SSCC grain for Push Despatch throughput (scanned SSCCs, pallet IDs) |

**Impact:** `gold_wm_push_despatch_delivery.pallet_count` is nullable — NULL when the HU table
is absent or has no matching HU. The KPI strip falls back to `line_count` with a UI label.
**Request:** replicate `ZPUSH_DISPATCH` into `connected_plant_<env>.sap` for all envs.
**Tracking:** Spec 14 (WMA-E-23). Product owner aware; accepted for v1.

## 6. CI secrets (for the bundle-validate job)
`.github/workflows/ci.yml` needs repository secrets `DATABRICKS_HOST` and `DATABRICKS_TOKEN`
(Settings → Secrets → Actions). The `notification_email` variable is now supplied to the
validate steps by the workflow itself.
