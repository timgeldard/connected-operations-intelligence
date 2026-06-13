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
    { viewId: 'inbound', displayName: 'Inbound', lifecycle: 'pilot', sortOrder: 7, defaultPanels: [{ panelId: 'wm-inbound', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'stock-health', displayName: 'Stock Health', lifecycle: 'pilot', sortOrder: 8, defaultPanels: [{ panelId: 'wm-stock-health', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'recon', displayName: 'Reconciliation', lifecycle: 'pilot', sortOrder: 9, defaultPanels: [{ panelId: 'wm-recon', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'campaigns', displayName: 'Campaigns', lifecycle: 'pilot', sortOrder: 10, defaultPanels: [{ panelId: 'wm-campaigns', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'trends', displayName: 'Trends', lifecycle: 'pilot', sortOrder: 11, defaultPanels: [{ panelId: 'wm-trends', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'bin-capacity', displayName: 'Bin Capacity', lifecycle: 'pilot', sortOrder: 12, defaultPanels: [{ panelId: 'wm-bin-capacity', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'movements', displayName: 'Goods Movements', lifecycle: 'pilot', sortOrder: 13, defaultPanels: [{ panelId: 'wm-movements', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'slow-movers', displayName: 'Slow Movers', lifecycle: 'pilot', sortOrder: 14, defaultPanels: [{ panelId: 'wm-slow-movers', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'movement-control', displayName: 'Movement Control', lifecycle: 'pilot', sortOrder: 15, defaultPanels: [{ panelId: 'wm-movement-control', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'staging-pace', displayName: 'Staging Pace', lifecycle: 'pilot', sortOrder: 16, defaultPanels: [{ panelId: 'wm-staging-pace', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'production-health', displayName: 'Production Health', lifecycle: 'pilot', sortOrder: 17, defaultPanels: [{ panelId: 'wm-production-health', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'qm-command-centre', displayName: 'QM Command Centre', lifecycle: 'pilot', sortOrder: 18, defaultPanels: [{ panelId: 'wm-qm-command-centre', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'qm-disposition-queue', displayName: 'Disposition Queue', lifecycle: 'pilot', sortOrder: 19, defaultPanels: [{ panelId: 'wm-qm-disposition-queue', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'order-journey', displayName: 'Order Journey', lifecycle: 'pilot', sortOrder: 20, defaultPanels: [{ panelId: 'wm-order-journey', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'production-progress', displayName: 'Production Progress', lifecycle: 'pilot', sortOrder: 21, defaultPanels: [{ panelId: 'wm-production-progress', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'yield-loss', displayName: 'Yield & Loss', lifecycle: 'pilot', sortOrder: 22, defaultPanels: [{ panelId: 'wm-yield-loss', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'shortage-projection', displayName: 'Shortage Projection', lifecycle: 'pilot', sortOrder: 23, defaultPanels: [{ panelId: 'wm-shortage-projection', defaultVisible: true, defaultOrder: 0 }] },
    { viewId: 'expiry-risk', displayName: 'Expiry Risk', lifecycle: 'pilot', sortOrder: 24, defaultPanels: [{ panelId: 'wm-expiry-risk', defaultVisible: true, defaultOrder: 0 }] },
    {
      viewId: 'lineside-monitor',
      displayName: 'Lineside Monitor',
      lifecycle: 'pilot',
      sortOrder: 25,
      defaultPanels: [{ panelId: 'wm-lineside-monitor', defaultVisible: true, defaultOrder: 0 }],
    },
    {
      viewId: 'planning-board',
      displayName: 'Planning Board',
      lifecycle: 'pilot',
      sortOrder: 26,
      defaultPanels: [{ panelId: 'wm-planning-board', defaultVisible: true, defaultOrder: 0 }],
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
  ],
  telemetryId: 'warehouse.wm-operations',
}
