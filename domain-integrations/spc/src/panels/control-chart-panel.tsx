import { useEffect, useState } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ControlChartSeries, ControlChartPoint } from '@connectio/data-contracts'
import { useControlChartSeries } from '../adapters/spc-monitoring-queries.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'
import { useSPCExclusions } from '../utils/spc-exclusion-store.js'
import { computeAll } from '../utils/calculations.js'
import type { QuantChartType, IndexedChartPoint } from '../utils/spc-types.js'
import { InteractiveControlChart } from '../components/interactive-control-chart.js'
import { SPCExclusionsModal, type ExclusionDialogState } from '../components/spc-exclusions-modal.js'

const registration: EvidencePanelRegistration = {
  panelId: 'control-chart',
  displayName: 'Control Chart',
  description: 'Time-series control chart with UCL, LCL, centreline, and spec limits. Out-of-control points highlighted.',
  ownerDomain: 'spc',
  sourceOwnership: { domainId: 'spc', systemName: 'spc', legacyAppId: 'spc' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['spc-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'spc.read', displayName: 'SPC Read' }],
}

export interface ControlChartPanelProps {
  readonly request: SPCMonitoringAdapterRequest
  readonly onPointClick?: (point: any) => void
  readonly ruleSet?: 'weco' | 'nelson'
}

export function ControlChartPanel({ request, onPointClick, ruleSet = 'weco' }: ControlChartPanelProps) {
  const { data: result, isLoading } = useControlChartSeries(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  const [exclusionDialog, setExclusionDialog] = useState<ExclusionDialogState | null>(null)

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) markReady()
    else if (result && !result.ok) markError()
  }, [isLoading, result, markReady, markError])

  const series: ControlChartSeries | null = result?.ok ? result.data : null

  // Defensively filter for points with valid numbers
  const validPoints = series?.points?.filter(
    (p): p is ControlChartPoint & { value: number } =>
      p != null && typeof p.value === 'number' && !isNaN(p.value)
  ) ?? []

  const charId = request.characteristicId ?? ''
  const { exclusions, toggleExclusion, clearExclusions } = useSPCExclusions(charId)

  // Map to IndexedChartPoint
  const indexedPoints: IndexedChartPoint[] = validPoints.map((p, idx) => {
    const isExcluded = exclusions.has(p.pointId)
    return {
      batch_id: p.batchId || null,
      batch_date: p.timestamp || null,
      batch_seq: idx + 1,
      sample_seq: 1,
      value: p.value,
      lsl: series?.lowerSpecLimit || null,
      usl: series?.upperSpecLimit || null,
      originalIndex: idx,
      excluded: isExcluded,
    }
  })

  // Recalculate reactively
  const activePoints = indexedPoints.filter(p => !p.excluded)
  const chartTypeMapped: QuantChartType = (series?.chartType === 'xbar-r' ? 'xbar_r' : series?.chartType === 'xbar-s' ? 'xbar_s' : series?.chartType === 'ewma' ? 'ewma' : series?.chartType === 'cusum' ? 'cusum' : 'imr') as QuantChartType

  const computed = computeAll(activePoints, chartTypeMapped, ruleSet)

  // Get limits
  let cl = series?.centerLine
  let ucl = series?.upperControlLimit
  let lcl = series?.lowerControlLimit

  if (exclusions.size > 0) {
    if (chartTypeMapped === 'imr' && computed.imr) {
      cl = computed.imr.xBar
      ucl = computed.imr.ucl_x
      lcl = computed.imr.lcl_x
    } else if (chartTypeMapped === 'xbar_r' && computed.xbarR) {
      cl = computed.xbarR.grandMean
      ucl = computed.xbarR.ucl_x
      lcl = computed.xbarR.lcl_x
    } else if (chartTypeMapped === 'xbar_s' && computed.xbarS) {
      cl = computed.xbarS.grandMean
      ucl = computed.xbarS.ucl_x
      lcl = computed.xbarS.lcl_x
    }
  }

  // Active signals
  const activeSignals = computed.signals || []

  const handlePointClick = (p: IndexedChartPoint) => {
    if (onPointClick) {
      onPointClick({
        ...p,
        pointId: validPoints[p.originalIndex]?.pointId,
        timestamp: validPoints[p.originalIndex]?.timestamp,
        sampleId: validPoints[p.originalIndex]?.sampleId,
        signalIds: validPoints[p.originalIndex]?.signalIds,
        unit: series?.unitOfMeasure,
      })
    } else {
      setExclusionDialog({
        action: p.excluded ? 'manual_restore' : 'manual_exclude',
        point: p,
      })
    }
  }

  const handleExclusionSubmit = () => {
    if (exclusionDialog?.point) {
      const pointId = validPoints[exclusionDialog.point.originalIndex].pointId
      toggleExclusion(pointId, exclusionDialog.action === 'manual_exclude')
    }
    setExclusionDialog(null)
  }

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {series && (
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>
              {series.characteristicName} — {series.chartType.toUpperCase()} ({series.unitOfMeasure}) · {validPoints.length} points
            </div>
            {exclusions.size > 0 && (
              <button
                onClick={clearExclusions}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--sunset, #F24A00)',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Clear exclusions ({exclusions.size})
              </button>
            )}
          </div>

          {validPoints.length === 0 ? (
            <div
              style={{ padding: '24px 0', textAlign: 'center', color: 'var(--shell-fg-3)', fontSize: 12 }}
              role="status"
            >
              No measurement data found for this characteristic.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
                {(ucl != null || cl != null || lcl != null) && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginRight: 4 }}>Control Limits:</span>
                    {ucl != null && <ChartStat label="UCL" value={ucl.toFixed(2)} color="var(--sunset, #F24A00)" />}
                    {cl != null && <ChartStat label="CL" value={cl.toFixed(2)} color="var(--shell-fg-2)" />}
                    {lcl != null && <ChartStat label="LCL" value={lcl.toFixed(2)} color="var(--sunset, #F24A00)" />}
                  </div>
                )}
                {(series.upperSpecLimit != null || series.lowerSpecLimit != null) && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', borderLeft: '1px solid var(--shell-line)', paddingLeft: 16 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginRight: 4 }}>Specification Limits:</span>
                    {series.upperSpecLimit != null && <ChartStat label="USL" value={series.upperSpecLimit.toFixed(2)} color="#D32F2F" />}
                    {series.lowerSpecLimit != null && <ChartStat label="LSL" value={series.lowerSpecLimit.toFixed(2)} color="#D32F2F" />}
                  </div>
                )}
              </div>

              {cl == null && lcl == null && ucl == null ? (
                <div
                  style={{ padding: '6px 10px', marginBottom: 8, background: 'var(--shell-warn-bg, rgba(199, 130, 28, 0.05))', border: '1px solid var(--shell-warn-border, rgba(199, 130, 28, 0.2))', borderRadius: 4, fontSize: 11, color: 'var(--shell-warn, #C7821C)', lineHeight: 1.4 }}
                  role="status"
                >
                  Control limits not calculated (minimum samples/configuration required) — cannot evaluate process control state.
                </div>
              ) : series.approvalState !== 'approved' ? (
                <div
                  style={{ padding: '6px 10px', marginBottom: 8, background: 'var(--shell-warn-bg, rgba(199, 130, 28, 0.05))', border: '1px solid var(--shell-warn-border, rgba(199, 130, 28, 0.3))', borderRadius: 4, fontSize: 11, color: 'var(--shell-warn, #C7821C)', lineHeight: 1.4 }}
                  role="status"
                >
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: 2 }}>
                    ⚠️ Control-limit approval source not verified ({series.approvalState?.replace(/-/g, ' ') || 'unknown'})
                  </span>
                  Do not use this chart for operational process-control decisions until approved limits are validated.
                  {series.limitProvenance && (
                    <span style={{ display: 'block', marginTop: 2, fontSize: 10, opacity: 0.8 }}>
                      Source: {series.limitProvenance.replace(/-/g, ' ')}
                    </span>
                  )}
                </div>
              ) : null}

              {validPoints.length > 0 && validPoints.length < 3 && (ucl != null || lcl != null || cl != null) && (
                <div
                  style={{ padding: '4px 8px', marginBottom: 8, background: 'var(--shell-warn-bg, rgba(199, 130, 28, 0.05))', border: '1px solid var(--shell-warn, #C7821C)', borderRadius: 4, fontSize: 11, color: 'var(--shell-warn, #C7821C)' }}
                  role="status"
                >
                  Fewer than 3 samples — control limits are indicative only.
                </div>
              )}

              <InteractiveControlChart
                title={series.characteristicName}
                points={indexedPoints}
                cl={cl}
                ucl={ucl}
                lcl={lcl}
                usl={series.upperSpecLimit}
                lsl={series.lowerSpecLimit}
                unit={series.unitOfMeasure || ''}
                signals={activeSignals}
                onPointClick={handlePointClick}
              />

              <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <LegendItem color={STATUS_COLOR['in-control']} label="No signals returned" />
                <LegendItem color={STATUS_COLOR['warning']} label="Warning" />
                <LegendItem color={STATUS_COLOR['out-of-control']} label="Active SPC signal" />
                <LegendItem color={STATUS_COLOR['not-evaluated']} label="Not evaluated" />
                <LegendItem color={STATUS_COLOR['excluded']} label="Excluded Point" />
              </div>
            </>
          )}
        </div>
      )}

      {exclusionDialog && (
        <SPCExclusionsModal
          dialog={exclusionDialog}
          saving={false}
          onCancel={() => setExclusionDialog(null)}
          onSubmit={handleExclusionSubmit}
        />
      )}
    </EvidencePanel>
  )
}

const STATUS_COLOR: Record<string, string> = {
  'out-of-control': 'var(--shell-bad, #C73315)',
  'warning': 'var(--shell-warn, #C7821C)',
  'in-control': 'var(--shell-good, #1F8B4C)',
  'not-evaluated': 'var(--shell-fg-3, #888)',
  'excluded': 'var(--shell-fg-3, #a0a0a5)',
}

function ChartStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>{label}</span>
    </div>
  )
}
