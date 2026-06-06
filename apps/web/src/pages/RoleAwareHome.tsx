import { usePinnedWorkspaces } from '@connectio/personalization'
import { isNavigable } from '@connectio/product-model'
import { isWorkspaceFlagEnabled } from '@connectio/feature-flags'
import { workspaceRegistry } from '../registry/workspace-registry.js'
import { useWorkspaceShellState } from '../shell/useWorkspaceShellState.js'

/** Maps severity to display colour. */
function severityColor(severity: string): string {
  if (severity === 'critical') return '#DC2626'
  if (severity === 'high') return '#D97706'
  if (severity === 'medium') return '#CA8A04'
  return 'var(--shell-fg-3)'
}

/** Maps risk status to a display colour. */
function riskStatusColor(status: string): string {
  if (status === 'critical') return '#DC2626'
  if (status === 'at-risk') return '#D97706'
  if (status === 'on-track') return '#16A34A'
  return 'var(--shell-fg-3)'
}

/**
 * Mock plan risk items shown in the Operations section.
 * Surfaced from the same mock data as the OperationsPlanRiskAdapter.
 * In production this would be driven by an API call.
 */
const MOCK_PLAN_RISK_ITEMS = [
  {
    planDate: '2026-05-14',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    riskStatus: 'critical' as const,
    openBlockers: 5,
    lateOrders: 3,
    topRiskReason: 'Block press breakdown on L-04 blocking 2 process orders',
    supervisor: 'Aoife Murphy',
  },
  {
    planDate: '2026-05-15',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    riskStatus: 'at-risk' as const,
    openBlockers: 2,
    lateOrders: 1,
    topRiskReason: 'Brine cooler PM on L-02 scheduled during shift — monitor throughput',
    supervisor: 'Aoife Murphy',
  },
] as const

/**
 * Mock priority release items shown in the Quality section.
 * These are surfaced from the same mock data as the QualityReleaseAdapter.
 * In production this would be driven by an API call.
 */
const MOCK_PRIORITY_RELEASE_ITEMS = [
  {
    releaseCaseId: 'RC-2024-001847',
    batchId: 'CH-240308-0047',
    material: 'Kerry Listowel Emmental',
    plant: 'Kerry Listowel',
    priority: 'critical' as const,
    status: 'under-review' as const,
    dueBy: '2026-05-15T12:00:00.000Z',
  },
  {
    releaseCaseId: 'RC-2024-001831',
    batchId: 'GC-240307-0091',
    material: 'Gouda Classic 5kg',
    plant: 'Kerry Listowel',
    priority: 'expedited' as const,
    status: 'awaiting-review' as const,
    dueBy: '2026-05-15T18:00:00.000Z',
  },
] as const

/** Maps release priority to a display colour. */
function priorityColor(priority: string): string {
  if (priority === 'critical') return '#DC2626'
  if (priority === 'expedited') return '#D97706'
  return 'var(--shell-fg-3)'
}

/**
 * Mock active environmental monitoring alerts surfaced on the home screen.
 * Mirrors the envmon mock data for Kerry Listowel (IE10).
 */
const MOCK_ENVMON_ALERTS = [
  {
    alertId: 'ALT-IE10-001',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    zoneId: 'ZONE-05',
    organism: 'Listeria monocytogenes',
    severity: 'critical' as const,
    status: 'under-investigation' as const,
    detectedAt: '2026-05-13T14:32:00Z',
    description: 'Positive Listeria detection in high-risk Zone 5 — investigation active',
  },
  {
    alertId: 'ALT-IE10-002',
    plantId: 'IE10',
    plantName: 'Kerry Listowel',
    zoneId: 'ZONE-04',
    organism: 'Listeria innocua',
    severity: 'high' as const,
    status: 'corrective-action' as const,
    detectedAt: '2026-05-11T09:15:00Z',
    description: 'Consecutive positives in Zone 4 — corrective action in progress',
  },
] as const

/**
 * Mock production staging readiness summary surfaced on the home screen.
 * Mirrors the production staging mock data for WH-IE10-01.
 */
const MOCK_STAGING_SUMMARY = {
  warehouseId: 'WH-IE10-01',
  warehouseName: 'Listowel Main Warehouse',
  planDate: '2026-05-15',
  riskStatus: 'at-risk' as const,
  totalOrders: 18,
  percentReady: 66.7,
  openShortfalls: 2,
  pendingPickTasks: 4,
  openMoveRequests: 2,
} as const

/**
 * Mock SPC signals surfaced on the home screen.
 * Mirrors the SPC monitoring mock data for Kerry Listowel IE10.
 */
const MOCK_SPC_SIGNALS = [
  {
    signalId: 'SIG-2024-00312',
    characteristicId: 'FAT_LINE02',
    characteristicName: 'Fat Content — Line 2',
    lineId: 'LINE-02',
    ruleViolated: 'Rule 1 — Single point beyond 3σ',
    severity: 'critical' as const,
    detectedAt: '2026-05-14T08:15:00.000Z',
    acknowledgedAt: undefined as string | undefined,
  },
  {
    signalId: 'SIG-2024-00310',
    characteristicId: 'MOISTURE_LINE01',
    characteristicName: 'Moisture Content — Line 1',
    lineId: 'LINE-01',
    ruleViolated: 'Rule 2 — 9 consecutive points same side of mean',
    severity: 'high' as const,
    detectedAt: '2026-05-14T06:30:00.000Z',
    acknowledgedAt: '2026-05-14T07:00:00.000Z',
  },
] as const

/**
 * Mock open warehouse holds surfaced on the home screen.
 * Mirrors the warehouse 360 mock data for WH-IE10-MAIN.
 */
const MOCK_WAREHOUSE_HOLDS = [
  {
    holdId: 'HOLD-2024-00312',
    batchId: 'CH-240308-0047',
    materialDescription: 'Emmental Block 4 kg',
    holdReason: 'quality-hold' as const,
    ageHours: 3.5,
    holdQuantity: 480,
    uom: 'KG',
  },
  {
    holdId: 'HOLD-2024-00298',
    batchId: 'GC-240307-0091',
    materialDescription: 'Gouda Classic 5 kg',
    holdReason: 'investigation' as const,
    ageHours: 27.2,
    holdQuantity: 1200,
    uom: 'KG',
  },
] as const

/** Maps hold reason to display colour. */
function holdReasonColor(reason: string): string {
  if (reason === 'quality-hold') return '#DC2626'
  if (reason === 'customer-hold') return '#D97706'
  if (reason === 'investigation') return '#7C3AED'
  if (reason === 'expired') return '#6B7280'
  return '#D97706'
}

/**
 * Mock critical maintenance work orders surfaced on the home screen.
 * Mirrors the maintenance reliability mock data for Kerry Listowel IE10.
 */
const MOCK_CRITICAL_WORK_ORDERS = [
  {
    workOrderId: 'WO-2024-01847',
    title: 'PHE gasket replacement — Line 2 down',
    equipmentId: 'EQ-IE10-PHE-001',
    equipmentDescription: 'Plate Heat Exchanger — Pasteurisation',
    priority: 'critical' as const,
    productionImpact: 'line-down' as const,
    status: 'open' as const,
    estimatedHours: 4,
  },
  {
    workOrderId: 'WO-2024-01832',
    title: 'Filler head bearing noise — Line 3',
    equipmentId: 'EQ-IE10-FILL-003',
    equipmentDescription: 'Filler Head Assembly Line 3',
    priority: 'high' as const,
    productionImpact: 'risk-only' as const,
    status: 'in-progress' as const,
    estimatedHours: 2,
  },
] as const

function workOrderPriorityColor(priority: string): string {
  if (priority === 'critical') return '#DC2626'
  if (priority === 'high') return '#D97706'
  if (priority === 'medium') return '#CA8A04'
  return 'var(--shell-fg-3)'
}

const MOCK_RECENT_INVESTIGATIONS = [
  {
    investigationId: 'INV-2026-00041',
    batchId: 'CH-260514-0031',
    material: 'Kerry Listowel Emmental',
    plant: 'Kerry Listowel',
    severity: 'critical' as const,
    status: 'under-investigation' as const,
    openedAt: '2026-05-14T10:15:00Z',
    reason: 'Out-of-spec MIC result detected in batch CH-260514-0031 — supplier lot under review',
  },
  {
    investigationId: 'INV-2026-00038',
    batchId: 'GC-260512-0088',
    material: 'Gouda Classic 5kg',
    plant: 'Kerry Listowel',
    severity: 'high' as const,
    status: 'open' as const,
    openedAt: '2026-05-12T14:30:00Z',
    reason: 'Elevated moisture result — checking upstream supplier exposure',
  },
] as const

function investigationSeverityColor(severity: string): string {
  if (severity === 'critical') return '#DC2626'
  if (severity === 'high') return '#D97706'
  if (severity === 'medium') return '#CA8A04'
  return 'var(--shell-fg-3)'
}

/**
 * Home screen rendered when no workspace is active in the URL.
 *
 * @remarks
 * Displays the user's pinned, navigable workspaces as clickable cards. When
 * `pinnedWorkspaces` is null (not yet loaded or no pins set) the full set of
 * navigable workspaces is shown instead, providing a sensible fallback.
 *
 * A "Priority Items — Batch Release" section is shown below the workspace
 * cards when quality-batch-release is in the navigable set. It surfaces the
 * two highest-priority mock cases so quality users can drill straight in.
 */
export function RoleAwareHome() {
  const {
    setWorkspace,
    navigateToTraceInvestigation,
    navigateToBatchRelease,
    navigateToOperationsPlanRisk,
    navigateToEnvMon,
    navigateToProductionStaging,
    navigateToSPCMonitoring,
    navigateToWarehouse360,
    navigateToMaintenanceReliability,
  } = useWorkspaceShellState()
  const [pinnedWorkspaces] = usePinnedWorkspaces(workspaceRegistry.map(w => w.workspaceId))

  const pinned = workspaceRegistry.filter(
    w =>
      isNavigable(w.lifecycle) &&
      isWorkspaceFlagEnabled(w.workspaceId) &&
      (pinnedWorkspaces === null || pinnedWorkspaces.includes(w.workspaceId)),
  )

  const hasTraceInvestigation = workspaceRegistry.some(
    w => w.workspaceId === 'trace-investigation' && isNavigable(w.lifecycle) && isWorkspaceFlagEnabled(w.workspaceId),
  )

  const hasBatchRelease = workspaceRegistry.some(
    w => w.workspaceId === 'quality-batch-release' && isNavigable(w.lifecycle) && isWorkspaceFlagEnabled(w.workspaceId),
  )

  const hasOperationsPlanRisk = workspaceRegistry.some(
    w => w.workspaceId === 'operations-plan-risk' && isNavigable(w.lifecycle) && isWorkspaceFlagEnabled(w.workspaceId),
  )

  const hasEnvMon = workspaceRegistry.some(
    w => w.workspaceId === 'envmon-monitoring' && isNavigable(w.lifecycle) && isWorkspaceFlagEnabled(w.workspaceId),
  )

  const hasProductionStaging = workspaceRegistry.some(
    w => w.workspaceId === 'production-staging' && isNavigable(w.lifecycle) && isWorkspaceFlagEnabled(w.workspaceId),
  )

  const hasSPCMonitoring = workspaceRegistry.some(
    w => w.workspaceId === 'spc-monitoring' && isNavigable(w.lifecycle) && isWorkspaceFlagEnabled(w.workspaceId),
  )

  const hasWarehouse360 = workspaceRegistry.some(
    w => w.workspaceId === 'warehouse-360-overview' && isNavigable(w.lifecycle) && isWorkspaceFlagEnabled(w.workspaceId),
  )

  const hasMaintenanceReliability = workspaceRegistry.some(
    w => w.workspaceId === 'maintenance-reliability' && isNavigable(w.lifecycle) && isWorkspaceFlagEnabled(w.workspaceId),
  )

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960 }}>
      {/* Pilot banner — Phase 7 */}
      <div
        style={{
          background: 'var(--shell-surface)',
          border: '1px solid var(--shell-line)',
          borderLeft: '3px solid var(--valentia-slate, #005776)',
          borderRadius: 6,
          padding: '12px 16px',
          marginBottom: 28,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', marginBottom: 2 }}>
            ConnectIO-RAD V2 — Controlled Pilot
          </div>
          <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>
            You are using the pilot version of V2. Data shown is mock or adapter-backed. Please give feedback on anything that does not work as expected.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setWorkspace('help-getting-started')}
            style={{
              padding: '5px 12px',
              background: 'none',
              border: '1px solid var(--shell-line)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--shell-fg-2)',
            }}
          >
            Help &amp; Training
          </button>
          <button
            type="button"
            onClick={() => setWorkspace('admin-pilot-feedback')}
            style={{
              padding: '5px 12px',
              background: 'var(--valentia-slate, #005776)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Give Feedback
          </button>
        </div>
      </div>
      <h1
        style={{
          margin: '0 0 4px',
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--shell-fg)',
        }}
      >
        My Work
      </h1>
      <p
        style={{
          margin: '0 0 32px',
          fontSize: 13,
          color: 'var(--shell-fg-2)',
        }}
      >
        Select a workspace to begin. Priority items from each domain are shown below — click any item to navigate directly.
      </p>

      {pinned.length > 0 && (
        <section>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--shell-fg-3)',
            }}
          >
            Workspaces
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            {pinned.map(w => (
              <button
                key={w.workspaceId}
                type="button"
                onClick={() => setWorkspace(w.workspaceId)}
                style={{
                  padding: '16px',
                  background: 'var(--shell-surface)',
                  border: '1px solid var(--shell-line)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: 13,
                    color: 'var(--shell-fg)',
                  }}
                >
                  {w.displayName}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: 'var(--shell-fg-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {w.lifecycle}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Trace Investigation section — shown when trace-investigation is navigable */}
      {hasTraceInvestigation && (
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--shell-fg-3)',
            }}
          >
            Recent Investigations — Trace
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
            {MOCK_RECENT_INVESTIGATIONS.map(inv => (
              <button
                key={inv.investigationId}
                type="button"
                onClick={() => navigateToTraceInvestigation(inv.investigationId, 'overview')}
                style={{
                  padding: '12px 16px',
                  background: 'var(--shell-surface)',
                  border: '1px solid var(--shell-line)',
                  borderLeft: `3px solid ${investigationSeverityColor(inv.severity)}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
                aria-label={`Open trace investigation ${inv.investigationId} for batch ${inv.batchId}`}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--shell-fg)' }}>
                    {inv.material}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                    {inv.batchId} · {inv.plant} · {inv.investigationId}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                    {inv.reason}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: investigationSeverityColor(inv.severity),
                    }}
                  >
                    {inv.severity}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase' }}>
                    {inv.status.replace(/-/g, ' ')}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Showing 2 recent investigations (mock data). Open Trace Investigation workspace for full view.
          </p>
        </section>
      )}

      {/* Quality section — shown when quality-batch-release is navigable */}
      {hasBatchRelease && (
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--shell-fg-3)',
            }}
          >
            Priority Items — Batch Release
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
            {MOCK_PRIORITY_RELEASE_ITEMS.map(item => (
              <button
                key={item.releaseCaseId}
                type="button"
                onClick={() => navigateToBatchRelease(item.releaseCaseId, 'batch-decision')}
                style={{
                  padding: '12px 16px',
                  background: 'var(--shell-surface)',
                  border: '1px solid var(--shell-line)',
                  borderLeft: `3px solid ${priorityColor(item.priority)}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
                aria-label={`Open release case ${item.releaseCaseId} for ${item.material}`}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: 13,
                      color: 'var(--shell-fg)',
                    }}
                  >
                    {item.material}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                    {item.batchId} · {item.plant} · {item.releaseCaseId}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: priorityColor(item.priority),
                    }}
                  >
                    {item.priority}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--shell-fg-3)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.status.replace(/-/g, ' ')}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Showing 2 priority items (mock data). Open Quality Batch Release workspace to see full queue.
          </p>
        </section>
      )}

      {/* Operations section — shown when operations-plan-risk is navigable */}
      {hasOperationsPlanRisk && (
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--shell-fg-3)',
            }}
          >
            Plan Risk — Operations
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
            {MOCK_PLAN_RISK_ITEMS.map(item => (
              <button
                key={item.planDate}
                type="button"
                onClick={() => navigateToOperationsPlanRisk(item.planDate, 'plan-overview')}
                style={{
                  padding: '12px 16px',
                  background: 'var(--shell-surface)',
                  border: '1px solid var(--shell-line)',
                  borderLeft: `3px solid ${riskStatusColor(item.riskStatus)}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
                aria-label={`Open plan risk for ${item.plantName} on ${item.planDate}`}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--shell-fg)' }}>
                    {item.plantName} — {item.planDate}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                    {item.topRiskReason}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: riskStatusColor(item.riskStatus),
                    }}
                  >
                    {item.riskStatus.replace(/-/g, ' ')}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>
                    {item.openBlockers} blockers · {item.lateOrders} late
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Showing 2 plan days (mock data). Open Operations Plan Risk workspace for full shift view.
          </p>
        </section>
      )}

      {/* Environmental Monitoring section — shown when envmon-monitoring is navigable */}
      {hasEnvMon && (
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--shell-fg-3)',
            }}
          >
            Active Alerts — Environmental Monitoring
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
            {MOCK_ENVMON_ALERTS.map(alert => (
              <button
                key={alert.alertId}
                type="button"
                onClick={() => navigateToEnvMon('alerts')}
                style={{
                  padding: '12px 16px',
                  background: 'var(--shell-surface)',
                  border: '1px solid var(--shell-line)',
                  borderLeft: `3px solid ${severityColor(alert.severity)}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
                aria-label={`Open environmental alert ${alert.alertId} in ${alert.plantName}`}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--shell-fg)' }}>
                    {alert.organism}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                    {alert.zoneId} · {alert.plantName} · {alert.description}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: severityColor(alert.severity),
                    }}
                  >
                    {alert.severity}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase' }}>
                    {alert.status.replace(/-/g, ' ')}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Showing 2 active alerts (mock data). Open Environmental Monitoring workspace for full zone view.
          </p>
        </section>
      )}

      {/* Production Staging section — shown when production-staging is navigable */}
      {hasProductionStaging && (
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--shell-fg-3)',
            }}
          >
            Staging Readiness — Production
          </h2>
          <button
            type="button"
            onClick={() => navigateToProductionStaging(MOCK_STAGING_SUMMARY.planDate, 'staging-overview')}
            style={{
              padding: '16px',
              background: 'var(--shell-surface)',
              border: '1px solid var(--shell-line)',
              borderLeft: `3px solid ${riskStatusColor(MOCK_STAGING_SUMMARY.riskStatus)}`,
              borderRadius: 6,
              cursor: 'pointer',
              textAlign: 'left',
              maxWidth: 680,
              width: '100%',
            }}
            aria-label={`Open production staging for ${MOCK_STAGING_SUMMARY.warehouseName} on ${MOCK_STAGING_SUMMARY.planDate}`}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--shell-fg)' }}>
                  {MOCK_STAGING_SUMMARY.warehouseName} — {MOCK_STAGING_SUMMARY.planDate}
                </div>
                <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 4, display: 'flex', gap: 12 }}>
                  <span>{Math.round(MOCK_STAGING_SUMMARY.percentReady)}% orders ready</span>
                  <span>{MOCK_STAGING_SUMMARY.openShortfalls} open shortfalls</span>
                  <span>{MOCK_STAGING_SUMMARY.pendingPickTasks} pending pick tasks</span>
                  <span>{MOCK_STAGING_SUMMARY.openMoveRequests} move requests</span>
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: riskStatusColor(MOCK_STAGING_SUMMARY.riskStatus),
                  flexShrink: 0,
                  paddingTop: 2,
                }}
              >
                {MOCK_STAGING_SUMMARY.riskStatus.replace(/-/g, ' ')}
              </span>
            </div>
          </button>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Showing today&apos;s staging status (mock data). Open Production Staging workspace for order detail.
          </p>
        </section>
      )}

      {/* SPC Monitoring section — shown when spc-monitoring is navigable */}
      {hasSPCMonitoring && (
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--shell-fg-3)',
            }}
          >
            Active Signals — SPC Monitoring
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
            {MOCK_SPC_SIGNALS.map(signal => (
              <button
                key={signal.signalId}
                type="button"
                onClick={() => navigateToSPCMonitoring('chart-overview')}
                style={{
                  padding: '12px 16px',
                  background: 'var(--shell-surface)',
                  border: '1px solid var(--shell-line)',
                  borderLeft: `3px solid ${severityColor(signal.severity)}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
                aria-label={`Open SPC signal ${signal.signalId} for ${signal.characteristicName}`}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--shell-fg)' }}>
                    {signal.characteristicName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                    {signal.lineId} · {signal.ruleViolated}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: severityColor(signal.severity) }}>
                    {signal.severity}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>
                    {signal.acknowledgedAt ? 'acknowledged' : 'unacknowledged'}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Showing 2 active signals (mock data). Open SPC Monitoring workspace for full control chart view.
          </p>
        </section>
      )}

      {/* Warehouse 360 section — shown when warehouse-360-overview is navigable */}
      {hasWarehouse360 && (
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--shell-fg-3)',
            }}
          >
            Open Holds — Warehouse
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
            {MOCK_WAREHOUSE_HOLDS.map(hold => (
              <button
                key={hold.holdId}
                type="button"
                onClick={() => navigateToWarehouse360('holds-management')}
                style={{
                  padding: '12px 16px',
                  background: 'var(--shell-surface)',
                  border: '1px solid var(--shell-line)',
                  borderLeft: `3px solid ${holdReasonColor(hold.holdReason)}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
                aria-label={`Open hold ${hold.holdId} for ${hold.materialDescription}`}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--shell-fg)' }}>
                    {hold.materialDescription}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                    {hold.batchId} · {hold.holdQuantity} {hold.uom} · age {hold.ageHours}h
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: holdReasonColor(hold.holdReason) }}>
                    {hold.holdReason.replace(/-/g, ' ')}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>{hold.holdId}</span>
                </div>
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Showing 2 open holds (mock data). Open Warehouse 360 workspace for full holds management view.
          </p>
        </section>
      )}

      {/* Maintenance & Reliability section — shown when maintenance-reliability is navigable */}
      {hasMaintenanceReliability && (
        <section style={{ marginTop: 32 }}>
          <h2
            style={{
              margin: '0 0 12px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--shell-fg-3)',
            }}
          >
            Priority Work Orders — Maintenance
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
            {MOCK_CRITICAL_WORK_ORDERS.map(wo => (
              <button
                key={wo.workOrderId}
                type="button"
                onClick={() => navigateToMaintenanceReliability('work-orders')}
                style={{
                  padding: '12px 16px',
                  background: 'var(--shell-surface)',
                  border: '1px solid var(--shell-line)',
                  borderLeft: `3px solid ${workOrderPriorityColor(wo.priority)}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
                aria-label={`Open work order ${wo.workOrderId}: ${wo.title}`}
              >
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--shell-fg)' }}>
                    {wo.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                    {wo.equipmentDescription} · est. {wo.estimatedHours}h · {wo.workOrderId}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: workOrderPriorityColor(wo.priority) }}>
                    {wo.priority}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase' }}>
                    {wo.productionImpact.replace(/-/g, ' ')}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--shell-fg-3)' }}>
            Showing 2 priority work orders (mock data). Open Maintenance & Reliability workspace for full view.
          </p>
        </section>
      )}
    </div>
  )
}
