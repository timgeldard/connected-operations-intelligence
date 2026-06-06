import type { WorkspaceRegistration } from '@connectio/product-model'

/**
 * Workspace registration for the Traceability domain.
 *
 * @remarks
 * Supports forward/reverse batch trace and mass balance at batch scope.
 * `requiredLevel: 'batch'` means the workspace will not activate without
 * an explicit batch context in the shell's scope.
 */
export const traceabilityWorkspaceRegistration: WorkspaceRegistration = {
  workspaceId: 'traceability-workspace',
  displayName: 'Traceability',
  description: 'Forward/reverse batch trace and mass balance',
  domainId: 'traceability',
  ownerDomain: 'traceability',
  lifecycle: 'live',
  supportedRoles: [],
  requiredPermissions: [],
  supportedScopes: ['batch'],
  scopePolicy: {
    supportedLevels: ['batch', 'process-order', 'plant'],
    requiredLevel: 'batch',
    defaultLevel: 'batch',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'trace',
      displayName: 'Trace',
      lifecycle: 'live',
      sortOrder: 0,
      defaultPanels: [
        { panelId: 'trace-exposure-summary', defaultVisible: true, defaultOrder: 0 },
      ],
    },
    {
      viewId: 'lineage',
      displayName: 'Lineage',
      lifecycle: 'live',
      sortOrder: 1,
      defaultPanels: [
        { panelId: 'batch-lineage', defaultVisible: true, defaultOrder: 0 },
      ],
    },
  ],
  defaultPanels: [
    { panelId: 'trace-exposure-summary', defaultVisible: true, defaultOrder: 0 },
    { panelId: 'batch-lineage', defaultVisible: true, defaultOrder: 1 },
  ],
  route: '/traceability',
  personalizationPolicy: {
    allowPanelReorder: true,
    allowPanelHide: true,
    allowSavedFilters: true,
    allowDefaultScopeOverride: false,
  },
  drillThroughDefinitions: [],
  telemetryId: 'traceability.workspace',
}
