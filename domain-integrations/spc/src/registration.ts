import type { WorkspaceRegistration } from '@connectio/product-model'

/** Phase 0 stub registration for the SPC (Statistical Process Control) workspace. */
export const spcWorkspaceRegistration: WorkspaceRegistration = {
  workspaceId: 'spc-workspace',
  displayName: 'SPC',
  description: 'SPC workspace — Phase 0 stub',
  domainId: 'spc',
  ownerDomain: 'spc',
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
  route: '/spc',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: false,
  },
  drillThroughDefinitions: [],
  telemetryId: 'spc.workspace',
}
