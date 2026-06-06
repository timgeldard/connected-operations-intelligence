# ADR-014: Cutover Simulation Mode Progression Model

**Status:** Accepted  
**Date:** 2026-05-15  
**Author:** ConnectIO Platform Team

---

## Context

ConnectIO replaces six legacy systems across Kerry's manufacturing sites. For each legacy system, there is a point in the programme where the ConnectIO workspace must be validated as a functional substitute before the legacy system can be switched off. This validation cannot happen in a single cutover event — the risk of a hard switchover (users hit ConnectIO cold, legacy is gone) is too high for production-critical workflows.

The programme needs a structured way to stage the transition from parallel operation through full retirement, per legacy system, with observable checkpoints at each stage.

---

## Decision

A `CutoverSimulationMode` type is defined in `packages/product-model/src/types/readiness.ts` with four ordered values:

```
off → observe → simulate-redirect → simulate-retirement
```

Each legacy system × ConnectIO workspace pair has its own independent simulation state. The `CutoverSimulationPage` admin dashboard (`?workspace=admin-cutover-simulation`) shows the current mode and latest simulation result per pair.

**Mode definitions:**

| Mode | Meaning |
|---|---|
| `off` | No simulation active. Both systems operate normally. ConnectIO workspace exists but is not being used as a substitute. |
| `observe` | ConnectIO workspace is shown alongside the legacy system. Users can compare outputs. No redirects. Legacy remains authoritative. |
| `simulate-redirect` | Deep links from the legacy system are intercepted and redirected to the corresponding ConnectIO workspace. Users land in ConnectIO but legacy data is still live. |
| `simulate-retirement` | Legacy system routes are disabled in the simulation context. All traffic goes to ConnectIO. The legacy system still exists but is not reachable via normal navigation. |

Each mode transition is a deliberate action: the platform team updates the `SIMULATION_PAIRS` configuration in `CutoverSimulationPage.tsx` and deploys. There is no automatic promotion.

---

## Rationale

### Why four modes and not two (on/off)?

A binary on/off model forces teams to choose between full parallel operation and full cutover. The two intermediate modes (`observe` and `simulate-redirect`) provide validation checkpoints that reduce the risk of discovering integration gaps only at the final retirement step.

### Why `observe` before `simulate-redirect`?

`observe` lets the site team validate that ConnectIO produces the same outputs as the legacy system for real production data — without any disruption to user workflows. This is the lowest-risk starting point and gives the data integration team a validation window before redirects begin.

### Why is state per legacy system rather than per workspace?

A single ConnectIO workspace may partially supersede a legacy system (e.g. Quality Batch Release covers part of LabWare LIMS). Tracking simulation state at the legacy system level reflects the retirement unit — the legacy system being switched off — rather than the ConnectIO delivery unit. Multiple ConnectIO workspaces may need to reach `simulate-retirement` before a single legacy system can be retired.

### Why in the admin shell rather than a separate deployment tool?

The simulation mode is a product-level governance decision visible to the same audience that uses the Production Readiness and Parity dashboards. Keeping it in the ConnectIO shell makes it discoverable without a separate tool login.

---

## Consequences

### Positive

- Staged progression reduces the risk of a failed cutover at each legacy system
- The `observe` mode provides a risk-free validation window before any user-facing change
- Each legacy system has an independent simulation timeline — slower legacy systems do not block faster ones
- The dashboard provides a single view of simulation status across all six legacy systems

### Negative

- Mode advancement requires a code change and deployment rather than a configuration toggle — this is intentional (auditability) but slower than a UI control
- `simulate-retirement` in the simulation context does not fully replicate a real retirement (legacy data may still be accessible via direct URL)

### Mitigations

- The `CutoverSimulationResult.passed` field records whether each simulation run completed without blocking issues, providing an audit trail of validation outcomes
- The cutover simulation guide (`docs/migration/cutover-simulation-guide.md`) documents the per-system status and the advancement process
