# SPC UAT Acceptance Script — Read-Only Validation

**Target Environment:** UAT  
**Domain:** Statistical Process Control (SPC)  
**Readiness Level:** Read-Only UAT (High-Fidelity Sandbox)

---

## 1. Prerequisites

- [ ] User has `spc.read` permission.
- [ ] Application is running in `mock` adapter mode for sandbox UAT (configured via `VITE_ADAPTER_MODE`).
- [ ] Note: `legacy-api` and `databricks-api` modes will show "Unavailable" as their backends are not yet deployed.
- [ ] A valid material candidate has been selected in the global scope.

---

## 2. Test Case 1: Workspace Entry & Candidate Validation

**Goal:** Verify that the SPC workspace correctly handles candidates and provides clear readiness context.

1. **Navigate** to the SPC Monitoring workspace (`/quality/spc-monitoring`).
2. **Verify** that if no material is selected, the "UAT Candidate Not Configured" blocker is displayed.
3. **Select** a valid material (e.g., `MAT-CH-EMMENTAL-BLOCK`).
4. **Verify** that the `VerificationStatusBanner` correctly identifies the state as "mock-demo".
5. **Verify** that the `SPCEvidenceSummaryPanel` displays a list of sections with "Mock" source markers.

---

## 3. Test Case 2: Control Chart Truthfulness

**Goal:** Verify that control charts correctly characterize unverified data.

1. **Select** a characteristic (e.g., `pH`).
2. **Verify** that the `Control Chart` panel displays a warning: "⚠️ Control-limit approval source not verified".
3. **Verify** that the legend uses "No signals returned" instead of "In control".
4. **Verify** that the source attribution (e.g., "MOCK") is visible on the panel header.

---

## 4. Test Case 3: Capability Analysis Safety

**Goal:** Verify that capability metrics are not presented as authoritative.

1. **Open** the "Capability" view.
2. **Verify** that the `Characteristic Capability` panel displays the warning: "⚠️ Capability approval source not verified".
3. **Verify** that for characteristics with small sample sizes, "Insufficient sample size" warnings are displayed.

---

## 5. Test Case 4: Evidence Capture

**Goal:** Verify that UAT evidence can be captured for audit logs.

1. **Open** the `SPCActionsPanel` in the right sidebar.
2. **Click** "Copy SPC UAT Evidence".
3. **Paste** the result into a text editor.
4. **Verify** that the JSON contains `plant`, `material`, `batch`, `adapterMode`, and `readiness: 'read-only-uat'`.

---

## 6. Known Limitations (UAT)

- Live Databricks SQL execution is disabled pending catalog alignment.
- Control limits are currently mock-fixtures and do not reflect approved plant standards.
- Rule violations (Nelson/Western Electric) are simulated rule-engine outputs.
