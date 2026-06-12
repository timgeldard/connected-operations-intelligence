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

## Data source (governed path — no legacy/mock fallback)

| Layer | Detail |
|-------|--------|
| Origin | SAP QM (QAMR, QAMV, QALS) → Databricks silver quality pipeline → gold `gold_qm_lab_result_signal` → `gold_qm_lab_result_signal_secured` (RLS) → `vw_consumption_quality_lab_fails` |
| API route | `GET /api/cq/lab/fails?plant_id=…&lot_type=…` (FastAPI, `apps/api/routes/quality_lab.py`) |
| Mode | `BACKEND_ADAPTER_MODE=databricks-api` required. Returns HTTP 503 otherwise. |
| Frontend adapter | `ConnectedQualityLabDatabricksAdapter` (`adapters/connected-quality-lab-databricks-adapter.ts`), `source: 'databricks-api'` |
| Source label | `'SAP QM via governed gold'` |

The V1 proxy route (`apps/api/routes/connected_quality_lab.py`) and the mock / legacy-api adapters have been permanently removed. There is no fallback mode.

### Silver tables (quality gate, `lab_board_lookback_days=30`)

| Silver table | Source | Notes |
|---|---|---|
| `quality_lab_inspection_result` | QAMR | Result grain per lot/op/MIC; carries `lot_origin_code`, `lot_order_number` for gold join |
| `quality_lab_characteristic_spec` | QAMV | Spec limits including optional `lsl_warn`/`usl_warn` (QAMV.TOLERANZUN_W/TOLERANZOB_W) |

Plant gate is applied via `gated_qals_for_lab()` → inner join to QALS restricted to the quality product area and a rolling 30-day window (`sap_date("ENSTEHDAT") >= current_date() - lab_board_lookback_days`). The `# determinism-exempt: rolling lab-board window` marker suppresses the CI determinism guard on this function.

### Gold table

`gold_qm_lab_result_signal` in `connected_plant_{env}.gold_io_reporting`. One row per failed or warned result within the lookback window. Production line is left-joined via `lot_order_number → process_order.order_number` (nullable — RM lots often have no linked process order).

### Catalog / schema configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `QUALITY_LAB_CATALOG` | — | Catalog for the quality_lab domain |
| `WH360_CATALOG` | — | Fallback catalog when `QUALITY_LAB_CATALOG` is not set |
| `QUALITY_LAB_SCHEMA` | `gold_io_reporting` | Schema in that catalog |

---

## Failure record shape (FailSpec — V1 field names preserved)

| Field | Type | Meaning |
|-------|------|---------|
| `mat` | string | Material description (falls back to material code if no description in gold) |
| `matNo` | string | Material number |
| `lot` | string | Inspection lot number |
| `batch` | string (optional) | Batch number — omitted when NULL |
| `line` | string (optional) | Production line — omitted when NULL (RM lots) |
| `char` | string | Characteristic ID (MIC) |
| `text` | string | Characteristic display name |
| `res` | number | Measured result value |
| `lo` | number (optional) | Lower spec limit — omitted when NULL (no spec) |
| `hi` | number (optional) | Upper spec limit — omitted when NULL (no spec) |
| `units` | string | Unit of measure |
| `sev` | 'fail' \| 'warn' | Severity: outside spec (fail) or warning threshold (warn) |
| `ts` | string \| null | ISO date of result recording start (QAMR.PRUEFDATUV) |
| `lotType` | string | SAP lot origin code (QALS.HERKUNFT): '89' = FP, '04' = RM |

---

## Severity rule (gold layer — authoritative)

V1's Databricks path hardcoded `sev='fail'` (warn was not distinguishable). The governed gold layer implements:

| Condition | Severity |
|-----------|----------|
| R < LSL or R > USL (outside spec) | `'fail'` |
| Within spec AND within warning band from either limit | `'warn'` |
| No spec AND valuation code not 'A' | `'fail'` |
| Accepted (valuation 'A') AND within spec AND outside warning band | excluded |

Warning band priority:
1. Explicit `lsl_warn` / `usl_warn` from QAMV (TOLERANZOB_W / TOLERANZUN_W) when present in silver
2. Fallback: 5% of spec span from each limit — `[(USL−LSL) × 0.05]`

**Design deviation:** V1's warn rule was absent. The 5%-of-span fallback is a new approximation. If plant QA teams configure explicit QAMV warning limits, those take precedence automatically.

---

## Components

| Component | File | Notes |
|-----------|------|-------|
| `ConnectedQualityLabBoardPanel` | `panels/connected-quality-lab-board-panel.tsx` | Registered panel — wraps everything in `EvidencePanel` |
| `FailCard` | (private, same file) | Renders one inspection failure with spec bar |
| `SpecBar` | (private, same file) | CSS-only spec range visualisation |
| `LabBoardView` | `views/lab-board-view.tsx` | Thin wrapper connecting panel to workspace scope |
| `ConnectedQualityLabDatabricksAdapter` | `adapters/connected-quality-lab-databricks-adapter.ts` | Single governed adapter, `source: 'databricks-api'` |

**Deleted (no longer exist):**
- `adapters/connected-quality-lab-adapter.ts` (mock)
- `adapters/connected-quality-lab-legacy-api-adapter.ts` (V1 proxy)
- `adapters/connected-quality-lab-adapter-factory.ts` (mode switcher)
- `adapters/connected-quality-lab-mock-data.ts` (mock data)
- `apps/api/routes/connected_quality_lab.py` (V1 proxy route)

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
| Source label | Board header (trailing) | `SAP QM via governed gold` (when `source === 'databricks-api'`) |
| Fail / Warn legend | Below board header | Colored chips: FAIL (red) = Outside spec · WARN (amber) = Warning threshold |
| Auto-rotate note | Page indicator | `Page N/M · Auto-rotates · Next in Xs` |

---

## Source wording

| Source | EvidencePanel badge | Panel source label |
|--------|--------------------|--------------------|
| `databricks-api` | (governed) | `SAP QM via governed gold` |

The registration `description` field reads:  
`"SAP QM inspection failures and warnings — governed gold (QAMR/QAMV, 30-day window) — 6-card rotating wallboard with spec bar and severity indicators."`

---

## Accessing the view

```
?workspace=quality-batch-release&view=lab-board
```

Plant context (`plantId`) flows from `scope.plantId` in `BatchReleaseWorkspace`. The lot type filter is internal to the panel.
