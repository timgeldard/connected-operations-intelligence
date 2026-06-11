/**
 * @connectio/di-wm-operations
 *
 * Domain integration package for the WM Operations workspace — read-only
 * warehouse/plant manager tools over the SAP WM staging and dispensary process
 * (WMA-E-19 WM Cockpit, WMA-E-50 staging with TR split, WMA-E-28 / PEX-E-61
 * dispensary), styled with the Kerry Design System (2024 brand).
 */

export { wmOperationsRegistration } from './wm-operations-registration.js'
export { WmOperationsWorkspace } from './wm-operations-workspace.js'
export type { WmOperationsWorkspaceProps, WmOperationsViewId } from './wm-operations-workspace.js'

export { WmOperationsAdapter, wmOperationsAdapter } from './adapters/wm-operations-adapter.js'
export type {
  WmOperationsAdapterRequest,
  WmOperationsAdapterOptions,
  WmWorklistItem,
  WmWorklistSummaryItem,
  WmOrderReadinessItem,
  WmBinStockItem,
  WmWorkArea,
  WmWorklistStatus,
  WmStorageZone,
} from './adapters/wm-operations-adapter.js'

export {
  useWmWorklist,
  useWmWorklistSummary,
  useWmOrderReadiness,
  useWmBinStock,
} from './adapters/wm-operations-queries.js'
