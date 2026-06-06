import type { WorkspaceRegistration } from '@connectio/product-model'

/** Workspace shell registration for the designed Trace Consumer app. */
export const traceConsumerRegistration: WorkspaceRegistration = {
  workspaceId: 'trace-consumer',
  displayName: 'Batch Traceability (Consumer)',
  description: 'A modern, consumer-grade search-driven batch traceability experience.',
  domainId: 'traceability',
  ownerDomain: 'traceability',
  lifecycle: 'pilot',
  supportedRoles: [
    'quality-lead',
    'food-safety-lead',
    'traceability-analyst',
    'plant-manager',
    'operations-supervisor',
  ],
  requiredPermissions: [
    {
      permissionId: 'trace.read',
      displayName: 'Trace Read',
      description: 'Permission to view trace data',
    },
  ],
  supportedScopes: ['plant', 'region', 'global'],
  scopePolicy: {
    supportedLevels: ['plant', 'region', 'global'],
    defaultLevel: 'plant',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'trace-consumer-view',
      displayName: 'Consumer Trace',
      lifecycle: 'pilot',
      sortOrder: 0,
      defaultPanels: [],
    },
  ],
  defaultPanels: [],
  route: '/trace-consumer',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: false,
    maxPinnedPanels: 0,
  },
  drillThroughDefinitions: [],
  telemetryId: 'quality-food-safety.trace-consumer',
}
