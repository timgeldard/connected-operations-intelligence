# Golden Process Orders (UAT Candidate Ledger)

This document catalogs known manufacturing process orders in the Databricks Unity Catalog UAT environment (`connected_plant_uat.csm_process_order_history`). Use these candidate orders during E2E browser and API testing.

---

## Candidate Orders

### 1. Process Order `7006965038`
* **Plant ID**: `C113`
* **Material ID**: `70373871`
* **Material Description**: `MIXED BERRY FLV LQD`
* **Order Status**: `CLOSED`
* **Expected Header Presence**: Expected from `vw_gold_process_order` based on SQL probe.
* **Expected Operation Count**: 11 operations from SQL probe.
* **Expected Confirmation Count**: Unknown for this candidate; validate during UAT and do not infer absence from an empty response.
* **Expected Goods Movement Count**: Present in SQL probe, exact count pending UAT evidence capture.
* **Evidence Description**:
  * **Operations**: Returns exactly 11 operations (phases OP-010 to OP-110) from `vw_gold_process_order_phase`.
  * **Goods Movements**: Includes Goods Issues (261) and Goods Receipts (101) from `vw_gold_adp_movement`.
* **Validation Status**: SQL-probed only — browser E2E pending
* **Validation Type**: SQL-only
* **Validation Date**: 2026-05-18
* **Environment/Catalog/Schema**: `connected_plant_uat.csm_process_order_history`
* **Source Views Used**:
  * `vw_gold_process_order` (Header details)
  * `vw_gold_process_order_phase` (Operations details)
  * `vw_gold_adp_movement` (Goods movements)
* **Evidence Note**: SQL schema and record counts verified via Databricks Statement API during the 2026-05-18 validation probe (commit `491c6a6`).
* **Evidence Link / Notes**: Use the POH `Copy UAT Evidence` payload plus browser/API screenshots in the UAT ledger. Candidate expected results require UAT validation; loaded data must be compared to SAP/Databricks source evidence.
* **Browser E2E Status**: Pending
* **Who/What Validated It**: AI agent / Engineering team via Databricks Statement API query validation.

---

### 2. Process Order `7006965039`
* **Plant ID**: `C113`
* **Material ID**: `70373871`
* **Material Description**: `MIXED BERRY FLV LQD`
* **Order Status**: `CLOSED`
* **Evidence Description**:
  * **Operations**: Returns exactly 13 operations (phases OP-010 to OP-130) from `vw_gold_process_order_phase`.
  * **Confirmations**: Contains 15 posted yield confirmations from `vw_gold_confirmation` totaling `375 KG` with actual operator postings from October/November 2025.
* **Validation Status**: SQL-probed only — browser E2E pending
* **Validation Type**: SQL-only
* **Validation Date**: 2026-05-18
* **Environment/Catalog/Schema**: `connected_plant_uat.csm_process_order_history`
* **Source Views Used**:
  * `vw_gold_process_order_phase` (Operations details)
  * `vw_gold_confirmation` (Yield confirmations)
* **Evidence Note**: SQL schema and record counts verified via Databricks Statement API during the 2026-05-18 validation probe (commit `491c6a6`).
* **Browser E2E Status**: Pending
* **Who/What Validated It**: AI agent / Engineering team via Databricks Statement API query validation.
