import type { WorkspaceRegistration } from '@connectio/product-model'

/**
 * Workspace registration for the Trace Investigation workspace.
 *
 * @remarks
 * This workspace supports multi-scope investigation: users can enter at batch,
 * material, plant, process-order, or global scope. The `requiredLevel` is
 * deliberately absent so the workspace activates without a pre-selected batch —
 * the investigationId in the URL provides primary context instead.
 *
 * Owner domain: traceability. Telemetry area: quality-food-safety / traceability.
 */
export const traceInvestigationRegistration: WorkspaceRegistration = {
  workspaceId: 'trace-investigation',
  displayName: 'Trace Investigation',
  description:
    'Unified workspace for investigating batch traceability, supplier exposure, customer impact, and recall readiness.',
  domainId: 'traceability',
  ownerDomain: 'traceability',
  lifecycle: 'live',
  supportedRoles: [
    'quality-lead',
    'food-safety-lead',
    'traceability-analyst',
    'plant-manager',
    'operations-supervisor',
  ],
  requiredPermissions: [
    {
      permissionId: 'trace.read',
      displayName: 'Trace Read',
      description: 'Permission to view trace investigation data',
    },
  ],
  supportedScopes: ['plant', 'region', 'global', 'material', 'batch', 'process-order'],
  scopePolicy: {
    supportedLevels: ['plant', 'region', 'global', 'material', 'batch', 'process-order'],
    defaultLevel: 'batch',
    autoElevate: true,
  },
  defaultViews: [
    {
      viewId: 'overview',
      displayName: 'Overview',
      lifecycle: 'live',
      sortOrder: 0,
      defaultPanels: [
        { panelId: 'batch-header', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'risk-signals', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'trace-graph', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'customer-impact', defaultVisible: true, defaultOrder: 3 },
        { panelId: 'coa-release-status', defaultVisible: true, defaultOrder: 4 },
        { panelId: 'event-timeline', defaultVisible: true, defaultOrder: 5 },
      ],
    },
    {
      viewId: 'network-overview',
      displayName: 'Investigation Overview (Network)',
      lifecycle: 'pilot',
      sortOrder: 1,
      defaultPanels: [
        { panelId: 'batch-header-network', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'customer-exposure-network', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'trace-graph-network', defaultVisible: true, defaultOrder: 2 },
      ],
    },
    {
      viewId: 'trace-tree',
      displayName: 'Trace Tree',
      lifecycle: 'live',
      sortOrder: 2,
      defaultPanels: [
        { panelId: 'trace-graph', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'batch-header', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'risk-signals', defaultVisible: true, defaultOrder: 2 },
      ],
    },
    {
      viewId: 'trace-genie-pilot',
      displayName: 'Trace Assistant Pilot',
      lifecycle: 'pilot',
      sortOrder: 3,
      defaultPanels: [
        { panelId: 'trace-genie-pilot', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'trace-graph', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'batch-header', defaultVisible: true, defaultOrder: 2 },
      ],
    },
    {
      viewId: 'mass-balance',
      displayName: 'Mass Balance',
      lifecycle: 'live',
      sortOrder: 4,
      defaultPanels: [
        { panelId: 'batch-header', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'trace-graph', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'risk-signals', defaultVisible: true, defaultOrder: 2 },
      ],
    },
    {
      viewId: 'customer-exposure',
      displayName: 'Customer Exposure',
      lifecycle: 'live',
      sortOrder: 5,
      defaultPanels: [
        { panelId: 'customer-impact', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'trace-graph', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'event-timeline', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'risk-signals', defaultVisible: true, defaultOrder: 3 },
      ],
    },
    {
      viewId: 'supplier-exposure',
      displayName: 'Supplier Exposure',
      lifecycle: 'live',
      sortOrder: 6,
      defaultPanels: [
        { panelId: 'material-supplier-exposure', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'trace-graph', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'related-investigations', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'risk-signals', defaultVisible: true, defaultOrder: 3 },
      ],
    },
    {
      viewId: 'timeline-events',
      displayName: 'Timeline & Events',
      lifecycle: 'live',
      sortOrder: 7,
      defaultPanels: [
        { panelId: 'event-timeline', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'related-investigations', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'coa-release-status', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'risk-signals', defaultVisible: true, defaultOrder: 3 },
      ],
    },
    {
      viewId: 'recall-readiness',
      displayName: 'Recall Readiness',
      lifecycle: 'live',
      sortOrder: 8,
      defaultPanels: [
        { panelId: 'risk-signals', defaultVisible: true, defaultOrder: 0 },
        { panelId: 'customer-impact', defaultVisible: true, defaultOrder: 1 },
        { panelId: 'coa-release-status', defaultVisible: true, defaultOrder: 2 },
        { panelId: 'related-investigations', defaultVisible: true, defaultOrder: 3 },
        { panelId: 'event-timeline', defaultVisible: true, defaultOrder: 4 },
      ],
    },
  ],
  defaultPanels: [
    { panelId: 'batch-header', defaultVisible: true, defaultOrder: 0 },
    { panelId: 'trace-graph', defaultVisible: true, defaultOrder: 1 },
    { panelId: 'trace-genie-pilot', defaultVisible: true, defaultOrder: 2 },
    { panelId: 'material-supplier-exposure', defaultVisible: true, defaultOrder: 3 },
    { panelId: 'customer-impact', defaultVisible: true, defaultOrder: 4 },
    { panelId: 'event-timeline', defaultVisible: true, defaultOrder: 5 },
    { panelId: 'coa-release-status', defaultVisible: true, defaultOrder: 6 },
    { panelId: 'related-investigations', defaultVisible: true, defaultOrder: 7 },
    { panelId: 'risk-signals', defaultVisible: true, defaultOrder: 8 },
  ],
  route: '/quality/trace-investigation',
  personalizationPolicy: {
    allowPanelReorder: true,
    allowPanelHide: true,
    allowSavedFilters: true,
    allowDefaultScopeOverride: false,
    maxPinnedPanels: 6,
  },
  drillThroughDefinitions: [
    {
      label: 'Open in Trace2',
      targetWorkspaceId: 'traceability-workspace',
      targetViewId: 'trace',
      contextScopes: ['batch', 'plant'],
    },
  ],
  telemetryId: 'quality-food-safety.trace-investigation',
}
