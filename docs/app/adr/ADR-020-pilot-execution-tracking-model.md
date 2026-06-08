# ADR-020: Pilot Execution Tracking Model

**Status:** Accepted  
**Date:** 2026-05-15  
**Deciders:** pilot-lead, programme-manager  
**Phase:** 8

## Context

Phase 8 introduces the execution phase of the pilot: running the 6 defined scenarios, tracking pass/fail results with evidence, and deriving a scenario pass rate. We needed to decide how to model execution results and what constitutes a passing scenario.

## Decision

Scenario execution is modelled as `ScenarioExecutionResult` (in `execution.ts`). The pass rate is computed by `computeScenarioPassRate` which counts both `'passed'` and `'passed-with-observations'` as passing. Scenarios that have not been run are excluded from the denominator-per-result but included in the total count display.

## Rationale

- `passed-with-observations` scenarios represent real-world pilot outcomes where the workspace works but integration gaps exist — these should count as pilot-passing since the product is validated, even if source data is not yet live.
- The pass rate denominator uses total planned scenarios (not just executed ones) so the metric correctly reflects incomplete pilot state to stakeholders.
- `blocks-pilot-exit` and `blocks-production` flags are set per execution record to provide scenario-level blocking signals without requiring a separate issue for each observation.

## Consequences

- The pass rate will remain below target until SCN-005 and SCN-006 are executed.
- Observations from `passed-with-observations` scenarios must be captured as issues in the Pilot Issue Register to ensure they are tracked to resolution.
