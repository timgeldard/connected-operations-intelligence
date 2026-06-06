import { useState } from 'react'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'
import { TraceQueryForm } from '../forms/trace-query-form.js'
import { BatchHeaderPanel } from '../panels/batch-header-panel.js'
import { TraceGeniePilotPanel } from '../panels/trace-genie-pilot-panel.js'
import { TraceGraphPanel } from '../panels/trace-graph-panel.js'

export interface TraceGeniePilotViewProps {
  readonly request: Trace2AdapterRequest
}

export function TraceGeniePilotView({ request }: TraceGeniePilotViewProps) {
  const [submittedRequest, setSubmittedRequest] = useState<Trace2AdapterRequest | null>(null)

  return (
    <div style={{ display: 'grid', gap: 12, padding: 16, gridColumn: '1 / -1' }}>
      <div>
        <p style={{ fontSize: 12, color: 'var(--shell-fg-2)', margin: '0 0 8px 0' }}>
          Domain-scoped Traceability assistant pilot. Answers are limited to the focal batch summary and the currently visible trace graph. No customer exposure, supplier impact, mass balance, quality/release, or recall decisions.
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
          <TraceGeniePilotPanel request={submittedRequest} />
          <TraceGraphPanel request={submittedRequest} />
          {submittedRequest.batchId && submittedRequest.materialId && (
            <BatchHeaderPanel request={submittedRequest} />
          )}
        </>
      )}
    </div>
  )
}
