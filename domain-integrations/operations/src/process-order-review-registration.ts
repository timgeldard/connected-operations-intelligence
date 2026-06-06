import type { WorkspaceRegistration } from '@connectio/product-model'

export const processOrderReviewRegistration: WorkspaceRegistration = {
  workspaceId: 'process-order-review',
  displayName: 'Process Order Review',
  description: 'Process order review workspace — execution progress, timeline, quality context, staging readiness, and related batch evidence for individual process orders.',
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
    { permissionId: 'operations.order.read', displayName: 'Operations Order Read', description: 'View process order details, progress, confirmations, and execution timeline' },
  ],
  supportedScopes: ['plant', 'line', 'work-centre', 'process-order', 'material', 'batch'],
  scopePolicy: {
    supportedLevels: ['plant', 'line', 'work-centre', 'process-order', 'material', 'batch'],
    defaultLevel: 'plant',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'order-history',
      displayName: 'Order History',
      lifecycle: 'pilot',
      sortOrder: 0,
      defaultPanels: [
        { panelId: 'order-history-cockpit', defaultVisible: true, defaultOrder: 0 },
      ],
    },
    {
      viewId: 'order-overview',
      displayName: 'Order Overview',
      lifecycle: 'pilot',
      sortOrder: 1,
      defaultPanels: [
        { panelId: 'process-order-header', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'order-progress', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'order-quality-context', defaultVisible: true, defaultOrder: 2 },
      ],
    },
    {
      viewId: 'execution-timeline',
      displayName: 'Execution Timeline',
      lifecycle: 'pilot',
      sortOrder: 2,
      defaultPanels: [
        { panelId: 'execution-timeline', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'order-progress', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'poh-genie-pilot',
      displayName: 'POH Assistant Pilot',
      lifecycle: 'pilot',
      sortOrder: 3,
      defaultPanels: [
        { panelId: 'poh-genie-pilot', defaultVisible: true, defaultOrder: 0 },
      ],
    },
    {
      viewId: 'yield-losses',
      displayName: 'Yield & Losses',
      lifecycle: 'pilot',
      sortOrder: 4,
      defaultPanels: [
        { panelId: 'order-progress', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'process-order-header', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'quality-context',
      displayName: 'Quality Context',
      lifecycle: 'pilot',
      sortOrder: 5,
      defaultPanels: [
        { panelId: 'order-quality-context', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'related-batch-context', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'staging-context',
      displayName: 'Staging Context',
      lifecycle: 'pilot',
      sortOrder: 6,
      defaultPanels: [
        { panelId: 'order-staging-context', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'order-progress', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'related-batches',
      displayName: 'Related Batches',
      lifecycle: 'pilot',
      sortOrder: 7,
      defaultPanels: [
        { panelId: 'related-batch-context', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'order-quality-context', defaultVisible: true, defaultOrder: 1 },
      ],
    },
  ],
  defaultPanels: [
    { panelId: 'process-order-header', defaultVisible: true, defaultOrder: 0 },
    { panelId: 'order-progress', defaultVisible: true, defaultOrder: 1 },
    { panelId: 'execution-timeline', defaultVisible: true, defaultOrder: 2 },
    { panelId: 'poh-genie-pilot', defaultVisible: true, defaultOrder: 3 },
    { panelId: 'order-quality-context', defaultVisible: true, defaultOrder: 4 },
    { panelId: 'order-staging-context', defaultVisible: true, defaultOrder: 5 },
    { panelId: 'related-batch-context', defaultVisible: true, defaultOrder: 6 },
  ],
  route: '/operations/process-order-review',
  personalizationPolicy: {
    allowPanelReorder: true,
    allowPanelHide: true,
    allowSavedFilters: false,
    allowDefaultScopeOverride: true,
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
  telemetryId: 'operations.process-order-review',
}
