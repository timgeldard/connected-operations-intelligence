# Verification Status Pattern Guide

This document defines the design pattern, states, and guidelines for the reusable **Verification Status Banner** component.

---

## 1. Overview & Objective

ConnectIO RAD V2 utilizes the **domain-integration + evidence panel** model. To enforce ultimate transparency and prevent silent mock fallbacks or misaligned expectations during user acceptance testing (UAT), every core dashboard view must render a prominent **Verification Status Banner** at the top.

The banner serves three purposes:
1. **Visual Governance:** Instantly communicates whether a screen is backed by live production data, executable but pending UAT verification, partially implemented, or purely a mock demo.
2. **Honest Limitations:** Explicitly documents exactly what active routes, Databricks Unity Catalog source views, and query parameters are supported, as well as known gaps or plans.
3. **Technical Transparency:** Exposes an expandable Specifications Drawer containing routes, source objects, known limitations, and metadata (last verified date) so that UAT testers (and AI agents) can troubleshoot discrepancies on the spot.

---

## 2. Shared Component Specification

The shared component is defined at:
[`packages/design-system/src/components/manufacturing/verification-status-banner.tsx`](file:///home/timgeldard/github/connectio-rad-v2/packages/design-system/src/components/manufacturing/verification-status-banner.tsx)

### Supported Status Modes

| Status Mode | Label | Visual Accent | Meaning |
|---|---|---|---|
| `native-live` | NATIVE LIVE | **Emerald Green** | Fully browser-verified against live Databricks Unity Catalog. |
| `executable-pending-bv` | EXECUTABLE PENDING BV | **Amber / Orange** | Live backend routes exist and are wired, but final UAT browser verification is pending. |
| `partial-native` | PARTIAL NATIVE | **Blue** | Some routes are live; others are stubbed/mocked. |
| `mock-demo` | SANDBOX / MOCK DEMO | **Gray / Charcoal** | No live backend queries. Operates entirely in mock simulation. |
| `source-blocked` | SOURCE BLOCKED | **Red** | Integration is blocked by catalog permissions, missing views, or backend errors. |
| `error` | INTEGRATION ERROR | **Bright Red** | Live connection attempted but failed (502/503/401/403). |

---

## 3. Usage & Integration Rules

1. **Top-Level Placement:** Always render the banner right under the primary view header and above search/filter controls.
2. **Exhaustive Lists:** Ensure all active routes and source objects (views/tables) are listed in the arrays.
3. **Traceable Metadata:** Fill in `lastVerified` (e.g. `"Pending Claude UAT Sweep"`) to establish a clear audit trail.
4. **Diagnostic Wording:** Use limitations to explain active parameter gaps (e.g., date/limit filters are planned but not applied by current native routes).

---

## 4. Example Implementations

### A. Statistical Process Control (SPC) Workspace (Mock Demo)
```tsx
<VerificationStatusBanner
  title="Statistical Process Control (SPC) Quality Metrics"
  status="mock-demo"
  sourceLabel="In-Memory Mock Simulation"
  routes={[
    'GET /api/spc/summary',
    'GET /api/spc/active-signals',
    'GET /api/spc/monitored-characteristics',
    'GET /api/spc/control-chart'
  ]}
  sourceObjects={['spc_quality_metrics_v']}
  limitations={[
    'Demo-Only sandbox environment',
    'Not linked to live production data',
    'Native Databricks integration pending catalog alignment'
  ]}
  lastVerified="Pending UAT Catalog Alignment"
/>
```

### B. Warehouse360 Cockpit Workspace (Executable Pending Verification)
```tsx
<VerificationStatusBanner
  title="Warehouse360 Integration Specifications"
  status="executable-pending-bv"
  sourceLabel="Databricks Unity Catalog wh360 Schema"
  routes={[
    'GET /api/warehouse360/overview',
    'GET /api/warehouse360/inbound',
    'GET /api/warehouse360/outbound',
    'GET /api/warehouse360/staging',
    'GET /api/warehouse360/exceptions'
  ]}
  sourceObjects={[
    'wh360_cockpit_summary_v',
    'wh360_inbound_v',
    'wh360_deliveries_v',
    'staging_orders_v',
    'wh360_imwm_exceptions_v'
  ]}
  limitations={[
    'UAT verification pending Claude',
    'No write-back or transactional executions allowed',
    'Read-only direct query mode against Unity Catalog views'
  ]}
  lastVerified="Pending Claude UAT Sweep"
/>
```

### C. Process Order History Workspace (Executable Pending Verification)
```tsx
<VerificationStatusBanner
  title="Process Order History Integration Specifications"
  status="executable-pending-bv"
  sourceLabel="Databricks Unity Catalog Kerry Manufacturing Schema"
  routes={[
    'POST /api/por/order-header',
    'GET /api/por/order-operations',
    'GET /api/por/order-confirmations',
    'GET /api/por/order-goods-movements'
  ]}
  sourceObjects={[
    'process_order_header_v',
    'process_order_operations_v',
    'process_order_confirmations_v',
    'process_order_goods_movements_v'
  ]}
  limitations={[
    'Posting date and max row limit parameters are planned for future backend updates.',
    'Currently running end-to-end executable backend routes pending browser verification.'
  ]}
  lastVerified="Pending Claude UAT Sweep"
/>
```
