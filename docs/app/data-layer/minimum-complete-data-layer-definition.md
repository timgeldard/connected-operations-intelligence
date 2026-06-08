# Minimum Complete Data Layer Definition

This document defines what "data-layer complete for controlled UAT" means for ConnectIO RAD V2. It is used to assess every domain capability consistently and to prevent overclaiming.

> **This definition describes readiness for controlled UAT, not production readiness.** See the explicit exclusions below.

## The 12 Criteria

A capability is **data-layer complete for controlled UAT** only when all of the following are true:

### 1. Clear source state

The adapter's data source is explicitly documented as one of:

- `live-databricks` — native route wired and browser-verified
- `live-legacy-bridge` — V1 proxy route wired and browser-verified
- `mock-only` — intentional fixture-only, no live path planned for this phase
- `unavailable-state` — explicitly surfaced to the user as unavailable
- `production-blocked` — hard constraint documented; no live path in scope

A capability that is silently mock, or whose source is undocumented, is **not** data-layer complete.

### 2. Frontend adapter method

One of:

- A typed adapter method exists in the domain's adapter class, returning `AdapterResult<T>`, OR
- The capability is explicitly represented as an unavailable state in the adapter (not silently omitted)

### 3. Backend route or documented absence

One of:

- A FastAPI route exists for the capability (in `apps/api/routes/`), OR
- A documented explicit reason why no route exists (e.g., capability is mock-only by design, capability is unavailable pending governance)

### 4. Zod/data-contract schema

Where structured data crosses a package or API boundary:

- A Zod schema exists in `@connectio/data-contracts`
- The schema is the single source of truth — not duplicated in ad-hoc TypeScript types

### 5. Generated Python contract support

Where a FastAPI route returns a structured contract:

- A corresponding Python model exists in `apps/api/contracts/generated.py`
- The Python model is derived from the same Zod schema (via contract generation), not hand-written

### 6. Source object documented

The specific Databricks table(s), view(s), or metric view(s) that supply this capability are named explicitly — in the domain README, source mapping doc, or adapter query.

### 7. Verification state documented

For each source object, the following are explicitly stated (even if the answer is "not yet verified"):

- Object exists: confirmed or not verified
- Schema: confirmed column list or not verified
- Grain: confirmed or not verified
- Join keys: confirmed or not verified
- Semantics: confirmed, pending, or governance-required

### 8. No silent mock fallback from live mode

When the adapter is running in `databricks-api` or `legacy-api` mode:

- The adapter does **not** silently return fixture data on error
- Expected failures (401, 403, 429, 502, 503, 504) are surfaced to the user
- The `source` field on `AdapterResult` accurately reflects the real source

### 9. Source badge / adapter mode surfaced in UI

The frontend panel displays:

- The adapter mode (mock / legacy-api / databricks-api) via a source badge or equivalent UX
- Any source-truthfulness caveats where the data is partial, pending-verification, or has known semantic gaps

### 10. Tests for three scenarios

Tests exist (unit or integration) covering:

- **Success path** — data returned correctly, `source` field correct
- **No-record / empty path** — empty dataset handled explicitly (not treated as "all clear")
- **Source-truthfulness / caveats** — unavailable state, error state, or mock-labelling behaviour

### 11. UAT candidate or documented absence

One of:

- A specific UAT candidate (material, batch, plant, or process order) is identified in the domain's golden candidates doc, OR
- A documented reason why no candidate can currently be identified (e.g., source not verified, no live data available)

### 12. Current blocker and next action documented

The capability has:

- A current blocker (or "none — ready for UAT") stated explicitly
- A next action that is specific and actionable

---

## Explicit Exclusions

### Complete data layer ≠ production-ready

Meeting all 12 criteria qualifies a capability for **controlled UAT only**. Production readiness additionally requires:

- Live UAT evidence captured and reviewed against reference
- All open defects triaged or closed
- Data freshness and `dataAsOf` behaviour verified
- Unity Catalog grants and OAuth token flow validated end-to-end
- Audit logging confirmed

### Complete data layer ≠ business decision authority

A data-layer-complete capability displays evidence; it does not:

- Authorize release, rejection, approval, or disposition
- Replace a governed business decision workflow
- Imply that displayed data is authoritative for regulatory or GxP purposes

### Complete data layer ≠ SAP write-back

No capability in this phase implements SAP write-back, SAP QM integration, or bidirectional data flow with any ERP system.

### Complete data layer ≠ GxP / e-signature readiness

Displaying quality evidence does not constitute an e-signature workflow, GxP audit trail, or regulated release action.

### Complete data layer does not remove domain caveats

Even a data-layer-complete capability retains its domain-specific caveats:

- **Mass balance:** MOVEMENT_CATEGORY direction mapping (TRACE-P1-010) and BALANCE_QTY semantics (TRACE-P1-011) remain unresolved; caveat banners must stay until these are closed
- **Quality UD:** Lot-selection rule not yet confirmed; batch-level UD display cannot be safely shown until governed
- **SPC:** No native Databricks route wired; contract alignment complete but runtime gate not passed
- **Warehouse:** Source schema not verified; expansion blocked
- **Supplier risk:** openSupplierActions/highestRiskSupplier governance not defined

---

## How to Apply This Definition

When reviewing a PR or assessing a domain for UAT readiness, step through the 12 criteria. A capability passes only when all 12 are explicitly satisfied — a partial or assumed "yes" counts as a gap.

If a criterion cannot be met because of an external dependency (governance, Databricks access, business decision), mark the capability as `governance-pending` or `source-verification-pending` and document the specific dependency. Do not treat it as complete.

This definition is reusable for future PR reviews. Any PR claiming to move a capability to `complete-for-controlled-uat` should reference this document and confirm each criterion explicitly.
