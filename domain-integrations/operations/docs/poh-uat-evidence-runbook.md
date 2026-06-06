# POH UAT Evidence Runbook

**Status:** Ready for execution — no prior live browser UAT run completed
**Created:** 2026-05-21
**Candidate:** process order `7006965038`, plant `C113`

This runbook is executable by a tester without needing repo history or Databricks direct access. It does not claim UAT is passed — it defines what to capture so that evidence is comparable across sessions.

---

## Before Starting

- [ ] Obtain the deployed app URL from the team.
- [ ] Confirm commit SHA: `git rev-parse --short HEAD` on the deployed build or read from the app footer.
- [ ] Confirm adapter mode: the POH Header section must show a source badge. It must read `databricks-api` — not `mock`. If you see `mock`, stop.
- [ ] Confirm your AAD/OAuth identity is authenticated (you are logged in as yourself, not a service principal).
- [ ] Note tester identity (alias or ticket reference — no full name or email address).
- [ ] Confirm the UAT candidate button or form accepts `7006965038 / C113`.

**Access requirements:** Direct Databricks SQL access is **not required** for this browser UAT. You need access to the deployed app in `databricks-api` mode and must be authenticated via your AAD/OAuth identity. The app connects to Databricks on your behalf using your OAuth token.

---

## Environment Record

| Field | Value |
|---|---|
| App URL | |
| Commit SHA (deployed build) | |
| Adapter mode confirmed | |
| Tester identity (alias/ref) | |
| Test date/time (YYYY-MM-DD HH:MM) | |
| Input: processOrderId | 7006965038 |
| Input: plantId | C113 |

---

## Capture Checklist

### A — Header

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Source badge | `databricks-api` | | |
| Header loads | HTTP 200; fields populated | | |
| Process order ID | `7006965038` | | |
| Material ID | Record exact value (preserve leading zeros as string) | | |
| Plant | `C113` | | |
| Order status | Record exact value | | |
| Planned start/end | Populated or blank (record which) | | |
| Actual start/end | Populated or blank | | |
| Order quantities | Populated or blank — if blank, do NOT interpret as zero | | |
| Source attribution | Record source label shown | | |

Screenshot required: header section.

---

### B — Operations

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Source badge | `databricks-api` | | |
| Operations load | HTTP 200; row count > 0 or honest no-record state | | |
| Row count | Record integer | | |
| Operation numbers | Record sample values | | |
| Work centre | Populated or blank (absent in confirmed source — record which) | | |
| Planned/actual dates | Populated or blank | | |
| No-record state message | If 0 rows: explicit message shown — must NOT imply no operations took place | | |

Screenshot required: operations section.

---

### C — Confirmations

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Source badge | `databricks-api` | | |
| Confirmations load | HTTP 200; row count ≥ 0 | | |
| Row count | Record integer | | |
| Confirmation IDs | Record sample values (preserve as strings) | | |
| `operationText` | Populated or blank (absent in confirmed source) | | |
| Final confirmation flag | Populated or blank | | |
| No-record state message | If 0 rows: message must NOT imply no confirmations occurred | | |
| Timestamp handling | Null timestamps shown as blank, not as epoch or zero | | |

Screenshot required: confirmations section.

---

### D — Goods Movements

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Source badge | `databricks-api` | | |
| Goods movements load | HTTP 200; row count ≥ 0 | | |
| Row count | Record integer | | |
| Movement type values | Record sample (101, 261, 641, etc.) | | |
| Movement direction values | Record — may include `unknown`; unknown rows must be visible, not filtered | | |
| Material IDs | Preserved as strings (leading zeros intact) | | |
| Batch IDs | Preserved as strings (leading zeros intact) | | |
| `materialDescription` | Populated or blank (absent in confirmed source) | | |
| No-record state message | If 0 rows: message must NOT imply no movements occurred | | |

Screenshot required: goods movements section.

---

### E — Component Consumption

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Component rows visible | Derived from goods movements (261 adds, 262 subtracts, EA excluded) | | |
| Each row shows material + batch + UOM | `materialId`, `batchId`, `uom` all visible per row | | |
| Multiple batches separate | Different batch IDs appear as separate rows, not collapsed | | |
| Mixed UOMs separate | KG rows and other UOM rows not summed together | | |
| Zero net rows visible | Rows with netQuantity = 0 (full reversals) are visible — not filtered | | |
| Negative net rows visible | Rows with netQuantity < 0 (over-reversals) are visible | | |
| No BOM/reservation coverage claim | Panel must NOT imply this covers all components | | |

**Important:** Component consumption must show material + batch + UOM grouping. Mixed UOM quantities must not be summed. Multiple batches must remain visible as separate rows. Zero/negative net rows must not disappear.

Screenshot required: component consumption section showing material + batch + UOM columns.

---

### F — Produced Output

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Output rows visible | Derived from goods movements (101 adds, 102 subtracts) | | |
| Each row shows material + batch + UOM | All three fields visible per row | | |
| Zero net rows visible | Full reversals (101 reversed by 102) are visible | | |
| Negative net rows visible | Over-reversals visible | | |
| No production completion claim | Panel must NOT imply this is a complete production record | | |

Screenshot required: produced output section.

---

### G — Source Badges

| Item | Expected (pass) | Observed | Pass / Fail / Blocked |
|---|---|---|---|
| Each section has a source badge | Header, operations, confirmations, movements all show `databricks-api` | | |
| No section shows `mock` as source | None of the four sections shows mock source in live mode | | |
| Mixed source handling | If one section returns error, its badge shows error/unavailable — not mock | | |

---

### H — Copy UAT Evidence Payload

- [ ] Click "Copy UAT Evidence" button.
- [ ] Paste payload here or into the UAT ledger:

```
[paste payload here]
```

Payload must include: `adapterMode`, section source summary, section completeness, counts, and `warnings`.

---

### I — Error and Unavailable States

| Item | Details |
|---|---|
| Any HTTP errors shown | |
| Any sections in error/unavailable state | |
| Any sections showing mock data unexpectedly | |
| Defects found | |

---

## Pass/Fail Guidance

| Criterion | Pass | Fail |
|---|---|---|
| All 4 route sections load with `databricks-api` source | Source badge = `databricks-api` on all sections | Any section shows `mock` |
| Component rows show material + batch + UOM | Three columns visible per row | Only material shown; batch missing |
| Multiple batches not collapsed | Separate rows for different batch IDs | Single aggregated row per material |
| Mixed UOMs not summed | KG and other UOM rows separate | Summed into single quantity |
| Zero/negative net rows visible | Rows with netQuantity ≤ 0 present | Zero rows silently absent |
| No-record sections show explicit message | "No records returned" / "Pending" message | Silent empty section or zero count |
| No section implies confirmed absence | No "No operations" / "No confirmations" claim | Any claim of complete absence |
| Source not shown as mock when live | All sections non-mock in deployed `databricks-api` mode | Any mock badge in live mode |

---

## Evidence Capture Template

Copy and fill in before closing the session:

```
Tester:
Date/time:
Environment URL:
Commit SHA / deployment version:
Adapter mode:
Input values (processOrderId / plantId):
Screenshots captured (list sections):
Copy evidence payload captured: Yes / No
Observed source badges (list per section):
Observed warnings:
Unexpected errors:
Pass/fail (overall):
Defects raised:
Notes:
```

---

## After the Session

1. Update `domain-integrations/operations/docs/poh-uat-readiness-notes.md` remaining UAT blockers section.
2. Note any component/output rows that differ from source evidence.
3. Raise defects for any movement direction codes that appear `unknown` and require business review.
4. If browser E2E is confirmed for all 4 routes, update `production-readiness-checklist.md` accordingly.
