# Proposed Extensions and Workspaces for Connected Operations Intelligence

This document outlines **20 Platform Extensions** and **20 Business Workspaces** designed to enhance the frontend user experience and the backend Databricks data service layer. 

---

## Part 1: 20 Platform Extensions (Data Service & Architecture)

These extensions enhance query performance, security, data validation, and developer experience across the FastAPI-to-Databricks boundary.

### 1. Dynamic Contract-Validation Middleware
* **Description**: Intercepts FastAPI adapter query outputs and validates the shape, data types, and nullability against the corresponding schemas in [app_contract_manifest.yml](file:///home/timgeldard/github/connected-operations-intelligence/data-products/io-reporting/contracts/app_contract_manifest.yml) at runtime in non-prod environments.
* **Benefit**: Catches schema drift or datatype mismatches before they reach the React UI, replacing silent failures with clear console errors.

### 2. Databricks Statement API Query Batcher
* **Description**: Combines multiple parallel panel queries from a single React workspace view into a single batch HTTP request to the Databricks SQL Statement Execution API.
* **Benefit**: Bypasses connection pool limits, minimizes HTTP overhead, and reduces total dashboard load time by up to 40%.

### 3. Unity Catalog Query Auditer & Index Tuner
* **Description**: A DLT pipeline that reads the UC system logs (`system.information_schema.query_history`) to profile query parameters, filters, and join paths.
* **Benefit**: Automatically recommends or updates Liquid Clustering keys (`cluster_by`) on Silver and Gold tables to maintain optimal query performance.

### 4. Enzyme Manual Re-Evaluation Hook
* **Description**: A secure FastAPI route that calls the Databricks REST API to trigger a targeted incremental refresh of a specific Gold table when an operator requests a refresh.
* **Benefit**: Allows real-time operational updates for time-sensitive aggregates without waiting for the next scheduled pipeline run.

### 5. Change Data Feed (CDF) WebSocket Streamer
* **Description**: Backs FastAPI routes with a WebSocket server that queries the Delta CDF (`table_changes`) on critical Gold tables and pushes updates to the UI.
* **Benefit**: Enables real-time wallboards (e.g. Lineside Monitor) to refresh dynamically when new goods movements or process orders are registered.

### 6. SAP Zero-Padding Normalization Extension
* **Description**: A conformed data service utility that automatically pads or strips leading zeros for SAP alphanumeric keys (`werks`, `charg`, `matnr`) based on metadata definitions.
* **Benefit**: Prevents join failures between user input (e.g. manual text entry) and warehouse inventory logs.

### 7. Central Security Model (CSM) Local Fixture Builder
* **Description**: A local CLI script that builds mock access models for local development. To protect user privacy and prevent data exposure, the fixture builder produces synthetic or redacted fixtures: it does not serialize raw queries or identifiers. Instead, it replaces PII and operational context with deterministic hashes or canonical placeholders, strips or generalizes timestamps, and synthesizes non-sensitive metadata. The builder pipeline (including the CLI entrypoint and fixture generation function) implements these redactions by default, with any raw-history export path requiring an explicit opt-in flag and containing clear documentation so raw-history export is disabled by default.
* **Benefit**: Enables developer shakedowns and RLS checking in fully disconnected local modes without risking exposure of sensitive queries or user identifiers.

### 8. QuerySpec Performance Profiling Middleware
* **Description**: A telemetry extension that intercepts the `QueryExecutor`, logs exact query timings, cache hit/miss rates, and dataset sizes, and logs them to a monitoring database.
* **Benefit**: Surfaces slow queries and bad indexing patterns before they reach UAT.

### 9. Automated RLS Matrix Test Suite
* **Description**: A CI runner that mocks different plant access scenarios (e.g., restricted to Plant A, global admin, no access) and asserts that the `*_secured` SQL views correctly prune rows.
* **Benefit**: Guarantees RLS compliance and prevents data leaks before merging code.

### 10. Aecorsoft CDC Gap Detection Engine
* **Description**: A daily data-quality job that compares source SAP tables against Bronze replicated tables, tracking record count variances.
* **Benefit**: Alerts administrators if replication lag is due to a failing connector rather than low transaction volumes.

### 11. Smart Cache-Tier Warming Daemon
* **Description**: A scheduled task that runs standard dashboard query specs against Databricks immediately following the completion of the daily Gold pipeline.
* **Benefit**: Pre-populates cache tiers (e.g. `GLOBAL_300S`), ensuring that operators' first load in the morning is instant.

### 12. Multilingual Material Master Translator
* **Description**: Joins conformed material codes with language-specific text tables (`MAKT`) based on the authenticated user's browser locale.
* **Benefit**: Serves localized product descriptions to operators across global sites.

### 13. Centralized Unit of Measure (UoM) Converter
* **Description**: A conformed library utilizing SAP conversion factors (`MARM`) to dynamically unify units of measure (e.g., converting Cases to KG) in Gold queries.
* **Benefit**: Prevents miscalculations when aggregating stock positions across materials with different default base units.

### 14. DLT ServiceNow Integration Agent
* **Description**: Translates critical pipeline expectations failures (`dlt.expect_or_fail`) into immediate ServiceNow incidents containing full DLT execution context.
* **Benefit**: Shortens system downtime by routing data failures to the right engineering teams.

### 15. Query-Time Range Windowing Optimizer
* **Description**: A SQL helper that injects date-range limits (e.g., lookback windows) directly into the partition columns of underlying delta tables.
* **Benefit**: Limits the scanned data size, reducing execution costs and Statement API execution times.

### 16. Dynamic QuerySpec Sanitizer
* **Description**: An allow-list validator in the API layer for custom SQL sorting (`order_by`) and custom projection configurations before executing queries. Rather than using regex-based sanitizers, it implements a strict validation process (via functions like `validateQuerySpec`, `sanitizeOrderBy`, and `sanitizeProjections`) that checks each requested column and projection field against a predefined set of allowed column names and each sort direction against an allowed set (e.g., `ASC`, `DESC`, and optionally `NULLS FIRST/LAST`). The validator rejects or errors out on any unknown column or direction before passing the spec to the query builder, ensuring the query builder uses only the validated values to compose SQL.
* **Benefit**: Secures the Statement API against potential SQL injection vectors by ensuring only pre-approved identifiers and directions are executed.

### 17. Unity Catalog Column-Masking Helper
* **Description**: Integrates UC column masks into the serving views DDL generator, hiding sensitive data (e.g., standard price, standard labor cost) from non-finance users.
* **Benefit**: Simplifies data security compliance.

### 18. Offline Schema-Migration DDL Generator
* **Description**: A developer tool that matches updates in `app_contract_manifest.yml` and auto-generates target schema DDL scripts for UAT workspaces.
* **Benefit**: Replaces manual view creation and schema updating.

### 19. React Query Diagnostic Utility
* **Description**: An overlay component in the developer build that charts active queries, caching age, background refetches, and retry triggers.
* **Benefit**: Streamlines frontend performance troubleshooting.

### 20. Multi-Metastore Configuration Sync Tool
* **Description**: Automatically replicates configuration CSVs (e.g., `site_config_plant.csv`) across metastores when deploying target bundles.
* **Benefit**: Guarantees environment consistency across dev, uat, and prod.

---

## Part 2: 20 Business Workspaces (React Frontend & UI)

These workspaces represent user-facing panels and views targeted at specific manufacturing, quality, warehousing, and planning roles.

### 1. OEE (Overall Equipment Effectiveness) Cockpit
* **Description**: Charts line-level OEE metrics by correlating production speeds (from process order confirmations) with downtime events and yield quality.
* **Benefit**: Gives plant managers real-time visibility into line performance (OEE = Availability × Performance × Quality).

### 2. Plant Maintenance & Calibration Workspace
* **Description**: Displays active calibration work orders (SAP PM module), machine wear histories, and upcoming maintenance schedules.
* **Benefit**: Prevents line failures by warning operators when active equipment requires calibration.

### 3. Dispensary Weigh-and-Dispense Queue
* **Description**: A dedicated panel for raw material weighers, listing active dispensary tasks, target ingredient weights, and scale calibration checks.
* **Benefit**: Reduces batch failures by checking ingredient weights and tolerances at the lineside.

### 4. Push Despatch & Shipping Control
* **Description**: Coordinates outbound logistics by charting truck arrivals, staging lane allocations, and shipping deadlines.
* **Benefit**: Optimizes warehouse traffic and guarantees on-time dispatch.

### 5. Product Genealogy & Batch Trace Explorer
* **Description**: An interactive graphical timeline tracing batch raw materials to vendors and finished goods downstream to customers.
* **Benefit**: Speeds up quality investigations and product recalls from hours to seconds.

### 6. FEFO Stock Picker & Expiry Board
* **Description**: Surfaces warehouse inventory sorted strictly by First Expiring, First Out (FEFO) rules, highlighting high-risk and expiring quants.
* **Benefit**: Minimizes scrap and write-offs by guiding selectors to the oldest usable inventory.

### 7. Statistical Process Control (SPC) Monitor
* **Description**: Renders real-time control charts (X-Bar, R-Charts) with automated Nelson or Western Electric rule violations for in-process checks.
* **Benefit**: Warns operators when a process is drifting before it goes out of specification.

### 8. IM/WM Stock Reconciliation Monitor
* **Description**: Highlights quantity and location discrepancies between Inventory Management (IM) and Warehouse Management (WM) stock tables.
* **Benefit**: Resolves inventory errors that block process order staging.

### 9. Manufacturing Adherence Command Centre
* **Description**: Charts daily schedule adherence, flagging late releases, material shortages, and labor bottlenecks.
* **Benefit**: Keeps lines running on time by surfacing schedule risks before shifts start.

### 10. Shift Handover Hub
* **Description**: A collaborative screen where outgoing shift supervisors log highlights, machine issues, and handover notes, paired with automated production reports.
* **Benefit**: Standardizes shift handovers and preserves operational knowledge.

### 11. Environmental Cleanroom Dashboard
* **Description**: Visualizes cleanroom particle counts, air humidity, pressure drops, and microbiological swab test results.
* **Benefit**: Guarantees compliance with cleanroom manufacturing requirements.

### 12. Inbound PO & Goods-Receipt Monitor
* **Description**: Tracks open purchase orders, vendor delivery performance, and active goods-receipt inspections.
* **Benefit**: Optimizes raw material receiving and warehouse staging space.

### 13. Quality Release & Disposition Board
* **Description**: Charts active QA inspection lots, material certificates of analysis (CoAs), and usage decisions (UD).
* **Benefit**: Accelerates inventory release cycles by highlighting lots awaiting review.

### 14. Recipe & Parameter Benchmarking Engine
* **Description**: Compares batch runs to identify correlations between production speeds, temperatures, pressures, and yield rates.
* **Benefit**: Optimizes recipe run targets.

### 15. Energy & Utility Footprint Cockpit
* **Description**: Joins plant energy utility logs (steam, electricity, water) with process order runs to calculate batch-specific energy footprints.
* **Benefit**: Identifies carbon and energy cost reductions at the product level.

### 16. Handling Unit (HU) Tracking Center
* **Description**: Displays SSCC packaging hierarchies, container volumes, and tracking histories.
* **Benefit**: Prevents picking errors by verifying HU details at shipping stages.

### 17. Production Yield & Scrap Waterfall
* **Description**: Visualizes material variances (issued vs. recipe requirement) across manufacturing stages.
* **Benefit**: Pinpoints where material loss or scrap occurs in the production process.

### 18. Operator Allocation & Labor Efficiency Panel
* **Description**: Displays shift worker assignments, active operations, and pick-rate efficiencies.
* **Benefit**: Maximizes labor utilization and balances workload across picking lanes.

### 19. Site Master Data Health Dashboard
* **Description**: Flags zero standard-prices, unmapped storage bins, and missing materials in SAP.
* **Benefit**: Clean master data prevents transaction blocks.

### 20. Sold/Divested Plant Transition Workspace
* **Description**: Coordinates inventory clearing, outstanding deliveries, and data archiving for plants changing ownership.
* **Benefit**: Ensures legal compliance and smooth transitions during site acquisitions or divestments.
