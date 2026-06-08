# Pilot Issue Register

**Route:** `?workspace=admin-pilot-issues`
**Phase:** 8

## Purpose

Canonical list of all issues raised during pilot execution. Each issue is categorised, assigned an owner, and flagged if it blocks pilot exit or production cutover.

## Issue Summary

| ID | Title | Category | Severity | Status | Pilot Exit Blocker | Prod Blocker |
|----|-------|----------|----------|--------|-------------------|--------------|
| ISS-001 | CoA API not wired | source-integration | critical | triaged | No | Yes |
| ISS-002 | SPC filter latency >3s | performance | warning | in-progress | No | No |
| ISS-003 | EventTimeline mock timestamps | data-quality | warning | triaged | No | Yes |
| ISS-004 | Action audit log not persisted | workflow-gap | blocker | in-progress | Yes | Yes |
| ISS-005 | PhaseManager data unavailable | source-integration | warning | waiting-on-owner | No | Yes |
| ISS-006 | WCAG 2.1 AA focus ring missing | accessibility | critical | new | Yes | Yes |
| ISS-007 | SAP PM contract not signed | governance | blocker | waiting-on-owner | No | Yes |
| ISS-008 | SPC connector not in pilot env | source-integration | warning | resolved | No | No |
| ISS-009 | Pilot banner not localised | ux | info | deferred | No | No |
| ISS-010 | Staging confirmation no email | workflow-gap | info | triaged | No | No |

## Blocker Escalation

ISS-004 and ISS-006 are pilot exit blockers. Both require resolution or formal accepted-risk before pilot exit criteria can be met. Daily triage cadence is required for all issues rated `critical` or `blocker`.
