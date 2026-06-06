import { useState } from 'react'
import { TraceGraphPanel } from '../panels/trace-graph-panel.js'
import { BatchHeaderPanel } from '../panels/batch-header-panel.js'
import { TraceQueryForm } from '../forms/trace-query-form.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Props for TraceTreeView. */
export interface TraceTreeViewProps {
  /** Adapter request context. Scope values (batchId/materialId/plantId) pre-fill the form. */
  readonly request: Trace2AdapterRequest
}

/**
 * Trace Tree view for the Trace Investigation workspace.
 *
 * @remarks
 * Provides a self-contained anchor form so the view works standalone at
 * ?workspace=traceability-workspace&view=trace-tree with no scope context.
 * Panels are only rendered after the user submits the form — preventing mock
 * fallback from BatchHeaderPanel (which calls legacy-api with empty batchId).
 *
 * RiskSignalsPanel is intentionally excluded: its adapter method is not yet
 * wired (base Trace2Adapter returns mock regardless of batchId). Add back when
 * a databricks-api or legacy-api override exists for getRiskSignals.
 */
export function TraceTreeView({ request }: TraceTreeViewProps) {
  const [submittedRequest, setSubmittedRequest] = useState<Trace2AdapterRequest | null>(null)

  return (
    <div style={{ display: 'grid', gap: 12, padding: 16, gridColumn: '1 / -1' }}>
      <div>
        <p style={{ fontSize: 12, color: 'var(--shell-fg-2)', margin: '0 0 8px 0' }}>
          Native Databricks trace graph — <code>gold_batch_lineage</code>. No mock fallback.
          Material IDs use stored format (no leading zeros). Batch IDs preserve leading zeros.
        </p>
        <TraceQueryForm
          onSubmit={setSubmittedRequest}
          initialMaterialId={request.materialId}
          initialBatchId={request.batchId}
          initialPlantId={request.plantId}
        />
      </div>

      {submittedRequest && (
        <>
          <details style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
            <summary style={{ cursor: 'pointer' }}>Technical details — last request payload</summary>
            <pre
              data-testid="last-request-payload"
              style={{ margin: '8px 0 0 0', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap' }}
            >
              {JSON.stringify(
                {
                  material_id: submittedRequest.materialId,
                  batch_id: submittedRequest.batchId,
                  plant_id: submittedRequest.plantId,
                  direction: submittedRequest.direction ?? 'both',
                  max_depth: submittedRequest.maxDepth ?? 3,
                  max_edges: submittedRequest.maxEdges ?? 1000,
                },
                null,
                2,
              )}
            </pre>
          </details>

          <TraceGraphPanel request={submittedRequest} />

          {submittedRequest.batchId && submittedRequest.materialId && (
            <BatchHeaderPanel request={submittedRequest} />
          )}
        </>
      )}
    </div>
  )
}
