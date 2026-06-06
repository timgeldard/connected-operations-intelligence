# Golden Test Batches — Traceability Investigation Cockpit (V2)

**Status:** Pre-validation register  
**Date issued:** 2026-05-19  
**Audience:** QA, food safety, supply chain testers

> **Mock-only constraint — read before using this register.**
> As of 2026-05-19, the V2 traceability cockpit is backed by mock data only. No browser session against a live Databricks or legacy-api source has been performed. The "expected" values in this register for the mock development batch come from the mock fixture in `trace2-mock-data.ts` — they are not live-validated figures. The reference candidate entries and any future entries must be validated against live Databricks gold views before the "expected" columns can be completed.
>
> Do not treat values marked "(mock)" as expected production output.

---

## What "validated" means

A batch entry in this register is considered **validated** when:

1. A real user session against the V2 app has loaded the batch via the query form.
2. The data displayed in the cockpit has been confirmed correct by cross-referencing against the live Databricks gold views (`gold_batch_delivery_v`, `gold_batch_mass_balance_v`, `gold_batch_quality_*`) or against SAP source records.
3. The tester has signed off the run in `uat-validation-ledger.md` with a run ID, date, environment, and app version commit.

Passing a unit test or showing data in mock mode does not count as validation.

---

## Batch Register

---

### Entry 1 — Mock development batch

| Field | Value |
|---|---|
| **material_id** | `100023847` |
| **batch_id** | `CH-240308-0047` |
| **plant_id** | `IE10` |
| **why_useful** | Primary development and unit-test fixture. All Phase 1 component and adapter tests use this batch. Exercises the main "active investigation with critical downstream exposure" scenario. |
| **expected_lineage_direction** | Both upstream and downstream (mock) |
| **expected_downstream_exposure** | Mock returns: 3 customers across IE, GB, DE; 1 400 KG shipped; 5 deliveries; 2 blocked deliveries; recall recommended. Values are from the mock fixture only — not live-validated. |
| **expected_customer_evidence** | Mock returns: `affectedCustomers: 3`, `affectedDeliveries: 5`, `shippedQuantity: 1400`, `countries: ['IE', 'GB', 'DE']`, `highestSeverity: 'critical'`. Values are from the mock fixture only. |
| **expected_stock_evidence** | Mock returns: quantity 2 400 KG, stockStatus `quality-inspection`, releaseStatus `blocked`, batchStatus `blocked`. Values are from the mock fixture only. |
| **expected_quality_evidence** | Mock returns: qualityStatus `pending`, releaseStatus `blocked`. Values are from the mock fixture only. |
| **expected_coa_evidence** | Mock returns: CoA available (`coaAvailable: true`), releaseStatus `blocked`, usageDecision `reject`, 0 failed characteristics, 2 pending results. Values are from the mock fixture only. |
| **expected_mass_balance_evidence** | Mock returns: input 24 002.4 KG-equivalent, output 2 400.0 KG, variance 21 602.4 KG-equivalent (10%), confidence 0.94, 1 unresolved movement. The large variance reflects the raw milk input expressed in litres vs. the cheese output in KG — it is a units artefact in the mock, not a real mass balance signal. Values are from the mock fixture only. |
| **validation_date** | Not applicable |
| **validation_status** | Mock data — no UAT required. This batch does not exist in any live system. |
| **source_of_evidence** | `domain-integrations/traceability/src/adapters/trace2-mock-data.ts` |

**Additional notes for this batch:**
- The mock scenario represents a fictional Emmental cheese batch at Kerry Listowel plant (IE10), manufactured 2024-03-08, expiry 2024-09-08. (The `plantName` value in the mock fixture is `Kerry Listowel`.)
- The investigation context is: INV-2024-003847, severity `high`, status `in-progress`.
- The investigation trigger in the mock is an elevated Listeria monocytogenes environmental signal in the ripening zone.
- Upstream lineage in mock: 2 raw material nodes (Pasteurised Whole Milk — 24 000 L, Cheese Starter Culture DVS 3000 — 2.4 KG), 1 unresolved supplier lot (Golden Vale Dairy Co-op, SL-GOLDEN-240308-019).
- All of the above is fictional and intended only for component development and UI testing.

---

### Entry 2 — Reference candidate A

| Field | Value |
|---|---|
| **material_id** | `000000000020052009` |
| **batch_id** | `0008602411` |
| **plant_id** | `C061` |
| **why_useful** | Known reference candidate from prior traceability work. Intended as the first real-data validation batch once live Databricks access is available. |
| **expected_lineage_direction** | Unknown — requires UAT validation |
| **expected_downstream_exposure** | Unknown — requires UAT validation |
| **expected_customer_evidence** | Unknown — requires UAT validation |
| **expected_stock_evidence** | Unknown — requires UAT validation |
| **expected_quality_evidence** | Unknown — requires UAT validation |
| **expected_coa_evidence** | Unknown — requires UAT validation |
| **expected_mass_balance_evidence** | Unknown — requires UAT validation |
| **validation_date** | Not yet performed |
| **validation_status** | Requires UAT validation. No browser or Databricks session has been performed against this batch in V2. |
| **source_of_evidence** | Prior traceability project reference only. No data-contract or source validation performed. |

**Additional notes for this batch:**
- This batch was identified as a candidate reference from prior traceability work. The identifiers have been recorded here for use in first-run UAT.
- Before running UAT with this batch: confirm the batch still exists in the target Databricks environment, and that plant C061 is accessible to the test user's OAuth identity.
- All "expected" fields above must be completed by a tester after a successful live session. Do not fill in values based on inference or prior V1 behaviour — V1 parity has not been established for V2.

---

### Entry 3 — Confirmed UAT candidate (Silicon Dioxide Powder, C061)

| Field | Value |
|---|---|
| **material_id** | `20035129` |
| **batch_id** | `8000049668` |
| **plant_id** | `C061` |
| **why_useful** | Confirmed to exist in connected_plant_uat gold views. Used for column verification live validation on 2026-05-19. Has unrestricted stock at C061 (135 KG), manufacture date 2025-05-31, shelf life expiration 2027-05-31. Reference candidate (000000000020052009/0008602411) returned 0 rows in UAT — this is the confirmed working replacement for first live session. |
| **expected_lineage_direction** | Unknown — requires full UAT session to confirm |
| **expected_downstream_exposure** | Unknown — requires UAT session |
| **expected_customer_evidence** | Unknown — requires UAT session |
| **expected_stock_evidence** | Confirmed from live gold_batch_stock_v: unrestricted=135, blocked=0, quality_inspection=0, total_stock=135, PLANT_ID=C061, uom=KG (BASE_UNIT_OF_MEASURE from gold_material). |
| **expected_quality_evidence** | qualityStatus expected 'unknown' (no QI stock, no QM decision source wired). |
| **expected_coa_evidence** | Unknown — CoA panel is mock-only. |
| **expected_mass_balance_evidence** | Unknown — requires UAT session against gold_batch_mass_balance_v. |
| **validation_date** | Partial — column verification only (2026-05-19). Full app-level UAT not yet performed. |
| **validation_status** | Partial — stock + summary + material data confirmed from direct Databricks queries. Full UAT session pending (app not yet deployed). |
| **source_of_evidence** | Direct Databricks SQL queries via Statement Execution API, 2026-05-19, connected_plant_uat, warehouse `connected_plant_uat` (e76480b94bea6ed5). |

**Additional notes:**
- Material name: Silicon Dioxide Powder (gold_material, LANGUAGE_ID='E').
- This batch supersedes Entry 2 (000000000020052009/0008602411) as the primary UAT candidate — Entry 2 exists in prior V1 work but returns 0 rows in the connected_plant_uat environment.
- Use this batch when running the first full UAT session against the deployed V2 app.

---

### Entry 4 — Confirmed high-delivery batch (20514264 / 0005717261)

| Field | Value |
|---|---|
| **material_id** | `20514264` |
| **batch_id** | `0005717261` |
| **plant_id** | _(multi-plant — not filtered for delivery queries)_ |
| **why_useful** | Confirmed to have 1977 customer delivery rows in `gold_batch_delivery_v` (connected_plant_uat). Use for CD-2/CD-3 browser UAT — delivery panel should show affectedCustomers > 0, countries populated, UOM=KG. |
| **expected_customer_evidence** | affectedDeliveries ≥ 1977 (live count from Databricks Statement API 2026-05-20); countries includes 'US'; customer includes SAM'S CLUB.COM (0001141028); UOM=KG; deliveryEvidenceSource='inventory-movements'. |
| **expected_lineage_direction** | Unknown — requires full UAT session |
| **expected_downstream_exposure** | Unknown — requires full UAT session |
| **expected_stock_evidence** | Unknown — requires UAT session |
| **expected_quality_evidence** | Unknown — requires UAT session |
| **expected_coa_evidence** | Unknown — CoA panel is mock-only. |
| **expected_mass_balance_evidence** | Unknown — requires UAT session |
| **validation_date** | Partial — customer delivery slice only (2026-05-20 via Databricks Statement API). Full app-level UAT not yet performed. |
| **validation_status** | Partial — delivery query confirmed from direct Databricks Statement API. Browser UAT scenarios CD-4 through CD-6 pending. |
| **source_of_evidence** | Direct Databricks Statement API query, 2026-05-20, connected_plant_uat, warehouse e76480b94bea6ed5. See DEF-TRACE-006 CD-2/CD-3 in uat-validation-ledger.md. |

**Additional notes:**
- This batch is the recommended primary candidate for customer delivery UAT (CD-2/CD-3).
- Do not use Entry 2 (000000000020052009/0008602411) for delivery UAT — that batch returned zero rows in gold_batch_delivery_v.
- Entry 3 (20035129/8000049668) is the batch stock/summary candidate; use this entry (Entry 4) for delivery panel validation.

---

### Entry 5 — Multi-supplier batch for supplier exposure UAT (20394026 / 0005587610)

| Field | Value |
|---|---|
| **material_id** | `20394026` |
| **batch_id** | `0005587610` |
| **plant_id** | _(no plant filter applied to supplier-exposure queries)_ |
| **why_useful** | Confirmed to have 4 distinct VENDOR_RECEIPT suppliers across US/DE/AE in `gold_batch_lineage` (after the empty-SUPPLIER_ID filter). Use for SE-2 browser UAT — supplier panel should show supplierCount=4, suppliers[] populated, names visible. |
| **expected_supplier_evidence** | supplierCount=4 (Agropur MSI LLC / Red Arrow Handels GmbH / Red Arrow Handels VP21601 / Millenium Chemical Trading LLC). Top supplier: Agropur MSI LLC (0005033449), US, 1,886,976 KG across 144 receipts. UOM=KG for all. Source 2026-05-21 via Databricks Statement API. |
| **expected_customer_evidence** | Unknown — requires UAT session |
| **expected_lineage_direction** | Unknown — requires full UAT session |
| **expected_downstream_exposure** | Unknown — requires full UAT session |
| **expected_stock_evidence** | Unknown — requires UAT session |
| **expected_quality_evidence** | Unknown — requires UAT session (TRACE-P1-012 blocks verified QM evidence) |
| **expected_coa_evidence** | Unknown — CoA panel is mock-only. |
| **expected_mass_balance_evidence** | Unknown — requires UAT session |
| **validation_date** | Partial — supplier exposure slice only (2026-05-21 via Databricks Statement API). Full app-level UAT not yet performed. |
| **validation_status** | Partial — supplier query confirmed from direct Databricks Statement API. Browser UAT pending. |
| **source_of_evidence** | Direct Databricks Statement API query, 2026-05-21, connected_plant_uat, warehouse e76480b94bea6ed5. See `supplier-exposure-source-mapping.md`. |

**Additional notes:**
- Entry 3 (20035129/8000049668) returns only 1 supplier (PQ Silicas UK) — fine for happy-path SE-1 UAT but does not exercise multi-supplier rendering.
- Use this Entry 5 batch when validating the supplier table renders multiple rows correctly across countries.

---

### Entry 6 — Production history candidate (70948010)

| Field | Value |
|---|---|
| **material_id** | `70948010` |
| **batch_id** | _(production-history queries filter by material only)_ |
| **plant_id** | _(returns multi-plant: P132, P648, P638)_ |
| **why_useful** | Highest-volume material in `gold_batch_production_history_v` — 26,196 historical batches between 2022-02-27 and 2025-09-28. Use for PH-2 browser UAT — production history panel should return 24 most-recent batches with quality status distribution. |
| **expected_production_history_evidence** | totalBatches=24 (LIMIT 24); first batch (2025-09-28) plant=P648 / batch=0011062334 / process_order=007006964801 / qty=31335.789 KG / quality=Pass. Distribution as of 2026-05-21 sample: top 24 batches all Pass. |
| **expected_customer_evidence** | Unknown — requires UAT session |
| **expected_supplier_evidence** | Unknown — requires UAT session |
| **expected_lineage_direction** | Unknown — requires full UAT session |
| **expected_downstream_exposure** | Unknown — requires full UAT session |
| **expected_stock_evidence** | Unknown — requires UAT session |
| **expected_quality_evidence** | quality_status from production-history view is 'Pass'/'Fail' label, NOT the SAP QM release decision (TRACE-P1-012). Do not treat Fail rows as confirmed rejections. |
| **expected_coa_evidence** | Unknown — CoA panel is mock-only. |
| **expected_mass_balance_evidence** | Unknown — requires UAT session |
| **validation_date** | Partial — production history slice only (2026-05-21 via Databricks Statement API). Full app-level UAT not yet performed. |
| **validation_status** | Partial — production history query confirmed from direct Databricks Statement API. Browser UAT pending. |
| **source_of_evidence** | Direct Databricks Statement API query, 2026-05-21, connected_plant_uat, warehouse e76480b94bea6ed5. See `production-history-source-mapping.md`. |

**Additional notes:**
- Entry 3 (20035129) is a raw-input material — production-history correctly returns 0 rows for it. That is the zero-rows happy path for PH-3 UAT.
- Use this Entry 6 material when validating the production history table renders multiple rows correctly with pass/fail distribution.

---

### Entry 7 — Next validated batch (template)

| Field | Value |
|---|---|
| **material_id** | _(to be completed by QA)_ |
| **batch_id** | _(to be completed by QA)_ |
| **plant_id** | _(to be completed by QA)_ |
| **why_useful** | _(describe why this batch was selected — e.g. known supplier issue, multi-plant lineage, zero-delivery containment, etc.)_ |
| **expected_lineage_direction** | _(upstream / downstream / both — confirm from live session)_ |
| **expected_downstream_exposure** | _(complete from live session output — do not infer from V1)_ |
| **expected_customer_evidence** | _(complete from live session output)_ |
| **expected_stock_evidence** | _(complete from live session output)_ |
| **expected_quality_evidence** | _(complete from live session output)_ |
| **expected_coa_evidence** | _(complete from live session output)_ |
| **expected_mass_balance_evidence** | _(complete from live session output)_ |
| **validation_date** | _(date of successful UAT session)_ |
| **validation_status** | _(pending / validated / blocked)_ |
| **source_of_evidence** | _(UAT run ID from `uat-validation-ledger.md`, plus Databricks gold view names queried)_ |

---

## How to add new batches

To register a new test batch:

1. Copy the template above (Entry 7) and append it to this file as a new numbered entry.
2. Fill in `material_id`, `batch_id`, and `plant_id` from the real SAP records.
3. Describe why this batch is useful in `why_useful` — the richer the reason, the more useful the register becomes over time.
4. Leave all "expected" fields as "Unknown — requires UAT validation" until a live session has been completed.
5. After the live session, update the expected fields with the values observed in the V2 cockpit, cross-referenced against Databricks gold views or SAP records.
6. Set `validation_status` to "validated" and record the `validation_date` and UAT run ID.
7. Never copy expected values from the mock fixture or from V1 output into the "expected" fields for a real batch. Each batch's expected behaviour must come from a V2 live session against the real data source.

A batch is only "validated" when a real tester, in a real environment, with a real OAuth session, has confirmed that the V2 cockpit output matches the underlying gold views. Mock output and unit test output do not qualify.
