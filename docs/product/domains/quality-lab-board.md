# Quality Lab Board — Domain Reference

**Domain:** quality  
**Workspace:** quality-batch-release  
**View:** lab-board  
**Lifecycle:** pilot

---

## Overview

The Lab Board is a wallboard-style view within the Quality Batch Release workspace that surfaces failed and warning SAP QM inspection results in real time. It preserves the V1 Connected Quality Lab Board experience (`/cq/?module=lab`) inside the V2 workspace shell.

The board shows up to 6 inspection failure cards per page, auto-rotates every 30 seconds when more than 6 failures are present, and allows filtering by lot type (All / Finished Product / Raw Material).

---

## Data source

| Layer | Detail |
|-------|--------|
| Origin | SAP QM inspection orders → Databricks gold view → V1 CQ backend |
| V1 endpoint | `GET /api/cq/lab/fails?plant_id=…&lot_type=…` |
| V2 proxy | `GET /api/cq/lab/fails` (FastAPI, `apps/api/routes/connected_quality_lab.py`) |
| Adapter modes | `mock` (default) · `legacy-api` (via `VITE_ADAPTER_MODE=legacy-api`) |

---

## Failure record shape (V1 FailSpec, preserved in V2)

| Field | Type | Meaning |
|-------|------|---------|
| `mat` | string | Material description |
| `matNo` | string | Material number |
| `lot` | string | Inspection lot number |
| `batch` | string | Batch number |
| `line` | string | Production line |
| `char` | string | Characteristic ID |
| `text` | string | Characteristic display name |
| `res` | number | Measured result value |
| `lo` | number | Lower spec limit |
| `hi` | number | Upper spec limit |
| `units` | string | Unit of measure |
| `sev` | 'fail' \| 'warn' | Severity: outside spec (fail) or warning threshold (warn) |
| `ts` | string \| null | ISO 8601 result timestamp |
| `lotType` | string | SAP lot type ('89' = FP, '04' = RM) |

---

## Components

| Component | File | Notes |
|-----------|------|-------|
| `ConnectedQualityLabBoardPanel` | `panels/connected-quality-lab-board-panel.tsx` | Registered panel — wraps everything in `EvidencePanel` |
| `FailCard` | (private, same file) | Renders one inspection failure with spec bar |
| `SpecBar` | (private, same file) | CSS-only spec range visualisation |
| `LabBoardView` | `views/lab-board-view.tsx` | Thin wrapper connecting panel to workspace scope |
| `ConnectedQualityLabAdapter` | `adapters/connected-quality-lab-adapter.ts` | Mock adapter, `source: 'mock'` |
| `ConnectedQualityLabLegacyApiAdapter` | `adapters/connected-quality-lab-legacy-api-adapter.ts` | Proxies to V1 CQ backend, `source: 'legacy-api'` |

---

## Auto-rotation behaviour

- `CARDS_PER_PAGE = 6` (3 columns × 2 rows)
- `ROTATION_SECONDS = 30`
- Interval runs only when `fails.length > CARDS_PER_PAGE`
- Manual Prev/Next click resets countdown to 30
- Lot type filter change resets page to 0 and countdown to 30
- `plantId` change resets page to 0 and countdown to 30

---

## Lot type filter

| Button | `lotType` value | Meaning |
|--------|----------------|---------|
| All | `undefined` | No filter — all failures |
| FP (89) | `'89'` | Finished product inspection lots |
| RM (04) | `'04'` | Raw material inspection lots |

---

## Severity colours

| Value | Colour | CSS |
|-------|--------|-----|
| `fail` | Red | `#D32F2F` |
| `warn` | Amber | `#D97706` |

---

## Layout cues (V1 preservation)

The following UI elements are rendered inside the panel body to match V1 Lab Board visual context:

| Element | Location | Content |
|---------|----------|---------|
| Board header | Top of panel body | `ConnectedQuality · Lab Board` (uppercase, small) |
| Plant context | Board header (right of title) | `Plant: {plantId}` — only shown when `plantId` is set |
| Source label | Board header (trailing) | `Mock SAP QM lab failures` or `SAP QM via legacy API` |
| Fail / Warn legend | Below board header | Colored chips: FAIL (red) = Outside spec · WARN (amber) = Warning threshold |
| Auto-rotate note | Page indicator | `Page N/M · Auto-rotates · Next in Xs` |

---

## Source wording

| Source | EvidencePanel badge | Panel source label |
|--------|--------------------|--------------------|
| `mock` | (none) | `Mock SAP QM lab failures` |
| `legacy-api` | Amber "Legacy API" | `SAP QM via legacy API` |

The registration `description` field does not use the word "Live" — it reads  
`"SAP QM inspection failures and warnings — 6-card rotating wallboard with spec bar and severity indicators."`

---

## Accessing the view

```
?workspace=quality-batch-release&view=lab-board
```

Plant context (`plantId`) flows from `scope.plantId` in `BatchReleaseWorkspace`. The lot type filter is internal to the panel.
