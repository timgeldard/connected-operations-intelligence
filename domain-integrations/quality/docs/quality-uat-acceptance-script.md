# UAT Acceptance Script — Quality Batch Release Cockpit (V2)

**Status:** Pre-validation  
**Version:** V2 — hybrid/mock data only  
**Date issued:** 2026-05-19  
**Audience:** Food safety leads, quality leads, quality managers, and plant managers

> **Important integration constraint — read before testing.**
> As of 2026-05-19, the V2 batch release cockpit is backed by mock adapters for all decision panels (Release Queue, Summary, Deviations, CoA, Holds) and by the legacy-api proxy for the Connected Quality Lab Board. Actions executed inside the right-rail Actions panel (e.g. "Release Batch", "Place on Hold") are simulation-only and do not persist back to SAP QM.
>
> Nothing in this script constitutes a parity claim between V2 and live SAP write capabilities.

---

## How to run these scenarios

1. Open the Quality Batch Release workspace by navigating to the application and choosing the **Quality Batch Release** workspace from the navigation rail or URL path `/quality/batch-release`.
2. Select a release case from the **Release Queue** panel on the left to load the batch decision details.
3. Review the populated panels. Record results as **PASS**, **FAIL**, or **BLOCKED**.
4. Log any issues or unexpected behaviors in the defect tracker.

---

## Scenario 1 — Known critical release case: overall readiness is blocked

**Purpose:** Verify that a known critical release case correctly displays all blocking alerts, warnings, and the recommended rejection action.

**Input:**  
Select release case `RC-2024-001847` (Emmental batch `CH-240308-0047`) in the queue.

**Expected evidence:**
- The **Release Summary** panel displays:
  - Overall Readiness: `blocked` (red badge)
  - Recommended Action: `reject` (red text)
  - Signals: Quality `✗`, SPC `✗`, CoA `✗`, No Holds `✗`, Deviations `✗`, Trace `✗`
  - Blockers (4 items): MIC failure (Listeria spp.), CoA incomplete, Open warehouse hold, SPC alarm (pH rule violation)
  - Warnings (2 items): Related trace investigation in progress, Upstream supplier lot flagged
  - Footnote displaying the orange **Mock Mode** warning banner.
- The **Quality Results** panel displays overall status `fail` (red text) and lists 2 MIC Failures (`Listeria monocytogenes` and `Listeria spp.`) with complete test method, result, limit, and analyst details.
- The **CoA Readiness** panel displays status `incomplete` (red text) and shows "Missing Fields: pH result, moisture content".
- The **Deviations** panel displays 2 open deviations (one critical quality deviation `DEV-2024-001` and one major environmental deviation `DEV-2024-002`).

**Pass criteria:**
- All panels populate correctly and display source badges indicating `mock` source.
- Red indicators are shown for all failed signals.
- The orange **Mock Mode** warning footprint is clearly visible at the bottom of each decision panel.

**Fail criteria:**
- Any of the decision panels display a `live` or `legacy-api` badge instead of `mock`.
- The recommended action reads "release" despite critical blockers.
- The MIC failures list is empty or shows "all tests passed".

---

## Scenario 2 — Lab Board Failure Wallboard: rotating cards and legend

**Purpose:** Verify that the pilot Lab Board panel shows live/mock failures, allows filtering by lot type, and indicates the correct integration source.

**Input:**  
Navigate to the **Lab Board** view inside the workspace.

**Expected evidence:**
- The **Lab Board** panel loads without errors.
- If running in mock mode, it displays the 6-card grid rotating every 30 seconds.
- The source label at the top reads "Mock SAP QM lab failures" (if in mock mode) or "SAP QM via legacy API" (if in legacy-api mode).
- A filter button bar allows selecting **All**, **FP (89)**, and **RM (04)** lot types.

**Pass criteria:**
- Visual severity badges (FAIL / WARN) are color-coded (red / amber).
- The speculative range bar (SpecBar) correctly visualizes the current result relative to low/high limits.
- Changing filters resets the rotation page back to 0.

**Fail criteria:**
- The panel crashes or shows an blank white space when loading.
- Selecting a filter has no effect or causes the active failures count to read `0` without any empty state text.

---

## Scenario 3 — Release Batch action sheet simulation

**Purpose:** Verify that the "Release Batch" action sheet opens, performs basic client-side validations, and transitions to a mock success state.

**Input:**
1. Select case `RC-2024-001847` (status is `under-review`).
2. Click the **Release Batch** button in the right-rail Actions panel.

**Expected behavior:**
- The **Release Batch** sheet slides open from the right.
- Change the Decision dropdown from "Released" to "Conditionally Released". The **Conditions** textarea appears.
- Leave "Signoff Name" blank and type a short rationale (less than 20 characters). Click **Release Batch**.
- Validation errors are displayed: "Rationale must be at least 20 characters" and "Signoff name is required".
- Fill in a valid Signoff Name (e.g. "Jane Doe") and a long rationale (e.g., "All micro tests have been re-verified and confirm zero presence of target pathogens."). Click **Release Batch**.
- The sheet switches to the success checkmark view stating: "Batch released successfully (mock)."

**Pass criteria:**
- Client-side validation prevents submitting invalid data.
- The sheet closes when clicking the top-right "✕" or "Cancel".
- No real SAP QM changes are made (console telemetry logs are emitted).

**Fail criteria:**
- Form submits successfully despite missing signoff name or short rationale.
- The sheet remains open or stuck in loading state upon submission.
