import type { WorkspaceRegistration } from '@connectio/product-model'

export const maintenanceReliabilityRegistration: WorkspaceRegistration = {
  workspaceId: 'maintenance-reliability',
  displayName: 'Maintenance & Reliability',
  description: 'Plant maintenance and reliability workspace — work orders, PM schedule, equipment availability, reliability metrics, and maintenance backlog.',
  domainId: 'maintenance',
  ownerDomain: 'maintenance',
  lifecycle: 'pilot',
  supportedRoles: [
    'maintenance-manager',
    'plant-manager',
    'operations-supervisor',
    'reliability-engineer',
    'maintenance-technician',
  ],
  requiredPermissions: [
    {
      permissionId: 'maintenance.overview.read',
      displayName: 'Maintenance Overview Read',
      description: 'View work orders, PM schedule, equipment availability, and reliability metrics',
    },
  ],
  supportedScopes: ['plant', 'line'],
  scopePolicy: {
    supportedLevels: ['plant', 'line'],
    defaultLevel: 'plant',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'overview',
      displayName: 'Overview',
      lifecycle: 'pilot',
      sortOrder: 0,
      defaultPanels: [
        { panelId: 'maintenance-kpi-summary', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'open-work-orders', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'equipment-availability', defaultVisible: true, defaultOrder: 2 },
      ],
    },
    {
      viewId: 'work-orders',
      displayName: 'Work Orders',
      lifecycle: 'pilot',
      sortOrder: 1,
      defaultPanels: [
        { panelId: 'open-work-orders', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'maintenance-backlog', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'preventive-maintenance',
      displayName: 'PM Schedule',
      lifecycle: 'pilot',
      sortOrder: 2,
      defaultPanels: [
        { panelId: 'preventive-maintenance-schedule', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'maintenance-kpi-summary', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'equipment-availability',
      displayName: 'Equipment Availability',
      lifecycle: 'pilot',
      sortOrder: 3,
      defaultPanels: [
        { panelId: 'equipment-availability', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'reliability-metrics', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'backlog',
      displayName: 'Backlog',
      lifecycle: 'pilot',
      sortOrder: 4,
      defaultPanels: [
        { panelId: 'maintenance-backlog', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'open-work-orders', defaultVisible: true, defaultOrder: 1 },
      ],
    },
  ],
  defaultPanels: [
    { panelId: 'maintenance-kpi-summary', defaultVisible: true, defaultOrder: 0 },
    { panelId: 'open-work-orders', defaultVisible: true, defaultOrder: 1 },
    { panelId: 'preventive-maintenance-schedule', defaultVisible: true, defaultOrder: 2 },
    { panelId: 'equipment-availability', defaultVisible: true, defaultOrder: 3 },
    { panelId: 'reliability-metrics', defaultVisible: true, defaultOrder: 4 },
    { panelId: 'maintenance-backlog', defaultVisible: true, defaultOrder: 5 },
  ],
  route: '/maintenance/reliability',
  personalizationPolicy: {
    allowPanelReorder: true,
    allowPanelHide: true,
    allowSavedFilters: false,
    allowDefaultScopeOverride: true,
  },
  drillThroughDefinitions: [
    {
      label: 'Open Operations Plan Risk',
      targetWorkspaceId: 'operations-plan-risk',
      targetViewId: 'plan-overview',
      contextScopes: ['plant'],
    },
  ],
  telemetryId: 'maintenance.reliability',
}
