import type { WorkspaceRegistration } from '@connectio/product-model'

/** Phase 0 stub registration for the Warehouse workspace. */
export const warehouseWorkspaceRegistration: WorkspaceRegistration = {
  workspaceId: 'warehouse-workspace',
  displayName: 'Warehouse',
  description: 'Warehouse workspace — Phase 0 stub',
  domainId: 'warehouse',
  ownerDomain: 'warehouse',
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
  route: '/warehouse',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: false,
  },
  drillThroughDefinitions: [],
  telemetryId: 'warehouse.workspace',
}
