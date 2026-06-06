import {
  VerificationStatusBanner,
  SourceConfidenceStrip,
  type ExtendedSourceMode,
  type EvidenceStatus,
} from '@connectio/design-system'
import type { CSSProperties } from 'react'
import { SPCSummaryPanel } from '../panels/spc-summary-panel.js'
import { ActiveSPCSignalsPanel } from '../panels/active-spc-signals-panel.js'
import { ControlChartPanel } from '../panels/control-chart-panel.js'
import { SPCEvidenceSummaryPanel } from '../panels/spc-evidence-summary-panel.js'
import { useMonitoredCharacteristics, useSPCSummary, useActiveSPCSignals } from '../adapters/spc-monitoring-queries.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'
import type { AdapterResult } from '@connectio/source-adapters'

const HEADER_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
}

const CHART_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  alignItems: 'start',
}

export interface ChartOverviewViewProps {
  readonly request: SPCMonitoringAdapterRequest
}

function resolveEvidenceStatus(result: AdapterResult<unknown> | undefined): EvidenceStatus {
  if (!result) return 'pending-validation'
  if (!result.ok) {
    if (result.error?.code === 'unauthorized') return 'permission-denied'
    if (result.error?.code === 'timeout') return 'timed-out'
    return 'error'
  }
  
  if (result.source === 'mock') return 'mock-only'
  return 'loaded'
}

export function ChartOverviewView({ request }: ChartOverviewViewProps) {
  const { data: charsResult, isLoading: charsLoading } = useMonitoredCharacteristics(request)
  const { data: summaryResult } = useSPCSummary(request)
  const { data: signalsResult } = useActiveSPCSignals(request)

  const characteristics = charsResult?.ok ? charsResult.data : []

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <SPCSandboxBanner />
      
      <VerificationStatusBanner
        title="Statistical Process Control (SPC) Quality Metrics"
        status="partial-native"
        sourceLabel="Unity Catalog — gold_batch_quality_result_v, spc_quality_metric_subgroup_mv"
        routes={[
          'GET /api/spc/characteristics (databricks-api)',
          'GET /api/spc/subgroups (databricks-api)',
        ]}
        sourceObjects={[
          'gold_batch_quality_result_v',
          'spc_quality_metric_subgroup_mv',
        ]}
        limitations={[
          'SPC Summary and Active Signals: unavailable — no source view in UAT',
          'Control limits: client-side calculation only (no locked limits)',
          'Point status: not-evaluated — no stored Nelson rule flags',
        ]}
        lastVerified="2026-05-26 (connected_plant_uat)"
      />

      <SourceConfidenceStrip
        mode={(summaryResult?.source as ExtendedSourceMode) || 'mock'}
        status={summaryResult?.ok ? 'loaded' : 'partial'}
        fetchedAt={summaryResult?.ok ? summaryResult.fetchedAt : undefined}
        style={{ marginBottom: '16px' }}
      />

      <SPCEvidenceSummaryPanel 
        sections={[
          { 
            id: 'summary', 
            name: 'SPC Summary Overview', 
            status: resolveEvidenceStatus(summaryResult), 
            source: summaryResult?.source,
            count: summaryResult?.ok ? summaryResult.data.chartsMonitored : undefined,
            message: 'High-level aggregation of monitored characteristics.'
          },
          { 
            id: 'signals', 
            name: 'Active SPC Signals', 
            status: resolveEvidenceStatus(signalsResult), 
            source: signalsResult?.source,
            count: signalsResult?.ok ? signalsResult.data.length : undefined,
            message: 'Nelson and Western Electric rule violations.'
          },
          { 
            id: 'chars', 
            name: 'Monitored Characteristics', 
            status: resolveEvidenceStatus(charsResult), 
            source: charsResult?.source,
            count: characteristics.length,
            message: 'MIC-level characteristic registrations.'
          },
          { 
            id: 'charts', 
            name: 'Control Charts', 
            status: resolveEvidenceStatus(charsResult), 
            source: charsResult?.source,
            message: 'Time-series control charts with statistical limits.'
          }
        ]}
      />

      <div style={HEADER_GRID}>
        <SPCSummaryPanel request={request} />
        <ActiveSPCSignalsPanel request={request} />
      </div>
      {charsLoading ? (
        <div
          role="status"
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--shell-fg-3)',
            fontSize: 13,
            border: '1px dashed var(--shell-line)',
            borderRadius: 6,
          }}
        >
          Loading monitored characteristics...
        </div>
      ) : characteristics.length > 0 ? (
        <div style={CHART_GRID}>
          {characteristics.map(char => (
            <ControlChartPanel
              key={char.characteristicId}
              request={{ ...request, characteristicId: char.characteristicId }}
            />
          ))}
        </div>
      ) : (
        <div
          role="status"
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--shell-fg-3)',
            fontSize: 13,
            border: '1px dashed var(--shell-line)',
            borderRadius: 6,
          }}
        >
          {charsResult?.ok
            ? 'No monitored characteristics found for this scope.'
            : 'Characteristics unavailable — source returned an error.'}
        </div>
      )}
    </div>
  )
}

export function SPCSandboxBanner() {
  return (
    <div
      style={{
        padding: '12px 16px',
        background: 'linear-gradient(135deg, rgba(199, 130, 28, 0.1) 0%, rgba(199, 130, 28, 0.05) 100%)',
        border: '1px solid var(--shell-warn-border, rgba(199, 130, 28, 0.3))',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: 'var(--shell-fg)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      role="status"
    >
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'rgba(199, 130, 28, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--shell-warn, #C7821C)',
          fontSize: '14px',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        !
      </div>
      <div>
        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--shell-warn, #C7821C)' }}>
          SPC Partial Native — Characteristics and charts are live; summary and signals are unavailable
        </h4>
        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--shell-fg-2)', lineHeight: 1.4 }}>
          Monitored characteristics and control chart subgroups are sourced from Unity Catalog UAT. Control limits are calculated client-side only — no locked limits or approved limit sets. Point status is <code style={{ background: 'var(--shell-surface-2)', padding: '1px 4px', borderRadius: '3px' }}>not-evaluated</code>; Nelson rule flags are not stored in this catalog. SPC Summary and Active Signals panels are unavailable pending source views.
        </p>
      </div>
    </div>
  )
}
