# Pilot Execution Dashboard

**Route:** `?workspace=admin-pilot-execution-dashboard`
**Phase:** 8 — Controlled Pilot Execution, Feedback Burn-Down, and Production Cutover Recommendation

## Purpose

Master status screen for the IE10 controlled pilot. Provides a single-pane view of pilot health: active blockers, scenario KPIs, feedback and issue counts, readiness summary, and a derived Go / No-Go preview.

## Sections

| Section | Description |
|---------|-------------|
| Pilot Status | Start/end dates, pilot scope, active roles and workspaces, current blockers |
| Cutover Recommendation | Derived Go / No-Go verdict, blockers, and required next actions |
| Scenario KPIs | Planned vs. executed vs. passed counts, pass rate |
| Feedback & Issue KPIs | Feedback submitted, issues created, open/resolved counts, critical/prod blockers |
| Readiness Summary | Progress meters for release gates, exit criteria, sign-offs, and data integration |

## Go / No-Go Logic

The cutover recommendation is derived conservatively:
- Any open blocker → `no-go`
- Conditions only (no blockers) → `go-with-conditions`
- Neither → `go`

**The recommendation must never be set to `go` or `go-with-conditions` while blockers remain open.**

## Current Status (IE10 Pilot)

- Status: **Active**
- Scenario pass rate: 66% (target ≥80%)
- Stakeholder sign-offs: 0 of 8
- Cutover recommendation: **NO-GO** (4 active blockers)
