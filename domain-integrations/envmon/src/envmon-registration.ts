import type { WorkspaceRegistration } from '@connectio/product-model'

export const envmonRegistration: WorkspaceRegistration = {
  workspaceId: 'envmon-monitoring',
  displayName: 'Environmental Monitoring',
  description:
    'Plant-level environmental monitoring workspace. Tracks zone status, active alerts, swab results, corrective actions, and compliance trends.',
  domainId: 'envmon',
  ownerDomain: 'envmon',
  lifecycle: 'live',
  supportedRoles: [
    'envmon-coordinator',
    'quality-lead',
    'site-manager',
    'plant-manager',
    'operations-supervisor',
  ],
  requiredPermissions: [
    {
      permissionId: 'envmon.monitoring.read',
      displayName: 'Environmental Monitoring Read',
      description: 'Permission to view zone status, alerts, swab results, and corrective actions',
    },
    {
      permissionId: 'envmon.actions.write',
      displayName: 'Environmental Monitoring Write',
      description: 'Permission to raise alerts, create corrective actions, and request retests',
    },
  ],
  supportedScopes: ['plant', 'region'],
  scopePolicy: {
    supportedLevels: ['plant', 'region'],
    defaultLevel: 'plant',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'native-monitoring',
      displayName: 'Monitoring',
      lifecycle: 'live',
      sortOrder: 0,
      defaultPanels: [
        { panelId: 'envmon-native-monitoring', defaultVisible: true, defaultOrder: 0 },
      ],
    },
    {
      viewId: 'scope-overview',
      displayName: 'Overview',
      lifecycle: 'live',
      sortOrder: 1,
      defaultPanels: [
        { panelId: 'envmon-site-summary', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'envmon-alerts', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'envmon-heatmap', defaultVisible: true, defaultOrder: 2 },
      ],
    },
    {
      viewId: 'plant-monitoring',
      displayName: 'Plant Monitoring',
      lifecycle: 'live',
      sortOrder: 2,
      defaultPanels: [
        { panelId: 'envmon-site-summary', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'envmon-zone-status', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'envmon-alerts', defaultVisible: true, defaultOrder: 2 },
      ],
    },
    {
      viewId: 'heatmap',
      displayName: 'Zone Heatmap',
      lifecycle: 'live',
      sortOrder: 3,
      defaultPanels: [
        { panelId: 'envmon-heatmap', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'envmon-zone-status', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'alerts',
      displayName: 'Alerts',
      lifecycle: 'live',
      sortOrder: 4,
      defaultPanels: [
        { panelId: 'envmon-alerts', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'envmon-corrective-actions', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'swab-vectors',
      displayName: 'Swab Vectors',
      lifecycle: 'live',
      sortOrder: 5,
      defaultPanels: [
        { panelId: 'envmon-swab-vectors', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'envmon-swab-results', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'trends',
      displayName: 'Trends',
      lifecycle: 'live',
      sortOrder: 6,
      defaultPanels: [
        { panelId: 'envmon-trends', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'envmon-site-summary', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'corrective-actions',
      displayName: 'Corrective Actions',
      lifecycle: 'live',
      sortOrder: 7,
      defaultPanels: [
        { panelId: 'envmon-corrective-actions', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'envmon-alerts', defaultVisible: true, defaultOrder: 1 },
      ],
    },
  ],
  defaultPanels: [
    { panelId: 'envmon-native-monitoring', defaultVisible: true, defaultOrder: 0 },
    { panelId: 'envmon-site-summary', defaultVisible: true, defaultOrder: 1 },
    { panelId: 'envmon-zone-status', defaultVisible: true, defaultOrder: 2 },
    { panelId: 'envmon-alerts', defaultVisible: true, defaultOrder: 3 },
    { panelId: 'envmon-heatmap', defaultVisible: true, defaultOrder: 4 },
    { panelId: 'envmon-swab-results', defaultVisible: true, defaultOrder: 5 },
    { panelId: 'envmon-trends', defaultVisible: true, defaultOrder: 6 },
    { panelId: 'envmon-corrective-actions', defaultVisible: true, defaultOrder: 7 },
    { panelId: 'envmon-swab-vectors', defaultVisible: true, defaultOrder: 8 },
  ],
  route: '/envmon/monitoring',
  personalizationPolicy: {
    allowPanelReorder: true,
    allowPanelHide: true,
    allowSavedFilters: true,
    allowDefaultScopeOverride: false,
    maxPinnedPanels: 6,
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
  telemetryId: 'envmon.monitoring',
}
