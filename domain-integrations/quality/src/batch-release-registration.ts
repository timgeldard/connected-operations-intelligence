import type { WorkspaceRegistration } from '@connectio/product-model'

/**
 * Workspace registration for the Quality Batch Release workspace.
 *
 * @remarks
 * This workspace is the primary cross-domain demonstration in Phase 2: it
 * consumes evidence panels from traceability, SPC, operations, and warehouse
 * — all scoped under `allowedConsumerWorkspaces: ['quality-batch-release']`.
 *
 * Six views cover the complete release lifecycle from queue management through
 * evidence review to decision and audit trail. The release case ID in the URL
 * provides primary context; batch and plant scope are derived from it.
 *
 * Owner domain: quality. Telemetry area: quality.batch-release.
 */
export const batchReleaseRegistration: WorkspaceRegistration = {
  workspaceId: 'quality-batch-release',
  displayName: 'Quality Batch Release',
  description:
    'Cross-domain workspace for reviewing quality evidence and approving or rejecting batch release decisions. Aggregates quality results, CoA readiness, SPC signals, operations conformance, and warehouse hold status.',
  domainId: 'quality',
  ownerDomain: 'quality',
  lifecycle: 'live',
  supportedRoles: [
    'quality-lead',
    'quality-analyst',
    'quality-manager',
    'food-safety-lead',
    'plant-manager',
  ],
  requiredPermissions: [
    {
      permissionId: 'quality.release.read',
      displayName: 'Quality Release Read',
      description: 'Permission to view batch release cases and quality evidence',
    },
    {
      permissionId: 'quality.release.write',
      displayName: 'Quality Release Write',
      description: 'Permission to submit release decisions, hold requests, and retest requests',
    },
  ],
  supportedScopes: ['plant', 'batch', 'process-order'],
  scopePolicy: {
    supportedLevels: ['plant', 'batch', 'process-order'],
    defaultLevel: 'batch',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'release-queue',
      displayName: 'Release Queue',
      lifecycle: 'live',
      sortOrder: 0,
      defaultPanels: [
        { panelId: 'release-queue', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'batch-release-summary', defaultVisible: true, defaultOrder: 1 },
      ],
    },
    {
      viewId: 'batch-decision',
      displayName: 'Batch Decision',
      lifecycle: 'live',
      sortOrder: 1,
      defaultPanels: [
        { panelId: 'batch-release-summary', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'quality-results-summary', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'coa-readiness', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'deviations', defaultVisible: true, defaultOrder: 3 },
      ],
    },
    {
      viewId: 'quality-evidence',
      displayName: 'Quality Evidence',
      lifecycle: 'live',
      sortOrder: 2,
      defaultPanels: [
        { panelId: 'quality-results-summary', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'coa-readiness', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'coa-release-status', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'risk-signals', defaultVisible: true, defaultOrder: 3 },
      ],
    },
    {
      viewId: 'operations-evidence',
      displayName: 'Operations Evidence',
      lifecycle: 'live',
      sortOrder: 3,
      defaultPanels: [
        { panelId: 'process-order-evidence', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'warehouse-hold-status', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'event-timeline', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'deviations', defaultVisible: true, defaultOrder: 3 },
      ],
    },
    {
      viewId: 'warehouse-trace-evidence',
      displayName: 'Warehouse & Trace',
      lifecycle: 'live',
      sortOrder: 4,
      defaultPanels: [
        { panelId: 'warehouse-hold-status', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'trace-exposure-for-release', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'related-investigations', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'spc-signals-for-release', defaultVisible: true, defaultOrder: 3 },
      ],
    },
    {
      viewId: 'decision-history',
      displayName: 'Decision History',
      lifecycle: 'live',
      sortOrder: 5,
      defaultPanels: [
        { panelId: 'decision-history', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'deviations', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'batch-release-summary', defaultVisible: true, defaultOrder: 2 },
      ],
    },
    {
      viewId: 'lab-board',
      displayName: 'Lab Board',
      lifecycle: 'pilot',
      sortOrder: 6,
      defaultPanels: [
        { panelId: 'connected-quality-lab-board', defaultVisible: true, defaultOrder: 0 },
      ],
    },
  ],
  defaultPanels: [
    { panelId: 'release-queue', defaultVisible: true, defaultOrder: 0 },
    { panelId: 'batch-release-summary', defaultVisible: true, defaultOrder: 1 },
    { panelId: 'quality-results-summary', defaultVisible: true, defaultOrder: 2 },
    { panelId: 'coa-readiness', defaultVisible: true, defaultOrder: 3 },
    { panelId: 'deviations', defaultVisible: true, defaultOrder: 4 },
    { panelId: 'decision-history', defaultVisible: true, defaultOrder: 5 },
    { panelId: 'process-order-evidence', defaultVisible: true, defaultOrder: 6 },
    { panelId: 'warehouse-hold-status', defaultVisible: true, defaultOrder: 7 },
    { panelId: 'spc-signals-for-release', defaultVisible: true, defaultOrder: 8 },
    { panelId: 'trace-exposure-for-release', defaultVisible: true, defaultOrder: 9 },
    { panelId: 'coa-release-status', defaultVisible: true, defaultOrder: 10 },
    { panelId: 'risk-signals', defaultVisible: true, defaultOrder: 11 },
    { panelId: 'event-timeline', defaultVisible: true, defaultOrder: 12 },
    { panelId: 'related-investigations', defaultVisible: true, defaultOrder: 13 },
    { panelId: 'connected-quality-lab-board', defaultVisible: true, defaultOrder: 14 },
  ],
  route: '/quality/batch-release',
  personalizationPolicy: {
    allowPanelReorder: true,
    allowPanelHide: true,
    allowSavedFilters: false,
    allowDefaultScopeOverride: false,
    maxPinnedPanels: 8,
  },
  drillThroughDefinitions: [
    {
      label: 'Open Trace Investigation',
      targetWorkspaceId: 'trace-investigation',
      targetViewId: 'overview',
      contextScopes: ['batch', 'plant'],
    },
    {
      label: 'Open in Traceability',
      targetWorkspaceId: 'traceability-workspace',
      targetViewId: 'trace',
      contextScopes: ['batch', 'plant'],
    },
  ],
  telemetryId: 'quality.batch-release',
}
