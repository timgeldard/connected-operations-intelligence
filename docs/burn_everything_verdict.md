# Burn-Everything Verdict: Connected Plant reporting Pipelines
**Status:** Documented Review  
**Date:** 2026-06-01  
**Author:** Senior Technical Architect

---

## Verdict Overview

**This repo is a promising architecture sketch, not yet a production-grade reporting data product.** The bones are sensible: Databricks Asset Bundle, split Silver/Gold pipelines, SCD1 operational state, Aecorsoft CDC metadata, row-filter scripts, and some unit tests. But the current implementation has too many contradictions between docs, deployment, and code to be trusted for factory-floor operational reporting across 100+ plants.

The biggest problem is not one bug. It is **false confidence**: the repo reads like it is production-ready, but key claims are either incomplete, manually applied, paused, unsecured at the consumption layer, or not implemented.

---

## Detailed Findings

### 1. Documentation and implementation are out of sync

The README says the bundle transforms SAP bronze data into **14 Silver tables** and computes Gold aggregates for production output, schedule adherence, and quality. It also says Silver uses SCD Type 1, liquid clustering, and Unity Catalog row filters, while Gold is intended as a trusted aggregate layer. 

That sounds strong. The problem is the Gold documentation describes **nine Gold outputs**, including transfer-order performance, inbound/outbound throughput, bin occupancy, stock availability, backlog, and expiry risk. 

But the actual Gold pipeline only defines **three tables**:

* `gold_shift_output_summary`
* `gold_order_otif_metrics`
* `gold_plant_production_quality_summary`

Those are the only functions in `gold/dlt_gold_pipeline.py`. 

**Burn finding:** the repo overstates its functional coverage. Anyone reading the design spec would think warehouse KPIs exist. They do not, at least not in the current Gold implementation.

**Fix:** make the docs brutally honest. Split Gold into:
* implemented
* designed but not implemented
* deliberately deferred
* blocked pending business rules

Right now the repo mixes those states.

---

### 2. The Gold layer is not fit for operational decision-making yet

The current Gold layer contains all-time or daily aggregates, but several names imply operational precision that is not really there.

Example: `gold_shift_output_summary` has no shift dimension. The Gold spec admits the “historical table name is retained” and that no shift dimension exists until a shift calendar is introduced. 

Example: `gold_order_otif_metrics` is explicitly not customer-delivery OTIF; it is internal process-order schedule adherence. 

Example: `gold_plant_production_quality_summary` is one row per plant across all available history, and the spec warns that it blends all available history. 

**Burn finding:** these Gold tables are too coarse for “integrated operations reporting.” They are prototype-grade KPIs, not production-grade operating metrics.

**Fix:** rebuild Gold around explicit grains:

| Area               | Required grain                                                                |
| ------------------ | ----------------------------------------------------------------------------- |
| Output             | plant × line/work centre × material × posting date × shift                    |
| Schedule adherence | plant × order × operation × planned/actual phase                              |
| Quality            | plant × inspection lot × material × batch × UD status × posting/decision date |
| Warehouse          | warehouse × storage type/bin × queue × source/destination × time bucket       |
| Stock              | plant × storage location × material × batch × stock category                  |
| Downtime           | plant × work centre × reason × order × time bucket                            |

Until that is done, treat Gold as demo data, not a decision layer.

---

### 3. Security posture is not finished

Silver row filtering is implemented as manual SQL scripts, not as a fully governed deployment step. The runbook says the row filter must be applied after first deployment by a Unity Catalog admin. 

The production row-filter function uses `current_user_attribute('allowed_plants')` and grants `silver_admin` full access.  It then manually applies row filters to each Silver table. 

Gold is more concerning. The runbook says Gold row filters are disabled by default and plant-level security must be enforced at the consumption boundary.  The Gold helper confirms row filters are only applied if `gold_apply_row_filter` is enabled, and the default is false. 

On top of that, all four pipeline resources grant `CAN_VIEW` to the broad `users` group.    

**Burn finding:** the security model is not end-to-end. Silver has row-filter scripts, but they are manual. Gold deliberately avoids row filters. Pipeline visibility is broad. This is not enough for multi-plant operational data.

**Fix:** define three access models:
1. **Silver direct access:** strict plant row filter.
2. **Gold aggregate access:** either plant-filtered Gold tables or separate secured Gold schemas by audience.
3. **Admin/support access:** explicit groups, not generic `users`.

Do not rely on downstream dashboards to be the only enforcement point.

---

### 4. The deployment defaults are dangerous

The bundle defaults point to production catalog and source catalog:

```yaml
catalog: connected_plant_prod
source_catalog: connected_plant_prod
```

That is visible in `databricks.yml`. 

The default target is `dev_uat_source`, which writes to dev but reads from UAT.  The docs also admit this is a “temporary compromise.” 

The Gold refresh job is scheduled three times daily, but it is **paused by default**.  The runbook also states the bundled job is paused by default and must be enabled after validation. 

**Burn finding:** this is not a clean dev/UAT/prod operational path. It is easy to accidentally validate against UAT, deploy with prod-looking defaults, and still not have Gold actually refreshing.

**Fix:** invert the defaults:
* default catalog should be dev/sample, never prod
* production deploy should require explicit target and explicit confirmation
* job schedule state should be target-specific
* notification email should be mandatory per environment
* dev should not read UAT unless named something brutally clear like `dev_reading_uat_do_not_use_for_perf`

---

### 5. The “continuous near-real-time” architecture is only partly continuous

The README describes Bronze → Silver via continuous Lakeflow and Gold via triggered batch. 

In reality, only the Silver fast pipeline is continuous.  Silver reference, Silver quality, and Gold are triggered.   

The Gold refresh job refreshes Silver reference and Silver quality, then Gold, but it does **not** trigger Silver fast.  The runbook explicitly warns that Gold can complete successfully while aggregating stale fast-domain data if the continuous fast pipeline is stopped or lagging. 

**Burn finding:** the freshness contract is weak. The repo can produce a successful Gold refresh over stale operational data.

**Fix:** add freshness gates before Gold refresh:
* assert max `_replicated_at` lag per critical Silver table
* fail Gold if fast Silver is stale beyond SLA
* publish freshness status as a Gold control table
* expose freshness in every dashboard

For factory-floor reporting, “pipeline succeeded” is not enough. You need “data is fresh enough to act on.”

---

### 6. The Silver incremental pattern is clever but risky at scale

The Silver pattern streams changed keys, then joins back to full bronze tables using `spark.read.table`. For example, goods movement streams changes from MSEG and MKPF, unions the keys, then joins back to full MSEG and MKPF. 

Warehouse transfer orders do the same with LTAK/LTAP.  Transfer requirements do the same with LTBK/LTBP.  Quality lots do the same with QALS/QMIH. 

This can be valid, but for high-volume SAP tables it is dangerous unless tightly controlled. MSEG-style tables are exactly where full snapshot joins can become expensive or explosive.

**Burn finding:** the repo uses a high-risk “trigger-stream refresh” pattern without enough visible protections against fan-out, duplicate changed keys, snapshot skew, late arriving headers, or massive joins.

**Fix:** introduce a formal CDC strategy per table:

| Table type                              | Preferred approach                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| Large line-item facts: MSEG, LTAP, LTBP | incremental keyed merge with deduped changed keys and bounded refresh window |
| Small reference tables                  | batch refresh or Auto Loader-style full replacement                          |
| Header/detail operational state         | precomputed changed-key table with dedupe and fan-out metrics                |
| Gold aggregates                         | refresh only affected date/plant partitions where possible                   |

Also add metrics: changed key count, joined row count, fan-out ratio, dropped rows, delete count, and max lag.

---

### 7. Some keys are too weak for SAP-scale modelling

`process_order` uses only `order_number` as the SCD key.  `process_order_operation` uses `order_number` and `operation_number`.  `quality_inspection_lot` uses only `inspection_lot_number`. 

The code joins source tables using `MANDT`, but the Silver outputs generally do not retain client as a key or column. For a single-client landscape that may be acceptable, but the repo should state that assumption explicitly and test it.

**Burn finding:** the model silently assumes a single SAP client / globally unique business keys. That is risky in enterprise SAP replication.

**Fix:** either retain `client_id` everywhere or document and enforce a one-client contract at ingestion. Do not casually drop `MANDT` from analytical keys unless the platform architecture guarantees uniqueness.

---

### 8. The helper defaults can accidentally point to production

`silver/helpers.py` builds `BRONZE` from Spark conf, but falls back to `connected_plant_prod.sap` if configuration is missing or an exception occurs. 

Gold has a similar fallback to `connected_plant_prod.silver`. 

**Burn finding:** production fallback is a footgun. Missing config should fail fast, not silently read production.

**Fix:** replace production fallbacks with hard failures outside explicit local-test mode. For example:
```python
if not spark.conf.contains("source_catalog"):
    raise ValueError("source_catalog must be set explicitly")
```
For tests, inject a local config. Do not make prod the default.

---

### 9. The model strips SAP leading zeros globally

`strip_zeros` removes leading zeros from numeric identifiers and returns `None` if the stripped result is empty.  The Silver design spec also states that key zero-padding is stripped in Silver. 

This is convenient for humans, but risky for SAP traceability and reconciliation. SAP external/internal formats matter. Material, batch, order, delivery, PO, reservation, and document numbers may need both raw and display forms.

**Burn finding:** the model destroys the original SAP key representation in many places.

**Fix:** keep both:
* `material_id_raw`
* `material_id_display`
* `batch_id_raw`
* `batch_id_display`
* `order_id_raw`
* `order_id_display`

Use raw keys for joins and reconciliation. Use display keys for dashboards.

---

### 10. Quality is under-modelled

The repo has a `quality_inspection_lot` table, but it is lot-level only. It joins QALS and QMIH, includes usage decision code/date/status, quantity, material, batch, and notification. 

For real site quality reporting, that is not enough. You need inspection characteristics, results, specs, defects, samples, valuation, UD history, stock posting, and links to batch release.

**Burn finding:** “quality” here is mostly inspection-lot header status. It cannot support serious Quality Manager use cases yet.

**Fix:** add at least:
* QAMV / QAMR / QASE characteristic and result model
* MIC/spec limits
* UD code catalog and UD selected set text
* defect/notification detail
* stock posting after UD
* batch release queue Gold view
* failed MIC Pareto
* OOS / near-spec warning model

Until then, do not position this as a quality reporting product.

---

### 11. Tests are too thin and too Gold-biased

The test suite shown covers the three implemented Gold functions.  It mocks DLT heavily so the functions can be imported locally. 

That is useful, but it does not test the hard parts:
* CDC ordering
* delete handling
* duplicate source rows
* late headers
* row filters
* Databricks bundle validation
* schema evolution
* source table absence
* high-volume join behavior
* plant security leakage
* SAP key formatting
* movement sign conventions beyond a tiny sample

**Burn finding:** the tests prove the current three Gold functions work against tiny mocked DataFrames. They do not prove the pipeline is safe.

**Fix:** add three classes of tests:
1. **Unit tests:** helper functions, movement classification, date/time conversion.
2. **Contract tests:** schema, keys, nullability, row counts, duplicate checks.
3. **Integration tests:** bundle validation and pipeline dry-run against sample bronze data.

---

### 12. The Gold and Silver specs are better than the code

This is the uncomfortable bit: the docs often know the right answer. The Silver design spec talks about 100+ plants, liquid clustering, SCD1, trigger-stream refresh, row filters, and Gold shift boundaries. 

The runbook even calls out stale Gold risk, row-filter implications, and process-order type confirmation. 

**Burn finding:** the repository has architectural intent, but the implementation is lagging behind the design. That is dangerous because good docs can hide unfinished code.

**Fix:** turn the docs into executable governance:
* every documented table must have an implemented pipeline function or be marked “planned”
* every freshness caveat must become a pipeline check
* every row-filter statement must be automated or blocked
* every caveat must have an owner and exit condition

---

## Remediation Strategy: What to Burn Down First

### Priority 0 — Stop pretending Gold is complete
Rename the current Gold layer to something like `gold_prototype` or mark the missing six Gold tables as planned only. The current mismatch between Gold spec and Gold code is the most misleading part of the repo.

### Priority 1 — Remove production fallbacks
No code path should silently default to `connected_plant_prod`. The helper fallback is a production-risk smell.

### Priority 2 — Enforce freshness before Gold
Gold must fail if Silver fast is stale. The runbook already admits the risk.

### Priority 3 — Redesign security end-to-end
Silver row filters are manual, Gold row filters are disabled, and pipeline permissions are broad. That is not good enough for a multi-plant data product.

### Priority 4 — Introduce raw/display key pairs
Do not strip SAP keys destructively. Keep raw SAP keys for joins and audit.

### Priority 5 — Build proper warehouse and quality Gold
The missing warehouse Gold tables are exactly the useful ones: backlog, bin occupancy, stock availability, expiry risk, inbound/outbound throughput. The docs describe them, but the code does not implement them.

---

## Architectural Rating

| Area                 | Rating | Comment                                                        |
| -------------------- | -----: | -------------------------------------------------------------- |
| Architecture intent  |   8/10 | Strong direction, sensible medallion pattern                   |
| Production readiness |   3/10 | Too many manual steps and unimplemented promises               |
| Security             |   4/10 | Silver has a model; Gold and permissions are weak              |
| Cost control         |   5/10 | Good split fast/slow, but risky stream-static joins            |
| SAP modelling        |   5/10 | Good start, but key formatting and quality depth are weak      |
| Testing              |   3/10 | Thin tests, mostly happy-path Gold                             |
| Documentation        |   6/10 | Good content, but misleading because it outruns implementation |
| Operability          |   4/10 | Runbook exists, but freshness and security are not automated   |
