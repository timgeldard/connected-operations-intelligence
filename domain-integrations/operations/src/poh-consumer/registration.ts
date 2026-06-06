import type { WorkspaceRegistration } from '@connectio/product-model'

/** Workspace shell registration for the Process Order History Consumer app. */
export const pohConsumerRegistration: WorkspaceRegistration = {
  workspaceId: 'poh-consumer',
  displayName: 'Process Order History (Consumer)',
  description: 'A modern, consumer-grade search-driven process order history experience.',
  domainId: 'operations',
  ownerDomain: 'operations',
  lifecycle: 'pilot',
  supportedRoles: [
    'operations-supervisor',
    'production-manager',
    'planner',
    'quality-lead',
    'warehouse-manager',
    'plant-manager',
  ],
  requiredPermissions: [
    {
      permissionId: 'operations.order.read',
      displayName: 'Operations Order Read',
      description: 'Permission to view process order data',
    },
  ],
  supportedScopes: ['plant', 'line', 'work-centre', 'process-order', 'material', 'batch'],
  scopePolicy: {
    supportedLevels: ['plant', 'line', 'work-centre', 'process-order', 'material', 'batch'],
    defaultLevel: 'plant',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'poh-consumer-view',
      displayName: 'Consumer POH',
      lifecycle: 'pilot',
      sortOrder: 0,
      defaultPanels: [],
    },
  ],
  defaultPanels: [],
  route: '/operations/poh-consumer',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: false,
    maxPinnedPanels: 0,
  },
  drillThroughDefinitions: [
    {
      label: 'Open Quality Batch Release',
      targetWorkspaceId: 'quality-batch-release',
      targetViewId: 'batch-decision',
      contextScopes: ['batch', 'plant'],
    },
    {
      label: 'Open Production Staging',
      targetWorkspaceId: 'production-staging',
      targetViewId: 'staging-overview',
      contextScopes: ['plant'],
    },
    {
      label: 'Open Trace Investigation',
      targetWorkspaceId: 'trace-investigation',
      targetViewId: 'overview',
      contextScopes: ['batch', 'plant'],
    },
  ],
  telemetryId: 'operations.poh-consumer',
}
