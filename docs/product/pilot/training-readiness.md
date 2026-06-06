# Training Readiness

**Route:** `?workspace=admin-pilot-training-readiness`
**Phase:** 8

## Purpose

Per-role training completion status for the IE10 pilot cohort. Identifies which roles are fully ready, which have gaps, and which are blocked by source availability or content dependencies.

## Completion by Role

| Role | Completion | Users Ready | Status |
|------|------------|-------------|--------|
| quality-lead | 100% | 3/3 | Ready |
| food-safety-lead | 100% | 2/2 | Ready |
| operations-supervisor | 75% | 1/2 | In Progress |
| warehouse-manager | 100% | 2/2 | Ready |
| qa-technician | 50% | 0/4 | Blocked |
| plant-manager | 25% | 0/1 | Blocked |

## Blockers

- **QA Technician:** SPC Monitoring and EnvMon training modules depend on source connector availability.
- **Plant Manager:** Cross-Domain Site Risk Review module pending SCN-006 readiness work.

## Overall

72% of pilot users training-complete. Target ≥90% before production cutover.
