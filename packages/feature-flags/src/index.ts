import type { LifecycleState } from '@connectio/product-model'

/** A map of flag name → enabled boolean, injectable at runtime. */
export type FeatureFlagRegistry = Record<string, boolean>

let registry: FeatureFlagRegistry = {}

/** Replace the active flag registry (called once on app init from manifest). */
export function setFeatureFlags(flags: FeatureFlagRegistry): void {
  registry = { ...flags }
}

function envBool(envVar: string, defaultVal: boolean): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const val = import.meta.env[envVar]
    if (val !== undefined) {
      return val === 'true' || (val as unknown) === true
    }
  }
  // Fallback to process.env for Node/testing without requiring Node globals
  // in browser-oriented package tsconfigs.
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  if (processEnv) {
    const val = processEnv[envVar]
    if (val !== undefined) {
      return val === 'true' || (val as unknown) === true
    }
  }
  return defaultVal
}

function getFlag(key: string, envVar: string, defaultVal: boolean): boolean {
  if (registry[key] !== undefined) {
    return registry[key]
  }
  return envBool(envVar, defaultVal)
}

/** Centralized feature flags registry configuration. */
export const featureFlags = {
  traceability: {
    get workspace() { return getFlag('traceability.workspace', 'VITE_FEATURE_TRACEABILITY_WORKSPACE', true) },
    get uatCandidates() { return getFlag('traceability.uatCandidates', 'VITE_FEATURE_TRACEABILITY_UAT_CANDIDATES', true) },
    get copyEvidence() { return getFlag('traceability.copyEvidence', 'VITE_FEATURE_TRACEABILITY_COPY_EVIDENCE', true) },
    get sourceDiagnostics() { return getFlag('traceability.sourceDiagnostics', 'VITE_FEATURE_TRACEABILITY_SOURCE_DIAGNOSTICS', true) },
    get customerExposurePanel() { return getFlag('traceability.customerExposurePanel', 'VITE_FEATURE_TRACE_CUSTOMER_EXPOSURE_PANEL', true) },
    get qualityDecisionPanel() { return getFlag('traceability.qualityDecisionPanel', 'VITE_FEATURE_TRACE_QUALITY_DECISION_PANEL', true) },
    get initialState() { return getFlag('traceability.initialState', 'VITE_FEATURE_TRACEABILITY_INITIAL_STATE', true) },
    get databricksApi() { return getFlag('traceability.databricksApi', 'VITE_FEATURE_TRACEABILITY_DATABRICKS_API', true) },
    get legacyApi() { return getFlag('traceability.legacyApi', 'VITE_FEATURE_TRACEABILITY_LEGACY_API', true) },
  },
  poh: {
    get workspace() { return getFlag('poh.workspace', 'VITE_FEATURE_POH_WORKSPACE', true) },
    get databricksApi() { return getFlag('poh.databricksApi', 'VITE_FEATURE_POH_DATABRICKS_API', true) },
    get uatCandidates() { return getFlag('poh.uatCandidates', 'VITE_FEATURE_POH_UAT_CANDIDATES', true) },
    get copyEvidence() { return getFlag('poh.copyEvidence', 'VITE_FEATURE_POH_COPY_EVIDENCE', true) },
  },
  spc: {
    get workspace() { return getFlag('spc.workspace', 'VITE_FEATURE_SPC_WORKSPACE', true) },
    get liveSources() { return getFlag('spc.liveSources', 'VITE_FEATURE_SPC_LIVE_SOURCES', false) },
    get sandboxUat() { return getFlag('spc.sandboxUat', 'VITE_FEATURE_SPC_SANDBOX_UAT', true) },
  },
  quality: {
    get workspace() { return getFlag('quality.workspace', 'VITE_FEATURE_QUALITY_WORKSPACE', true) },
    get releaseActions() { return getFlag('quality.releaseActions', 'VITE_FEATURE_QUALITY_RELEASE_ACTIONS', false) },
    get simulatedReleasePanels() { return getFlag('quality.simulatedReleasePanels', 'VITE_FEATURE_QUALITY_SIMULATION', true) },
    get liveSources() { return getFlag('quality.liveSources', 'VITE_FEATURE_QUALITY_LIVE_SOURCES', false) },
  },
  warehouse: {
    get workspace() { return getFlag('warehouse.workspace', 'VITE_FEATURE_WAREHOUSE_WORKSPACE', true) },
    get databricksApi() { return getFlag('warehouse.databricksApi', 'VITE_FEATURE_WAREHOUSE_DATABRICKS_API', true) },
    get exceptionGuidance() { return getFlag('warehouse.exceptionGuidance', 'VITE_FEATURE_WAREHOUSE_EXCEPTION_GUIDANCE', true) },
    get postingActions() { return getFlag('warehouse.postingActions', 'VITE_FEATURE_WAREHOUSE_POSTING_ACTIONS', false) },
  },
  writeBack: {
    get sapWriteBack() { return getFlag('writeBack.sapWriteBack', 'VITE_FEATURE_SAP_WRITE_BACK', false) },
    get qualityReleaseAction() { return getFlag('writeBack.qualityReleaseAction', 'VITE_FEATURE_QUALITY_RELEASE_ACTION', false) },
    get warehousePostingAction() { return getFlag('writeBack.warehousePostingAction', 'VITE_FEATURE_WAREHOUSE_POSTING_ACTION', false) },
    get orderConfirmationAction() { return getFlag('writeBack.orderConfirmationAction', 'VITE_FEATURE_ORDER_CONFIRMATION_ACTION', false) },
    get goodsMovementPosting() { return getFlag('writeBack.goodsMovementPosting', 'VITE_FEATURE_GOODS_MOVEMENT_POSTING', false) },
    get electronicSignature() { return getFlag('writeBack.electronicSignature', 'VITE_FEATURE_ELECTRONIC_SIGNATURE', false) },
  },
  runtime: {
    get enableCrossDomainContext() { return getFlag('runtime.enableCrossDomainContext', 'VITE_FEATURE_ENABLE_CROSS_DOMAIN_CONTEXT', false) },
  },
  databricks: {
    get useProductionCatalog() { return getFlag('databricks.useProductionCatalog', 'VITE_FEATURE_DATABRICKS_USE_PROD_CATALOG', false) },
  },
}

/** Map workspaceId to the corresponding workspace feature flag status. */
export function isWorkspaceFlagEnabled(workspaceId: string): boolean {
  switch (workspaceId) {
    case 'trace-investigation':
      return featureFlags.traceability.workspace
    case 'process-order-review':
      return featureFlags.poh.workspace
    case 'spc-monitoring':
      return featureFlags.spc.workspace
    case 'warehouse-360-overview':
      return featureFlags.warehouse.workspace
    case 'quality-batch-release':
      return featureFlags.quality.workspace
    default:
      return true
  }
}

/** Check whether a named feature flag is enabled. */
export function isFlagEnabled(flag: string): boolean {
  if (registry[flag] !== undefined) {
    return registry[flag]
  }
  const envVarName = flag.startsWith('VITE_') ? flag : `VITE_FEATURE_${flag.replace(/([A-Z])/g, '_$1').toUpperCase()}`
  return envBool(envVarName, false)
}

/**
 * Returns true when the lifecycle state is navigable given current flags.
 * Pilot workspaces are only visible when the 'pilot-access' flag is set.
 */
export function isLifecycleEnabled(lifecycle: LifecycleState): boolean {
  switch (lifecycle) {
    case 'live':
      return true
    case 'pilot':
      return isFlagEnabled('pilot-access')
    case 'concept-lab':
      return isFlagEnabled('concept-lab-access')
    case 'deprecated':
    case 'hidden':
      return false
  }
}
