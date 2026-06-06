import type { WorkspaceRegistration } from '@connectio/product-model'

/** Phase 0 stub registration for the Environmental Monitoring workspace. */
export const envmonWorkspaceRegistration: WorkspaceRegistration = {
  workspaceId: 'envmon-workspace',
  displayName: 'Environmental Monitoring',
  description: 'Environmental Monitoring workspace — Phase 0 stub',
  domainId: 'envmon',
  ownerDomain: 'envmon',
  lifecycle: 'concept-lab',
  supportedRoles: [],
  requiredPermissions: [],
  supportedScopes: ['plant'],
  scopePolicy: {
    supportedLevels: ['plant'],
    defaultLevel: 'plant',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'overview',
      displayName: 'Overview',
      lifecycle: 'concept-lab',
      sortOrder: 0,
      defaultPanels: [],
    },
  ],
  defaultPanels: [],
  route: '/envmon',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: false,
  },
  drillThroughDefinitions: [],
  telemetryId: 'envmon.workspace',
}
