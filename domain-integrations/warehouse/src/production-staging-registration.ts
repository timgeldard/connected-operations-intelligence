import type { WorkspaceRegistration } from '@connectio/product-model'

export const productionStagingRegistration: WorkspaceRegistration = {
  workspaceId: 'production-staging',
  displayName: 'Production Staging',
  description:
    'Warehouse workspace for monitoring production order staging readiness. Tracks pick tasks, zone capacity, material shortfalls, move requests, and picking wave progress ahead of planned production start.',
  domainId: 'warehouse',
  ownerDomain: 'warehouse',
  lifecycle: 'live',
  supportedRoles: [
    'warehouse-manager',
    'logistics-lead',
    'operations-supervisor',
    'plant-manager',
    'production-planner',
    'shift-lead',
  ],
  requiredPermissions: [
    {
      permissionId: 'warehouse.staging.read',
      displayName: 'Warehouse Staging Read',
      description: 'Permission to view staging readiness, pick tasks, zone capacity, and shortfall data',
    },
    {
      permissionId: 'warehouse.staging.write',
      displayName: 'Warehouse Staging Write',
      description: 'Permission to request moves, escalate shortfalls, and submit expedited staging requests',
    },
  ],
  supportedScopes: ['plant', 'warehouse'],
  scopePolicy: {
    supportedLevels: ['plant', 'warehouse'],
    defaultLevel: 'warehouse',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'staging-overview',
      displayName: 'Staging Overview',
      lifecycle: 'live',
      sortOrder: 0,
      defaultPanels: [
        { panelId: 'staging-readiness-summary', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'staging-order-list', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'staging-alerts', defaultVisible: true, defaultOrder: 2 },
      ],
    },
    {
      viewId: 'order-staging',
      displayName: 'Order Staging',
      lifecycle: 'live',
      sortOrder: 1,
      defaultPanels: [
        { panelId: 'staging-order-list', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'staging-pick-tasks', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'shortfalls',
      displayName: 'Shortfalls',
      lifecycle: 'live',
      sortOrder: 2,
      defaultPanels: [
        { panelId: 'staging-shortfalls', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'staging-alerts', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'zone-capacity',
      displayName: 'Zone Capacity',
      lifecycle: 'live',
      sortOrder: 3,
      defaultPanels: [
        { panelId: 'staging-zone-capacity', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'staging-order-list', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'picking-waves',
      displayName: 'Picking Waves',
      lifecycle: 'live',
      sortOrder: 4,
      defaultPanels: [
        { panelId: 'staging-picking-waves', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'staging-pick-tasks', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'move-requests',
      displayName: 'Move Requests',
      lifecycle: 'live',
      sortOrder: 5,
      defaultPanels: [
        { panelId: 'staging-move-requests', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'staging-shortfalls', defaultVisible: true, defaultOrder: 1 },
      ],
    },
  ],
  defaultPanels: [
    { panelId: 'staging-readiness-summary', defaultVisible: true, defaultOrder: 0 },
    { panelId: 'staging-order-list', defaultVisible: true, defaultOrder: 1 },
    { panelId: 'staging-pick-tasks', defaultVisible: true, defaultOrder: 2 },
    { panelId: 'staging-zone-capacity', defaultVisible: true, defaultOrder: 3 },
    { panelId: 'staging-shortfalls', defaultVisible: true, defaultOrder: 4 },
    { panelId: 'staging-move-requests', defaultVisible: true, defaultOrder: 5 },
    { panelId: 'staging-picking-waves', defaultVisible: true, defaultOrder: 6 },
    { panelId: 'staging-alerts', defaultVisible: true, defaultOrder: 7 },
  ],
  route: '/warehouse/production-staging',
  personalizationPolicy: {
    allowPanelReorder: true,
    allowPanelHide: true,
    allowSavedFilters: true,
    allowDefaultScopeOverride: false,
    maxPinnedPanels: 6,
  },
  drillThroughDefinitions: [
    {
      label: 'Open Operations Plan Risk',
      targetWorkspaceId: 'operations-plan-risk',
      targetViewId: 'material-staging-risk',
      contextScopes: ['plant'],
    },
  ],
  telemetryId: 'warehouse.production-staging',
}
