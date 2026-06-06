# Golden Quality Batches (UAT Candidate Ledger)

This document catalogs known quality release cases and inspection lots for use in testing and user acceptance testing (UAT) of the Quality Batch Release cockpit. It maps mock validation cases and specifies their current verification status.

---

## Candidate Release Cases

### 1. Release Case `RC-2024-001847` (Standard UAT Candidate)
* **Plant ID**: `C113`
* **Batch ID**: `B-2024-0817-A`
* **Material ID**: `70373871`
* **Material Description**: `MIXED BERRY FLV LQD`
* **Case Status**: `awaiting-review`
* **Evidence Description**:
  * **Summary**: Returns overall readiness `incomplete` with recommended action `escalate`.
  * **Blockers**: 1 active blocker (`critical` level release hold).
  * **Warnings**: 1 active warning (`pending` status deviation).
  * **CoA Readiness**: Incomplete, missing signedOffBy, customer-specific CoAs pending.
  * **Quality Results**: Passing overall chemical and physical tests; MIC tests are completely passing.
  * **Decision History**: Audit trail has 0 previous decisions.
* **Validation Status**: Mock-only (simulated in-memory)
* **Validation Type**: Frontend Mock Verification
* **Validation Date**: 2026-05-19
* **Environment/Catalog/Schema**: `in-memory mock context`
* **Source Views Used**:
  * `MockQualityReleaseAdapter` (Simulated in-memory state)
* **Browser E2E Status**: Pending
* **Who/What Validated It**: automated component tests; engineering review pending.

---

### 2. Release Case `RC-2024-001848` (Deviation & Retest Candidate)
* **Plant ID**: `C113`
* **Batch ID**: `B-2024-0818-B`
* **Material ID**: `70373871`
* **Material Description**: `MIXED BERRY FLV LQD`
* **Case Status**: `under-review`
* **Evidence Description**:
  * **Summary**: Returns overall readiness `incomplete` with recommended action `escalate`.
  * **Blockers**: 2 active blockers (`critical` open deviation `DEV-2024-00921` blocking release, and 1 open lab re-test).
  * **Warnings**: 0 warnings.
  * **CoA Readiness**: Complete and signed off by quality manager `J. Smith` — fictional fixture value, not a real approver or audit record.
  * **Quality Results**: MIC status is `fail` with active MIC failure (Coliform limit exceeded).
  * **Decision History**: Contains 1 previous `conditional-release` attempt rejected during final sweep.
* **Validation Status**: Mock-only (simulated in-memory)
* **Validation Type**: Frontend Mock Verification
* **Validation Date**: 2026-05-19
* **Environment/Catalog/Schema**: `in-memory mock context`
* **Source Views Used**:
  * `MockQualityReleaseAdapter` (Simulated in-memory state)
* **Browser E2E Status**: Pending
* **Who/What Validated It**: automated component tests; engineering review pending.

---

### 3. Lab Board Plant `C113` (Legacy API Connected Quality)
* **Plant ID**: `C113`
* **Source View/Route**: `GET /api/cq/lab/fails` & `GET /api/cq/lab/plants`
* **Evidence Description**:
  * Returns active inspection failures for plant `C113` directly from the V1 Connected Quality backend database.
* **Validation Status**: Wired to FastAPI backend Proxy (live backend verification pending)
* **Validation Type**: Hybrid Legacy API
* **Validation Date**: 2026-05-19
* **Source Views Used**:
  * V1 route `GET /api/cq/lab/fails`
  * V1 route `GET /api/cq/lab/plants`
  * V1 DAL references `vw_gold_inspection_result`, `vw_gold_process_order`, `vw_gold_process_order_plan`, `vw_gold_process_order_material`, `vw_gold_inspection_usage_decision`, `vw_gold_inspection_specification`, `vw_gold_material`, and `gold_plant`.
* **Browser E2E Status**: Pending
* **Who/What Validated It**: Engineering team via FastAPI integration tests.

---

## Live Quality Candidate Status

No verified live Quality UAT candidate has been identified from V1 discovery. The mock release cases above remain UI trust-hardening fixtures only; they are not source-backed SAP QM release candidates. Use `golden-quality-candidates.md` for the live candidate template and future evidence capture.
