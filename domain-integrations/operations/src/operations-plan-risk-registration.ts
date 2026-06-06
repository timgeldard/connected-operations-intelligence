import type { WorkspaceRegistration } from '@connectio/product-model'

/**
 * Workspace registration for the Operations Plan Risk workspace.
 *
 * @remarks
 * Phase 3 cross-domain workspace proving the V2 cockpit composition model.
 * Aggregates evidence from operations, warehouse, quality, and maintenance
 * domain integrations into a single plant-level risk view.
 *
 * Seven views cover the full operations supervisor workflow from overall plan
 * health through critical blockers, material staging, quality holds, line
 * resource risk, schedule adherence, and shift handover.
 *
 * Owner domain: operations. Telemetry area: operations.plan-risk.
 */
export const operationsPlanRiskRegistration: WorkspaceRegistration = {
  workspaceId: 'operations-plan-risk',
  displayName: 'Operations Plan Risk',
  description:
    'Cross-domain workspace for monitoring daily production plan risk. Aggregates operations, warehouse staging, quality blockers, and maintenance constraints into a unified plant-level risk cockpit.',
  domainId: 'operations',
  ownerDomain: 'operations',
  lifecycle: 'live',
  supportedRoles: [
    'operations-supervisor',
    'production-planner',
    'plant-manager',
    'shift-lead',
    'logistics-lead',
    'quality-lead',
  ],
  requiredPermissions: [
    {
      permissionId: 'operations.plan.read',
      displayName: 'Operations Plan Read',
      description: 'Permission to view plan risk summaries, line status, and schedule adherence data',
    },
    {
      permissionId: 'operations.actions.write',
      displayName: 'Operations Actions Write',
      description: 'Permission to submit escalations, staging requests, and handover notes',
    },
  ],
  supportedScopes: ['plant', 'line', 'process-order'],
  scopePolicy: {
    supportedLevels: ['plant', 'line', 'process-order'],
    defaultLevel: 'plant',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'plan-overview',
      displayName: 'Plan Overview',
      lifecycle: 'live',
      sortOrder: 0,
      defaultPanels: [
        { panelId: 'plan-risk-summary', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'late-orders', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'material-shortage', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'quality-blockers', defaultVisible: true, defaultOrder: 3 },
        { panelId: 'warehouse-staging-status', defaultVisible: true, defaultOrder: 4 },
        { panelId: 'line-status', defaultVisible: true, defaultOrder: 5 },
        { panelId: 'operations-action-queue', defaultVisible: true, defaultOrder: 6 },
      ],
    },
    {
      viewId: 'critical-blockers',
      displayName: 'Critical Blockers',
      lifecycle: 'live',
      sortOrder: 1,
      defaultPanels: [
        { panelId: 'plan-risk-summary', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'quality-blockers', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'release-hold-impact', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'material-shortage', defaultVisible: true, defaultOrder: 3 },
        { panelId: 'maintenance-constraint', defaultVisible: true, defaultOrder: 4 },
        { panelId: 'operations-action-queue', defaultVisible: true, defaultOrder: 5 },
      ],
    },
    {
      viewId: 'material-staging-risk',
      displayName: 'Material & Staging',
      lifecycle: 'live',
      sortOrder: 2,
      defaultPanels: [
        { panelId: 'material-shortage', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'warehouse-staging-status', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'late-orders', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'operations-action-queue', defaultVisible: true, defaultOrder: 3 },
      ],
    },
    {
      viewId: 'quality-release-blockers',
      displayName: 'Quality Blockers',
      lifecycle: 'live',
      sortOrder: 3,
      defaultPanels: [
        { panelId: 'quality-blockers', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'release-hold-impact', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'operations-action-queue', defaultVisible: true, defaultOrder: 2 },
      ],
    },
    {
      viewId: 'line-resource-risk',
      displayName: 'Line & Resources',
      lifecycle: 'live',
      sortOrder: 4,
      defaultPanels: [
        { panelId: 'line-status', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'maintenance-constraint', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'yield-variance', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'schedule-adherence', defaultVisible: true, defaultOrder: 3 },
        { panelId: 'late-orders', defaultVisible: true, defaultOrder: 4 },
      ],
    },
    {
      viewId: 'schedule-adherence',
      displayName: 'Schedule Adherence',
      lifecycle: 'live',
      sortOrder: 5,
      defaultPanels: [
        { panelId: 'schedule-adherence', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'late-orders', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'yield-variance', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'material-shortage', defaultVisible: true, defaultOrder: 3 },
        { panelId: 'quality-blockers', defaultVisible: true, defaultOrder: 4 },
      ],
    },
    {
      viewId: 'handover-actions',
      displayName: 'Handover & Actions',
      lifecycle: 'live',
      sortOrder: 6,
      defaultPanels: [
        { panelId: 'shift-handover', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'operations-action-queue', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'quality-blockers', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'maintenance-constraint', defaultVisible: true, defaultOrder: 3 },
      ],
    },
  ],
  defaultPanels: [
    { panelId: 'plan-risk-summary', defaultVisible: true, defaultOrder: 0 },
    { panelId: 'late-orders', defaultVisible: true, defaultOrder: 1 },
    { panelId: 'material-shortage', defaultVisible: true, defaultOrder: 2 },
    { panelId: 'quality-blockers', defaultVisible: true, defaultOrder: 3 },
    { panelId: 'warehouse-staging-status', defaultVisible: true, defaultOrder: 4 },
    { panelId: 'line-status', defaultVisible: true, defaultOrder: 5 },
    { panelId: 'operations-action-queue', defaultVisible: true, defaultOrder: 6 },
    { panelId: 'release-hold-impact', defaultVisible: true, defaultOrder: 7 },
    { panelId: 'maintenance-constraint', defaultVisible: true, defaultOrder: 8 },
    { panelId: 'yield-variance', defaultVisible: true, defaultOrder: 9 },
    { panelId: 'schedule-adherence', defaultVisible: true, defaultOrder: 10 },
    { panelId: 'shift-handover', defaultVisible: true, defaultOrder: 11 },
  ],
  route: '/operations/plan-risk',
  personalizationPolicy: {
    allowPanelReorder: true,
    allowPanelHide: true,
    allowSavedFilters: true,
    allowDefaultScopeOverride: false,
    maxPinnedPanels: 8,
  },
  drillThroughDefinitions: [
    {
      label: 'Open Quality Batch Release',
      targetWorkspaceId: 'quality-batch-release',
      targetViewId: 'batch-decision',
      contextScopes: ['batch', 'plant'],
    },
    {
      label: 'Open Trace Investigation',
      targetWorkspaceId: 'trace-investigation',
      targetViewId: 'overview',
      contextScopes: ['batch', 'plant'],
    },
  ],
  telemetryId: 'operations.plan-risk',
}
