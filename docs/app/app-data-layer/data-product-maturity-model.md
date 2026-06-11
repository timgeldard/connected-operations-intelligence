# Data Product Maturity Model

Data products within ConnectIO-RAD progress through a formalized maturity lifecycle.

> [!NOTE]
> This data product maturity model tracks backend and API readiness. To view the framework for user-facing features, see the [Application Experience Maturity Model](../product-operating-model/application-experience-maturity-model.md).


## Maturity Levels

- **L0 — Concept identified:** The business need or object is defined but unexplored.
- **L1 — Source mapped:** The Databricks underlying source views/tables are identified and DDL verified.
- **L2 — Contract defined:** The Zod/TypeScript schema and Pydantic response models are specified.
- **L3 — Route implemented:** The FastAPI route and Databricks query logic are implemented.
- **L4 — Mapper/contract tested:** Backend automated tests verify query logic, mapping, and exclusions.
- **L5 — Reference consumer ready:** A frontend UI or adapter is wired to consume the route.
- **L6 — Browser UAT evidenced:** End-to-end browser tests run successfully against a live UAT environment, and evidence is captured.
- **L7 — Production-ready:** Fully verified, governed, and deployed for production use.

## Important Notes

- Production readiness is not implied by route existence alone.
- Browser UAT evidence is separate from code completeness. An L4 route is not L6 until the runbook is executed.
- Governance-pending fields block higher readiness where relevant.

### Examples:

- `SPCSubgroupSeries` may be L3/L4 but is browser-UAT-pending.
- `QualityUsageDecisionEvidence` may be L2/L3 but is governance-pending for edge cases.
- `WarehouseOperationalSnapshot` may be blocked entirely at L1 due to source/schema mismatch.
