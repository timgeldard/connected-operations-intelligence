# UAT Acceptance Script — Traceability Investigation Cockpit (V2)

**Status:** Pre-validation  
**Version:** V2 — mock data only  
**Date issued:** 2026-05-19  
**Audience:** Food safety, quality, supply chain (QA users)

> **Important constraint — read before testing.**
> As of 2026-05-19, the V2 traceability cockpit is backed by mock data only. No browser session against a live Databricks or legacy-api source has been verified. Scenarios that require a specific batch behaviour (for example, a batch with no shipments) cannot be exercised against the current single mock fixture. Each scenario below states explicitly whether it is testable against the current mock, needs a modified fixture, or requires live Databricks access.
>
> Nothing in this script constitutes a parity claim between V2 and V1.

---

## How to run these scenarios

1. Open the traceability workspace: navigate to the app and add `?workspace=traceability-workspace&view=overview` to the URL.
2. Use the query form to enter the batch details for each scenario.
3. Work through each scenario in order. Record your result as **PASS**, **FAIL**, or **BLOCKED**.
4. If any panel remains in a loading state for more than 10 seconds without resolving to data or an error card, treat that as a fail.
5. Record defects in the UAT Validation Ledger (`uat-validation-ledger.md`).

---

## Scenario 1 — Known valid batch: all panels load

**Purpose:** Verify that entering a known batch causes all six evidence panels to populate without errors.

**Input:**  
- Material: `100023847`  
- Batch: `CH-240308-0047`  
- Plant: `IE10`

**Pages to inspect:** Overview view — the full panel grid.

**Expected evidence (mock fixture):**  
Six panels should reach a loaded state: Batch Header, Risk Signals, Trace Graph, Customer Impact, CoA Release Status, Event Timeline. The Investigation Summary cockpit header at the top should display the material description (`EMMENTAL BLOCK NATURAL 100KG`), material ID, and batch ID. Evidence Confidence badge should show a score and a grade label (COMPLETE, PARTIAL, or MISSING — not "Not Assessed").

Note: specific confidence score is derived from the mock fixture. It does not reflect expected live behaviour. Requires UAT validation with live data to confirm expected confidence scoring.

**Pass criteria:**
- All six panels display content (not a spinner or error card).
- The cockpit header shows material and batch identity.
- Evidence Confidence badge shows a grade other than "Not Assessed".
- No browser console errors related to adapter failures.

**Fail criteria / warning signs:**
- Any panel stuck on a loading spinner after 10 seconds.
- Any panel showing an error card (red border, error message).
- Confidence badge shows "Not Assessed" after data loads.
- Material description or batch ID shows "Loading..." indefinitely.

**Current fixture status:** Testable against the current mock fixture.

**Databricks validation note:** Requires UAT access to a live environment to verify real batch data loads through the API adapter.

---

## Scenario 2 — Batch with downstream customer exposure

**Purpose:** Confirm that a batch where stock has been shipped shows customer-facing delivery details, affected countries, and an appropriate severity level.

**Input:**  
- Material: `100023847`  
- Batch: `CH-240308-0047`  
- Plant: `IE10`

**Pages to inspect:** Overview view (cockpit header metrics row and Customer Impact panel); Customer Exposure view (`?view=customer-exposure`).

**Expected evidence:**  
The cockpit header "Total Shipped" metric should show a non-zero quantity. The "Downstream Exposure" metric should show a non-zero customer count with a country count. The severity banner should show "Critical Exposure" when shipped stock and customer deliveries are present. The Customer Impact panel should show delivery records.

The mock fixture returns: 1 400 KG shipped to 3 customers across IE, GB, DE — these values come from the mock fixture only and must not be treated as expected live values. Requires UAT validation with live data to confirm the quantities, countries, and customer count that production will return for any real batch.

**Pass criteria:**
- Shipped quantity is non-zero and displayed in the cockpit header.
- Downstream Exposure metric shows customers and countries.
- Severity banner reads "Critical Exposure" (red styling).
- Customer Impact panel is populated.

**Fail criteria / warning signs:**
- Severity reads "Low Risk" despite the Customer Impact panel showing deliveries.
- "Total Shipped" shows "?" when data has loaded (this would indicate a null customerExposure bug — see Ledger section on pre-validation defects).
- Countries listed as "across 0 countries" when deliveries are visible.

**Current fixture status:** The critical-exposure and delivery flow are testable against the current mock fixture. The specific quantities and countries shown are mock values only.

**Databricks validation note:** Requires UAT access. Confirm quantities against SAP delivery notes and Databricks `gold_batch_delivery_v`.

---

## Scenario 3 — Batch with upstream supplier lineage

**Purpose:** Verify that upstream supplier nodes are visible in the trace graph and that supplier exposure details are surfaced.

**Input:**  
- Material: `100023847`  
- Batch: `CH-240308-0047`  
- Plant: `IE10`

**Pages to inspect:** Overview view (Trace Graph panel); Trace Tree view (`?view=trace-tree`); Supplier Exposure view (`?view=supplier-exposure`).

**Expected evidence:**  
The Trace Graph panel should show upstream nodes connected to the root batch. At least one supplier lot or raw-material node should be visible. The cockpit header "Upstream Lineage" metric should show a non-zero supplier count. The Supplier Exposure view should list supplier names or lot references.

The mock fixture shows: 2 upstream raw-material nodes (Pasteurised Whole Milk and Cheese Starter Culture), 1 unresolved supplier lot (Golden Vale Dairy Co-op, lot SL-GOLDEN-240308-019). These values are mock only. Requires UAT validation with live data.

**Pass criteria:**
- At least one upstream node visible in the trace graph.
- "Upstream Lineage" metric in cockpit header shows a number greater than 0.
- Supplier Exposure view loads without errors.

**Fail criteria / warning signs:**
- Trace Graph panel shows only the root node with no upstream connections.
- Cockpit header shows 0 suppliers despite upstream nodes being visible in the graph.
- Supplier Exposure view shows an error card.

**Current fixture status:** Basic upstream lineage display is testable against the current mock fixture.

**Databricks validation note:** Requires UAT access. Verify supplier nodes against the V1 reference engine's `fetch_bottom_up()` output for the same batch.

---

## Scenario 4 — Batch with no customer deliveries

**Purpose:** Confirm that a batch where no stock has been shipped shows zero deliveries — not an error state or a "data unavailable" message — and that severity is "Low Risk", not "Unknown".

**Input:**  
A batch where no deliveries have been made. This scenario cannot be exercised against the current mock fixture (which returns 1 400 KG shipped). A separate fixture or live batch is required.

**Pages to inspect:** Overview view (cockpit header, severity banner); Customer Impact panel.

**Expected evidence:**  
The cockpit header "Total Shipped" metric should display 0. The "Downstream Exposure" metric should show 0 customers. The severity banner should show "Low Risk" (green styling). The Customer Impact panel should indicate zero deliveries rather than an error. The Evidence Confidence "customers" sector should score as complete (zero shipments = batch contained).

Requires UAT validation with live data to confirm this behaviour against a real zero-shipment batch.

**Pass criteria:**
- "Total Shipped" shows 0 (not "?" and not an error).
- Severity reads "Low Risk".
- Customer Impact panel shows a zero-delivery state (not an error card).
- No "data unavailable" text on the shipped-quantity metric.

**Fail criteria / warning signs:**
- Severity reads "Unknown" for a batch where the adapter did return customerExposure data with zero shipments. (UNKNOWN severity is correct only when the data source itself is unavailable, not when it returns zero.)
- Customer Impact panel shows an error card instead of an empty state.
- Zero is rendered as blank or "—" without any label.

**Current fixture status:** Not testable against the current mock fixture. Requires a new fixture or live batch with zero deliveries.

**Databricks validation note:** Requires UAT access. Confirm zero-delivery state in `gold_batch_delivery_v`.

---

## Scenario 5 — Batch with unrestricted stock remaining

**Purpose:** Verify that the stock position metric shows unrestricted (unblocked) stock correctly and that the severity banner reflects an in-warehouse risk.

**Input:**  
A batch where `stockStatus = 'unrestricted'` and no deliveries have been made. The current mock fixture sets `stockStatus = 'quality-inspection'`, so this scenario requires a different fixture or live batch.

**Pages to inspect:** Overview view (cockpit header "Stock Position" metric; severity banner).

**Expected evidence:**  
The "Stock Position" metric should show the batch quantity with "unrestricted" as the sub-label. The severity banner should show "Medium Risk" with the alert message "Action Required: Significant stock remains unrestricted. Restrict batch status to prevent further issues." and action guidance "Monitor stock position and adjacent production batches." The batch header panel should reflect unrestricted stock status.

Requires UAT validation with live data to confirm what "unrestricted" stock looks like for a real at-risk batch.

**Pass criteria:**
- "Stock Position" sub-label reads "unrestricted".
- Severity banner reads "Medium Risk" with warn-coloured styling (amber) and alert message "Restrict batch status to prevent further issues".
- Batch Header panel "Stock Status" field shows "unrestricted".

**Fail criteria / warning signs:**
- Severity reads "Low Risk" when stock is unrestricted (this is incorrect — "Low Risk" should only appear when stock is contained and no deliveries have shipped).
- "Stock Position" shows a blank or "—" instead of the quantity.

**Current fixture status:** Not testable against the current mock fixture. Requires a new fixture or live batch.

**Databricks validation note:** Requires UAT access.

---

## Scenario 6 — Batch with quality status and CoA evidence

**Purpose:** Verify that quality inspection status and Certificate of Analysis data are surfaced in the relevant panel and contribute to the Evidence Confidence score.

**Input:**  
- Material: `100023847`  
- Batch: `CH-240308-0047`  
- Plant: `IE10`

**Pages to inspect:** Overview view (CoA Release Status panel; cockpit header "Quality Status" metric); Evidence Pack Readiness sidebar.

**Expected evidence:**  
The CoA Release Status panel should show a CoA availability indicator and a release/usage decision. The "Quality Status" metric in the cockpit header should display a non-blank status badge. The Evidence Confidence breakdown (visible in the Evidence Pack Readiness sidebar) should show "coa" and "quality" sectors as complete or partial — not "unknown".

The mock fixture returns: CoA available, release status blocked, usage decision "reject", 0 failed characteristics, 2 pending results. These are mock values only and must not be treated as expected live values.

**Pass criteria:**
- CoA Release Status panel is populated (not loading, not error).
- "Quality Status" metric in cockpit header shows a status badge (pending, accepted, rejected).
- Evidence Confidence badge grade is not "Not Assessed" once data has loaded.

**Fail criteria / warning signs:**
- CoA Release Status panel remains in a loading state or shows an error card.
- Quality status metric is blank or shows "—".
- Evidence Confidence grade remains "Not Assessed" after all panels have loaded.

**Current fixture status:** Testable against the current mock fixture. Quality and CoA values shown are from the mock only.

**Databricks validation note:** Requires UAT access. Verify quality lot data against `gold_batch_quality_*` views in Databricks.

---

## Scenario 7 — Batch with missing or partial evidence

**Purpose:** Verify that the Evidence Confidence badge displays PARTIAL or MISSING when one or more evidence sectors cannot be resolved.

**Input:**  
A scenario where at least one data sector returns empty or null data (for example, mass balance with an unresolved variance, or a batch with no CoA). The current mock fixture produces a partial-evidence scenario because of the mass balance variance — this can be used for this scenario.

- Material: `100023847`  
- Batch: `CH-240308-0047`  
- Plant: `IE10`

**Pages to inspect:** Overview view (Evidence Confidence badge in cockpit header; Evidence Pack Readiness sidebar).

**Expected evidence:**  
The Evidence Confidence badge should show PARTIAL or MISSING (amber or red styling), not COMPLETE. The Evidence Pack Readiness sidebar should list at least one identified gap. The grade label in the badge tooltip should read "Partial" or "Missing", not "Complete" or "Not Assessed".

Specific gap messages and exact grade depend on which sectors are incomplete. Requires UAT validation with live data to confirm the gap messages that will appear for real production batches.

**Pass criteria:**
- Evidence Confidence badge grade is PARTIAL or MISSING (not COMPLETE or Not Assessed).
- At least one gap is listed in the badge tooltip.
- Evidence Pack Readiness sidebar reflects the incomplete state.

**Fail criteria / warning signs:**
- Badge shows COMPLETE when the mass balance has a known variance.
- Badge shows "Not Assessed" after all panels have loaded.
- Badge tooltip lists no gaps despite visible incomplete data.

**Current fixture status:** The PARTIAL grade is testable against the current mock fixture because of the mass balance variance in the mock data. The specific gap messages should be verified with live data.

**Databricks validation note:** Requires UAT access to confirm which real batches produce partial evidence and verify the gap messages are accurate.

---

## Scenario 8 — Deep lineage / max-depth truncation

**Purpose:** Verify that the trace graph shows a truncation signal when the lineage tree is cut off at the maximum depth, so that investigators are not misled into thinking the displayed graph is the full picture.

**Input:**  
A batch with a known multi-hop lineage that exceeds the configured graph depth limit. This scenario cannot be exercised against the current mock fixture (which has a fixed 3-level mock graph with `truncated` not set to `true` in the mock data).

**Pages to inspect:** Trace Tree view (`?view=trace-tree`); Trace Graph panel on the Overview view.

**Expected evidence:**  
When the graph is truncated, a visible indicator should appear — for example, a banner or node label signalling that the displayed graph is a subset of the full lineage. The `TraceGraph.truncated` field (which exists in the schema) should drive this indicator. If a truncation depth label or count is available, it should be surfaced.

Note: the current V2 code does not surface a truncation indicator (this is a known gap recorded in `mb56-parity-review.md`). This scenario is therefore expected to FAIL in the current build and should be logged as a known defect.

Requires UAT validation with live data and a batch that produces a truncated graph.

**Pass criteria:**
- A truncation indicator is visible when the graph depth limit is reached.
- The indicator is present before the investigator scrolls past the last visible node.
- Truncated nodes are not silently omitted without any signal.

**Fail criteria / warning signs:**
- No truncation indicator appears for a graph known to be incomplete.
- Graph appears complete when it is not.
- `truncated: true` is returned by the backend but no UI element reflects it.

**Current fixture status:** Not testable against the current mock fixture. The mock does not set `truncated: true`. This is a known pre-validation defect (see `mb56-parity-review.md`).

**Databricks validation note:** Requires UAT access. Confirm truncation behaviour against the reference engine's configurable depth limit.

---

## Scenario 9 — Invalid material or batch: graceful error state

**Purpose:** Confirm that entering a material or batch that does not exist produces an informative error state rather than a blank screen or an infinite loading spinner.

**Input:**  
- Material: any non-existent material ID (e.g. `000000000000`)  
- Batch: any non-existent batch ID (e.g. `INVALID-BATCH-9999`)  
- Plant: any plant code

**Pages to inspect:** All six panels on the Overview view.

**Expected evidence:**  
Each panel should surface an error card (not a blank panel and not a loading spinner). The error message should be meaningful — "Batch not found" or similar — rather than a raw technical exception. The Investigation Summary cockpit header should not show mock data for a non-existent batch.

Note: the current mock fixture always returns data regardless of the input (the adapter ignores the request parameters in Phase 1). This means Scenario 9 cannot be exercised in the current mock build — the error state will not trigger. This is a known Phase 1 limitation. Requires UAT validation with live data.

**Pass criteria:**
- All panels show an error card with a meaningful message.
- No panel remains in a loading state indefinitely.
- The cockpit header does not show data belonging to a different batch.

**Fail criteria / warning signs:**
- Panels show data for the mock batch despite an invalid batch being entered (this is the current Phase 1 behaviour — it is expected but should be recorded as a known defect against live validation).
- Any panel shows a blank white area with no loading, no error, and no content.
- Raw JavaScript stack traces appear in the panel.

**Current fixture status:** Not testable against the current mock fixture. The mock adapter does not use the input identifiers to drive error states.

**Databricks validation note:** Requires UAT access. Confirm the `TraceNotFound` guard in the backend returns a clear 404 response that the adapter propagates to the error card.

---

## Scenario 10 — customerExposure data source unavailable: UNKNOWN severity, not Low Risk

**Purpose:** Verify that when the customer delivery data source is unavailable (adapter returns null, not zero), the cockpit displays "Exposure Unknown" severity with an explicit warning — not "Low Risk" — so that investigators do not assume the batch is contained.

**Input:**  
This scenario requires triggering a null customerExposure response. In the current mock build, this can be done by temporarily modifying the adapter to return `ok: false` for `getCustomerExposureSummary`. A simulated error state will produce the same effect. This cannot be triggered purely through the query form.

**Pages to inspect:** Overview view (cockpit header severity banner; "Total Shipped" metric; "Downstream Exposure" metric).

**Expected evidence:**  
When customerExposure is null (data source failed, not "zero deliveries"):

- Severity banner reads "Exposure Unknown" (amber/warn styling, not green).
- Alert message reads: "Customer delivery data is unavailable. Downstream exposure cannot be assessed — do not assume containment."
- Action guidance reads: "Verify delivery data source connectivity before concluding on containment status."
- "Total Shipped" metric displays "?" rather than "0".
- "Downstream Exposure" metric sub-label reads "data unavailable" rather than "across 0 countries".

These exact strings are present in `InvestigationSummary.tsx` and were added as part of the null/zero distinction fix (commits `74f4b5c` and `1612703` on main, tracked as part of the traceability recall-maturity hardening — see also `uat-validation-ledger.md` pre-validation defects section).

**Pass criteria:**
- Severity label reads "Exposure Unknown" (not "Low Risk").
- Banner background is amber/warn, not green.
- Alert message explicitly says "do not assume containment".
- "Total Shipped" shows "?" and "Downstream Exposure" shows "data unavailable".

**Fail criteria / warning signs:**
- Severity reads "Low Risk" when customerExposure is null. This is the pre-fix behaviour and would indicate the fix has regressed.
- Banner is green-styled when delivery data is unavailable.
- "Total Shipped" shows 0 (this would incorrectly imply no deliveries rather than unknown).
- No warning text about data source connectivity.

**Current fixture status:** The null-exposure path is not triggered by the default mock. Requires a modified adapter or controlled error injection. The fix is in the current codebase but cannot be exercised end-to-end without either modifying the mock or connecting to a live source.

**Databricks validation note:** Requires UAT access. Confirm that a real source-unavailable condition (e.g. Databricks query failure) propagates through the adapter as `ok: false` and correctly triggers the UNKNOWN severity state in the cockpit.

---

## Pass/Fail Summary Template

| Scenario | Description | Result | Defect ref | Notes |
|---|---|---|---|---|
| 1 | Known valid batch — all 6 panels load | | | |
| 2 | Batch with downstream customer exposure | | | |
| 3 | Batch with upstream supplier lineage | | | |
| 4 | Batch with no customer deliveries | | | |
| 5 | Batch with unrestricted stock remaining | | | |
| 6 | Batch with quality / CoA evidence | | | |
| 7 | Batch with missing or partial evidence | | | |
| 8 | Deep lineage / max-depth truncation | | | |
| 9 | Invalid material / batch — graceful error | | | |
| 10 | customerExposure unavailable — UNKNOWN severity | | | |

Record all defects in `uat-validation-ledger.md`.
