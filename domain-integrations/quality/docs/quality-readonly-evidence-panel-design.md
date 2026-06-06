# Quality Read-Only Evidence Panel Scaffold

**Status:** scaffold-ready, pending source verification.
**Created:** 2026-05-21.

## Purpose

The read-only Quality evidence panel gives UAT users a visible placeholder for source-backed inspection lot, MIC result, usage-decision, and CoA-like evidence without implying live Quality release readiness.

## Current Behaviour

- The panel is mounted in the `quality-evidence` view.
- It uses `QualityReadOnlyEvidenceAdapter`.
- It shows `pending-source-verification`.
- It renders zero counts only as unavailable scaffold counts, not proof of source absence.
- It displays warnings that missing usage-decision, CoA, or deviation evidence must not be interpreted as accepted, released, or no issue.
- It states that specification limits are not SPC control limits and MIC valuation is not a release decision.

## Not Implemented

- No native Databricks route.
- No Databricks SQL.
- No source-backed inspection lot rows.
- No source-backed MIC result table.
- No official CoA document approval.
- No deviation/nonconformance workflow.
- No release/reject/conditional action.
- No SAP QM write-back.

## Source Verification Required Before Live Evidence

Before replacing the scaffold response with source-backed data, complete `quality-databricks-source-verification.md` and capture:

- source object existence
- exact columns and types
- row grain
- usage-decision semantics
- CoA-like result boundaries
- candidate plant/material/batch/inspection-lot evidence
- route and browser verification results
