# Data Product Patterns

The standard app data product pattern vocabulary defines common structural models used to expose business objects through the API.

## Pattern Vocabulary

- **Identity:** Core identifiers and basic metadata describing the object.
- **Summary:** An aggregated, high-level overview of the business object.
- **Evidence:** Immutable, source-backed facts used to support business decisions.
- **Metric:** Quantitative measurements or KPIs.
- **Ledger:** A chronological list of transactions or movements.
- **Timeline:** A sequence of lifecycle events ordered by time.
- **Lineage:** The upstream and downstream relationships (e.g., traceability graphs).
- **Exposure:** The impact or reach of an object (e.g., customer delivery exposure).
- **Snapshot:** The state of an object at a specific point in time.
- **Exception:** Operational anomalies, errors, or flags requiring attention.
- **Decision Context:** Data synthesized specifically to support a human business decision.
- **Investigation Pack:** A comprehensive bundle of related data products across domains for deep-dive analysis.

## Application approach

Not every business object must support every pattern. Do not force all objects into a fixed "Summary / Evidence / Investigation" shape. Instead, use **Business Object × Data Product Pattern** as the modelling approach.

### Examples:

- **Batch:** may support Summary, Quality Evidence, Movement Ledger, Lineage Graph, Exposure Evidence, Investigation Pack.
- **SPC Characteristic:** may support Identity, Subgroup Series, Limit Provenance, Signal Evidence, Capability Evidence.
- **Inspection Lot:** may support Identity, Result Evidence, Decision Context, Timeline.
