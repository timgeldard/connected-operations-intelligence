import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { SupplierBatchView } from '@connectio/data-contracts'
import { useSupplierBatches } from './trace-app-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'supplier-batches',
  displayName: 'Supplier Batches',
  description:
    'Vendor lots consumed by this batch (upstream) plus sibling batches at other plants that consumed the same vendor lot. Cross-plant ripple risk surface.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['trace'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: {
    staleAfterSeconds: 300,
    errorAfterSeconds: 900,
    refreshOnFocus: true,
    pollIntervalSeconds: null,
  },
  confidencePolicy: { level: 0.95, hidden: false },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

export interface SuppliersPanelProps {
  readonly request: Trace2AdapterRequest
}

const RISK_TONES = {
  low: { bg: 'var(--jade, #44CF93)20', fg: '#1a8454' },
  medium: { bg: 'var(--sunrise, #F9C20A)20', fg: '#8a6b00' },
  high: { bg: 'var(--sunset, #F24A00)20', fg: 'var(--sunset, #F24A00)' },
  // `unknown` is the source-truthful default added in PR #82 — surface as a
  // neutral pill so the UI does NOT imply a risk classification.
  unknown: { bg: 'var(--shell-line, #E5E3D7)', fg: 'var(--shell-fg-2)' },
} as const

export function SuppliersPanel({ request }: SuppliersPanelProps) {
  const { data: result, isLoading } = useSupplierBatches(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) markReady()
    else if (result && !result.ok) markError()
  }, [isLoading, result, markReady, markError])

  const data: SupplierBatchView | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: 20 }}>
          <SectionTitle label="Vendor lots consumed (upstream)" extra={`${data.consumedLots.length} lots`} />
          <div style={{ overflowX: 'auto', marginBottom: 22 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--shell-surface-2, #F8F7F0)' }}>
                  {['Vendor', 'Vendor batch', 'Material', 'Receipt', 'Consumed', 'CoA', 'Risk'].map((h) => (
                    <Th key={h} align={h === 'Consumed' ? 'right' : 'left'}>
                      {h}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.consumedLots.map((l) => {
                  const tone = RISK_TONES[l.risk]
                  return (
                    <tr key={l.vendorBatch} style={{ borderBottom: '1px solid var(--shell-line, #E5E3D7)' }}>
                      <td style={{ padding: '9px 12px', fontWeight: 500 }}>{l.vendor}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--valentia-slate, #005776)' }}>{l.vendorBatch}</td>
                      <td style={{ padding: '9px 12px' }}>{l.material}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--shell-fg-2)' }}>{l.receipt}</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {l.consumed.toLocaleString()} <span style={{ color: 'var(--shell-fg-2)' }}>{l.uom}</span>
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--shell-fg-2)' }}>{l.coa ?? '—'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            background: tone.bg,
                            color: tone.fg,
                          }}
                        >
                          {l.risk}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <SectionTitle
            label="Sibling batches consuming the same vendor lot"
            extra={`${data.siblingBatches.length} batches across plants`}
            tone="warn"
          />
          <div
            style={{
              fontSize: 11,
              color: 'var(--shell-fg-2)',
              fontStyle: 'italic',
              marginBottom: 12,
            }}
          >
            Cross-plant ripple risk — these batches share at least one upstream vendor lot with the
            active batch. Plant filter is intentionally NOT applied.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--shell-surface-2, #F8F7F0)' }}>
                  {['Plant', 'Batch', 'Manufactured', 'Qty', 'Vendor batch'].map((h) => (
                    <Th key={h} align={h === 'Qty' ? 'right' : 'left'}>
                      {h}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.siblingBatches.map((b) => (
                  <tr key={`${b.batchId}-${b.plantId ?? b.plant}`} style={{ borderBottom: '1px solid var(--shell-line, #E5E3D7)' }}>
                    <td style={{ padding: '9px 12px' }}>{b.plant}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--valentia-slate, #005776)', fontWeight: 600 }}>{b.batchId}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--shell-fg-2)' }}>{b.mfg}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{b.qty.toLocaleString()}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--shell-fg-2)' }}>{b.vendorBatch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

function SectionTitle({ label, extra, tone }: { label: string; extra?: string; tone?: 'warn' }) {
  const color = tone === 'warn' ? '#8a6b00' : 'var(--valentia-slate, #005776)'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        paddingBottom: 8,
        marginBottom: 12,
        borderBottom: '1px solid var(--shell-line, #E5E3D7)',
      }}
    >
      <span style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700, color }}>
        {label}
      </span>
      {extra && (
        <span style={{ fontSize: 11, color: 'var(--shell-fg-2)', fontFamily: 'monospace', marginLeft: 'auto' }}>
          {extra}
        </span>
      )}
    </div>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '8px 12px',
        fontSize: 10.5,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: 'var(--shell-fg-2)',
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  )
}
