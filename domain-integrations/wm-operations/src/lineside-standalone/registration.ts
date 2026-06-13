import type { WorkspaceRegistration } from '@connectio/product-model'

/**
 * Standalone workspace registration for the Lineside Monitor (PEX-E-35).
 *
 * FRESHNESS NOTE (ADR-017 pilot dependency):
 * The operational value of this workspace depends on the ADR-017 pilot cadence decision
 * (15-min triggered silver+gold, ideally sub-cadence for fast-silver tables).  Until that
 * cadence is live the gold pipeline runs daily.  The UI displays a STALE banner when data
 * age exceeds 2 × the configured refresh interval.  The lifecycle is 'pilot' until ADR-017
 * is confirmed and the cadence is validated in UAT.
 */
export const linesideMonitorStandaloneRegistration: WorkspaceRegistration = {
  workspaceId: 'wm-lineside-monitor',
  displayName: 'Lineside Monitor',
  description:
    'Standalone wallboard for production-line supervisors: running orders, current phase, what\'s next, blocked/at-risk, staging readiness, and plan vs actual. ' +
    'Cadence note: live operational value requires ADR-017 pilot cadence (15-min triggered gold).',
  domainId: 'warehouse',
  ownerDomain: 'warehouse',
  lifecycle: 'pilot',
  supportedRoles: [
    'plant-manager',
    'operations-supervisor',
    'logistics-lead',
    'warehouse-manager',
  ],
  requiredPermissions: [
    {
      permissionId: 'warehouse.wm-operations.read',
      displayName: 'WM Operations Read',
      description:
        'View staging/picking worklists, order readiness, and lineside production data',
    },
  ],
  supportedScopes: ['plant'],
  scopePolicy: {
    supportedLevels: ['plant'],
    defaultLevel: 'plant',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'lineside-board',
      displayName: 'Lineside Board',
      lifecycle: 'pilot',
      sortOrder: 0,
      defaultPanels: [],
    },
  ],
  defaultPanels: [],
  route: '/warehouse/lineside',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: true,
    maxPinnedPanels: 0,
  },
  drillThroughDefinitions: [],
  telemetryId: 'warehouse.wm-lineside-monitor',
}
