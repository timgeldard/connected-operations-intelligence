# Lessons Learned

**Route:** `?workspace=admin-pilot-lessons-learned`
**Phase:** 8

## Purpose

Captures lessons and recommendations from the IE10 controlled pilot. Lessons are categorised, prioritised, assigned to owners, and linked to the wave in which they should be actioned.

## Summary

| Category | Count |
|----------|-------|
| Process | 3 |
| Data Integration | 2 |
| Technical | 2 |
| Product | 2 |
| Training | 1 |
| Support | 1 |
| Governance | 1 |
| Stakeholder | 1 |

**Total: 12 lessons. 7 high priority, 4 medium, 1 low.**

## Key Lessons

### LL-001 — Sign-off process should start earlier

Begin stakeholder briefings before all scenarios are complete. Waiting for 100% scenario completion before initiating sign-offs adds weeks to the timeline.

### LL-002 — Source API readiness gate required

Source APIs that are unavailable at pilot start should be formally accepted-as-mock before pilot kick-off. Unexpected API unavailability (CoA, PhaseManager) erodes user confidence.

### LL-003 — Action persistence gap caught late

Action audit log persistence (ISS-004) should have been caught in pre-pilot acceptance testing. Add a server-side action persistence integration test to the pre-pilot gate.

### LL-005 — Role-specific training outperforms general overview

Role-specific workspace training drives faster adoption and fewer support questions than general V2 concepts overview alone. Make role-specific training mandatory.

### LL-009 — Daily triage cadence required for critical issues

Critical issues (like ISS-006) should have owners assigned within 24 hours. Establish a daily stand-up for any issue rated critical or above.

### LL-012 — Accessibility testing must gate pilot launch

WCAG 2.1 AA compliance should be an automated and manual audit gate before any pilot launch. Accessibility failures discovered in pilot are expensive to remediate.
