import type { WorkspaceRegistration } from '@connectio/product-model'

export const spcConsumerRegistration: WorkspaceRegistration = {
  workspaceId: 'spc-consumer',
  displayName: 'Statistical Process Control (Consumer)',
  description: 'A premium, search-driven statistical process control workspace with interactive charts and capability analysis.',
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
    { permissionId: 'spc.read', displayName: 'SPC Read', description: 'View control charts, capability, alarms, and history' },
  ],
  supportedScopes: ['plant', 'material', 'batch'],
  scopePolicy: {
    supportedLevels: ['plant', 'material', 'batch'],
    defaultLevel: 'material',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'spc-consumer-view',
      displayName: 'Consumer SPC',
      lifecycle: 'pilot',
      sortOrder: 0,
      defaultPanels: [],
    },
  ],
  defaultPanels: [],
  route: '/spc-consumer',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: false,
    maxPinnedPanels: 0,
  },
  drillThroughDefinitions: [],
  telemetryId: 'quality.spc-consumer',
}
