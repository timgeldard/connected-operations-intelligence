import type { WorkspaceRegistration } from '@connectio/product-model'

/** Standalone workspace registration for the Claude Design ConnectedQuality Lab Board. */
export const connectedQualityLabBoardStandaloneRegistration: WorkspaceRegistration = {
  workspaceId: 'connected-quality-lab-board',
  displayName: 'ConnectedQuality Lab Board',
  description: 'Standalone wallboard screen imported from the Claude Design ConnectedQuality export.',
  domainId: 'quality',
  ownerDomain: 'quality',
  lifecycle: 'pilot',
  supportedRoles: [
    'quality-lead',
    'quality-analyst',
    'quality-manager',
    'plant-manager',
  ],
  requiredPermissions: [
    {
      permissionId: 'quality.release.read',
      displayName: 'Quality Release Read',
      description: 'Permission to view quality and lab-board evidence',
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
      viewId: 'standalone-board',
      displayName: 'Lab Board',
      lifecycle: 'pilot',
      sortOrder: 0,
      defaultPanels: [],
    },
  ],
  defaultPanels: [],
  route: '/quality/lab-board',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: false,
    maxPinnedPanels: 0,
  },
  drillThroughDefinitions: [],
  telemetryId: 'quality.connected-quality-lab-board',
}
