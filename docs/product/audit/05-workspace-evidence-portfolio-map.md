# Workspace and Evidence Portfolio Map — ConnectIO-RAD V2

**Audit date:** 2026-05-16

---

## Cross-domain evidence flows

The following diagram shows how evidence flows from source domains into consuming workspaces. All flows are mock-backed — no live data moves anywhere.

```
Traceability ──────────────────────────────────────► quality-batch-release
  trace-exposure-for-release panel                    (Warehouse & Trace view)

Quality (blockers) ─────────────────────────────────► operations-plan-risk
  quality blockers panel                               (Quality Blockers view)

Operations (evidence) ──────────────────────────────► quality-batch-release
  process-order-evidence panel                         (Operations Evidence view)

Warehouse (evidence) ───────────────────────────────► quality-batch-release
  warehouse-hold-status panel                          (Warehouse & Trace view)

Warehouse (staging) ────────────────────────────────► operations-plan-risk
  material shortages, staging blockers panel           (Warehouse Blockers view)

SPC (signals) ──────────────────────────────────────► quality-batch-release
  spc-signals-for-release panel                        (Quality Evidence view)

Maintenance (constraints) ──────────────────────────► operations-plan-risk
  maintenance constraints panel                        (Plan Overview view)
```

---

## Evidence portfolio by workspace

### `quality-batch-release` — Quality Domain

The highest-evidence workspace. Consumes cross-domain data from 5 other domains.

| Evidence Panel | Source Domain | Adapter | Mock Data Key |
|---|---|---|---|
| quality-results-summary | Quality (self) | `QualityReleaseAdapter.getReleaseContext` | `mockReleaseContext` |
| coa-readiness | Quality (self) | `QualityReleaseAdapter.getCOAReadiness` | — |
| deviations | Quality (self) | `QualityReleaseAdapter.getDeviations` | — |
| decision-history | Quality (self) | `QualityReleaseAdapter.getDecisionHistory` | — |
| release-queue | Quality (self) | `QualityReleaseAdapter.getReleaseQueue` | `mockReleaseQueue` (3 items) |
| batch-release-summary | Quality (self) | `QualityReleaseAdapter.getReleaseSummary` | `mockReleaseSummary` |
| coa-release-status | Quality (self) | `QualityReleaseAdapter.getCOAReleaseStatus` | — |
| process-order-evidence | **Operations** | `OperationsEvidenceAdapter.getProcessOrderEvidence` | `mockProcessOrderEvidence` |
| warehouse-hold-status | **Warehouse** | `WarehouseEvidenceAdapter.getWarehouseHoldStatus` | `mockWarehouseHoldStatus` |
| spc-signals-for-release | **SPC** | `SPCSignalsAdapter.getSPCSignals` | `mockSPCSignalSummary` |
| trace-exposure-for-release | **Traceability** | `Trace2Adapter.getTraceExposure` | — |
| risk-signals | Quality (self) + multi | — | — |
| event-timeline | Quality (self) | — | `mockExecutionTimeline` |
| related-investigations | Quality (self) | — | — |

**Drill-through targets received:** From `envmon-monitoring` (Open Quality Batch Release)

---

### `operations-plan-risk` — Operations Domain

| Evidence Panel | Source Domain | Adapter | Mock Data Key |
|---|---|---|---|
| Plan risk context | Operations (self) | `OperationsPlanRiskAdapter.getPlanRiskContext` | `mockPlanRiskContext` |
| Plan risk summary | Operations (self) | `OperationsPlanRiskAdapter.getPlanRiskSummary` | `mockPlanRiskSummary` |
| Late orders | Operations (self) | `OperationsPlanRiskAdapter.getLateOrders` | `mockLateOrders` (3 items) |
| Material shortages | Operations (self) + **Warehouse** | `OperationsPlanRiskAdapter.getMaterialShortages` + `WarehouseStagingAdapter.getMaterialShortagesForPlan` | `mockMaterialShortages` |
| Quality blockers | **Quality** | `QualityBlockersAdapter.getQualityBlockersForPlan` | `mockQualityBlockers` (3 items) |
| Maintenance constraints | **Maintenance** | `MaintenanceConstraintsAdapter.getMaintenanceConstraintsForPlan` | `mockMaintenanceConstraints` (2 items) |
| Warehouse staging blockers | **Warehouse** | `WarehouseStagingAdapter.getWarehouseStagingStatus` | `mockWarehouseStagingStatus` (4 items) |
| Release hold impacts | **Quality** | `QualityBlockersAdapter.getReleaseHoldImpacts` | `mockReleaseHoldImpacts` |

---

### `trace-investigation` — Traceability Domain

Self-contained workspace. No inbound cross-domain evidence.

| Evidence Panel | Source Domain | Adapter | Mock Data Key |
|---|---|---|---|
| Investigation context | Traceability (self) | `Trace2Adapter.getInvestigationContext` | `mockInvestigationContext` |
| Batch header | Traceability (self) | `Trace2Adapter.getBatchHeader` | `mockBatchHeader` |
| Trace graph | Traceability (self) | `Trace2Adapter.getTraceGraph` | `mockTraceGraph` (placeholder) |
| Batch lineage | Traceability (self) | `Trace2Adapter.getBatchLineage` | — (placeholder) |
| Trace exposure summary | Traceability (self) | `Trace2Adapter.getTraceExposure` | — |
| Mass balance | Traceability (self) | `Trace2Adapter.getMassBalance` | — |

**Drill-through outbound:** From `envmon-monitoring` (Open Trace Investigation), from `quality-batch-release` (Open Trace Investigation action)

---

### `envmon-monitoring` — EnvMon Domain

Self-contained workspace with outbound drill-throughs.

| Evidence Panel | Source Domain | Adapter | Mock Data Key |
|---|---|---|---|
| EnvMon context | EnvMon (self) | `EnvMonAdapter.getEnvMonContext` | `mockEnvMonContext` |
| Site summary | EnvMon (self) | `EnvMonAdapter.getEnvMonSiteSummary` | `mockEnvMonSiteSummary` |
| Zone list | EnvMon (self) | `EnvMonAdapter.getEnvMonZones` | `mockEnvMonZones` (5 zones) |
| Alerts | EnvMon (self) | `EnvMonAdapter.getEnvMonAlerts` | `mockEnvMonAlerts` (3 alerts) |
| Swab results | EnvMon (self) | `EnvMonAdapter.getEnvMonSwabResults` | `mockEnvMonSwabResults` (4 results) |
| Trends | EnvMon (self) | `EnvMonAdapter.getEnvMonTrends` | `mockEnvMonTrends` (7 date entries) |
| Heatmap | EnvMon (self) | `EnvMonAdapter.getEnvMonHeatmap` | `mockEnvMonHeatmap` (5 cells) — placeholder CSS grid |
| Corrective actions | EnvMon (self) | `EnvMonAdapter.getEnvMonCorrectiveActions` | `mockEnvMonCorrectiveActions` (2 items) |

**Drill-through outbound:** To `quality-batch-release` (Open Quality Batch Release), to `trace-investigation` (Open Trace Investigation)

---

### `production-staging` — Warehouse Domain

| Evidence Panel | Source Domain | Adapter |
|---|---|---|
| Staging context | Warehouse (self) | `ProductionStagingAdapter.getProductionStagingContext` |
| Staging status (per line) | Warehouse (self) | `ProductionStagingAdapter.getStagingStatus` |
| Material shortages | Warehouse (self) | `ProductionStagingAdapter.getMaterialShortages` |
| Staging KPI summary | Warehouse (self) | `ProductionStagingAdapter.getStagingKpiSummary` |
| Line readiness | Warehouse (self) | `ProductionStagingAdapter.getLineReadiness` |
| Pending confirmations | Warehouse (self) | `ProductionStagingAdapter.getPendingConfirmations` |

---

### `spc-monitoring` — SPC Domain (Pilot)

| Evidence Panel | Source Domain | Adapter | Mock Data Key |
|---|---|---|---|
| SPC monitoring context | SPC (self) | `SPCMonitoringAdapter.getSPCMonitoringContext` | `mockSPCMonitoringContext` |
| SPC summary | SPC (self) | `SPCMonitoringAdapter.getSPCSummary` | `mockSPCSummary` |
| Active SPC signals | SPC (self) | `SPCMonitoringAdapter.getActiveSPCSignals` | `mockActiveSPCSignals` (2 items) |
| Control chart series | SPC (self) | `SPCMonitoringAdapter.getControlChartSeries` | `mockControlChartSeries` (9 points) — placeholder SVG |
| Characteristic capability | SPC (self) | `SPCMonitoringAdapter.getCharacteristicCapability` | — |

---

### `warehouse-360` — Warehouse Domain (Pilot)

| Evidence Panel | Source Domain | Adapter |
|---|---|---|
| Warehouse context | Warehouse (self) | `Warehouse360Adapter.getWarehouse360Context` |
| Warehouse KPI summary | Warehouse (self) | `Warehouse360Adapter.getWarehouseKpiSummary` |
| Stock zones | Warehouse (self) | `Warehouse360Adapter.getStockZones` |
| Location capacity | Warehouse (self) | `Warehouse360Adapter.getLocationCapacity` |
| Active holds | Warehouse (self) | `Warehouse360Adapter.getActiveHolds` |
| Goods movements | Warehouse (self) | `Warehouse360Adapter.getGoodsMovements` |
| Inventory aging | Warehouse (self) | `Warehouse360Adapter.getInventoryAging` |

---

### `maintenance-reliability` — Maintenance Domain (Pilot)

| Evidence Panel | Source Domain | Adapter |
|---|---|---|
| Reliability context | Maintenance (self) | `MaintenanceReliabilityAdapter.getMaintenanceReliabilityContext` |
| KPI summary | Maintenance (self) | `MaintenanceReliabilityAdapter.getMaintenanceKpiSummary` |
| Work orders | Maintenance (self) | `MaintenanceReliabilityAdapter.getWorkOrders` |
| PM tasks | Maintenance (self) | `MaintenanceReliabilityAdapter.getPreventiveMaintenanceTasks` |
| Equipment availability | Maintenance (self) | `MaintenanceReliabilityAdapter.getEquipmentAvailability` |
| Reliability metrics | Maintenance (self) | `MaintenanceReliabilityAdapter.getReliabilityMetrics` |
| Maintenance backlog | Maintenance (self) | `MaintenanceReliabilityAdapter.getMaintenanceBacklog` |

---

### `process-order-review` — Operations Domain (Pilot)

| Evidence Panel | Source Domain | Adapter |
|---|---|---|
| Process order review context | Operations (self) | `ProcessOrderReviewAdapter.getProcessOrderReviewContext` |
| Order header | Operations (self) | `ProcessOrderReviewAdapter.getProcessOrderHeader` |
| Order progress summary | Operations (self) | `ProcessOrderReviewAdapter.getOrderProgressSummary` |
| Execution timeline | Operations (self) | `ProcessOrderReviewAdapter.getExecutionTimeline` |
| Goods movements | Operations (self) | `ProcessOrderReviewAdapter.getGoodsMovements` |
| Active deviations | Operations (self) | `ProcessOrderReviewAdapter.getActiveDeviations` |
| Quality checkpoints | Operations (self) | `ProcessOrderReviewAdapter.getQualityCheckpoints` |

---

## Evidence depth summary

| Workspace | Total panels | Self-sourced | Cross-domain | Real data | Mock data |
|-----------|-------------|---|---|---|---|
| quality-batch-release | 14 | 9 | 5 | 0 | 14 |
| operations-plan-risk | 12 | 8 | 4 | 0 | 12 |
| trace-investigation | 8 | 8 | 0 | 0 | 8 |
| envmon-monitoring | 8 | 8 | 0 | 0 | 8 |
| production-staging | 8 | 8 | 0 | 0 | 8 |
| spc-monitoring | 7 | 7 | 0 | 0 | 7 |
| warehouse-360 | 6 | 6 | 0 | 0 | 6 |
| maintenance-reliability | 6 | 6 | 0 | 0 | 6 |
| process-order-review | 6 | 6 | 0 | 0 | 6 |

**`quality-batch-release` is the most evidence-rich workspace.** It is also the workspace with the most cross-domain wiring, making it the highest-value demonstration of the platform architecture.
