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

Tables consumed there (already verified in UAT): `plantcode_t001w`, `customermaster_kna1`,
`vendormaster_lfa1`, `procurementorderobject_ekko/_ekpo`, `handlingunit_vekp/_vepo`.

## 3. Decision — Gold schema for uat/prod
`uat`/`prod` write `gold` into the **shared, multi-owner** `connected_plant_<env>.gold`
(already holds platform `gold_process_order`, `gold_plant`, etc.). Decide before the first
uat deploy: a **dedicated schema** for this product vs. coexist (name-collision / ownership
risk). `dev_*` targets write to the clean `connected_plant_dev`.

## 4. CI secrets (for the bundle-validate job)
`.github/workflows/ci.yml` needs repository secrets `DATABRICKS_HOST` and `DATABRICKS_TOKEN`
(Settings → Secrets → Actions). The `notification_email` variable is now supplied to the
validate steps by the workflow itself.
