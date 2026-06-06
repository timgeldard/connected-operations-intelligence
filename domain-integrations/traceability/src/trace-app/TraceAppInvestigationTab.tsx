import { useState } from 'react'
import { BatchHeaderNetworkPanel } from '../panels/batch-header-network-panel.js'
import type { StockBucket } from '../panels/batch-header-network-panel.js'
import { CustomerExposureNetworkPanel } from '../panels/customer-exposure-network-panel.js'
import {
  TraceGraphNetworkPanel,
  type RiskFilter,
} from '../panels/trace-graph-network-panel.js'
import type { TraceNode } from '@connectio/data-contracts'
import {
  useBatchHeaderSummary,
  useCustomerExposureSummary,
  useTraceGraph,
} from '../adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

export interface TraceAppInvestigationTabProps {
  readonly request: Trace2AdapterRequest
}

/**
 * Investigation tab for the Trace App workspace.
 *
 * @remarks
 * Reuses the existing `*NetworkPanel` panels and their live hooks
 * (`useBatchHeaderSummary`, `useCustomerExposureSummary`, `useTraceGraph`).
 * The TraceTreeView from the design is deferred to a follow-on slice — the
 * D3 graph panel covers the lineage-visualisation requirement for slice 1.
 */
export function TraceAppInvestigationTab({ request }: TraceAppInvestigationTabProps) {
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
  const [selectedBucket, setSelectedBucket] = useState<StockBucket | null>(null)
  const [selectedNode, setSelectedNode] = useState<TraceNode | null>(null)
  const batchHeaderQuery = useBatchHeaderSummary(request)
  const customerExposureQuery = useCustomerExposureSummary(request)
  const traceGraphQuery = useTraceGraph(request)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          background: 'var(--shell-surface-2, #F1F1E5)',
          border: '1px solid var(--shell-line, #E5E3D7)',
          borderRadius: 8,
        }}
      >
        <label
          htmlFor="trace-app-risk-filter"
          style={{ fontSize: 12, fontWeight: 500, color: 'var(--shell-fg-2)' }}
        >
          Risk filter:
        </label>
        <select
          id="trace-app-risk-filter"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
          style={{
            padding: '4px 8px',
            fontSize: 12,
            border: '1px solid var(--shell-line, #E5E3D7)',
            borderRadius: 4,
            background: 'white',
            color: 'var(--forest, #143700)',
            fontFamily: 'inherit',
          }}
        >
          <option value="all">All nodes</option>
          <option value="critical">Critical+</option>
          <option value="high">High+</option>
          <option value="medium">Medium+</option>
          <option value="low">Low+</option>
        </select>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 16,
        }}
      >
        <BatchHeaderNetworkPanel
          result={batchHeaderQuery.data}
          isLoading={batchHeaderQuery.isLoading}
          onStockBucketClick={setSelectedBucket}
        />
        <CustomerExposureNetworkPanel
          result={customerExposureQuery.data}
          isLoading={customerExposureQuery.isLoading}
        />
      </div>

      <TraceGraphNetworkPanel
        result={traceGraphQuery.data}
        isLoading={traceGraphQuery.isLoading}
        riskFilter={riskFilter}
        onNodeClick={setSelectedNode}
      />

      {selectedBucket && (
        <InlineDetail
          label={`${selectedBucket.label} stock`}
          value={selectedBucket.value.toLocaleString()}
          onDismiss={() => setSelectedBucket(null)}
        />
      )}
      {selectedNode && (
        <InlineDetail
          label="Selected lineage node"
          value={
            selectedNode.batchId
              ? `${selectedNode.materialDescription} (${selectedNode.batchId})`
              : selectedNode.materialDescription
          }
          subtitle={`${selectedNode.type ?? 'unknown'} · depth ${selectedNode.depth ?? 0} · ${selectedNode.riskLevel ?? 'none'}`}
          onDismiss={() => setSelectedNode(null)}
        />
      )}
    </div>
  )
}

function InlineDetail({
  label,
  value,
  subtitle,
  onDismiss,
}: {
  label: string
  value: string
  subtitle?: string
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      style={{
        padding: 12,
        border: '1px solid var(--shell-line, #E5E3D7)',
        borderRadius: 8,
        background: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--shell-fg-2)' }}>{label}</p>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--forest, #143700)',
          }}
        >
          {value}
        </p>
        {subtitle && (
          <p style={{ margin: '2px 0 0', fontSize: 11, fontFamily: 'monospace', color: 'var(--shell-fg-2)' }}>
            {subtitle}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          padding: '4px 10px',
          fontSize: 12,
          border: '1px solid var(--shell-line, #E5E3D7)',
          borderRadius: 4,
          background: 'white',
          color: 'var(--forest, #143700)',
          cursor: 'pointer',
        }}
      >
        Dismiss
      </button>
    </div>
  )
}
