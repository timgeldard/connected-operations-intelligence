# Quality Read-Only Evidence State Model

**Status:** Code-ready (2026-05-21)
**Domain:** `domain-integrations/quality`
**Related:** `quality-readiness-checklist.md`, `quality-known-limitations.md`, `qm-usage-decision-code-semantics.md`

This document defines the canonical state model for the Quality read-only evidence panel and all helpers that render inspection lot, MIC, usage-decision, CoA-like, and deviation evidence. States in this model are **evidence states**, not release decisions.

---

## 1. State Definitions

### `not-configured`

| Field | Value |
|---|---|
| Meaning | No batchId, materialId, or request context has been supplied. |
| When it appears | Panel rendered without required context keys. |
| Allowed UI copy | "No batch context configured. Select a batch to view Quality evidence." |
| Must NOT imply | That no quality issue exists. |
| Evidence status | None available. |
| Source badge | Not shown. |
| UAT implication | Not a UAT-blocking state; fixture coverage required. |

---

### `pending-source-verification`

| Field | Value |
|---|---|
| Meaning | The Databricks source object, schema, grain, and join keys have not yet been verified for this evidence section. |
| When it appears | Adapter returns this status because the broader quality source verification pack has not been completed for the relevant objects (inspection-lot/MIC/CoA-like). |
| Allowed UI copy | "Source verification pending. Evidence cannot be retrieved until the Quality Databricks source pack is completed." |
| Must NOT imply | That no inspection lot, MIC result, deviation, or usage decision exists. |
| Evidence status | Unavailable — source-unverified. |
| Source badge | Shows "Verification pending" rather than a source name. |
| UAT implication | Blocks all live UAT until the broader source verification pack is completed. |

---

### `source-verified-not-wired`

| Field | Value |
|---|---|
| Meaning | The Databricks source has been verified (schema, grain, join keys, and code semantics confirmed) but no live runtime route has been wired. The route plan exists; implementation is pending. |
| When it appears | Usage-decision source (`gold_inspection_usage_decision`) is verified, but the FastAPI proxy route and adapter are not live. |
| Allowed UI copy | "Source verified. Live route pending implementation. Evidence displayed here is fixture/simulation only." |
| Must NOT imply | That live data matches the fixture data. |
| Evidence status | Simulation/fixture only — not live. |
| Source badge | Shows "Route pending" or "Simulation" badge. |
| UAT implication | UI/state model code-ready. Live wiring must be completed before UAT can proceed. |

---

### `loading`

| Field | Value |
|---|---|
| Meaning | The adapter query is in flight. |
| When it appears | `isLoading: true` from the React Query hook. |
| Allowed UI copy | "Loading Quality evidence…" |
| Must NOT imply | That any specific quality outcome is pending or expected. |
| Evidence status | In flight. |
| Source badge | Not shown during loading. |
| UAT implication | Not a UAT-blocking state; standard query behaviour. |

---

### `loaded`

| Field | Value |
|---|---|
| Meaning | The source returned at least one inspection lot, MIC result, or usage-decision row. Evidence is rendered from source data. |
| When it appears | `inspectionLotCount > 0` or `micResultCount > 0` or `usageDecision != null`, and the adapter completed successfully. |
| Allowed UI copy | Show raw source code verbatim + governed label (additive). |
| Must NOT imply | Release approval, batch-level decision, or official CoA approval. |
| Evidence status | Source data present — read-only display only. |
| Source badge | Shows actual source (`databricks-api`, `legacy-api`, `mock`). |
| UAT implication | Requires browser-level validation of source data against SAP reference before any UAT claim. |

---

### `no-records`

| Field | Value |
|---|---|
| Meaning | The queried source returned zero rows for the given request parameters. |
| When it appears | No inspection lots, no MIC results, or no usage-decision row was found in the source. |
| Allowed UI copy | "No records returned by source. This is not confirmation that no quality evidence exists." |
| Must NOT imply | Proof of absence. Zero records from one source does not mean no inspection lot, no decision, or no deviations exist. |
| Evidence status | No records from queried source. |
| Source badge | Shows source name. |
| UAT implication | Must be investigated against SAP/Databricks directly before interpreting as clean. |

---

### `partial-evidence`

| Field | Value |
|---|---|
| Meaning | Some evidence sections returned data; others returned no records or are unavailable. The overall evidence picture is incomplete. |
| When it appears | At least one of: inspection lots, MIC results, usage decision, CoA-like rows returned data, but other sections did not. |
| Allowed UI copy | "Partial evidence only. Some sections are unavailable or returned no records. Do not treat missing sections as absence of evidence." |
| Must NOT imply | That missing sections have no evidence in source. |
| Evidence status | Partial — incomplete coverage. |
| Source badge | Shows source name. |
| UAT implication | Each section's no-record status must be individually verified. |

---

### `multiple-lots`

| Field | Value |
|---|---|
| Meaning | The queried batch has more than one inspection lot. A single batch-level usage decision cannot be derived by aggregating per-lot decisions without a governed lot-selection rule. |
| When it appears | `inspectionLotCount > 1`. |
| Allowed UI copy | "Multiple inspection lots found. Per-lot usage decisions are shown individually. A batch-level release decision is not derived from individual lot decisions." |
| Must NOT imply | That any single lot's decision represents the full batch. |
| Evidence status | Multiple lots — per-lot evidence only. |
| Source badge | Shows source name. |
| UAT implication | A confirmed lot-selection rule (fan-out rule) must be defined before live wiring. This is an explicit UAT blocker (TRACE-P1-012). |

---

### `unavailable`

| Field | Value |
|---|---|
| Meaning | The evidence section is known to be unavailable — the source is out of scope, the route is not implemented, or a governance gate blocks it. |
| When it appears | Deviation source, official CoA document, SAP QM write-back are in scope but not wired. |
| Allowed UI copy | "Evidence unavailable. [Reason]. This must not be interpreted as absence of [deviation/CoA/etc.]." |
| Must NOT imply | That no deviation, no CoA, or no QM record exists. |
| Evidence status | Unavailable — reason stated. |
| Source badge | Not shown; "Unavailable" label replaces it. |
| UAT implication | Must be resolved (wired or explicitly risk-accepted) before live UAT. |

---

### `error`

| Field | Value |
|---|---|
| Meaning | The adapter returned a non-OK result: network error, auth failure, parse failure, or similar. |
| When it appears | `result.ok === false`. |
| Allowed UI copy | "Quality evidence could not be retrieved. Error: [message]. This is not confirmation of no quality issue." |
| Must NOT imply | That the batch has no quality evidence. An error means the query failed, not that no records exist. |
| Evidence status | Query failed. |
| Source badge | Shows attempted source. |
| UAT implication | Error cases must be surfaced in UAT without masking as a passing state. |

---

### `mock`

| Field | Value |
|---|---|
| Meaning | The adapter is returning fixture/simulation data. This data does not represent any real batch or lot. |
| When it appears | `source === 'mock'`. |
| Allowed UI copy | "Simulated data only. This evidence does not represent real batch quality data. Do not use for release decisions." |
| Must NOT imply | Any real quality outcome, real inspection result, or real decision authority. |
| Evidence status | Simulation. |
| Source badge | Shows "Mock / Simulation" badge. |
| UAT implication | Mock data must never be cited as UAT evidence. |

---

### `simulated-release-only`

| Field | Value |
|---|---|
| Meaning | The release queue or release decision panel is running in simulation mode. No SAP QM write-back, e-signature, or GxP audit trail is active. |
| When it appears | Release queue, release summary, decision history panels in mock/simulated mode. |
| Allowed UI copy | "Simulated release panel. This panel does not authorise release, rejection, or any SAP posting. All release actions are demonstration-only." |
| Must NOT imply | Any actual release authority, SAP approval, or regulatory compliance. |
| Evidence status | Simulated — no write-back. |
| Source badge | Shows "Simulation" badge. |
| UAT implication | Blocked for any operational use until SAP QM write-back, e-signature, and GxP audit trail are implemented and governed. |

---

## 2. State Table

| State | Meaning | User-facing copy (key phrase) | Must NOT imply | Example scenario |
|---|---|---|---|---|
| `not-configured` | No request context | "Select a batch to view Quality evidence" | No quality issue exists | Panel rendered without batchId |
| `pending-source-verification` | Source not yet verified | "Source verification pending" | No inspection lot/MIC/UD exists | Broader quality source pack not run |
| `source-verified-not-wired` | Source verified, route not live | "Source verified. Live route pending." | Live data matches fixture | Usage-decision source verified; route not built |
| `loading` | Query in flight | "Loading Quality evidence…" | Any quality outcome | React Query isLoading |
| `loaded` | Source returned rows | Raw code + governed label | Release approval or CoA approval | Inspection lots found, UD code A |
| `no-records` | Source returned zero rows | "No records returned by source. Not confirmation of absence." | Proof of absence | Query succeeded, no inspection lot rows |
| `partial-evidence` | Some sections loaded, others not | "Partial evidence only. Missing sections may still exist." | Missing section = no issue | Lots loaded, MIC/CoA unavailable |
| `multiple-lots` | More than one inspection lot | "Multiple lots found. Per-lot evidence only." | Single batch-level decision | Two lots with different UD codes |
| `unavailable` | Evidence section not wired | "Evidence unavailable. Do not interpret as absence." | Deviation or CoA clear | Deviation source not wired |
| `error` | Adapter query failed | "Evidence could not be retrieved. Not confirmation of no issue." | No quality evidence exists | Network/auth error |
| `mock` | Fixture/simulation data | "Simulated data only. Not real batch evidence." | Any real quality outcome | Mock adapter active |
| `simulated-release-only` | Release simulation mode | "Simulated release panel. No authorisation implied." | Release authority or SAP approval | Release queue in demo mode |

---

## 3. Required Rules

### 3.1 Unknown is not zero

A result of `no-records`, `unavailable`, or `error` does not mean the evidence does not exist. These states reflect the current query outcome, not the real-world fact. Example: a missing inspection lot row in `gold_inspection_usage_decision` does not confirm that no inspection was performed in SAP.

### 3.2 No records is not proof of absence

Zero rows returned by a queried source object must always be annotated with: "No records returned from a source must not be interpreted as absence of exposure." The panel must never suppress this warning.

### 3.3 Missing usage decision is not accepted/released

A null, absent, or empty-string usage-decision must never be displayed as "Accepted", "Released", "Compliant", or "No issues". The governed mapping for empty string (`''`) is "Pending — lot open, no decision taken". A null or absent usage-decision is a source gap; the correct display is "No usage decision recorded" or "Evidence unavailable".

### 3.4 Missing deviation evidence is not no deviations

If the deviation source is in `unavailableEvidence` or returns zero rows, the panel must display: "Deviation source unavailable. Do not interpret this as no deviations." The absence of a deviation row does not confirm no deviation exists.

### 3.5 CoA-like rows are not official CoA approval

CoA-like result evidence (MIC results in a CoA format) is read-only source evidence. It is not a controlled CoA document, is not a sign-off, is not versioned, and is not official CoA approval. `documentStatus` in the contract is restricted to `unavailable | unknown` for this reason.

### 3.6 Release panels remain simulated unless governed workflow exists

Any panel that displays release queue, release decision, or decision history data must carry `simulated-release-only` semantics until SAP QM write-back, e-signature, GxP audit trail, and process-owner governance are designed, implemented, and validated.

### 3.7 Read-only evidence is not release authority

The Quality read-only evidence panel is an evidence display tool. It has no write-back capability, no SAP integration, and no release authority. Displaying a usage-decision code does not constitute a release decision. The panel must always show: "Read-only Quality evidence. This panel does not authorise release, rejection, or SAP posting."

---

## 4. Source Badge Behaviour

| State | Badge text | Badge colour |
|---|---|---|
| `not-configured` | Not shown | — |
| `pending-source-verification` | "Verification pending" | Warning (amber) |
| `source-verified-not-wired` | "Route pending" | Warning (amber) |
| `loading` | Not shown | — |
| `loaded` | Source name (e.g., "databricks-api") | Info (blue/neutral) |
| `no-records` | Source name | Warning (amber) |
| `partial-evidence` | Source name | Warning (amber) |
| `multiple-lots` | Source name | Warning (amber) |
| `unavailable` | "Unavailable" | Warning (amber) |
| `error` | Source name | Error (red) |
| `mock` | "Mock / Simulation" | Warning (amber) |
| `simulated-release-only` | "Simulation" | Warning (amber) |

---

## 5. Live-Wiring Gates

Before any state transitions from `pending-source-verification` or `source-verified-not-wired` to `loaded` in production:

1. The broader Quality Databricks source verification pack (`quality-databricks-source-verification.md`) must be completed for the relevant objects (inspection-lot, MIC/result, CoA-like, deviation).
2. The lot-selection rule for multiple lots per batch must be defined (TRACE-P1-012 gate).
3. The FastAPI proxy route and adapter must be implemented and browser-tested against a live V1 or Databricks backend.
4. A verified live Quality UAT candidate (plant/material/batch with confirmed inspection lot data) must be identified.
5. User OAuth identity must be enforced for all Databricks reads — no service-principal fallback.

---

## 6. UAT Implication Summary

| Criterion | Current state | Unblocked by |
|---|---|---|
| UI/state model code-ready | Code-ready (2026-05-21) | This work package |
| Fixture coverage | Complete (2026-05-21) | This work package |
| Source-truthfulness tests | Complete (2026-05-21) | This work package |
| Live Databricks wiring | Pending | Broader source verification pack + lot-selection rule + route implementation |
| Verified UAT candidate | Pending | Quality source verification and candidate identification |
| Live UAT | Blocked | All of the above |

**Quality live UAT remains blocked.** UI and source-truthfulness state handling are code-ready with fixture coverage. Live Databricks source wiring remains pending.
