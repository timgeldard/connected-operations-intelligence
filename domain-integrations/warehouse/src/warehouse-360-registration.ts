import type { WorkspaceRegistration } from '@connectio/product-model'

export const warehouse360Registration: WorkspaceRegistration = {
  workspaceId: 'warehouse-360-overview',
  displayName: 'Warehouse 360',
  description: 'Holistic warehouse operational view — stock by zone, open holds, goods movement activity, location capacity, and replenishment needs at a glance.',
  domainId: 'warehouse',
  ownerDomain: 'warehouse',
  lifecycle: 'pilot',
  supportedRoles: [
    'warehouse-manager',
    'logistics-lead',
    'plant-manager',
    'operations-supervisor',
    'quality-lead',
  ],
  requiredPermissions: [
    {
      permissionId: 'warehouse.overview.read',
      displayName: 'Warehouse Overview Read',
      description: 'View warehouse stock status, open holds, goods movements, and replenishment data',
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
      viewId: 'warehouse-cockpit',
      displayName: 'Warehouse Cockpit (Native)',
      lifecycle: 'pilot',
      sortOrder: 0,
      defaultPanels: [
        { panelId: 'warehouse-cockpit', defaultVisible: true, defaultOrder: 0 },
      ],
    },
    {
      viewId: 'warehouse-overview',
      displayName: 'Warehouse Overview',
      lifecycle: 'pilot',
      sortOrder: 1,
      defaultPanels: [
        { panelId: 'warehouse-360-summary', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'stock-overview', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'open-holds', defaultVisible: true, defaultOrder: 2 },
      ],
    },
    {
      viewId: 'stock-status',
      displayName: 'Stock Status',
      lifecycle: 'pilot',
      sortOrder: 2,
      defaultPanels: [
        { panelId: 'stock-overview', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'location-capacity', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'holds-management',
      displayName: 'Holds Management',
      lifecycle: 'pilot',
      sortOrder: 3,
      defaultPanels: [
        { panelId: 'open-holds', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'warehouse-360-summary', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'goods-movements',
      displayName: 'Goods Movements',
      lifecycle: 'pilot',
      sortOrder: 4,
      defaultPanels: [
        { panelId: 'goods-movement-activity', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'warehouse-360-summary', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'replenishment',
      displayName: 'Replenishment',
      lifecycle: 'pilot',
      sortOrder: 5,
      defaultPanels: [
        { panelId: 'replenishment-needs', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'stock-overview', defaultVisible: true, defaultOrder: 1 },
      ],
    },
  ],
  defaultPanels: [
    { panelId: 'warehouse-360-summary', defaultVisible: true, defaultOrder: 0 },
    { panelId: 'stock-overview', defaultVisible: true, defaultOrder: 1 },
    { panelId: 'open-holds', defaultVisible: true, defaultOrder: 2 },
    { panelId: 'goods-movement-activity', defaultVisible: true, defaultOrder: 3 },
    { panelId: 'replenishment-needs', defaultVisible: true, defaultOrder: 4 },
    { panelId: 'location-capacity', defaultVisible: true, defaultOrder: 5 },
  ],
  route: '/warehouse/warehouse-360-overview',
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
  telemetryId: 'warehouse.warehouse-360-overview',
}
