# Traceability UAT Evidence Runbook

**Status:** Ready for execution — no prior live UAT run completed
**Created:** 2026-05-21
**Candidate:** material `20035129` / batch `8000049668` / plant `C061`
**Reference candidate (alternate):** material `000000000020052009` / batch `0008602411` / plant `C061`

This runbook is executable by a tester without needing repo history or Databricks direct access. It does not claim UAT is passed — it defines what to capture so that evidence is comparable across sessions.

---

## Before Starting

- [ ] Obtain the deployed app URL from the team (do not guess).
- [ ] Confirm commit SHA: run `git rev-parse --short HEAD` on the deployed build or read the version shown in the app footer.
- [ ] Confirm adapter mode: the Batch Header panel must show a source badge. It must read `databricks-api` — not `mock` or `legacy-api`. If you see `mock`, stop — do not proceed with this runbook.
- [ ] Confirm your AAD/OAuth identity is authenticated (you are logged in as yourself, not a service principal).
- [ ] Confirm Unity Catalog access is expected for your identity. Contact the data platform team if unsure.
- [ ] Confirm screenshots or screen recording is permitted in your environment.
- [ ] Note tester identity (alias or ticket reference — no full name or email address).

**Access requirements:** Direct Databricks SQL access is **not required** for this browser UAT. You need access to the deployed app in `databricks-api` mode and must be authenticated via your AAD/OAuth identity. The app connects to Databricks on your behalf using your OAuth token.

---

## Environment Record

Fill in before starting:

| Field | Value |
|---|---|
| App URL | |
| Commit SHA (deployed build) | |
| Adapter mode confirmed | |
| Tester identity (alias/ref) | |
| Test date/time (YYYY-MM-DD HH:MM) | |
| Input: material_id | 20035129 |
| Input: batch_id | 8000049668 |
| Input: plant_id | C061 |

---

## Capture Checklist

### A — Batch Header

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Source badge | `databricks-api` | | |
| Batch header loads | HTTP 200; fields populated | | |
| `batchStatus` value | Record exact value | | |
| `stockStatus` value | Record exact value | | |
| `qualityStatus` value | `unknown` or `pending` — never `accepted` or `released` | | |
| `releaseStatus` value | Record exact value | | |
| `plantName` | Populated or blank (record which) | | |
| `manufactureDate` | Populated or blank | | |
| `expiryDate` | Populated or blank | | |
| UNRESTRICTED qty | Populated or explicit null | | |
| BLOCKED qty | Populated; amber highlight if non-zero | | |
| QI HOLD qty | Populated; amber highlight if non-zero | | |
| RESTRICTED qty | Populated or explicit null | | |
| TRANSIT qty | Populated or explicit null | | |
| `qualityStatus = unknown` warning visible | If unknown: warning note must be visible stating "do not interpret as accepted or rejected" | | |
| Plant-scoped result | Confirm only one plant row returned (C061) | | |

Screenshot required: batch header panel fully loaded.

---

### B — Trace Graph

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Source badge | `databricks-api` | | |
| Graph loads | HTTP 200; nodes and edges visible or honest no-record state | | |
| Node count | Record integer | | |
| Edge count | Record integer | | |
| `truncated` flag | true / false — record which | | |
| Truncation banner shown | If `truncated = true`: amber banner must be visible | | |
| Upstream nodes visible | Record count | | |
| Downstream nodes visible | Record count | | |
| Raw `LINK_TYPE` examples | Record up to 3 raw values from edge detail or network response | | |
| `relationshipType` mapped values | Record corresponding mapped values | | |
| Databricks query ID | Record from response header if visible | | |

Screenshot required: trace graph with nodes and edges visible (or no-record state if empty).

---

### C — Customer Exposure

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Source badge | `databricks-api` | | |
| HTTP status | 200 (data found) or 404 (no records) | | |
| If 200: severity banner text | Record exact text | | |
| If 200: `affectedCustomers` | Record integer | | |
| If 200: `affectedDeliveries` | Record integer | | |
| If 200: `shippedQuantity` | Record value and UOM | | |
| If 200: `maxExposureDepth` | Record integer | | |
| Depth label shown | "Direct shipment detected (depth 1)" or "Indirect exposure detected (min depth N)" | | |
| Country disclaimer shown | If `countries=[]` and deliveries > 0: amber disclaimer must be visible | | |
| If 404: "do not interpret as zero exposure" message visible | Confirm message is shown in panel | | |
| LINK_TYPE='DELIVERY' confirmed live | Record actual raw LINK_TYPE values observed | | |

Screenshot required: customer exposure panel (showing exposure or honest 404 state).

---

### D — Customer Deliveries

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Source badge | `databricks-api` | | |
| HTTP status | 200 or 404 | | |
| If 200: delivery rows loaded | Record row count | | |
| If 200: `affectedCustomers` | Record integer | | |
| If 200: `shippedQuantity` | Record value and UOM | | |
| If 200: countries populated | Record values | | |
| If 404: "do not interpret as zero exposure" message visible | Confirm message is shown | | |

Screenshot required: customer deliveries panel.

---

### E — Supplier Exposure

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Panel renders | Panel shows "data unavailable" or warning — not silent zero | | |
| Source attribution | Record source badge / label shown | | |
| `openSupplierActions` | Shows 0 with disclaimer or "unavailable" — never implies no risk | | |

Note: Supplier exposure has a live first slice (PR #57) from `gold_batch_lineage` + `gold_supplier`. Record the source badge and per-supplier rows if shown. `openSupplierActions` must show 0 with disclaimer or "unavailable" — this risk field remains blocked pending governance. Supplier exposure is not a supplier corrective-action list and does not imply supplier fault.

---

### F — Production History

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Source badge | `databricks-api` | | |
| Panel loads | HTTP 200 or honest no-record state | | |
| Row count | Record integer | | |
| `quality_status` values visible | Record sample values (Pass/Fail/unknown) | | |
| `quality_status` disclaimer visible | "Pass/Fail label from production history source — not a release decision" must be visible | | |

Screenshot required: production history panel.

---

### G — Mass Balance

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Source badge | `databricks-api` | | |
| Panel loads | HTTP 200 | | |
| Row count | Record integer | | |
| `confidence` value | Record value (0.0–1.0) | | |
| `unresolvedMovements` count | Record integer | | |
| Category mapping caveat visible | Amber warning banner for incomplete MOVEMENT_CATEGORY mapping must be visible (TRACE-P1-010) | | |
| BALANCE_QTY caveat visible | Disclaimer that balance figure is not a verified mass-balance result must be visible (TRACE-P1-011) | | |
| Panel does NOT show verified balance | Confirm no text claims mass balance is verified | | |

**Important:** Mass-balance panel must retain caveats while TRACE-P1-010 and TRACE-P1-011 remain open. Passing UAT does not mean mass balance is semantically approved — it confirms only that the panel loads and shows the correct caveat banners.

Screenshot required: mass balance panel showing caveat banner.

---

### H — Queried-At Labels and Confidence

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Queried-at timestamp visible | Each panel that returned data shows a queried-at label | | |
| Confidence tooltip | Confidence badge tooltip describes evidence basis | | |
| Source badge per panel | Each panel shows correct source badge | | |

---

### I — Copy UAT Evidence Payload

- [ ] Click "Copy UAT Evidence" button.
- [ ] Paste payload here or into the UAT validation ledger:

```
[paste payload here]
```

Payload must include: `adapterMode`, `sourceConfidence`, `warnings`, and section-level states.

---

### J — Warnings, Unavailable States, and Defects

| Item | Details |
|---|---|
| Any error banners shown | |
| Any "unavailable" panel states | |
| Any panels showing mock data unexpectedly | |
| Defects found | |

---

## Pass/Fail Guidance

| Criterion | Pass | Fail |
|---|---|---|
| Batch header loads with Databricks source | Source badge = `databricks-api`; fields populated | Source badge = `mock`; or HTTP error |
| Trace graph loads or honest no-record state | Nodes/edges visible OR explicit "no lineage records" message | Silent empty state with no message |
| Mass balance shows caveat | Amber banner for TRACE-P1-010 and TRACE-P1-011 visible | No caveat shown; or "mass balance verified" claimed |
| Customer exposure: 404 zero-rows message | "do not interpret as zero exposure" visible in panel | Silent zero / "no exposure" claim |
| Quality status unknown does not imply accepted | Warning note visible when `qualityStatus = unknown` | No warning; or "accepted" / "released" shown |
| No panel implies recall closure | No text reads "Contained", "Cleared", "Released", "Approved" without source evidence | Any of those terms shown without source attribution |
| Source not shown as mock when live | All panels have non-mock source badge | Any panel shows mock badge in deployed `databricks-api` mode |

---

## Evidence Capture Template

Copy and fill in before closing the session:

```
Tester:
Date/time:
Environment URL:
Commit SHA / deployment version:
Adapter mode:
Input values (material_id / batch_id / plant_id):
Screenshots captured (list panels):
Copy evidence payload captured: Yes / No
Observed source badges (list per panel):
Observed warnings:
Unexpected errors:
Pass/fail (overall):
Defects raised:
Notes:
```

---

## After the Session

1. Fill in the [Run table](./uat-validation-ledger.md#run-table) with all captured evidence.
2. Update `docs/migration/databricks-column-verification-queries.md` with any newly confirmed column names.
3. Update `production-readiness-checklist.md` rows 1.1, 1.2, 1.5, 1.7, 3.2, 3.4 to reflect the result.
4. Raise defects in `traceability-defect-backlog.md` for any mismatches.
5. If LINK_TYPE='DELIVERY' value confirmed live: update `customer-exposure-source-mapping.md` and the DEF-TRACE-005 entry.
6. If customer deliveries scenario CD-4 completed: update DEF-TRACE-006.
