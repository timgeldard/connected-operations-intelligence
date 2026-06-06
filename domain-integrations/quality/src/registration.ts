import type { WorkspaceRegistration } from '@connectio/product-model'

/** Phase 0 stub registration for the Quality workspace. */
export const qualityWorkspaceRegistration: WorkspaceRegistration = {
  workspaceId: 'quality-workspace',
  displayName: 'Quality',
  description: 'Quality workspace — Phase 0 stub',
  domainId: 'quality',
  ownerDomain: 'quality',
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
  route: '/quality',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: false,
  },
  drillThroughDefinitions: [],
  telemetryId: 'quality.workspace',
}
