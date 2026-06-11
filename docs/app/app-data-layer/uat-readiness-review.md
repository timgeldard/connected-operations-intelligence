# Controlled UAT Readiness Review

> **Status.** Template only. This document does **not** assert that any
> journey, data product, or domain has passed UAT, has been signed off, or
> is ready for production. It will be completed by the review facilitator
> after all evidence packs from
> [`docs/app-data-layer/evidence/`](./evidence/) have been filed.
>
> UAT readiness is not production readiness. See section 6.

---

## 1. Purpose

This document is the cross-domain review gate that follows completion of
all eight first-wave UAT sessions. Its purpose is to:

1. Confirm all evidence packs exist and meet the standard in
   [`browser-uat-evidence-standard.md`](./browser-uat-evidence-standard.md).
2. Surface any forbidden-claim violations, null-state rendering failures,
   or caveat-visibility gaps found across sessions.
3. Determine which data products are `evidence-captured`,
   `passed-with-caveats`, `failed`, or `blocked`.
4. Identify any open gates that remain before any production-readiness
   conversation can begin.

This review does **not** make a production-readiness claim.

---

## 2. Review Participants

| Role              | Name | Confirmed attendance |
|-------------------|------|----------------------|
| Review facilitator | _(fill in)_ | [ ] |
| Trace domain owner | _(fill in)_ | [ ] |
| Quality domain owner | _(fill in)_ | [ ] |
| SPC domain owner | _(fill in)_ | [ ] |
| POH/Operations owner | _(fill in)_ | [ ] |
| Warehouse domain owner | _(fill in)_ | [ ] |
| Business UAT lead | _(fill in)_ | [ ] |
| Data engineer / contract owner | _(fill in)_ | [ ] |

---

## 3. Evidence Pack Status

Complete this table after all sessions are filed.

| # | Journey                                   | Evidence folder                                          | Evidence status      | Outcome                 | Open caveats |
|---|-------------------------------------------|----------------------------------------------------------|----------------------|-------------------------|--------------|
| 1 | Trace — Batch Header + Customer Exposure  | `evidence/YYYY-MM-DD/trace-batch-header-customer-exposure/` | _(not-started)_    | _(not-started)_         | —            |
| 2 | Trace — Supplier Exposure + Mass Balance  | `evidence/YYYY-MM-DD/trace-supplier-exposure-mass-balance/` | _(not-started)_    | _(not-started)_         | —            |
| 3 | Quality — Usage Decision Evidence         | `evidence/YYYY-MM-DD/quality-usage-decision-evidence/`      | _(not-started)_    | _(not-started)_         | —            |
| 4 | POH — Process Order Header                | `evidence/YYYY-MM-DD/poh-process-order-header/`             | _(not-started)_    | _(not-started)_         | —            |
| 5 | SPC — Chart Data Series                   | `evidence/YYYY-MM-DD/spc-chart-data-series/`                | _(not-started)_    | _(not-started)_         | —            |
| 6 | Warehouse — Inbound                       | `evidence/YYYY-MM-DD/warehouse-inbound/`                    | _(not-started)_    | _(not-started)_         | —            |
| 7 | Warehouse — Staging                       | `evidence/YYYY-MM-DD/warehouse-staging/`                    | _(not-started)_    | _(not-started)_         | —            |
| 8 | Warehouse — Exceptions                    | `evidence/YYYY-MM-DD/warehouse-exceptions/`                 | _(not-started)_    | _(not-started)_         | —            |

Valid outcome values: `not-started` · `evidence-captured` · `passed-with-caveats` · `failed` · `blocked` · `not-applicable`

---

## 4. Cross-Journey Findings

### 4.1 Forbidden-claim violations

List any phrase that appeared in any session that is on a forbidden-claim
list. Reference the evidence pack and the screenshot.

| Journey | Forbidden phrase observed | Screenshot ref | Resolution |
|---------|--------------------------|----------------|------------|
| _(none at this point)_ | | | |

### 4.2 Null / unknown / unavailable rendering failures

List any field that rendered as a reassuring default when the source
returned `null`, `unknown`, or `unavailable`.

| Journey | Field | Observed rendering | Expected rendering | Resolution |
|---------|-------|-------------------|-------------------|------------|
| _(none at this point)_ | | | | |

### 4.3 Caveat visibility gaps

List any caveat (governance-pending, application-heuristic, etc.) that
was required but not visible in the UI.

| Journey | Required caveat | Was it visible? | Resolution |
|---------|----------------|-----------------|------------|
| _(none at this point)_ | | | |

### 4.4 Source mode issues

List any session where mock mode was silently used in a non-mock
environment, or where the source badge showed an unexpected mode.

| Journey | Expected mode | Observed mode | Resolution |
|---------|--------------|---------------|------------|
| _(none at this point)_ | | | |

---

## 5. Blocked Items Reconfirmation

The following items were blocked from first-wave UAT (from
[`uat-entry-plan.md`](./uat-entry-plan.md) section 6). Confirm their
status has not changed.

| Domain | Blocked item | Block reason | Status at review |
|--------|-------------|--------------|------------------|
| Warehouse | Overview — `nearExpiryCount` | Gate 4 open (threshold not agreed) | _(confirm)_ |
| Warehouse | Overview — `reconciliationExceptionCount` | Gate 5 open (tolerance not agreed) | _(confirm)_ |
| Trace / Quality | `recallRecommended` (governed true/false) | Governed recall rule not implemented | _(confirm)_ |
| Quality / Supplier | Supplier risk scoring (categorical) | Source coverage and governance pending | _(confirm)_ |
| SPC | Capability indices / Nelson rule signals | Out of scope | _(confirm)_ |
| All | Release / reject / approval workflows | Out of scope | _(confirm)_ |

---

## 6. Open Gates Before Production-Readiness Conversation

The following are **minimum open gates** that must be closed before any
production-readiness conversation can begin for any journey. This list
is not exhaustive — see [`uat-entry-plan.md`](./uat-entry-plan.md)
section 11 for the full production readiness gate list.

| # | Gate | Status |
|---|------|--------|
| 1 | All 8 evidence packs filed and reviewed | _(open)_ |
| 2 | No outstanding forbidden-claim violations | _(open)_ |
| 3 | All null/unknown rendering failures resolved | _(open)_ |
| 4 | All required caveats confirmed visible | _(open)_ |
| 5 | Warehouse Gates 4 and 5 closed (overview governance) | _(open)_ |
| 6 | Governed recall-rule source implemented for Trace | _(open)_ |
| 7 | Supplier risk scoring governance resolved for Quality | _(open)_ |
| 8 | Named business owner acceptance per data product | _(open)_ |
| 9 | Support runbook and monitoring agreed per domain | _(open)_ |
| 10 | Security and access review completed | _(open)_ |

---

## 7. Review Outcome

> _To be completed by review facilitator after all evidence packs are filed
> and cross-journey findings have been assessed._

**Overall UAT wave outcome:** _(not-started)_

**Summary:**

_(Fill in after all sessions complete.)_

**Next steps:**

_(List the specific actions required before any production-readiness gate
can be opened. Include ticket / PR references.)_

---

## 8. Sign-Off

> _Signatures confirm that the evidence packs have been reviewed and the
> findings above are accurate. This sign-off does not constitute
> production readiness or regulatory approval._

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Review facilitator | | | |
| Technical lead | | | |
| Business UAT lead | | | |

---

## Related

- [`uat-entry-plan.md`](./uat-entry-plan.md)
- [`browser-uat-evidence-standard.md`](./browser-uat-evidence-standard.md)
- [`evidence/`](./evidence/) — all filed evidence packs
- `browser-uat-checklists/` — per-domain journey checklists
