import type { WorkspaceRegistration } from '@connectio/product-model'

export const envmonConsumerRegistration: WorkspaceRegistration = {
  workspaceId: 'envmon-consumer',
  displayName: 'Environmental Monitoring (Consumer)',
  description: 'A modern, interactive spatial environment monitoring tool with zone drawing and point placement constraints.',
  domainId: 'envmon',
  ownerDomain: 'envmon',
  lifecycle: 'pilot',
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
      description: 'Permission to view zone status and floor plans',
    },
    {
      permissionId: 'envmon.actions.write',
      displayName: 'Environmental Monitoring Write',
      description: 'Permission to edit L4 zones and L5 coordinate mappings',
    },
  ],
  supportedScopes: ['plant'],
  scopePolicy: {
    supportedLevels: ['plant'],
    defaultLevel: 'plant',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'envmon-consumer-view',
      displayName: 'Consumer EnvMon',
      lifecycle: 'pilot',
      sortOrder: 0,
      defaultPanels: [],
    },
  ],
  defaultPanels: [],
  route: '/envmon/consumer',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: false,
  },
  drillThroughDefinitions: [],
  telemetryId: 'envmon.consumer',
}
