import type { WorkspaceRegistration } from '@connectio/product-model'

/** Phase 0 stub registration for the Maintenance workspace. */
export const maintenanceWorkspaceRegistration: WorkspaceRegistration = {
  workspaceId: 'maintenance-workspace',
  displayName: 'Maintenance',
  description: 'Maintenance workspace — Phase 0 stub',
  domainId: 'maintenance',
  ownerDomain: 'maintenance',
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
  route: '/maintenance',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: false,
  },
  drillThroughDefinitions: [],
  telemetryId: 'maintenance.workspace',
}
