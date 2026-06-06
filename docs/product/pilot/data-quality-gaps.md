# Data Quality Gaps

**Route:** `?workspace=admin-pilot-data-quality-gaps`
**Phase:** 8

## Purpose

Catalogue of gaps between mock/simulated pilot data and real source system data. Used to track which data quality issues must be resolved before production cutover.

## Gap Summary

| ID | Source System | Workspace | Severity | Status |
|----|---------------|-----------|----------|--------|
| DQG-001 | Coda (ERP) — CoA API | quality-batch-release | critical | Open |
| DQG-002 | eDMS — Event Log | trace-investigation | warning | Open |
| DQG-003 | PhaseManager (MES) | operations-plan-risk | warning | Open |
| DQG-004 | SPC Connector | spc-monitoring | warning | Workaround In Place |
| DQG-005 | SAP PM (CMMS) | maintenance-reliability | blocker | Open |
| DQG-006 | SAP WM | warehouse-360-overview | info | Workaround In Place |
| DQG-007 | EnvMon Sensor API | envmon-monitoring | warning | Open |
| DQG-008 | Coda Batch Master | quality-batch-release | info | Accepted Risk |
| DQG-009 | SPC Control Limits | spc-monitoring | warning | Open |
| DQG-010 | Azure AD (IAM) | all | info | Resolved |

## Production Blockers

DQG-001 (CoA API) and DQG-005 (SAP PM) are open without accepted-risk status — these block production cutover.
