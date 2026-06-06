import type { WorkspaceRegistration } from '@connectio/product-model'

/**
 * Workspace registration for the standalone Trace App.
 *
 * @remarks
 * The Trace App is a self-contained, search-driven traceability surface with
 * its own top bar, plant picker, landing page, and sticky batch-header tab
 * strip. It is distinct from the existing Trace Investigation workspace
 * (`trace-investigation`) — that workspace is panel-grid driven and assumes
 * a pre-selected batch scope. The Trace App lets users search-resolve a
 * batch from scratch and inspect it through 7 themed tabs.
 *
 * URL: ?workspace=trace
 *
 * Slice 1 (this registration) ships:
 *  - Investigation tab — live data via existing useBatchHeaderSummary /
 *    useCustomerExposureSummary / useTraceGraph hooks
 *  - Quality Passport / Mass Balance / Timeline / Recall / Holds / Suppliers
 *    tabs — stubbed pending backend gold views (gold_batch_movements,
 *    gold_recall_summary, gold_holds_ledger, gold_supplier_lots, etc.)
 *
 * Lifecycle: pilot until the 6 stub tabs are wired to real sources and
 * end-to-end browser-tested.
 */
export const traceAppRegistration: WorkspaceRegistration = {
  workspaceId: 'trace',
  displayName: 'Trace',
  description:
    'Search-driven batch traceability with lineage, customer exposure, recall readiness, holds, supplier batches, mass balance, and quality passport.',
  domainId: 'traceability',
  ownerDomain: 'traceability',
  lifecycle: 'pilot',
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
  supportedScopes: ['plant', 'region', 'global'],
  scopePolicy: {
    supportedLevels: ['plant', 'region', 'global'],
    defaultLevel: 'plant',
    autoElevate: false,
  },
  defaultViews: [
    {
      viewId: 'trace-app',
      displayName: 'Trace',
      lifecycle: 'pilot',
      sortOrder: 0,
      defaultPanels: [],
    },
  ],
  defaultPanels: [],
  route: '/trace',
  personalizationPolicy: {
    allowPanelReorder: false,
    allowPanelHide: false,
    allowSavedFilters: false,
    allowDefaultScopeOverride: false,
    maxPinnedPanels: 0,
  },
  drillThroughDefinitions: [
    {
      label: 'Open in Trace Investigation',
      targetWorkspaceId: 'trace-investigation',
      targetViewId: 'overview',
      contextScopes: ['batch', 'plant'],
    },
  ],
  telemetryId: 'quality-food-safety.trace-app',
}
