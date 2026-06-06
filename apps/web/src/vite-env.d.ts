/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Adapter mode — controls which source adapter is used for all domains.
   *  'mock'        — return fixture data (default, no backend required)
   *  'legacy-api'  — call V1 APIs via V2 proxy routes
   */
  readonly VITE_ADAPTER_MODE?: 'mock' | 'legacy-api' | 'databricks-api'

  /** Base URL for the V2 API proxy (e.g. http://localhost:8000).
   *  Required when VITE_ADAPTER_MODE=legacy-api.
   */
  readonly VITE_TRACE_API_BASE_URL?: string

  /** Base URL for the Warehouse 360 proxy (future). */
  readonly VITE_WH360_API_BASE_URL?: string

  /** Base URL for the Process Order History proxy (future). */
  readonly VITE_POH_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
