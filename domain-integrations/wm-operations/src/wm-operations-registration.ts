import type { WorkspaceRegistration } from '@connectio/product-model'

export const wmOperationsRegistration: WorkspaceRegistration = {
  workspaceId: 'wm-operations',
  displayName: 'WM Operations',
  description:
    'Read-only warehouse & plant manager tools over the SAP WM staging process — live staging/picking worklist, order staging readiness, dispensary operations, and a stock & bin explorer. Kerry-branded workspace.',
  domainId: 'warehouse',
  ownerDomain: 'warehouse',
  lifecycle: 'pilot',
  supportedRoles: [
    'warehouse-manager',
    'plant-manager',
    'logistics-lead',
    'operations-supervisor',
  ],
  requiredPermissions: [
    {
      permissionId: 'warehouse.wm-operations.read',
      displayName: 'WM Operations Read',
      description:
        'View staging/picking worklists, order readiness, dispensary operations, and bin-level stock',
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
      viewId: 'staging-worklist',
      displayName: 'Staging & Picking',
      lifecycle: 'pilot',
      sortOrder: 0,
      defaultPanels: [
        { panelId: 'wm-worklist-summary', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'wm-worklist-table', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'order-readiness',
      displayName: 'Order Readiness',
      lifecycle: 'pilot',
      sortOrder: 1,
      defaultPanels: [
        { panelId: 'wm-order-readiness', defaultVisible: true, defaultOrder: 0 },
      ],
    },
    {
      viewId: 'dispensary',
      displayName: 'Dispensary',
      lifecycle: 'pilot',
      sortOrder: 2,
      defaultPanels: [
        { panelId: 'wm-dispensary-work', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'wm-dispensary-stock', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'stock-explorer',
      displayName: 'Stock & Bins',
      lifecycle: 'pilot',
      sortOrder: 3,
      defaultPanels: [
        { panelId: 'wm-bin-stock', defaultVisible: true, defaultOrder: 0 },
      ],
    },
    {
      viewId: 'outbound',
      displayName: 'Outbound',
      lifecycle: 'pilot',
      sortOrder: 4,
      defaultPanels: [
        { panelId: 'wm-outbound', defaultVisible: true, defaultOrder: 0 },
      ],
    },
    {
      viewId: 'operators',
      displayName: 'Operators',
      lifecycle: 'pilot',
      sortOrder: 5,
      defaultPanels: [
        { panelId: 'wm-operators', defaultVisible: true, defaultOrder: 0 },
      ],
    },
    {
      viewId: 'handover',
      displayName: 'Handover',
      lifecycle: 'pilot',
      sortOrder: 6,
      defaultPanels: [
        { panelId: 'wm-handover', defaultVisible: true, defaultOrder: 0 },
      ],
    },
  ],
  defaultPanels: [
    { panelId: 'wm-worklist-summary', defaultVisible: true, defaultOrder: 0 },
    { panelId: 'wm-worklist-table', defaultVisible: true, defaultOrder: 1 },
    { panelId: 'wm-order-readiness', defaultVisible: true, defaultOrder: 2 },
    { panelId: 'wm-dispensary-work', defaultVisible: true, defaultOrder: 3 },
    { panelId: 'wm-dispensary-stock', defaultVisible: true, defaultOrder: 4 },
    { panelId: 'wm-bin-stock', defaultVisible: true, defaultOrder: 5 },
  ],
  route: '/warehouse/wm-operations',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: true,
  },
  drillThroughDefinitions: [
    {
      label: 'Open Warehouse 360',
      targetWorkspaceId: 'warehouse-360-overview',
      targetViewId: 'warehouse-cockpit',
      contextScopes: ['plant', 'warehouse'],
    },
    {
      label: 'Open Production Staging',
      targetWorkspaceId: 'production-staging',
      targetViewId: 'staging-overview',
      contextScopes: ['plant'],
    },
  ],
  telemetryId: 'warehouse.wm-operations',
}
