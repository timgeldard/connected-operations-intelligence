import type { ConsumerApplicationRegistration } from '@connectio/product-model'

/**
 * Registry of consumer-grade app experiences being assembled from design POCs.
 *
 * @remarks
 * This is intentionally separate from `workspaceRegistry`: workspaces describe
 * shell navigation, while this registry tracks the product/design consolidation
 * path for Claude Design and other POC-origin applications.
 */
export const consumerAppRegistry: readonly ConsumerApplicationRegistration[] = [
  {
    appId: 'trace-consumer',
    displayName: 'Batch Traceability',
    primaryUser: 'Food Safety Lead',
    jobToBeDone: 'Find a batch, understand lineage/exposure, and package evidence without navigating legacy Trace2 screens.',
    designSource: 'claude-design',
    assemblyMode: 'standalone-designed-app',
    shellPresentation: 'fullscreen',
    workspaceId: 'trace-consumer',
    lifecycle: 'pilot',
    appMaturity: 'A3',
    dataMaturity: 'D3',
    dataBinding: 'api-contracts',
    requiredCaveats: [
      'Surface mock/source mode wherever live data is not available.',
      'Do not label recall or release decisions as governed recommendations.',
      'Make unknown, unavailable, and not-evaluated states explicit.',
    ],
    designArtifacts: [
      'docs/apps/trace-consumer/product-brief.md',
      'domain-integrations/traceability/src/trace-consumer/',
      'docs/product-operating-model/design-drop-in-execution-plan.md',
    ],
  },
  {
    appId: 'connected-quality-lab-board',
    displayName: 'ConnectedQuality Lab Board',
    primaryUser: 'Quality Lab Technician',
    jobToBeDone: 'Monitor open SAP QM failures and warnings on a wallboard-style lab screen.',
    designSource: 'claude-design',
    assemblyMode: 'standalone-designed-app',
    shellPresentation: 'fullscreen',
    workspaceId: 'connected-quality-lab-board',
    lifecycle: 'pilot',
    appMaturity: 'A3',
    dataMaturity: 'D3',
    dataBinding: 'api-contracts',
    requiredCaveats: [
      'Plant and failure data are read through the Connected Quality lab adapter.',
      'Mock adapter mode remains non-live even though the standalone screen is data-wired.',
      'Do not use this standalone wallboard for production release, reject, or hold decisions.',
    ],
    designArtifacts: [
      'docs/assets/connected-quality-standalone.html',
      'domain-integrations/quality/src/lab-board-standalone/',
    ],
  },
  {
    appId: 'warehouse-360-overview',
    displayName: 'Warehouse 360 Cockpit',
    primaryUser: 'Warehouse Supervisor',
    jobToBeDone: 'See operational warehouse status, exceptions, and flow constraints in one cockpit experience.',
    designSource: 'claude-design',
    assemblyMode: 'standalone-designed-app',
    shellPresentation: 'standard',
    workspaceId: 'warehouse-360-overview',
    lifecycle: 'pilot',
    appMaturity: 'A3',
    dataMaturity: 'D2',
    dataBinding: 'api-contracts',
    requiredCaveats: [
      'Differentiate source-backed values from unavailable or governance-pending values.',
      'Do not imply all-clear from empty exception lists unless the source route confirms coverage.',
    ],
    designArtifacts: [
      'domain-integrations/warehouse/src/views/warehouse-cockpit-view.tsx',
      'docs/product-operating-model/design-drop-in-execution-plan.md',
    ],
  },
  {
    appId: 'spc-monitoring',
    displayName: 'SPC Monitoring',
    primaryUser: 'Quality Engineer',
    jobToBeDone: 'Review process behaviour with interactive charts while keeping calculated limits and exclusions visibly caveated.',
    designSource: 'claude-design',
    assemblyMode: 'workspace-view',
    shellPresentation: 'standard',
    workspaceId: 'spc-monitoring',
    lifecycle: 'pilot',
    appMaturity: 'A4',
    dataMaturity: 'D3',
    dataBinding: 'api-contracts',
    requiredCaveats: [
      'Client-calculated control limits must not be presented as governed locked limits.',
      'Manual exclusions are application state until a governed write-back path exists.',
      'Not-evaluated signals must not be collapsed into in-control claims.',
    ],
    designArtifacts: [
      'domain-integrations/spc/src/panels/control-chart-panel.tsx',
      'domain-integrations/spc/src/components/interactive-control-chart.tsx',
    ],
  },
  {
    appId: 'spc-consumer',
    displayName: 'Statistical Process Control (Consumer)',
    primaryUser: 'Quality Lead / Quality Engineer',
    jobToBeDone: 'Check process control states, view interactive chart measurements, exclude outlier subgroups, and get automated context-aware insights on capability metrics.',
    designSource: 'claude-design',
    assemblyMode: 'standalone-designed-app',
    shellPresentation: 'fullscreen',
    workspaceId: 'spc-consumer',
    lifecycle: 'pilot',
    appMaturity: 'A4',
    dataMaturity: 'D3',
    dataBinding: 'api-contracts',
    requiredCaveats: [
      'Client-calculated control limits must not be presented as governed locked limits.',
      'Manual exclusions are application state until a governed write-back path exists.',
    ],
    designArtifacts: [
      'domain-integrations/spc/src/spc-consumer-workspace.tsx',
      'domain-integrations/spc/src/spc-consumer/',
    ],
  },
  {
    appId: 'poh-consumer',
    displayName: 'Process Order History (Consumer)',
    primaryUser: 'Operations Supervisor / Production Manager',
    jobToBeDone: 'Search process orders, view plant-level yield/pour/quality dashboards, and view detailed order timeline and goods movement details.',
    designSource: 'claude-design',
    assemblyMode: 'standalone-designed-app',
    shellPresentation: 'fullscreen',
    workspaceId: 'poh-consumer',
    lifecycle: 'pilot',
    appMaturity: 'A3',
    dataMaturity: 'D3',
    dataBinding: 'api-contracts',
    requiredCaveats: [
      'Fallback to mock data where backend routes are not verified.',
      'Maintain empty fields as null or undefined where source-backed verification is absent.',
    ],
    designArtifacts: [
      'domain-integrations/operations/src/poh-consumer-workspace.tsx',
      'domain-integrations/operations/src/poh-consumer/',
    ],
  },
  {
    appId: 'envmon-consumer',
    displayName: 'Environmental Monitoring (Consumer)',
    primaryUser: 'Environmental Surveillance Coordinator / Quality Lead',
    jobToBeDone: 'Interactively map L4 zones and coordinate-constrained L5 swab points on SVGs, and monitor microbiological status.',
    designSource: 'claude-design',
    assemblyMode: 'standalone-designed-app',
    shellPresentation: 'fullscreen',
    workspaceId: 'envmon-consumer',
    lifecycle: 'pilot',
    appMaturity: 'A3',
    dataMaturity: 'D3',
    dataBinding: 'api-contracts',
    requiredCaveats: [
      'L5 points must be physically/geometrically contained inside their parent L4 zones.',
      'Degrade gracefully to list view when floor plan SVGs are missing.',
    ],
    designArtifacts: [
      'domain-integrations/envmon/src/envmon-consumer-workspace.tsx',
      'domain-integrations/envmon/src/envmon-consumer/',
    ],
  },
]

/** Resolve consumer-app metadata by mounted workspace id. */
export function getConsumerAppForWorkspace(
  workspaceId: string,
): ConsumerApplicationRegistration | undefined {
  return consumerAppRegistry.find(app => app.workspaceId === workspaceId)
}
