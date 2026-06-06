import type { TraceAppTabId } from './plants.js'

export interface TraceAppStubTabProps {
  readonly tabId: TraceAppTabId
  readonly title: string
  readonly description: string
  readonly checklist: readonly { readonly h: string; readonly d: string }[]
}

/**
 * Placeholder for tabs whose backend gold views and Zod schemas have not yet
 * been built. The slice 1 Trace App ships 6 of these (Quality Passport, Mass
 * Balance, Timeline, Recall, Holds, Suppliers) — each follow-on slice will
 * replace one stub with a real implementation.
 */
export function TraceAppStubTab({ tabId, title, description, checklist }: TraceAppStubTabProps) {
  return (
    <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          maxWidth: 720,
          width: '100%',
          padding: 28,
          background: 'white',
          border: '1px solid var(--shell-line, #E5E3D7)',
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 999,
            background: 'var(--sunrise, #F9C20A)20',
            color: 'var(--sunrise, #F9C20A)',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 12,
          }}
        >
          Pending source — pilot stub
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: 'var(--forest, #143700)' }}>
          {title}
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--shell-fg-2)', lineHeight: 1.5 }}>
          {description}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            padding: 14,
            background: 'var(--shell-surface-2, #F1F1E5)',
            borderRadius: 8,
          }}
        >
          {checklist.map((c) => (
            <div key={c.h}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  color: 'var(--valentia-slate, #005776)',
                  marginBottom: 4,
                }}
              >
                {c.h}
              </div>
              <div style={{ fontSize: 12, color: 'var(--forest, #143700)', lineHeight: 1.45 }}>{c.d}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: 'var(--shell-fg-2)' }}>
          panelId: <span style={{ fontFamily: 'monospace' }}>{tabId}</span> · See <code>INTEGRATION.md</code>{' '}
          (Trace App v2) for the schema, hook, and adapter mapping required to wire this tab.
        </div>
      </div>
    </div>
  )
}

const STUB_CONFIG: Record<
  Exclude<TraceAppTabId, 'investigation'>,
  Omit<TraceAppStubTabProps, 'tabId'>
> = {
  passport: {
    title: 'Quality Passport',
    description:
      'Identity + CoA + spec bars + stock + production context + lot history + mass-balance variance + signoff for the active batch. Internal and customer-safe (external) audience modes.',
    checklist: [
      { h: 'Schema', d: 'BatchQualityPassport (new)' },
      { h: 'Hook', d: 'useBatchQualityPassport(request)' },
      { h: 'Adapter', d: 'gold_batch_lot_history + gold_batch_signoff + existing batch-header/quality views' },
      { h: 'Confidence score', d: 'Server-computed; never client-derived' },
    ],
  },
  'mass-balance': {
    title: 'Mass Balance',
    description:
      'SAP MSEG-derived movement ledger for the batch: produced / consumed / shipped / adjusted KPIs and the full event log with movement codes.',
    checklist: [
      { h: 'Schema', d: 'MassBalanceLedger (new)' },
      { h: 'Hook', d: 'useMassBalance(request)' },
      { h: 'Source', d: 'gold_batch_movements (new — derive from SAP MSEG)' },
      { h: 'Variance rule', d: 'produced + adjusted - consumed - shipped - current' },
    ],
  },
  timeline: {
    title: 'Investigation Timeline',
    description:
      'Chronological log of production, QC, release, hold, dispatch, and approval events for the batch — across SAP, LIMS, and TRACE source systems.',
    checklist: [
      { h: 'Schema', d: 'InvestigationTimeline (new)' },
      { h: 'Hook', d: 'useInvestigationTimeline(request)' },
      { h: 'Source', d: 'gold_investigation_events (new — union over multiple sources)' },
      { h: 'Tone classification', d: 'Server-decided per event' },
    ],
  },
  recall: {
    title: 'Recall & Exposure',
    description:
      'Cross-plant customer exposure with delivery-level detail, geographic spread, recall recommendation, and per-country aggregates. Never filtered by active plant.',
    checklist: [
      { h: 'Schema', d: 'RecallReadiness (new)' },
      { h: 'Hook', d: 'useRecallReadiness(request)' },
      { h: 'Source', d: 'gold_recall_summary + existing gold_batch_delivery_v' },
      { h: 'Cross-plant', d: 'Plant context ignored — exposure must show full picture' },
    ],
  },
  holds: {
    title: 'Holds & Releases',
    description:
      'Active and resolved quality holds on the batch with reason codes, owners, and resolution audit trail. Quantity-by-reason rollup.',
    checklist: [
      { h: 'Schema', d: 'HoldsLedger (new)' },
      { h: 'Hook', d: 'useHoldsReleases(request)' },
      { h: 'Source', d: 'gold_holds_ledger (new — derive from SAP block reasons + QM hold table)' },
      { h: 'Read-only', d: 'No release mutations from this UI' },
    ],
  },
  suppliers: {
    title: 'Supplier Batches',
    description:
      'Vendor lots consumed by this batch (upstream) plus sibling batches at other plants that consumed the same vendor lot (cross-plant ripple risk).',
    checklist: [
      { h: 'Schema', d: 'SupplierBatchView (new)' },
      { h: 'Hook', d: 'useSupplierBatches(request)' },
      { h: 'Sources', d: 'gold_supplier_lots + gold_supplier_sibling_batches (new)' },
      { h: 'Risk classification', d: 'Server-derived per supplier lot' },
    ],
  },
}

export function getStubConfig(
  tabId: Exclude<TraceAppTabId, 'investigation'>,
): Omit<TraceAppStubTabProps, 'tabId'> {
  return STUB_CONFIG[tabId]
}
