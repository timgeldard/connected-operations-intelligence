import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ControlChartPoint } from '@connectio/data-contracts'
import { useCharacteristicCapability, useControlChartSeries } from '../adapters/spc-monitoring-queries.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'
import { useSPCExclusions } from '../utils/spc-exclusion-store.js'
import { computeAll } from '../utils/calculations.js'
import type { QuantChartType } from '../utils/spc-types.js'
import { CapabilityHistogram } from '../components/capability-histogram.js'

const registration: EvidencePanelRegistration = {
  panelId: 'characteristic-capability',
  displayName: 'Characteristic Capability',
  description: 'Cp, Cpk, Pp, Ppk indices with mean, standard deviation, and capability interpretation.',
  ownerDomain: 'spc',
  sourceOwnership: { domainId: 'spc', systemName: 'spc', legacyAppId: 'spc' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['spc-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: false, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'spc.read', displayName: 'SPC Read' }],
}

export interface CharacteristicCapabilityPanelProps {
  readonly request: SPCMonitoringAdapterRequest
}

const INTERPRETATION_COLOR: Record<string, string> = {
  capable: 'var(--shell-good, #1F8B4C)',
  marginal: 'var(--shell-warn, #C7821C)',
  'not-capable': 'var(--shell-bad, #C73315)',
  'insufficient-data': 'var(--shell-fg-3)',
}

export function CharacteristicCapabilityPanel({ request }: CharacteristicCapabilityPanelProps) {
  const { data: capResult, isLoading: isCapLoading } = useCharacteristicCapability(request)
  const { data: seriesResult, isLoading: isSeriesLoading } = useControlChartSeries(request)

  const lastRefreshedAt = capResult?.ok ? capResult.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isCapLoading || isSeriesLoading) return
    if (capResult?.ok && seriesResult?.ok) markReady()
    else if ((capResult && !capResult.ok) || (seriesResult && !seriesResult.ok)) markError()
  }, [isCapLoading, isSeriesLoading, capResult, seriesResult, markReady, markError])

  const capData = capResult?.ok ? capResult.data : null
  const seriesData = seriesResult?.ok ? seriesResult.data : null

  const charId = request.characteristicId ?? ''
  const { exclusions } = useSPCExclusions(charId)

  // Defensively filter raw points
  const rawPoints = seriesData?.points ?? []
  const validPoints = rawPoints.filter(
    (p): p is ControlChartPoint & { value: number } =>
      p != null && typeof p.value === 'number' && !isNaN(p.value)
  )

  // Map to ChartDataPoints for calculation
  const mappedPoints = validPoints.map((p, idx) => ({
    batch_id: p.batchId || null,
    batch_date: p.timestamp || null,
    batch_seq: idx + 1,
    sample_seq: 1,
    value: p.value,
    lsl: seriesData?.lowerSpecLimit || null,
    usl: seriesData?.upperSpecLimit || null,
    excluded: exclusions.has(p.pointId),
  }))

  const activePointsForCalc = mappedPoints.filter(p => !p.excluded)
  const chartTypeMapped: QuantChartType = (seriesData?.chartType === 'xbar-r' ? 'xbar_r' : seriesData?.chartType === 'xbar-s' ? 'xbar_s' : seriesData?.chartType === 'ewma' ? 'ewma' : seriesData?.chartType === 'cusum' ? 'cusum' : 'imr') as QuantChartType

  const computed = computeAll(activePointsForCalc, chartTypeMapped, 'weco')
  const capability = computed.capability

  // Dynamic calculations override
  const cp = exclusions.size > 0 && capability ? capability.cp : capData?.cp
  const cpk = exclusions.size > 0 && capability ? capability.cpk : capData?.cpk
  const pp = exclusions.size > 0 && capability ? capability.pp : capData?.pp
  const ppk = exclusions.size > 0 && capability ? capability.ppk : capData?.ppk
  const mean = exclusions.size > 0 && capability ? capability.xBar : capData?.mean
  const standardDeviation = exclusions.size > 0 && capability ? capability.sigmaOverall : capData?.standardDeviation
  const sampleCount = exclusions.size > 0 ? activePointsForCalc.length : capData?.sampleCount ?? activePointsForCalc.length

  const interpretation = getInterpretation(cpk, sampleCount)
  const isInsufficient = interpretation === 'insufficient-data'

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!capResult?.ok ? capResult?.error.message : undefined}
      source={capResult?.source}
    >
      {capData && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)' }}>{capData.characteristicName}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: INTERPRETATION_COLOR[interpretation] ?? 'var(--shell-fg)',
              padding: '2px 6px', border: `1px solid ${INTERPRETATION_COLOR[interpretation] ?? 'var(--shell-line)'}`, borderRadius: 3,
            }}>
              {interpretation.replace(/-/g, ' ')}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <CapabilityIndex label="Cp" value={cp} threshold={1.33} isInsufficient={isInsufficient} />
            <CapabilityIndex label="Cpk" value={cpk} threshold={1.33} isInsufficient={isInsufficient} />
            <CapabilityIndex label="Pp" value={pp} threshold={1.33} isInsufficient={isInsufficient} />
            <CapabilityIndex label="Ppk" value={ppk} threshold={1.33} isInsufficient={isInsufficient} />
          </div>

          {capData.approvalState !== 'approved' && (
            <div
              style={{
                padding: '6px 10px',
                background: 'var(--shell-warn-bg, rgba(199, 130, 28, 0.05))',
                border: '1px solid var(--shell-warn-border, rgba(199, 130, 28, 0.3))',
                borderRadius: 4,
                fontSize: 11,
                color: 'var(--shell-warn, #C7821C)',
                lineHeight: 1.4,
              }}
              role="status"
            >
              <span style={{ fontWeight: 600, display: 'block', marginBottom: 2 }}>
                ⚠️ Capability approval source not verified ({capData.approvalState?.replace(/-/g, ' ') || 'unknown'})
              </span>
              Calculated indices are for workflow validation only.
              {capData.limitProvenance && (
                <span style={{ display: 'block', marginTop: 2, fontSize: 10, opacity: 0.8 }}>
                  Source: {capData.limitProvenance.replace(/-/g, ' ')}
                </span>
              )}
            </div>
          )}

          {isInsufficient && (
            <div
              style={{
                padding: '6px 10px',
                background: 'var(--shell-warn-bg, rgba(199, 130, 28, 0.05))',
                border: '1px solid var(--shell-warn-border, rgba(199, 130, 28, 0.2))',
                borderRadius: 4,
                fontSize: 11,
                color: 'var(--shell-warn, #C7821C)',
                lineHeight: 1.4,
              }}
              role="status"
            >
              Insufficient sample size to calculate reliable capability indices. A minimum of 30 samples is recommended for production control validation.
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <StatRow label="Mean" value={typeof mean === 'number' && !isNaN(mean) ? mean.toFixed(3) : '—'} />
            <StatRow label="Std Dev" value={typeof standardDeviation === 'number' && !isNaN(standardDeviation) ? standardDeviation.toFixed(4) : '—'} />
            <StatRow label="n" value={typeof sampleCount === 'number' ? String(sampleCount) : '—'} />
            <StatRow label="Confidence" value={typeof capData.confidence === 'number' && !isNaN(capData.confidence) ? `${Math.round(capData.confidence * 100)}%` : '—'} />
          </div>

          {seriesData && (
            <CapabilityHistogram
              values={activePointsForCalc.map(p => p.value)}
              xBar={mean}
              sigmaOverall={standardDeviation}
              usl={seriesData.upperSpecLimit}
              lsl={seriesData.lowerSpecLimit}
            />
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

function getInterpretation(cpk: number | null | undefined, count: number): 'capable' | 'marginal' | 'not-capable' | 'insufficient-data' {
  if (count < 30) return 'insufficient-data'
  if (cpk == null || isNaN(cpk)) return 'insufficient-data'
  if (cpk >= 1.33) return 'capable'
  if (cpk >= 1.0) return 'marginal'
  return 'not-capable'
}

function CapabilityIndex({
  label,
  value,
  threshold,
  isInsufficient = false,
}: {
  label: string
  value: number | null | undefined
  threshold: number
  isInsufficient?: boolean
}) {
  const hasValue = value != null && !isNaN(value) && !isInsufficient
  const color = !hasValue
    ? 'var(--shell-fg-3)'
    : value >= threshold
    ? 'var(--shell-good, #1F8B4C)'
    : value >= 1.0
    ? 'var(--shell-warn, #C7821C)'
    : 'var(--shell-bad, #C73315)'
  return (
    <div style={{ background: 'var(--shell-surface-2)', borderRadius: 4, padding: '6px 10px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{hasValue ? value.toFixed(2) : '—'}</div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>{value}</div>
    </div>
  )
}
