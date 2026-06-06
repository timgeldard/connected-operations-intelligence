import type { WorkspaceRegistration } from '@connectio/product-model'
import { traceInvestigationRegistration, traceAppRegistration, traceConsumerRegistration } from '@connectio/di-traceability'
import { batchReleaseRegistration, connectedQualityLabBoardStandaloneRegistration } from '@connectio/di-quality'
import { operationsPlanRiskRegistration, processOrderReviewRegistration, pohConsumerRegistration } from '@connectio/di-operations'
import { envmonRegistration, envmonConsumerRegistration } from '@connectio/di-envmon'
import { productionStagingRegistration } from '@connectio/di-warehouse'
import { spcMonitoringRegistration, spcConsumerRegistration } from '@connectio/di-spc'
import { warehouse360Registration } from '@connectio/di-warehouse'
import { maintenanceReliabilityRegistration } from '@connectio/di-maintenance'

/**
 * Static workspace registry — Phase 1–4 implementations.
 *
 * Live workspaces are marked `lifecycle: 'live'` and appear in the nav rail
 * and home screen by default. Phase 0 stubs remain `concept-lab` so they are
 * hidden unless explicitly enabled.
 *
 * Domain-integration packages own their registrations; this file imports and
 * assembles them rather than duplicating the registration data.
 */
export const workspaceRegistry: readonly WorkspaceRegistration[] = [
  // Phase 1 — Trace Investigation (fully implemented)
  traceInvestigationRegistration,

  // Phase 5 — Trace App (search-driven standalone, pilot)
  traceAppRegistration,

  // Consumer Grade Standalone Trace
  traceConsumerRegistration,

  // Phase 2 — Quality Batch Release (cross-domain, fully implemented)
  batchReleaseRegistration,

  // Claude Design export — standalone ConnectedQuality Lab Board
  connectedQualityLabBoardStandaloneRegistration,

  // Phase 3 — Operations Plan Risk (cross-domain, fully implemented)
  operationsPlanRiskRegistration,

  // Phase 4 — Environmental Monitoring (fully implemented)
  envmonRegistration,

  // Environmental Monitoring Consumer (pilot)
  envmonConsumerRegistration,

  // Phase 4 — Production Staging (fully implemented)
  productionStagingRegistration,

  // Phase 5 — SPC Monitoring (pilot)
  spcMonitoringRegistration,

  // SPC Consumer (pilot)
  spcConsumerRegistration,

  // Phase 5 — Process Order Review (pilot)
  processOrderReviewRegistration,

  // Consumer Process Order History (pilot)
  pohConsumerRegistration,

  // Phase 5 — Warehouse 360 Overview (pilot)
  warehouse360Registration,

  // Phase 5 — Maintenance & Reliability (pilot)
  maintenanceReliabilityRegistration,

  // Phase 0 stubs — kept for traceability workspace backwards compatibility
  {
    workspaceId: 'traceability-workspace',
    displayName: 'Traceability',
    description: 'Traceability workspace — Phase 0 stub (superseded by Trace Investigation)',
    domainId: 'traceability',
    ownerDomain: 'traceability',
    lifecycle: 'concept-lab',
    supportedRoles: [],
    requiredPermissions: [],
    supportedScopes: ['batch'],
    scopePolicy: {
      supportedLevels: ['batch'],
      defaultLevel: 'batch',
      autoElevate: false,
    },
    defaultViews: [
      { viewId: 'trace', displayName: 'Trace', lifecycle: 'concept-lab', sortOrder: 0, defaultPanels: [] },
      { viewId: 'lineage', displayName: 'Lineage', lifecycle: 'concept-lab', sortOrder: 1, defaultPanels: [] },
    ],
    defaultPanels: [],
    route: '/traceability',
    personalizationPolicy: {
      allowPanelReorder: false,
      allowPanelHide: false,
      allowSavedFilters: false,
      allowDefaultScopeOverride: false,
    },
    drillThroughDefinitions: [],
    telemetryId: 'traceability.workspace',
  },
  {
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
      { viewId: 'overview', displayName: 'Overview', lifecycle: 'concept-lab', sortOrder: 0, defaultPanels: [] },
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
  },
  {
    workspaceId: 'operations-workspace',
    displayName: 'Operations',
    description: 'Operations workspace — Phase 0 stub',
    domainId: 'operations',
    ownerDomain: 'operations',
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
      { viewId: 'overview', displayName: 'Overview', lifecycle: 'concept-lab', sortOrder: 0, defaultPanels: [] },
    ],
    defaultPanels: [],
    route: '/operations',
    personalizationPolicy: {
      allowPanelReorder: false,
      allowPanelHide: false,
      allowSavedFilters: false,
      allowDefaultScopeOverride: false,
    },
    drillThroughDefinitions: [],
    telemetryId: 'operations.workspace',
  },
]
