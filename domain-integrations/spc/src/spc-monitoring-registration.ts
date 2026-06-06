import type { WorkspaceRegistration } from '@connectio/product-model'

export const spcMonitoringRegistration: WorkspaceRegistration = {
  workspaceId: 'spc-monitoring',
  displayName: 'SPC Monitoring',
  description: 'Statistical process control monitoring — control charts, capability analysis, signal tracking, and alarm history for inspection characteristics.',
  domainId: 'spc',
  ownerDomain: 'spc',
  lifecycle: 'pilot',
  supportedRoles: [
    'quality-lead',
    'qa-technician',
    'food-safety-lead',
    'operations-supervisor',
    'plant-manager',
  ],
  requiredPermissions: [
    { permissionId: 'spc.read', displayName: 'SPC Read', description: 'View control charts, signals, capability indices, and alarm history' },
  ],
  supportedScopes: ['plant', 'line', 'work-centre', 'material', 'batch'],
  scopePolicy: {
    supportedLevels: ['plant', 'line', 'work-centre', 'material', 'batch'],
    defaultLevel: 'material',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'chart-overview',
      displayName: 'Chart Overview',
      lifecycle: 'pilot',
      sortOrder: 0,
      defaultPanels: [
        { panelId: 'spc-summary', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'active-spc-signals', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'control-chart', defaultVisible: true, defaultOrder: 2 },
      ],
    },
    {
      viewId: 'active-signals',
      displayName: 'Active Signals',
      lifecycle: 'pilot',
      sortOrder: 1,
      defaultPanels: [
        { panelId: 'active-spc-signals', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'spc-process-context', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'characteristic-review',
      displayName: 'Characteristic Review',
      lifecycle: 'pilot',
      sortOrder: 2,
      defaultPanels: [
        { panelId: 'control-chart', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'characteristic-capability', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'capability',
      displayName: 'Capability',
      lifecycle: 'pilot',
      sortOrder: 3,
      defaultPanels: [
        { panelId: 'characteristic-capability', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'spc-summary', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'alarm-history',
      displayName: 'Alarm History',
      lifecycle: 'pilot',
      sortOrder: 4,
      defaultPanels: [
        { panelId: 'spc-alarm-history', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'spc-related-batches', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'chart-configuration-readonly',
      displayName: 'Chart Configuration',
      lifecycle: 'pilot',
      sortOrder: 5,
      defaultPanels: [
        { panelId: 'spc-process-context', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'characteristic-capability', defaultVisible: true, defaultOrder: 1 },
      ],
    },
  ],
  defaultPanels: [
    { panelId: 'spc-summary', defaultVisible: true, defaultOrder: 0 },
    { panelId: 'active-spc-signals', defaultVisible: true, defaultOrder: 1 },
    { panelId: 'control-chart', defaultVisible: true, defaultOrder: 2 },
    { panelId: 'characteristic-capability', defaultVisible: true, defaultOrder: 3 },
    { panelId: 'spc-alarm-history', defaultVisible: true, defaultOrder: 4 },
    { panelId: 'spc-related-batches', defaultVisible: true, defaultOrder: 5 },
    { panelId: 'spc-process-context', defaultVisible: true, defaultOrder: 6 },
  ],
  route: '/quality/spc-monitoring',
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
      label: 'Open Trace Investigation',
      targetWorkspaceId: 'trace-investigation',
      targetViewId: 'overview',
      contextScopes: ['batch', 'plant'],
    },
  ],
  telemetryId: 'spc.monitoring',
}
