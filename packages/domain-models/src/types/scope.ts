/** A dimension of operational context. */
export type ScopeLevel =
  | 'plant'
  | 'line'
  | 'work-centre'
  | 'region'
  | 'global'
  | 'material'
  | 'batch'
  | 'process-order'
  | 'warehouse'
  | 'storage-location'
  | 'supplier'
  | 'customer'

/** Governs which scope dimensions a workspace requires and supports. */
export interface ScopePolicy {
  /** Scope levels this workspace can be meaningfully rendered at. */
  readonly supportedLevels: readonly ScopeLevel[]
  /** Minimum scope level required; workspace is unavailable without it. */
  readonly requiredLevel?: ScopeLevel
  /** Default scope level when the user has multiple authorised options. */
  readonly defaultLevel: ScopeLevel
  /** When true, workspace adapts to the user's broadest authorised scope. */
  readonly autoElevate: boolean
}
