import { useState } from 'react'
import { TraceGraphPanel } from '@connectio/di-traceability'
import type { Trace2AdapterRequest } from '@connectio/di-traceability'

// gold_batch_lineage stores material IDs without SAP ALPHA leading zeros.
// '20052009' is the confirmed stored key — not '000000000020052009'.
const DEFAULT_MATERIAL = '20052009'
const DEFAULT_BATCH = '0008602411'
const DEFAULT_PLANT = 'C061'
const DEFAULT_DIRECTION = 'both' as const
const DEFAULT_MAX_DEPTH = 2
const DEFAULT_MAX_EDGES = 100

type Direction = 'both' | 'upstream' | 'downstream'

export function TraceGraphVerifyPage() {
  const [materialId, setMaterialId] = useState(DEFAULT_MATERIAL)
  const [batchId, setBatchId] = useState(DEFAULT_BATCH)
  const [plantId, setPlantId] = useState(DEFAULT_PLANT)
  const [direction, setDirection] = useState<Direction>(DEFAULT_DIRECTION)
  const [maxDepth, setMaxDepth] = useState(DEFAULT_MAX_DEPTH)
  const [maxEdges, setMaxEdges] = useState(DEFAULT_MAX_EDGES)
  const [submitted, setSubmitted] = useState<Trace2AdapterRequest | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted({ investigationId: '', materialId, batchId, plantId, direction, maxDepth, maxEdges })
  }

  const selectStyle = { fontFamily: 'monospace', padding: '4px 8px' }
  const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }

  return (
    <div data-testid="trace-graph-verify-page" style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 4 }}>Batch Traceability Investigation</h2>
      <p style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginBottom: 12 }}>
        Native Databricks trace graph — <code>gold_batch_lineage</code>. No mock fallback.
        Material IDs use stored format (no leading zeros). Batch IDs preserve leading zeros.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={labelStyle}>
          Material ID
          <input
            type="text"
            value={materialId}
            onChange={e => setMaterialId(e.target.value)}
            data-testid="input-material-id"
            style={{ fontFamily: 'monospace', padding: '4px 8px' }}
          />
        </label>
        <label style={labelStyle}>
          Batch ID
          <input
            type="text"
            value={batchId}
            onChange={e => setBatchId(e.target.value)}
            data-testid="input-batch-id"
            style={{ fontFamily: 'monospace', padding: '4px 8px' }}
          />
        </label>
        <label style={labelStyle}>
          Plant ID
          <input
            type="text"
            value={plantId}
            onChange={e => setPlantId(e.target.value)}
            data-testid="input-plant-id"
            style={{ fontFamily: 'monospace', padding: '4px 8px' }}
          />
        </label>
        <label style={labelStyle}>
          Direction
          <select
            value={direction}
            onChange={e => setDirection(e.target.value as Direction)}
            data-testid="select-direction"
            style={selectStyle}
          >
            <option value="both">Both</option>
            <option value="upstream">Upstream</option>
            <option value="downstream">Downstream</option>
          </select>
        </label>
        <label style={labelStyle}>
          Max depth
          <select
            value={maxDepth}
            onChange={e => setMaxDepth(Number(e.target.value))}
            data-testid="select-max-depth"
            style={selectStyle}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
        <label style={labelStyle}>
          Max edges
          <select
            value={maxEdges}
            onChange={e => setMaxEdges(Number(e.target.value))}
            data-testid="select-max-edges"
            style={selectStyle}
          >
            <option value={100}>100</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </label>
        <button type="submit" data-testid="btn-run-trace" style={{ padding: '4px 16px' }}>
          Run Trace
        </button>
      </form>
      {submitted && <TraceGraphPanel request={submitted} />}
    </div>
  )
}
