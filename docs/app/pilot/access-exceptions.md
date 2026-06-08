# Access Exceptions

**Route:** `?workspace=admin-pilot-access-exceptions`
**Phase:** 8

## Purpose

Documents access discrepancies — cases where a role's actual workspace access differs from the expected access level defined in the Role/Scope Matrix.

## Exception Summary

| ID | Role | Workspace | Expected | Actual | Severity | Status |
|----|------|-----------|----------|--------|----------|--------|
| AE-001 | quality-lead | quality-batch-release | Yes | Yes | info | Resolved |
| AE-002 | plant-manager | quality-batch-release | Yes | No | warning | Open |
| AE-003 | qa-technician | operations-plan-risk | No | Yes | critical | Open |
| AE-004 | food-safety-lead | trace-investigation | Yes | Yes | info | Resolved |
| AE-005 | warehouse-manager | warehouse-360-overview | Yes | Yes | info | Resolved |
| AE-006 | operations-supervisor | quality-batch-release | No | No | info | Resolved |
| AE-007 | maintenance-technician | maintenance-reliability | Yes | No | warning | Deferred |
| AE-008 | plant-manager | trace-investigation | Yes | No | critical | Open |
| AE-009 | quality-lead | spc-monitoring | Yes | Yes | info | Resolved |
| AE-010 | external-auditor | quality-batch-release | No | No | info | Resolved |

## Open Production Blockers

- **AE-002**: Plant manager missing read access to quality-batch-release — blocks SCN-006.
- **AE-003**: QA Technician has unexpected write access to operations-plan-risk — security issue requiring immediate remediation.
- **AE-008**: Plant manager missing read access to trace-investigation — blocks SCN-006.
