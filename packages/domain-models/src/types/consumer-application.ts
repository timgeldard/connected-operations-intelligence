import type { LifecycleState } from './lifecycle.js'

/** Where a consumer app experience originated before being assembled here. */
export type ConsumerAppDesignSource =
  | 'claude-design'
  | 'in-repo-design'
  | 'existing-workspace'

/** How tightly the designed experience is wired to governed data today. */
export type ConsumerAppDataBinding =
  | 'static-poc'
  | 'mock-contracts'
  | 'api-contracts'
  | 'governed-live-data'

/** How the designed app is mounted into the ConnectIO shell. */
export type ConsumerAppAssemblyMode =
  | 'standalone-designed-app'
  | 'workspace-view'
  | 'panel-composition'

/** Shell treatment required by the designed app. */
export type ConsumerAppShellPresentation =
  | 'standard'
  | 'fullscreen'

/** App-experience maturity for consumer-grade applications. */
export type ApplicationExperienceMaturity =
  | 'A0'
  | 'A1'
  | 'A2'
  | 'A3'
  | 'A4'
  | 'A5'
  | 'A6'

/** Data-product maturity backing a consumer application. */
export type DataProductMaturity =
  | 'D0'
  | 'D1'
  | 'D2'
  | 'D3'
  | 'D4'
  | 'D5'
  | 'D6'

/** Registration metadata for a designed consumer application experience. */
export interface ConsumerApplicationRegistration {
  /** Stable app id; usually the same as the mounted workspace id. */
  readonly appId: string
  /** Human-readable application name. */
  readonly displayName: string
  /** Primary user or role the designed experience serves. */
  readonly primaryUser: string
  /** User job-to-be-done, stated in product language. */
  readonly jobToBeDone: string
  /** Source of the visual/interaction design being consolidated. */
  readonly designSource: ConsumerAppDesignSource
  /** Current mount style inside the shell. */
  readonly assemblyMode: ConsumerAppAssemblyMode
  /** Whether the app uses normal workspace chrome or owns the full canvas. */
  readonly shellPresentation: ConsumerAppShellPresentation
  /** Workspace id that hosts this app, when mounted. */
  readonly workspaceId: string
  /** Product lifecycle of the assembled app. */
  readonly lifecycle: LifecycleState
  /** Current app-experience maturity. */
  readonly appMaturity: ApplicationExperienceMaturity
  /** Current maturity of the data products backing the app. */
  readonly dataMaturity: DataProductMaturity
  /** Current data-binding level. */
  readonly dataBinding: ConsumerAppDataBinding
  /** Visible caveats the app must surface while data/product maturity catches up. */
  readonly requiredCaveats: readonly string[]
  /** Optional links or paths for source POCs, briefs, screenshots, or design notes. */
  readonly designArtifacts: readonly string[]
}
