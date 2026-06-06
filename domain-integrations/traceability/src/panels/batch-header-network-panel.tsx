import { useEffect, useState } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { BatchHeaderSummary } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'

const registration: EvidencePanelRegistration = {
  panelId: 'batch-header-network',
  displayName: 'Batch Overview',
  description:
    'Batch identity with stock-bucket distribution for the network investigation view.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['trace-investigation'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: {
    staleAfterSeconds: 300,
    errorAfterSeconds: 900,
    refreshOnFocus: true,
    pollIntervalSeconds: null,
  },
  confidencePolicy: { level: 0.99, hidden: false },
  drillThrough: {
    label: 'Open in Trace2',
    targetWorkspaceId: 'traceability-workspace',
    targetViewId: 'trace',
    contextScopes: ['batch'],
  },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

export interface StockBucket {
  readonly key: 'unrestricted' | 'blocked' | 'qualityInspection' | 'restricted' | 'transit'
  readonly label: string
  readonly value: number
  readonly color: string
}

export interface BatchHeaderNetworkPanelProps {
  readonly result?: AdapterResult<BatchHeaderSummary>
  readonly isLoading?: boolean
  readonly onStockBucketClick?: (bucket: StockBucket) => void
}

const STOCK_BUCKET_COLORS = {
  unrestricted: 'var(--jade)',
  blocked: 'var(--sunset)',
  qualityInspection: 'var(--sage)',
  restricted: 'var(--sunrise)',
  transit: 'var(--ink-400, #6B7280)',
} as const

function statusToneColor(status: string): string {
  switch (status) {
    case 'unrestricted':
    case 'accepted':
    case 'released':
      return 'var(--jade)'
    case 'blocked':
    case 'rejected':
      return 'var(--sunset)'
    case 'quality-inspection':
    case 'pending':
    case 'conditional':
      return 'var(--sage)'
    case 'restricted':
    case 'not-released':
      return 'var(--sunrise)'
    default:
      return 'var(--shell-fg-3)'
  }
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        background: `${statusToneColor(status)}1A`,
        color: statusToneColor(status),
        border: `1px solid ${statusToneColor(status)}`,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  )
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--shell-fg-2)' }}>{label}</p>
      <p
        style={{
          margin: '2px 0 0',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--forest)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </p>
    </div>
  )
}

function StockBucketRow({
  bucket,
  totalStock,
  onClick,
}: {
  bucket: StockBucket
  totalStock: number
  onClick?: () => void
}) {
  const percentage = totalStock > 0 ? (bucket.value / totalStock) * 100 : 0
  const [hovered, setHovered] = useState(false)
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: onClick ? 'pointer' : 'default', padding: '2px 0' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: hovered ? 'var(--valentia-slate)' : 'var(--forest)',
            transition: 'color 0.15s',
          }}
        >
          {bucket.label}
        </span>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--shell-fg-2)' }}>
          {bucket.value.toLocaleString()} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: 'var(--shell-line)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            background: bucket.color,
            opacity: bucket.value === 0 ? 0.3 : 1,
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  )
}

export function BatchHeaderNetworkPanel({
  result,
  isLoading = false,
  onStockBucketClick,
}: BatchHeaderNetworkPanelProps) {
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) {
      markReady()
    } else if (result && !result.ok) {
      markError()
    }
  }, [isLoading, result, markReady, markError])

  const data: BatchHeaderSummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--forest)' }}>
                  Batch Overview
                </h3>
                <StatusPill status={data.stockStatus} />
              </div>
              <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 12, color: 'var(--shell-fg-2)' }}>
                {data.batchId} · {data.materialId}
              </p>
            </div>
            <StatusPill status={data.qualityStatus} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <MetaField label="Material" value={data.materialDescription} />
            <MetaField label="Plant" value={data.plantName ?? data.plantId} />
            <MetaField
              label="Manufacture Date"
              value={data.manufactureDate ? new Date(data.manufactureDate).toLocaleDateString() : 'N/A'}
            />
            <MetaField
              label="Expiry Date"
              value={data.expiryDate ? new Date(data.expiryDate).toLocaleDateString() : 'N/A'}
            />
          </div>

          <StockDistribution data={data} onClick={onStockBucketClick} />

          {data.processOrderId && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 12 }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--shell-fg-2)' }}>Process Order</p>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 13,
                  fontFamily: 'monospace',
                  color: 'var(--valentia-slate)',
                }}
              >
                {data.processOrderId}
              </p>
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

function StockDistribution({
  data,
  onClick,
}: {
  data: BatchHeaderSummary
  onClick?: (bucket: StockBucket) => void
}) {
  const buckets: StockBucket[] = [
    { key: 'unrestricted', label: 'Unrestricted', value: data.unrestricted ?? 0, color: STOCK_BUCKET_COLORS.unrestricted },
    { key: 'blocked', label: 'Blocked', value: data.blocked ?? 0, color: STOCK_BUCKET_COLORS.blocked },
    { key: 'qualityInspection', label: 'QC Inspection', value: data.qualityInspection ?? 0, color: STOCK_BUCKET_COLORS.qualityInspection },
    { key: 'restricted', label: 'Restricted', value: data.restricted ?? 0, color: STOCK_BUCKET_COLORS.restricted },
    { key: 'transit', label: 'In Transit', value: data.transit ?? 0, color: STOCK_BUCKET_COLORS.transit },
  ]
  const totalStock = buckets.reduce((sum, b) => sum + b.value, 0)

  return (
    <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--forest)' }}>
          Stock Distribution
        </h4>
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--shell-fg-2)' }}>
          Total: {totalStock.toLocaleString()} {data.uom ?? 'units'}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {buckets.map((bucket) => (
          <StockBucketRow
            key={bucket.key}
            bucket={bucket}
            totalStock={totalStock}
            onClick={onClick ? () => onClick(bucket) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
