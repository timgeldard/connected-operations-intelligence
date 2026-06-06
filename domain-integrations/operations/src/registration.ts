import type { WorkspaceRegistration } from '@connectio/product-model'

/** Phase 0 stub registration for the Operations workspace. */
export const operationsWorkspaceRegistration: WorkspaceRegistration = {
  workspaceId: 'operations-workspace',
  displayName: 'Operations',
  description: 'Operations workspace — Phase 0 stub',
  domainId: 'operations',
  ownerDomain: 'operations',
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
  route: '/operations',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: false,
  },
  drillThroughDefinitions: [],
  telemetryId: 'operations.workspace',
}
