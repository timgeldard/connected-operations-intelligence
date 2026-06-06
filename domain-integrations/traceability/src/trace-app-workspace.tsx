import { useState } from 'react'
import { PLANTS, TRACE_APP_TABS, type PlantDescriptor, type TraceAppTabId } from './trace-app/plants.js'
import { TraceAppTopBar } from './trace-app/TraceAppTopBar.js'
import { TraceAppLanding } from './trace-app/TraceAppLanding.js'
import { TraceAppBatchHeader } from './trace-app/TraceAppBatchHeader.js'
import { TraceAppInvestigationTab } from './trace-app/TraceAppInvestigationTab.js'
import { TraceAppStubTab, getStubConfig } from './trace-app/TraceAppStubTab.js'
import { QualityPassportPanel } from './trace-app/QualityPassportPanel.js'
import { MassBalancePanel } from './trace-app/MassBalancePanel.js'
import { TimelinePanel } from './trace-app/TimelinePanel.js'
import { RecallPanel } from './trace-app/RecallPanel.js'
import { HoldsPanel } from './trace-app/HoldsPanel.js'
import { SuppliersPanel } from './trace-app/SuppliersPanel.js'
import { useBatchHeaderSummary } from './adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from './adapters/trace2-adapter.js'

export interface TraceAppWorkspaceProps {
  /**
   * Optional pre-resolved investigation context. Reserved for deep-link URLs
   * (?workspace=trace&materialId=...&batchId=...&plantId=...) — not wired in
   * slice 1; users land on the Landing search.
   */
  readonly initialRequest?: { materialId: string; batchId: string; plantId: string }
}

interface ResolvedRequest {
  readonly materialId: string
  readonly batchId: string
  readonly plantId: string
}

/**
 * Standalone Trace App workspace.
 *
 * @remarks
 * Self-contained search-driven traceability surface. Renders its own top bar,
 * plant picker, landing page, sticky batch-header tab strip, and per-tab
 * content panels. Distinct from the panel-grid Trace Investigation workspace
 * (`trace-investigation`). Mounted at ?workspace=trace.
 *
 * Slice 1: Investigation tab is live (existing hooks). The other 6 tabs are
 * stubs pending the new gold views called out in INTEGRATION.md (v2).
 */
export function TraceAppWorkspace({ initialRequest }: TraceAppWorkspaceProps) {
  const [activePlant, setActivePlant] = useState<PlantDescriptor>(PLANTS[0]!)
  const [query, setQuery] = useState('')
  const [request, setRequest] = useState<ResolvedRequest | null>(initialRequest ?? null)
  const [tab, setTab] = useState<TraceAppTabId>('investigation')

  const adapterRequest: Trace2AdapterRequest | null = request
    ? {
        materialId: request.materialId,
        batchId: request.batchId,
        plantId: request.plantId,
      }
    : null

  // Drive the batch header strip from the same hook the Investigation tab uses.
  const batchHeaderQuery = useBatchHeaderSummary(adapterRequest ?? { materialId: '', batchId: '', plantId: '' }, {
    enabled: request !== null,
  })
  const batchHeader = batchHeaderQuery.data?.ok ? batchHeaderQuery.data.data : null
  const batchHeaderError =
    batchHeaderQuery.data !== undefined &&
    !batchHeaderQuery.data.ok &&
    batchHeaderQuery.data.error.code === 'not-found'

  function handleSearch(resolved: ResolvedRequest) {
    setRequest(resolved)
    setTab('investigation')
    window.scrollTo({ top: 0 })
  }

  function handleBack() {
    setRequest(null)
    setQuery('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TraceAppTopBar
        activePlant={activePlant}
        onChangePlant={setActivePlant}
        query={query}
        onChangeQuery={setQuery}
        onSubmitQuery={() => {
          // Free-text search is deferred — the landing form's 3 fields are the entry
          // point. Pressing Enter in the top-bar search box is a no-op for slice 1.
        }}
        showSearch={request !== null}
      />

      {request === null && <TraceAppLanding onSearch={handleSearch} />}

      {request !== null && adapterRequest !== null && (
        <>
          <TraceAppBatchHeader
            batch={batchHeader}
            request={request}
            activeTab={tab}
            onTabChange={setTab}
            onBack={handleBack}
          />

          <div style={{ flex: 1, background: 'var(--shell-surface, #FAFAF6)' }}>
            {batchHeaderError ? (
              <InvalidCombinationBanner request={request} />
            ) : (
              <TabContent tab={tab} request={adapterRequest} onNavigateTab={setTab} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

function TabContent({
  tab,
  request,
  onNavigateTab,
}: {
  tab: TraceAppTabId
  request: Trace2AdapterRequest
  onNavigateTab: (tab: TraceAppTabId) => void
}) {
  if (tab === 'investigation') return <TraceAppInvestigationTab request={request} />
  if (tab === 'passport') {
    return (
      <div style={{ padding: 20 }}>
        <QualityPassportPanel
          request={request}
          audienceMode="internal"
          onNavigateTab={(target) => onNavigateTab(target)}
        />
      </div>
    )
  }
  if (tab === 'mass-balance') {
    return (
      <div style={{ padding: 20 }}>
        <MassBalancePanel request={request} />
      </div>
    )
  }
  if (tab === 'timeline') {
    return (
      <div style={{ padding: 20 }}>
        <TimelinePanel request={request} />
      </div>
    )
  }
  if (tab === 'recall') {
    return (
      <div style={{ padding: 20 }}>
        <RecallPanel request={request} />
      </div>
    )
  }
  if (tab === 'holds') {
    return (
      <div style={{ padding: 20 }}>
        <HoldsPanel request={request} />
      </div>
    )
  }
  if (tab === 'suppliers') {
    return (
      <div style={{ padding: 20 }}>
        <SuppliersPanel request={request} />
      </div>
    )
  }
  const config = getStubConfig(tab)
  return (
    <TraceAppStubTab
      tabId={tab}
      title={config.title}
      description={config.description}
      checklist={config.checklist}
    />
  )
}

function InvalidCombinationBanner({ request }: { request: ResolvedRequest }) {
  return (
    <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
      <div
        role="alert"
        style={{
          maxWidth: 720,
          width: '100%',
          padding: 20,
          borderRadius: 8,
          border: '2px solid var(--sunset, #F24A00)',
          background: 'rgba(242, 74, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--sunset, #F24A00)',
          }}
        >
          No batch record found for this combination
        </p>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-2)' }}>
          The supplied material / batch / plant combination did not resolve to a batch in the
          primary source. All tabs are suppressed to avoid showing lineage data that does not
          correspond to the entered context. The same batch may exist in a different plant —
          go back and verify.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '4px 12px',
            fontSize: 12,
            fontFamily: 'monospace',
            color: 'var(--forest, #143700)',
            paddingTop: 4,
          }}
        >
          <span style={{ color: 'var(--shell-fg-2)' }}>Material:</span>
          <span>{request.materialId || '(blank)'}</span>
          <span style={{ color: 'var(--shell-fg-2)' }}>Batch:</span>
          <span>{request.batchId || '(blank)'}</span>
          <span style={{ color: 'var(--shell-fg-2)' }}>Plant:</span>
          <span>{request.plantId || '(blank)'}</span>
        </div>
      </div>
    </div>
  )
}

// Re-export for any consumer needing the tab list at the workspace surface
export { TRACE_APP_TABS }
