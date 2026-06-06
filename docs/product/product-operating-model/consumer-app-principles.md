# Consumer App Principles

To build premium, consumer-grade applications for manufacturing operations, we adhere to the following core user experience and architectural principles:

---

## 1. Start from the User Job, Not the Table or Route
Avoid mirroring database schemas or API structures in the UI. Design layouts based on the logical sequence of operations the user must perform to accomplish their task. 

## 2. Design for Operational Decision Support, Not Data Browsing
Operational users need to make fast, accurate decisions (e.g. "Can I release this batch?", "Is the pasteurizer stable?"). Design interfaces to highlight anomalies, alert states, and critical parameters rather than presenting grid-heavy spreadsheets of raw numbers.

## 3. Keep SAP/Databricks Complexity Behind App-Facing Contracts
Data source fragmentation, join complexities, and naming conventions must be resolved at the adapter or endpoint mapper level. Component interfaces must be clean, typed, and tailored to the frontend's functional needs.

## 4. Prefer Guided Workflows Over Raw Dashboards
Break complex analyses into guided work steps (e.g., progressive disclosures, tabs, stepping systems) to prevent cognitive overload.

## 5. Treat Edge States as First-Class UX
Empty, loading, error, stale, partial, and governance-pending states must be designed and styled as first-class layouts. Never leave the user with an empty screen, raw stack traces, or silent freezes.

## 6. Separate Facts, Derived Values, Heuristics, and Governed Decisions
- **Facts**: Direct raw measurements from systems of record.
- **Derived Values**: Client-side mathematical calculations (e.g., standard deviations).
- **Heuristics**: Predictive or suggestive metrics (e.g., AI/BI estimations).
- **Governed Decisions**: Legally or quality-governed statuses (e.g., official batch release status).
Never present a heuristic or derived value as a governed decision in the user interface.

## 7. Use Attributable, User-Facing Caveat Language
Where data is partial, catalog integration is pending, or source data is simulated, explain the state in clear, non-technical terms. (e.g. *"Sandbox Mode — Simulating data for material candidate validation. Do not use for operational release decisions."*).

## 8. Do Not Allow Demo/Mock Data to be Mistaken for Live Evidence
Simulated environments must feature explicit banners (like the `SPCSandboxBanner` or `VerificationStatusBanner`) indicating that mock data is active.

## 9. Maintain Explicit Product Briefs
Every application or workspace in this repo must declare its:
- Primary users.
- Primary jobs-to-be-done.
- Data dependencies.
- Readiness caveats.
- Non-goals.
These details should be authored inside the application's `product-brief.md`.
