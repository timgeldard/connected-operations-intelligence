# App Data-Layer UAT Entry Plan

> **Status.** Plan definition only. This document does **not** assert that
> any data product, route, or panel has passed UAT. It defines which data
> products are allowed into first-wave UAT, under what conditions, and which
> remain blocked.
>
> UAT entry is not production readiness. UAT is not compliance sign-off.
> UAT is not process validation. No data product is promoted to
> production-ready by appearing in this document.

---

## 1. Purpose

This document defines which app data products may be presented to business
users for **controlled UAT**, with known and visible caveats, and which
remain blocked from UAT.

UAT in this context means:

- Controlled, facilitated sessions with named business users.
- Exercising a governed data product end-to-end in a real browser against a
  verified environment.
- Capturing evidence that the data is recognisable, usable, and honestly
  rendered.

UAT is **not**:

- Production readiness.
- Compliance sign-off.
- Process validation.
- Authorisation for SAP write-back, usage-decision release or reject,
  quality approval, e-signature, or automated recall decisions.

UAT exists to validate:

- Usability — can a business user navigate the journey without confusion?
- Recognisability — does the data match what the user knows from source systems?
- Caveat visibility — are governed-pending and unavailable states clearly
  labelled and not silently converted into reassuring defaults?
- Source-truthful rendering — does the UI faithfully represent what the backend
  contract delivers?

---

## 2. Scope

This plan applies to governed app data products in the following domains:

- **Trace** — batch identity, traceability, exposure, and mass balance.
- **Quality** — usage-decision evidence.
- **SPC** — statistical process control chart data and subgroup series.
- **POH** — process-order header.
- **Warehouse** — inbound, staging, and exceptions.

Future domains should apply the same entry criteria before entering UAT.

---

## 3. UAT Entry Criteria

A data product may enter UAT only when **all** of the following criteria are
true:

| #   | Criterion                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Source is verified, or the unverified state is explicitly caveated as unavailable/unknown.                                                                                           |
| 2   | Contract is defined in Zod (`@connectio/data-contracts`).                                                                                                                            |
| 3   | Generated Pydantic contract is in sync with the Zod contract where a backend route exists.                                                                                           |
| 4   | FastAPI `response_model` is enforced on the route where applicable.                                                                                                                  |
| 5   | Mapper tests exist covering source-to-contract field mapping.                                                                                                                        |
| 6   | Route tests exist where a backend route exists.                                                                                                                                      |
| 7   | Reference consumer / frontend adapter preserves `null`, `unknown`, `unavailable`, `not-evaluated`, and `governance-pending` states without converting them into reassuring defaults. |
| 8   | No silent mock fallback occurs in non-mock mode.                                                                                                                                     |
| 9   | Known caveats are documented in the domain data-product catalogue.                                                                                                                   |
| 10  | A browser UAT checklist exists for the relevant app.                                                                                                                                 |
| 11  | An evidence capture template exists (`browser-uat-evidence-template.md`).                                                                                                            |
| 12  | No forbidden business claims are made (see section 6 and section 7).                                                                                                                 |

**Governance-pending fields** are allowed in UAT only if they are clearly
labelled as `unavailable`, `unknown`, `not evaluated`, `pending validation`,
or `governance pending`. They must not be silently omitted, zeroed, or
rendered as a confident business conclusion.

---

## 4. UAT Exclusion Criteria

A data product or route **must not enter UAT** if any of the following are
true:

| #   | Exclusion condition                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------- |
| 1   | The source object does not exist and there is no safe `unavailable`-mode response defined.              |
| 2   | The FastAPI `response_model` is disabled because the route output diverges from the contract.           |
| 3   | The mapper emits invented business values (e.g., hardcoded `"low"`, `"safe"`, `"approved"`).            |
| 4   | The frontend adapter converts `unknown` or `unavailable` into a reassuring default for the user.        |
| 5   | The route silently falls back to mock data in live mode.                                                |
| 6   | A required business rule is missing and the field is rendered as if it were present.                    |
| 7   | A field implies an approval, release, safety, recall, or compliance decision without a governed source. |
| 8   | The browser journey cannot identify which route or data product is being exercised.                     |
| 9   | CI is red for changes affecting the journey.                                                            |

---

## 5. First-Wave UAT Candidates

The following data products are nominated as first-wave UAT candidates. Each
has met or is on a documented path to meet the entry criteria above, with
listed caveats remaining visible to users.

> **Note.** Candidate status means eligible for controlled UAT planning only.
> It does not mean browser UAT evidence has been captured. Evidence capture
> is a separate step, governed by the outcomes defined in section 10.

### Trace

| Data product               | Route / consumer                                                                          | Reason it is a UAT candidate                                                                               | Required caveats                                                                          | Forbidden claims                                               | Evidence checklist                            | UAT priority |
| -------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------- | ------------ |
| Batch Header               | `/api/trace2/batch-header` / Trace app adapter                                            | Source-verified; contract enforced; mapper and route tests exist; core recall/traceability identity object | Source quality and status states must remain source-truthful; no completeness claim       | Batch is safe / recall not required / all trace links resolved | [trace.md](./browser-uat-checklists/trace.md) | 1            |
| Customer Exposure Evidence | `/api/trace2/customer-exposure` and `/api/trace2/customer-deliveries` / Trace app adapter | Source-verified; contract enforced; exposes governed exposure aggregation                                  | `recallRecommended` remains `null` / `unavailable` without a governed recall-rule source  | Recall not required / no recall risk / recall recommended      | [trace.md](./browser-uat-checklists/trace.md) | 1            |
| Supplier Exposure Evidence | `/api/trace2/supplier-exposure` and `/api/trace2/supplier-batches` / Trace app adapter    | Source-verified; contract enforced; exposes supplier-side traceability                                     | Supplier risk remains `unknown` / `unavailable` without a governed risk source            | Low risk / no supplier risk / supplier cleared                 | [trace.md](./browser-uat-checklists/trace.md) | 2            |
| Mass Balance Ledger        | `/api/trace2/mass-balance-ledger` / Trace app adapter                                     | Contract enforced; exposes lot-level mass balance                                                          | Reconciliation remains application-heuristic / governance-pending; tolerance not governed | Balanced / reconciled / no discrepancy                         | [trace.md](./browser-uat-checklists/trace.md) | 2            |

### Quality

| Data product            | Route / consumer                                        | Reason it is a UAT candidate                                                    | Required caveats                                                                                       | Forbidden claims                                                       | Evidence checklist                                | UAT priority |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------- | ------------ |
| Usage Decision Evidence | `/api/quality/read-only-evidence` / Quality app adapter | Contract enforced; lot-level evidence; usage-decision status is source-truthful | Strict lot-level evidence only; no batch-level release claim; `usageDecision` value is source-verbatim | Batch approved / batch released / batch rejected / usage decision made | [quality.md](./browser-uat-checklists/quality.md) | 3            |

### POH

| Data product         | Route / consumer                          | Reason it is a UAT candidate                                                                | Required caveats                                                              | Forbidden claims                                | Evidence checklist                        | UAT priority |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------- | ------------ |
| Process Order Header | `/api/por/order-header` / POH app adapter | Contract enforced; process-order identity and context; foundational for downstream journeys | Unknown `orderStatus` must remain unknown; no completion or on-time inference | Order complete / order on time / order approved | [poh.md](./browser-uat-checklists/poh.md) | 4            |

### SPC

| Data product          | Route / consumer                                                                | Reason it is a UAT candidate                                                                    | Required caveats                                                                                 | Forbidden claims                                                        | Evidence checklist                        | UAT priority |
| --------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------- | ------------ |
| SPC Chart Data Series | `/api/spc/chart-data` / SPC app adapter                                         | Contract enforced; guardrails clear; point-level series data is source-truthful                 | `lockedBy` is not an approval; point status `not-evaluated`; no capability or Nelson rule claims | In control / process capable / Nelson rule violation / process approved | [spc.md](./browser-uat-checklists/spc.md) | 5            |
| SPC Subgroup Series   | `/api/spc/subgroups` / SPC app adapter (if route exists and adapter is aligned) | Extends chart data with subgroup detail; included if UI route and adapter are confirmed aligned | Same caveats as chart data series                                                                | Same as chart data series                                               | [spc.md](./browser-uat-checklists/spc.md) | 5            |

### Warehouse

| Data product | Route / consumer                                       | Reason it is a UAT candidate                                     | Required caveats                                                                                                            | Forbidden claims                                           | Evidence checklist                                    | UAT priority |
| ------------ | ------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- | ------------ |
| Inbound      | `/api/warehouse360/inbound` / Warehouse app adapter    | Source-verified; contract enforced; mapper and route tests exist | Unavailable warehouse or storage-location fields remain unavailable                                                         | Stock confirmed / storage verified / receipt approved      | [warehouse.md](./browser-uat-checklists/warehouse.md) | 6            |
| Staging      | `/api/warehouse360/staging` / Warehouse app adapter    | Source-verified; contract enforced; mapper and route tests exist | `stagingStatus`, `stagedQuantity`, and `openQuantity` may be application-derived or heuristic where direct source is absent | Staged / staging confirmed / quantity verified             | [warehouse.md](./browser-uat-checklists/warehouse.md) | 7            |
| Exceptions   | `/api/warehouse360/exceptions` / Warehouse app adapter | Source-verified; contract enforced; mapper and route tests exist | Severity mapping, `detected_date` semantics, expiry linkage, and document linkage remain caveated                           | Exception resolved / severity confirmed / recall triggered | [warehouse.md](./browser-uat-checklists/warehouse.md) | 8            |

---

## 6. Explicitly Blocked or Excluded from First-Wave UAT

The following data products or fields are **blocked** from first-wave UAT.
Blocked items must not be presented to business users as if they were
production-ready or caveat-free.

| Domain             | Data product / field                              | Block reason                                                                                                                | Governance gate    |
| ------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Warehouse          | Overview — `nearExpiryCount`                      | Threshold not agreed; source inclusion/exclusion rules not agreed                                                           | Gate 4 open        |
| Warehouse          | Overview — `reconciliationExceptionCount`         | Exception definition and tolerance not agreed; source comparison rule not agreed                                            | Gate 5 open        |
| Warehouse          | Overview (whole panel)                            | `response_model` remains disabled if route output diverges from contract; no production-readiness claim                     | Gates 4 and 5 open |
| Trace / Quality    | `recallRecommended` (governed true/false)         | Governed recall-rule source not implemented; `null` / `unavailable` is allowed in UAT                                       | Governance pending |
| Quality / Supplier | Supplier risk scoring (`low` / `medium` / `high`) | Source coverage and governance pending; unknown/unavailable allowed; categorical values not allowed without governed source | Governance pending |
| SPC                | Capability indices / Nelson rule signals          | Intentionally not implemented; not part of first UAT wave                                                                   | Out of scope       |
| All domains        | Release / reject / approval workflows             | Out of scope; no SAP write-back; no e-signature; no usage-decision mutation                                                 | Out of scope       |

**Warehouse overview** remains blocked until Gates 4 and 5 are closed. No
partial overview rendering (e.g., showing only the non-blocked fields) is
permitted unless a governed split of the overview panel is agreed and
implemented.

---

## 7. Allowed Caveats in UAT

The following caveat states are acceptable in UAT **provided they are
visibly labelled and do not mislead the user**:

| Caveat label              | Meaning                                                                           |
| ------------------------- | --------------------------------------------------------------------------------- |
| `unknown`                 | The value cannot be determined from available source data.                        |
| `unavailable`             | The value is not available in this context or environment.                        |
| `not evaluated`           | The calculation or rule has not been applied.                                     |
| `pending validation`      | The value exists in source but has not been validated against governed rules.     |
| `governance pending`      | The business rule, threshold, or source definition has not been agreed.           |
| `source coverage pending` | The data product does not yet have confirmed source coverage.                     |
| `application heuristic`   | The value is derived by application logic rather than a governed source field.    |
| `application derived`     | The value is computed from governed source fields using a stated derivation rule. |

Caveats are acceptable in UAT only when they are **visible** and do not
allow the user to mistake a caveated state for a business conclusion.

### Allowed labelling examples

- "Recall recommendation unavailable — governed rule not implemented"
- "Supplier risk unknown — no governed risk source"
- "SPC point status not evaluated"
- "Warehouse exception severity unavailable — integer mapping not governed"

### Not allowed (unless governed and source-backed)

- "Recall not required"
- "Low risk"
- "In control"
- "Approved"
- "Released"
- "Safe"
- "No issue found"
- "Healthy"

These phrases imply a business conclusion that requires a governed source,
an agreed rule, and a confirmed mapping. Without those, they must not appear
in any UAT session or screenshot.

---

## 8. Required Evidence per UAT Run

UAT evidence is governed by:

- [`browser-uat-evidence-standard.md`](./browser-uat-evidence-standard.md)
- [`browser-uat-evidence-template.md`](./browser-uat-evidence-template.md)

Each UAT evidence pack must capture:

| Field                                            | Required        |
| ------------------------------------------------ | --------------- |
| Tester name                                      | Yes             |
| Date and time                                    | Yes             |
| Environment                                      | Yes             |
| Branch / commit SHA                              | Yes             |
| Data product                                     | Yes             |
| Route / API path                                 | Yes             |
| Identifiers used (batch, order, material, plant) | Yes             |
| Screenshots                                      | Yes             |
| Network / API evidence                           | Where practical |
| Expected governed states                         | Yes             |
| Actual UI rendering                              | Yes             |
| Pass / fail / caveat outcome                     | Yes             |
| Follow-up actions                                | Yes             |

Evidence packs are stored under
`docs/app-data-layer/evidence/YYYY-MM-DD/<app-or-data-product>/`.

A data product is not considered `evidence-captured` until evidence is
filed. Completion of the UAT checklist without accompanying evidence does
not constitute an `evidence-captured` outcome.

---

## 9. Recommended UAT Execution Order

| Step | Journey                                | Rationale                                                                                                                                                                        |
| ---- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Trace batch header + customer exposure | Trace is the core recall/traceability workflow. Batch header is the identity object all other journeys depend on. Customer exposure carries the highest governance significance. |
| 2    | Trace supplier exposure + mass balance | Extends Trace coverage to the supply side. Mass balance validates ledger completeness with visible heuristic caveats.                                                            |
| 3    | Quality usage decision evidence        | High business value; must remain strictly lot-level; usage-decision status is source-verbatim.                                                                                   |
| 4    | POH process-order header               | Process-order identity is foundational context for SPC and downstream journeys.                                                                                                  |
| 5    | SPC chart data / subgroup journey      | Guardrails are clear; capability and Nelson signals remain out of scope and must not be implied.                                                                                 |
| 6    | Warehouse inbound                      | First warehouse drill-through route; validated source mapping; fewest governance caveats of the three.                                                                           |
| 7    | Warehouse staging                      | Staging status and quantity carry application-heuristic caveats that must be clearly labelled.                                                                                   |
| 8    | Warehouse exceptions                   | Most caveated warehouse route; severity mapping and date semantics are governance-pending.                                                                                       |
| 9    | UAT readiness review                   | Cross-domain review of all completed evidence packs before any production-readiness conversation begins.                                                                         |

**Execution rationale:**

- **Trace first** — it is the core recall and traceability workflow; all other
  journeys depend on batch identity being correctly established.
- **Quality next** — usage-decision evidence is high business value but must
  remain lot-level; confirming this constraint early prevents misinterpretation.
- **POH next** — process-order context is foundational for downstream SPC and
  Warehouse journeys.
- **SPC next** — guardrails (locked limits, not-evaluated point status) are
  clear, but capability indices and Nelson rule signals remain explicitly out of
  scope and must not appear.
- **Warehouse last** — the overview panel remains blocked by Gates 4 and 5;
  drill-through routes carry the most governance caveats of any first-wave
  candidates and benefit from testers being familiar with the caveat framework
  established in earlier rounds.

---

## 10. UAT Decision Outcomes

The following outcomes are defined for UAT runs. **`production-ready` is
not a UAT outcome** and must not be used.

| Outcome                      | Meaning                                                                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ready-for-uat`              | The data product meets all entry criteria with no outstanding caveats. It may be presented without additional labelling.                                                               |
| `ready-for-uat-with-caveats` | The data product meets entry criteria but carries one or more visible caveats that must be disclosed to testers before the session.                                                    |
| `blocked`                    | The data product does not meet entry criteria. It must not be presented to business users.                                                                                             |
| `out-of-scope`               | The data product or feature is outside the first-wave UAT scope by design.                                                                                                             |
| `evidence-captured`          | A completed UAT run has filed evidence under `docs/app-data-layer/evidence/`. This outcome does not mean production-ready.                                                             |
| `failed-uat`                 | A UAT run found that the data product did not behave as governed: incorrect rendering, silent default injection, missing caveat labelling, or a forbidden business claim was observed. |

---

## 11. Production Readiness Gap

UAT entry is one step. **Production readiness requires substantially
more.** A data product that has completed UAT with captured evidence still
requires all of the following before any production promotion decision:

| Gate                                   | Description                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Governance closure                     | Any `governance-pending` field must have its business rule agreed, documented, and implemented before being rendered as a business conclusion. |
| Source ownership confirmed             | A named business owner for the source object is confirmed.                                                                                     |
| Business owner acceptance              | The business owner has formally accepted the data product for production use.                                                                  |
| Support model                          | A support runbook exists and is owned by an agreed team.                                                                                       |
| Monitoring and logging                 | Request-level logging and error-rate alerting are in place.                                                                                    |
| Security and access review             | Role-based access controls are reviewed and confirmed for the production audience.                                                             |
| Performance check                      | Response times are validated against production-representative data volumes.                                                                   |
| Deployment process                     | A repeatable, documented deployment process exists for the route and adapter.                                                                  |
| Rollback plan                          | A rollback procedure is documented and tested.                                                                                                 |
| Browser UAT evidence                   | Evidence is filed under `docs/app-data-layer/evidence/`.                                                                                       |
| Production data validation             | The data product has been validated against production-representative data, not only test or staging data.                                     |
| No unresolved production-blocked gates | No open gate (such as Gates 4 and 5 for Warehouse overview) blocks the data product.                                                           |

**This document does not make any production-readiness claim for any data
product, route, or panel in this repository.**

---

## Appendix: UAT Candidate Summary Table

| Domain             | Data product                                | UAT entry status             | Main caveat                                                                                 | Checklist                                             |
| ------------------ | ------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Trace              | Batch Header                                | `ready-for-uat-with-caveats` | Source quality and status states must remain source-truthful                                | [trace.md](./browser-uat-checklists/trace.md)         |
| Trace              | Customer Exposure Evidence                  | `ready-for-uat-with-caveats` | `recallRecommended` remains `unavailable` / `null` without governed recall rule             | [trace.md](./browser-uat-checklists/trace.md)         |
| Trace              | Supplier Exposure Evidence                  | `ready-for-uat-with-caveats` | Supplier risk remains `unknown` / `unavailable` without governed source                     | [trace.md](./browser-uat-checklists/trace.md)         |
| Trace              | Mass Balance Ledger                         | `ready-for-uat-with-caveats` | Reconciliation is application-heuristic / governance-pending                                | [trace.md](./browser-uat-checklists/trace.md)         |
| Quality            | Usage Decision Evidence                     | `ready-for-uat-with-caveats` | Strict lot-level evidence only; no batch-level release claim                                | [quality.md](./browser-uat-checklists/quality.md)     |
| POH                | Process Order Header                        | `ready-for-uat-with-caveats` | Unknown `orderStatus` must remain unknown; no completion or on-time inference               | [poh.md](./browser-uat-checklists/poh.md)             |
| SPC                | SPC Chart Data Series                       | `ready-for-uat-with-caveats` | `lockedBy` is not approval; point status `not-evaluated`; no capability / Nelson claims     | [spc.md](./browser-uat-checklists/spc.md)             |
| SPC                | SPC Subgroup Series                         | `ready-for-uat-with-caveats` | Same caveats as chart data series; conditional on route and adapter alignment               | [spc.md](./browser-uat-checklists/spc.md)             |
| Warehouse          | Inbound                                     | `ready-for-uat-with-caveats` | Unavailable warehouse / storage-location fields remain unavailable                          | [warehouse.md](./browser-uat-checklists/warehouse.md) |
| Warehouse          | Staging                                     | `ready-for-uat-with-caveats` | `stagingStatus`, `stagedQuantity`, `openQuantity` may be application-derived / heuristic    | [warehouse.md](./browser-uat-checklists/warehouse.md) |
| Warehouse          | Exceptions                                  | `ready-for-uat-with-caveats` | Severity mapping, `detected_date`, expiry and document linkage remain caveated              | [warehouse.md](./browser-uat-checklists/warehouse.md) |
| Warehouse          | Overview                                    | `blocked`                    | `nearExpiryCount` and `reconciliationExceptionCount` governance gates (4 and 5) remain open | [warehouse.md](./browser-uat-checklists/warehouse.md) |
| All                | Release / reject / approval workflows       | `out-of-scope`               | No SAP write-back, no e-signature, no usage-decision mutation in scope                      | —                                                     |
| All                | Recall recommendation (governed true/false) | `blocked`                    | Governed recall-rule source not implemented                                                 | —                                                     |
| Quality / Supplier | Supplier risk scoring (categorical)         | `blocked`                    | Source coverage and governance pending; categorical values require governed source          | —                                                     |
| SPC                | Capability indices / Nelson rule signals    | `out-of-scope`               | Intentionally not implemented; not part of first UAT wave                                   | —                                                     |
