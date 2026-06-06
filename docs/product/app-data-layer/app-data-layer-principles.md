# App Data Layer Principles

The durable asset of ConnectIO-RAD is the app-facing data product layer. The Databricks semantic model is the underlying source of truth, and our API contracts define the app boundary.

**Core principle:**
"ConnectIO-RAD apps are reference consumers of a governed manufacturing app data layer; the durable product is the app-facing data product layer over Databricks, not the prototype screens."

- **Apps are reference consumers:** The applications included in this repository serve as prototypes and reference consumers. They are replaceable and their existence does not dictate source semantics.
- **Evidence over unsupported decision labels:** We prefer presenting source-backed facts and evidence rather than generating unsupported business decision labels (e.g., "Quality Released" or "Recall Recommended").
- **No silent fallback to mock/live ambiguity:** Data must clearly state its source. There should be no silent fallback from a live endpoint to mock data.
- **Every important field must be classifiable:** Any field that implies a business reality or decision must be explicitly classified by its derivation (e.g., source-field, source-derived, heuristic).
- **Governance-pending means the app must not decide:** If governance rules have not been defined for a specific process or calculation, the application must not infer or enforce a decision.
