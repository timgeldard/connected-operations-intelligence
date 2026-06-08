# Cutover Recommendation

**Route:** `?workspace=admin-pilot-cutover-recommendation`
**Phase:** 8

## Purpose

Displays the derived cutover recommendation (Go / No-Go / Go-with-conditions / Defer) along with the rationale, active blockers, conditions, accepted risks, and required actions before cutover.

## Current Recommendation

**NO-GO** — as of pilot start (2026-05-15)

### Rationale

Pilot is in active execution. Critical blockers prevent a production cutover recommendation:
- 0 of 8 stakeholder sign-offs approved
- Scenario pass rate 66% (target ≥80%)
- 4 active production blockers (ISS-001, ISS-004, ISS-005, ISS-006)
- SAP PM contract not signed

### Required Actions Before Cutover

1. Complete SCN-005 and SCN-006 scenario validation
2. Initiate stakeholder sign-off process after SCN-006 completion
3. Resolve ISS-006 accessibility focus ring issue
4. Resolve ISS-004 action audit log persistence gap
5. Confirm SAP PM integration contract timeline
6. Achieve ≥90% training readiness across all in-scope roles

## Conservative Logic Rule

**Do not set recommendation to `go` unless all blockers are cleared and all stakeholder sign-offs are approved.** Conditions alone can support `go-with-conditions`. Both conditions and sign-offs met with zero blockers → `go`.
