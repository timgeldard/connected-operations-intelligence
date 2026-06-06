# di-traceability

Batch traceability investigation cockpit for the ConnectIO V2 platform.

Gives quality and food-safety users a single view of a suspect batch: what it is, where it came from, what it went into, which customers may be exposed, what stock remains, and what evidence is complete or missing.

## Architecture

```
trace2-queries.ts       TanStack Query hooks (one per data domain)
       │
trace2-adapter.ts       Adapter facade — returns AdapterResult<T> ({ ok, data } | { ok, error })
       │
trace2-adapter-factory  Selects mock or legacy-api adapter based on config
       │
trace2-mock-data.ts     Realistic mock responses (Phase 1 fixture)
```

### Views and panels

- **`views/overview-view.tsx`** — Main investigation cockpit: `InvestigationSummary` header + 6 evidence panels + `EvidencePackReadiness` checklist
- **`views/trace-tree-view.tsx`** — Bidirectional lineage graph
- **`views/customer-exposure-view.tsx`** — Delivery and customer exposure detail
- **`views/supplier-exposure-view.tsx`** — Upstream vendor/receipt exposure
- **`views/mass-balance-view.tsx`** — Input/output variance
- **`views/recall-readiness-view.tsx`** — Recall risk assessment

Panels are stateless cards (≥320px) that accept a `Trace2AdapterRequest` and render a single data domain.

### Evidence confidence

`calculateConfidence()` in `components/EvidenceConfidence.tsx` scores evidence completeness across 6 sectors (lineage, customers, mass balance, quality, CoA, suppliers) and drives the `EvidenceConfidenceBadge` and `EvidencePackReadiness` checklist on the cockpit.

## Running tests

```sh
pnpm nx test di-traceability
pnpm nx typecheck di-traceability
```

## Key docs

| Doc                                         | Purpose                                                           |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `docs/mb56-parity-review.md`                | Gap analysis vs. reference SQL engine                             |
| `docs/uat-acceptance-script.md`             | 10 UAT scenarios for QA / food-safety users                       |
| `docs/golden-test-batches.md`               | Register of known test batches                                    |
| `docs/uat-validation-ledger.md`             | Live UAT run history                                              |
| `docs/traceability-defect-backlog.md`       | Classified defect register                                        |
| `docs/production-readiness-checklist.md`    | Gates before production use                                       |
| `docs/traceability-genie-readiness-pack.md` | First approved Traceability Genie question pack and blocked scope |

## Status

Hybrid readiness. `BatchHeaderPanel` has a browser-verified `legacy-api` path, and `TraceGraphPanel` has a browser-verified native `databricks-api` path. Trace App routes (`recall-readiness`, `supplier-batches`, `batch-quality-passport`, `mass-balance-ledger`, `investigation-timeline`, `holds-ledger`) exist as code-fixed but browser-UAT-pending read-only evidence routes. Several other trace panels remain mock-only or are still blocked on DDL/source verification. A new **Trace Assistant Pilot** view now provides a deterministic, domain-scoped assistant surface limited to focal batch and visible graph evidence. See `docs/production-readiness-checklist.md` and `docs/traceability-genie-readiness-pack.md` for the current gates.
