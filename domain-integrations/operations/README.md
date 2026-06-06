# Operations / Process Order History (POH) Domain Integration

This package houses the Process Order History integration, which provides role-aware supervisor cockpits aggregating evidence from plant-floor operations, confirmation yields, and material documents.

---

## 1. Adapter Configuration & Source Modes

Every API call in the Operations domain uses the `AdapterResult<T>` structure and respects the `VITE_ADAPTER_MODE` environment flag.

| Mode | Behavior | Source Badges | Endpoints |
|---|---|---|---|
| `mock` (Default) | Returns local fixture data defined in `process-order-review-mock-data.ts`. No network calls. | `MOCK FIXTURE - NOT LIVE` (Gray/Amber) | None |
| `legacy-api` | Calls the FastAPI proxy at `VITE_LEGACY_API_BASE_URL` (usually port `8000`). For POH endpoints, this mode falls back to superclass mock methods unless overridden. | `LEGACY-API` (Blue) or `MOCK` (for fallback paths) | `/api/por/order-header` |
| `databricks-api` | Queries the live Unity Catalog database via FastAPI statement API. | `DATABRICKS-API` (Green) | `/api/por/order-header`, `/api/por/order-operations`, `/api/por/order-confirmations`, `/api/por/order-goods-movements` |

---

## 2. Active vs Planned Filter Controls

To ensure UX truthfulness and prevent users from believing they are active, unwired query filters are visually distinguished, disabled, and annotated:

- **Active / Query-Wired Filters**:
  - `Process Order ID` (Queries all endpoints)
  - `Plant ID` (Queries the header endpoint `/api/por/order-header` only)
- **Planned / Diagnostic Filters** (Disabled and styled with clear labels):
  - `Material ID`
  - `Batch ID`
  - `Posting Date From`
  - `Posting Date To`
  - `Max Rows Limit` (Slider control)

---

## 3. Browser UAT & E2E Checklist

Follow this checklist when verifying the cockpit layout and E2E connectivity in the browser:

- [ ] **Offline Layout Check**:
  - Load the cockpit with `VITE_ADAPTER_MODE=mock`.
  - Click **Load Demo-Only Fixture** and then **Run / Refresh**.
  - Confirm the mock warning banner is visible: `Mock fixture selected — values are demo-only...`.
  - Confirm all 5 main panels render successfully: Operations, Confirmations, Goods Movements, Event Timeline, and Data Quality Exceptions.
  - Verify that the non-wired inputs are disabled and labeled `(Planned / Diagnostic)`.
- [ ] **Databricks Connectivity Check**:
  - Load the cockpit with `VITE_ADAPTER_MODE=legacy-api` and backend configured with `BACKEND_ADAPTER_MODE=databricks-api`.
  - Enter the golden UAT order ID `7006965038` and plant `C113`.
  - Verify that the card source badges transition to `DATABRICKS-API` (Green).
  - Verify that the table renders the 11 operation phases matching the Unity Catalog data.
  - Confirm the Event Timeline sorted order is chronologically ascending.
  - Confirm section states are visible for Header, Operations, Confirmations, and Goods Movements.
  - Confirm no-record sections use cautious wording and are not interpreted as proof of absence.
  - Use **Copy UAT Evidence** and paste the payload into the UAT ledger alongside source screenshots/API evidence.

POH is read-only. No SAP write-back, order confirmation posting, goods movement posting, release, TECO, or change action is implemented in this workspace.

## 4. Related parity and readiness docs

- [V1 Genie Discovery and V2 Parity Roadmap](../../docs/migration/v1-genie-discovery-and-v2-parity-roadmap.md)
- [POH Genie Readiness Pack](./docs/poh-genie-readiness-pack.md)

## 5. POH assistant pilot

The Process Order Review workspace now includes a **POH Assistant Pilot** view. It is a domain-scoped, deterministic assistant surface limited to approved POH topics:

- operations
- confirmations
- goods movements
- the conditional order-header slice

It is **not** a live Databricks Genie integration and it must not answer blocked topics such as lateness root cause, OEE, planning, downtime, genealogy, or release decisions.
