import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type {
  BatchQualityPassport,
  PassportProduction,
  PassportUsageDecisionEvidence,
  PassportStock,
  QualityCharacteristic,
} from '@connectio/data-contracts'
import { useBatchQualityPassport } from './trace-app-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'
import {
  Card,
  CardContent,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  DrillThroughButton,
} from '@connectio/design-system'

const registration: EvidencePanelRegistration = {
  panelId: 'quality-passport',
  displayName: 'Batch Quality Passport',
  description:
    'Consolidated identity, CoA results, stock, production context, lot history, mass-balance variance, and sign-off for the active batch.',
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
  confidencePolicy: { level: 0.99, hidden: false },
  drillThrough: {
    label: 'Open in Trace Investigation',
    targetWorkspaceId: 'trace-investigation',
    targetViewId: 'overview',
    contextScopes: ['batch'],
  },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

export type PassportAudienceMode = 'internal' | 'external'

export interface QualityPassportPanelProps {
  readonly request: Trace2AdapterRequest
  readonly audienceMode?: PassportAudienceMode
  /** Optional callback when the user clicks "Open Mass Balance →". */
  readonly onNavigateTab?: (tabId: 'mass-balance') => void
}

export function QualityPassportPanel({
  request,
  audienceMode = 'internal',
  onNavigateTab,
}: QualityPassportPanelProps) {
  const { data: result, isLoading } = useBatchQualityPassport(request)
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

  const data: BatchQualityPassport | null = result?.ok ? result.data : null
  const isExternal = audienceMode === 'external'

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: 24, fontFamily: 'var(--font-sans)' }}>
          <HeroBand data={data} />
          
          <Tabs defaultValue="coa" style={{ width: '100%' }}>
            <TabsList
              style={{
                background: 'var(--stone)',
                padding: 4,
                borderRadius: 'var(--radius-md)',
                display: 'inline-flex',
                gap: 4,
                marginBottom: 20,
                width: '100%',
                justifyContent: 'flex-start',
              }}
            >
              <TabsTrigger
                value="coa"
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 'var(--fw-semibold)',
                  fontSize: 'var(--fs-13)',
                }}
              >
                CoA & Specifications
              </TabsTrigger>
              <TabsTrigger
                value="stock"
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 'var(--fw-semibold)',
                  fontSize: 'var(--fs-13)',
                }}
              >
                Stock & Inventory
              </TabsTrigger>
              <TabsTrigger
                value="production"
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 'var(--fw-semibold)',
                  fontSize: 'var(--fs-13)',
                }}
              >
                Production & Lots
              </TabsTrigger>
              <TabsTrigger
                value="usage"
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 'var(--fw-semibold)',
                  fontSize: 'var(--fs-13)',
                }}
              >
                Usage Decision
              </TabsTrigger>
            </TabsList>

            <TabsContent value="coa">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Section num="01" label="Identity & production order">
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 16,
                      background: 'var(--stone)',
                      padding: 20,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--stroke-soft)',
                    }}
                  >
                    <KV label="Material" value={data.identity.materialDescription} />
                    <KV label="Batch" value={data.identity.batchId} mono />
                    <KV
                      label="Plant"
                      value={isExternal ? 'EU-IE-01' : `${data.identity.plantName} · ${data.identity.plantId}`}
                    />
                    <KV
                      label="Process order"
                      value={isExternal ? '[masked]' : data.identity.processOrderId}
                      mono={!isExternal}
                    />
                    <KV
                      label="Manufacture"
                      value={new Date(data.identity.manufactureDate).toLocaleDateString()}
                      mono
                    />
                    <KV
                      label="Expiry"
                      value={`${new Date(data.identity.expiryDate).toLocaleDateString()} · ${data.identity.daysToExpiry}d`}
                      mono
                    />
                    <KV label="UoM" value={data.identity.uom} mono />
                    <KV label="Audience" value={isExternal ? 'Customer-safe' : 'Internal'} />
                  </div>
                </Section>

                <Section num="02" label="Certificate of analysis" extra={`${data.quality.coa.length} characteristics`}>
                  <div style={{ border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <CoATable rows={data.quality.coa} />
                  </div>
                </Section>
              </div>
            </TabsContent>

            <TabsContent value="stock">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Section num="03" label="Stock by category">
                  <StockBreakdown stock={data.stock} />
                </Section>

                {!isExternal && (
                  <Section num="04" label="Mass balance variance">
                    <MassBalanceBanner
                      variance={data.massBalance.variance}
                      uom={data.stock.uom}
                      note={data.massBalance.note}
                      onOpenDetail={onNavigateTab ? () => onNavigateTab('mass-balance') : undefined}
                    />
                  </Section>
                )}
              </div>
            </TabsContent>

            <TabsContent value="production">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(285px, 1fr))',
                    gap: 20,
                  }}
                >
                  <Section num="05" label="Production context">
                    <ProductionContext production={data.production} isExternal={isExternal} />
                  </Section>
                  <Section num="06" label="Lot history" extra="Last 4 lots">
                    <div style={{ border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <LotHistoryTable rows={data.lotHistory} isExternal={isExternal} />
                    </div>
                  </Section>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="usage">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Section
                  num="07"
                  label="Usage-decision evidence"
                  extra="SAP QM Audit Trail"
                >
                  <UsageDecisionEvidenceList rows={data.usageDecisionEvidence} isExternal={isExternal} />
                </Section>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </EvidencePanel>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HeroBand({ data }: { data: BatchQualityPassport }) {
  const confidence = data.quality.heuristicQualityConfidence
  const confColor =
    confidence >= 90 ? 'var(--confidence-high)' : confidence >= 75 ? 'var(--confidence-medium)' : 'var(--confidence-low)'
  const failedMics = data.quality.coa.filter((c) => c.status === 'fail').length
  const warnMics = data.quality.coa.filter((c) => c.status === 'warn').length
  const acceptLots = data.lotHistory.filter((l) => l.result === 'accept').length
  const rejectLots = data.lotHistory.filter((l) => l.result === 'reject').length

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1fr',
        marginBottom: 24,
        border: '1px solid var(--stroke)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'var(--white)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ padding: 20, borderRight: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 'var(--ls-upper)', textTransform: 'uppercase', fontWeight: 'var(--fw-bold)', color: 'var(--fg-muted)', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Quality confidence</span>
            <Badge
              style={{
                background: data.quality.confidenceSource === 'application-heuristic' ? 'color-mix(in srgb, var(--status-warn) 15%, white)' : 'var(--brand)',
                color: data.quality.confidenceSource === 'application-heuristic' ? 'var(--status-warn)' : 'var(--white)',
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
              }}
              title={data.quality.confidenceSource === 'application-heuristic' ? "This score is application-derived from MIC pass/fail and warning counts. It is not a governed SAP/QM field." : undefined}
            >
              {data.quality.confidenceSource === 'application-heuristic' ? 'HEURISTIC' : 'GOVERNED'}
            </Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 'var(--fs-36)', fontWeight: 'var(--fw-extrabold)', color: confColor, lineHeight: 1 }}>
              {confidence}
              <span style={{ fontSize: 'var(--fs-14)', color: 'var(--fg-muted)', fontWeight: 'var(--fw-semibold)' }}>/100</span>
            </div>
            <div style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-muted)' }}>
              {data.quality.notes.map((n) => (
                <div key={n}>· {n}</div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 10, fontStyle: 'italic', fontFamily: 'var(--font-mono)' }}>
          Source: {data.quality.confidenceSource === 'application-heuristic' ? 'Application Heuristic (SAP QM proxy)' : 'Databricks API (SAP QM)'}
        </div>
      </div>
      <KpiTile label="Lots produced" value={data.productionLotCount ?? data.lotHistory.length} sub="process orders" />
      <KpiTile label="Inspection lots" value={data.inspectionLotCount ?? data.lotHistory.length} sub="quality records" />
      <KpiTile
        label="Results · accepted"
        value={acceptLots}
        sub={`${rejectLots} rejected`}
        tone="good"
      />
      <KpiTile
        label="Failed MICs"
        value={failedMics}
        sub={`${warnMics} near limit`}
        tone={failedMics > 0 ? 'bad' : warnMics > 0 ? 'warn' : 'good'}
      />
    </div>
  )
}

function KpiTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string | number
  sub?: string
  tone?: 'good' | 'warn' | 'bad'
}) {
  const color =
    tone === 'good' ? 'var(--status-good)' : tone === 'warn' ? 'var(--status-warn)' : tone === 'bad' ? 'var(--status-bad)' : 'var(--brand)'
  return (
    <div style={{ padding: 20, borderRight: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: 10, letterSpacing: 'var(--ls-upper)', textTransform: 'uppercase', fontWeight: 'var(--fw-bold)', color: 'var(--fg-muted)' }}>
        {label}
      </div>
      <div style={{ marginTop: 6, fontSize: 'var(--fs-28)', fontWeight: 'var(--fw-extrabold)', color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function Section({
  num,
  label,
  extra,
  children,
}: {
  num: string
  label: string
  extra?: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <SectionTitle num={num} label={label} extra={extra} />
      {children}
    </div>
  )
}

function SectionTitle({ num, label, extra }: { num?: string; label: string; extra?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        paddingBottom: 8,
        marginBottom: 14,
        borderBottom: '1px solid var(--stroke)',
      }}
    >
      {num && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-11)', color: 'var(--brand)', fontWeight: 'var(--fw-bold)' }}>
          {num}
        </span>
      )}
      <span className="t-eyebrow" style={{ margin: 0 }}>
        {label}
      </span>
      {extra && (
        <span style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
          {extra}
        </span>
      )}
    </div>
  )
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 'var(--ls-upper)', textTransform: 'uppercase', color: 'var(--fg-muted)', fontWeight: 'var(--fw-semibold)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-semibold)', color: 'var(--forest)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>
        {value}
      </div>
    </div>
  )
}

function CoATable({ rows }: { rows: readonly QualityCharacteristic[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-13)' }}>
        <thead>
          <tr style={{ background: 'var(--stone)', borderBottom: '1px solid var(--stroke)' }}>
            <Th>Characteristic</Th>
            <Th>Spec</Th>
            <Th style={{ minWidth: 240 }}>Result</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={`${c.mic}-${i}`} style={{ borderBottom: '1px solid var(--stroke-soft)', background: 'var(--white)' }}>
              <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--forest)' }}>{c.param}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-11)', color: 'var(--fg-muted)', marginTop: 2 }}>
                  {c.mic} · target {c.target} {c.uom}
                </div>
              </td>
              <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', fontSize: 'var(--fs-12)', verticalAlign: 'top' }}>
                {c.binary ? `${c.binary} ${c.uom}` : `${c.low} – ${c.high} ${c.uom}`}
              </td>
              <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      minWidth: 70,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 'var(--fw-bold)',
                      color: c.status === 'fail' ? 'var(--status-bad)' : c.status === 'warn' ? 'var(--status-warn)' : 'var(--status-good)',
                    }}
                  >
                    {c.binary || c.actual}
                    <span style={{ color: 'var(--fg-muted)', fontWeight: 'var(--fw-normal)', fontSize: 'var(--fs-11)', marginLeft: 2 }}>
                      {c.uom}
                    </span>
                  </span>
                  {!c.binary && (
                    <div style={{ flex: 1 }}>
                      <SpecBar low={c.low} high={c.high} target={c.target} actual={c.actual} status={c.status} />
                    </div>
                  )}
                </div>
              </td>
              <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                <StatusPill
                  status={c.status}
                  label={c.status === 'ok' ? 'In spec' : c.status === 'warn' ? 'Near limit' : 'Out of spec'}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SpecBar({
  low,
  high,
  target,
  actual,
  status,
}: {
  low: number
  high: number
  target: number
  actual: number
  status: 'ok' | 'warn' | 'fail'
}) {
  const span = high - low || 1
  const pad = span * 0.18
  const min = low - pad
  const max = high + pad
  const range = max - min
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / range) * 100))

  const tolLeft = pct(low)
  const tolWidth = pct(high) - pct(low)
  const tgtLeft = pct(target)
  const actLeft = pct(actual)

  const actColor = status === 'fail' ? 'var(--status-bad)' : status === 'warn' ? 'var(--status-warn)' : 'var(--status-good)'

  return (
    <div style={{ position: 'relative', height: 14, width: '100%' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 5, height: 4, background: 'var(--stone)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--stroke-soft)' }} />
      <div
        style={{
          position: 'absolute',
          top: 4,
          height: 6,
          left: `${tolLeft}%`,
          width: `${tolWidth}%`,
          background: 'color-mix(in srgb, var(--status-info) 20%, white)',
          borderLeft: '1px solid var(--status-info)',
          borderRight: '1px solid var(--status-info)',
          borderRadius: 'var(--radius-sm)',
        }}
      />
      <div style={{ position: 'absolute', top: 1, bottom: 1, left: `${tgtLeft}%`, width: 2, background: 'var(--forest)' }} />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          left: `${actLeft}%`,
          width: 12,
          height: 12,
          borderRadius: 'var(--radius-full)',
          background: actColor,
          boxShadow: `0 0 0 2px var(--white), 0 0 0 3px ${actColor}`,
        }}
      />
    </div>
  )
}

function StockBreakdown({ stock }: { stock: PassportStock }) {
  const buckets: { key: keyof PassportStock; label: string; color: string }[] = [
    { key: 'unrestricted', label: 'Unrestricted', color: 'var(--status-good)' },
    { key: 'qualityInspection', label: 'Quality inspection', color: 'var(--status-info)' },
    { key: 'restricted', label: 'Restricted', color: 'var(--status-warn)' },
    { key: 'blocked', label: 'Blocked', color: 'var(--status-bad)' },
    { key: 'transit', label: 'In transit', color: 'var(--brand)' },
  ]
  const total = buckets.reduce((s, b) => s + (Number(stock[b.key]) || 0), 0)

  return (
    <Card style={{ padding: 18, background: 'var(--white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)', boxShadow: 'var(--shadow-sm)' }}>
      <CardContent style={{ padding: 0, display: 'grid', gap: 12 }}>
        {buckets.map((b) => {
          const val = Number(stock[b.key]) || 0
          const pct = total > 0 ? (val / total) * 100 : 0
          return (
            <div key={b.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-medium)', color: 'var(--forest)' }}>{b.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--forest)' }}>
                  {val.toLocaleString()} <span style={{ color: 'var(--fg-muted)' }}>· {pct.toFixed(1)}%</span>
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--stone)', borderRadius: 'var(--radius-full)', overflow: 'hidden', border: '1px solid var(--stroke-soft)' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: b.color, opacity: val === 0 ? 0.3 : 1, borderRadius: 'var(--radius-full)' }} />
              </div>
            </div>
          )
        })}
        <div
          style={{
            marginTop: 8,
            paddingTop: 12,
            borderTop: '1px dashed var(--stroke)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-upper)', fontWeight: 'var(--fw-bold)' }}>
            Total on hand
          </span>
          <span style={{ fontSize: 'var(--fs-22)', fontWeight: 'var(--fw-extrabold)', color: 'var(--forest)', fontFamily: 'var(--font-mono)' }}>
            {total.toLocaleString()}
            <span style={{ fontSize: 12, fontWeight: 'var(--fw-semibold)', color: 'var(--fg-muted)', marginLeft: 4 }}>{stock.uom}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function ProductionContext({ production, isExternal }: { production: PassportProduction; isExternal: boolean }) {
  const formatOptional = (value: string | null | undefined) => value ?? 'Unavailable'
  const formatOptionalDate = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString() : 'Unavailable'
  const plannedQty = production.plannedQty != null
    ? production.plannedQty.toLocaleString()
    : 'Unavailable'
  const yieldPct = production.yield != null
    ? `${(production.yield * 100).toFixed(1)}%`
    : 'Unavailable'
  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Order', value: isExternal ? '[masked]' : production.orderId, mono: !isExternal },
    { label: 'Line', value: isExternal ? '[masked]' : formatOptional(production.line) },
    { label: 'Operator', value: isExternal ? '[masked]' : formatOptional(production.operator) },
    { label: 'Started', value: formatOptionalDate(production.startedAt), mono: true },
    { label: 'Confirmed', value: formatOptionalDate(production.confirmedAt), mono: true },
    {
      label: 'Planned · Actual',
      value: `${plannedQty} · ${production.actualQty.toLocaleString()} KG`,
      mono: true,
    },
    { label: 'Yield', value: yieldPct },
    { label: 'Originating customer', value: formatOptional(production.originatingCustomer) },
  ]
  return (
    <Card style={{ padding: 18, background: 'var(--white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)', boxShadow: 'var(--shadow-sm)' }}>
      <CardContent style={{ padding: 0, display: 'grid', gap: 8 }}>
        {rows.map((r, i) => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              paddingBottom: 6,
              borderBottom: i === rows.length - 1 ? 'none' : '1px dotted var(--stroke-soft)',
            }}
          >
            <span style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-muted)' }}>{r.label}</span>
            <span
              style={{
                fontSize: 'var(--fs-13)',
                fontWeight: 'var(--fw-medium)',
                color: 'var(--forest)',
                textAlign: 'right',
                fontFamily: r.mono ? 'var(--font-mono)' : 'inherit',
              }}
            >
              {r.value}
            </span>
          </div>
        ))}
        {!isExternal && (
          <div style={{ marginTop: 8, fontSize: 'var(--fs-11)', color: 'var(--fg-muted)', fontStyle: 'italic' }}>
            {production.notes}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LotHistoryTable({
  rows,
  isExternal,
}: {
  rows: readonly BatchQualityPassport['lotHistory'][number][]
  isExternal: boolean
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-13)' }}>
        <thead>
          <tr style={{ background: 'var(--stone)', borderBottom: '1px solid var(--stroke)' }}>
            {['Lot', 'Date', 'Inspection', 'Decision', 'MICs', 'Decided by'].map((h) => (
              <Th key={h} align={h === 'MICs' ? 'right' : 'left'}>
                {h}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid var(--stroke-soft)', background: 'var(--white)' }}>
              <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-semibold)', color: 'var(--brand)' }}>{l.id}</td>
              <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{l.date}</td>
              <td style={{ padding: '10px 14px', color: 'var(--forest)' }}>{l.inspection}</td>
              <td style={{ padding: '10px 14px' }}>
                <StatusPill
                  status={l.result === 'reject' ? 'fail' : l.result === 'conditional' ? 'warn' : 'ok'}
                  label={l.result === 'accept' ? 'Released' : l.result === 'conditional' ? 'Conditional' : 'Rejected'}
                />
              </td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: l.failed > 0 ? 'var(--status-warn)' : 'var(--fg-muted)', fontWeight: l.failed > 0 ? 'var(--fw-bold)' : 'var(--fw-normal)' }}>
                  {l.failed}
                </span>
                <span style={{ color: 'var(--fg-muted)' }}> / {l.mics}</span>
              </td>
              <td style={{ padding: '10px 14px', color: 'var(--forest)' }}>
                {isExternal ? '[masked]' : l.decisionBy}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MassBalanceBanner({
  variance,
  uom,
  note,
  onOpenDetail,
}: {
  variance: number
  uom: string
  note: string
  onOpenDetail?: () => void
}) {
  const reconciled = variance === 0
  const toneColor = reconciled ? 'var(--status-good)' : 'var(--status-warn)'
  const displayVariance = variance > 0 ? `+${variance}` : variance

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '16px 20px',
        background: `color-mix(in srgb, ${toneColor} 8%, white)`,
        border: `1px solid color-mix(in srgb, ${toneColor} 20%, white)`,
        borderLeft: `4px solid ${toneColor}`,
        borderRadius: 'var(--radius-md)',
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-full)',
            background: 'var(--white)',
            display: 'grid',
            placeItems: 'center',
            border: `2px solid ${toneColor}`,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span style={{ fontSize: 'var(--fs-16)', fontWeight: 'var(--fw-bold)', color: toneColor, fontFamily: 'var(--font-mono)' }}>
            {displayVariance}
          </span>
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-bold)', color: 'var(--forest)', marginBottom: 2 }}>
            Variance {reconciled ? 'reconciled' : `${Math.abs(variance)} ${uom} unexplained`}
          </div>
          <div style={{ fontSize: 'var(--fs-12)', color: 'var(--fg-muted)' }}>{note}</div>
        </div>
      </div>
      {onOpenDetail && (
        <DrillThroughButton
          label="Open Mass Balance"
          onClick={onOpenDetail}
        />
      )}
    </div>
  )
}

function UsageDecisionEvidenceList({
  rows,
  isExternal,
}: {
  rows: readonly PassportUsageDecisionEvidence[]
  isExternal: boolean
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {rows.map((s) => (
        <div
          key={`${s.role}-${s.recordedAt}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '14px 18px',
            background: 'var(--stone)',
            border: '1px solid var(--stroke-soft)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ minWidth: 160 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: 'var(--ls-upper)',
                textTransform: 'uppercase',
                color: 'var(--fg-muted)',
                fontWeight: 'var(--fw-bold)',
                marginBottom: 4,
              }}
            >
              {s.role}
            </div>
            <div style={{ fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-semibold)', color: 'var(--forest)' }}>
              {isExternal && s.decisionBy !== '—' ? '[masked]' : s.decisionBy}
            </div>
          </div>
          <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--fg-muted)' }}>
            {s.recordedAt || '—'}
          </div>
          <StatusPill
            status={s.decisionType === 'usage-decision-recorded' ? 'ok' : s.decisionType === 'inspection-completed' ? 'warn' : 'neutral'}
            label={
              s.decisionType === 'usage-decision-recorded'
                ? 'Decision recorded'
                : s.decisionType === 'inspection-completed'
                  ? 'Inspection done'
                  : 'No evidence'
            }
          />
        </div>
      ))}
    </div>
  )
}

function Th({ children, align = 'left', style }: { children: React.ReactNode; align?: 'left' | 'right'; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '10px 14px',
        fontSize: 10.5,
        letterSpacing: 'var(--ls-upper)',
        textTransform: 'uppercase',
        color: 'var(--fg-muted)',
        fontWeight: 'var(--fw-semibold)',
        fontFamily: 'var(--font-mono)',
        ...style,
      }}
    >
      {children}
    </th>
  )
}

function StatusPill({ status, label }: { status: 'ok' | 'warn' | 'fail' | 'neutral'; label: string }) {
  const tone =
    status === 'fail'
      ? { bg: 'color-mix(in srgb, var(--status-bad) 12%, white)', fg: 'var(--status-bad)' }
      : status === 'warn'
        ? { bg: 'color-mix(in srgb, var(--status-warn) 12%, white)', fg: 'var(--status-warn)' }
        : status === 'ok'
          ? { bg: 'color-mix(in srgb, var(--status-good) 12%, white)', fg: 'var(--status-good)' }
          : { bg: 'var(--stone)', fg: 'var(--fg-muted)' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        fontSize: 11,
        fontWeight: 'var(--fw-semibold)',
        background: tone.bg,
        color: tone.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
