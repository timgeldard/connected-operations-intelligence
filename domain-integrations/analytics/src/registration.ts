import type { WorkspaceRegistration } from '@connectio/product-model'

/** Phase 0 stub registration for the Analytics workspace. */
export const analyticsWorkspaceRegistration: WorkspaceRegistration = {
  workspaceId: 'analytics-workspace',
  displayName: 'Analytics',
  description: 'Analytics workspace — Phase 0 stub',
  domainId: 'analytics',
  ownerDomain: 'analytics',
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
  route: '/analytics',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: false,
  },
  drillThroughDefinitions: [],
  telemetryId: 'analytics.workspace',
}
