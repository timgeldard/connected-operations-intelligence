import { useState, useEffect } from 'react'
import { UAT_CANDIDATE } from '../constants.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

const DEFAULT_MATERIAL = '100023847'
const DEFAULT_BATCH = 'CH-240308-0047'
const DEFAULT_PLANT = 'IE10'
const DEFAULT_DIRECTION = 'both' as const
const DEFAULT_MAX_DEPTH = 5
const DEFAULT_MAX_EDGES = 1000

type Direction = 'both' | 'upstream' | 'downstream'

export interface TraceQueryFormProps {
  onSubmit: (request: Trace2AdapterRequest) => void
  initialMaterialId?: string
  initialBatchId?: string
  initialPlantId?: string
  hideCandidateButton?: boolean
}

/** Returns a stored-key suggestion if the input looks like an 18-char SAP ALPHA-padded material ID. */
function buildSuggestion(materialId: string): string | null {
  if (/^\d{18}$/.test(materialId) && materialId.startsWith('0')) {
    const stripped = materialId.replace(/^0+/, '')
    return stripped !== materialId ? stripped : null
  }
  return null
}

/**
 * Shared trace query form used by TraceTreeView and any other surface that needs
 * a material/batch/plant anchor with direction and depth controls.
 *
 * Features:
 * - §5 recent searches (last 3 in component state, one-click reload)
 * - §5 copy payload button (JSON for direct API use)
 * - §6 material ID normalization warning for 18-char zero-padded inputs
 */
export function TraceQueryForm({
  onSubmit,
  initialMaterialId,
  initialBatchId,
  initialPlantId,
  hideCandidateButton = false,
}: TraceQueryFormProps) {
  const [materialId, setMaterialId] = useState(initialMaterialId ?? DEFAULT_MATERIAL)
  const [batchId, setBatchId] = useState(initialBatchId ?? DEFAULT_BATCH)
  const [plantId, setPlantId] = useState(initialPlantId ?? DEFAULT_PLANT)
  const [direction, setDirection] = useState<Direction>(DEFAULT_DIRECTION)
  const [maxDepth, setMaxDepth] = useState(DEFAULT_MAX_DEPTH)
  const [maxEdges, setMaxEdges] = useState(DEFAULT_MAX_EDGES)
  const [recentSearches, setRecentSearches] = useState<readonly Trace2AdapterRequest[]>([])
  const [copyLabel, setCopyLabel] = useState('Copy payload')

  // Sync state with props if they change (e.g. from Load UAT Candidate in parent)
  useEffect(() => {
    if (initialMaterialId !== undefined) setMaterialId(initialMaterialId)
    if (initialBatchId !== undefined) setBatchId(initialBatchId)
    if (initialPlantId !== undefined) setPlantId(initialPlantId)
  }, [initialMaterialId, initialBatchId, initialPlantId])

  const suggestion = buildSuggestion(materialId)

  function buildRequest(): Trace2AdapterRequest {
    return { investigationId: '', materialId: materialId.trim(), batchId: batchId.trim(), plantId: plantId.trim(), direction, maxDepth, maxEdges }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const req = buildRequest()
    setRecentSearches(prev => {
      const filtered = prev.filter(
        r =>
          !(
            r.materialId === req.materialId &&
            r.batchId === req.batchId &&
            r.direction === req.direction &&
            r.maxDepth === req.maxDepth &&
            r.maxEdges === req.maxEdges
          ),
      )
      return [req, ...filtered].slice(0, 3)
    })
    onSubmit(req)
  }

  function handleReset() {
    setMaterialId(DEFAULT_MATERIAL)
    setBatchId(DEFAULT_BATCH)
    setPlantId(DEFAULT_PLANT)
    setDirection(DEFAULT_DIRECTION)
    setMaxDepth(DEFAULT_MAX_DEPTH)
    setMaxEdges(DEFAULT_MAX_EDGES)
  }

  function handleLoadUatCandidate() {
    setMaterialId(UAT_CANDIDATE.materialId)
    setBatchId(UAT_CANDIDATE.batchId)
    setPlantId(UAT_CANDIDATE.plantId)
    setDirection(DEFAULT_DIRECTION)
    setMaxDepth(DEFAULT_MAX_DEPTH)
    setMaxEdges(DEFAULT_MAX_EDGES)
  }

  async function handleCopy() {
    const payload = buildRequest()
    const json = JSON.stringify(payload, null, 2)
    try {
      await navigator.clipboard.writeText(json)
      setCopyLabel('Copied!')
      setTimeout(() => setCopyLabel('Copy payload'), 2000)
    } catch (err) {
      console.error('Failed to copy payload:', err)
      setCopyLabel('Failed')
      setTimeout(() => setCopyLabel('Copy payload'), 2000)
    }
  }

  function reloadRecent(req: Trace2AdapterRequest) {
    setMaterialId(req.materialId ?? DEFAULT_MATERIAL)
    setBatchId(req.batchId ?? DEFAULT_BATCH)
    setPlantId(req.plantId ?? DEFAULT_PLANT)
    setDirection((req.direction ?? DEFAULT_DIRECTION) as Direction)
    setMaxDepth(req.maxDepth ?? DEFAULT_MAX_DEPTH)
    setMaxEdges(req.maxEdges ?? DEFAULT_MAX_EDGES)
    onSubmit(req)
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    padding: '8px 12px',
    border: '1px solid var(--shell-line)',
    borderRadius: '4px',
    background: 'var(--shell-surface)',
    color: 'var(--shell-fg)',
    fontSize: '13px'
  }
  const selectStyle: React.CSSProperties = { ...inputStyle, padding: '7px 12px' }
  const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--shell-fg-2)' }
  const helperStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 400, color: 'var(--shell-fg-3)', marginTop: '2px' }

  return (
    <div data-testid="trace-query-form" style={{ background: 'var(--shell-surface-2)', padding: '20px', borderRadius: '8px', border: '1px solid var(--shell-line)' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <label style={labelStyle}>
            Material ID
            <input
              type="text"
              value={materialId}
              onChange={e => setMaterialId(e.target.value)}
              data-testid="input-material-id"
              placeholder="e.g. 20035129"
              style={inputStyle}
            />
            {suggestion && (
              <button
                type="button"
                data-testid="material-id-suggestion"
                onClick={() => setMaterialId(suggestion)}
                style={{
                  fontSize: '11px',
                  color: 'var(--shell-accent)',
                  cursor: 'pointer',
                  marginTop: '4px',
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  display: 'block'
                }}
              >
                Use normalized ID: {suggestion}
              </button>
            )}
            <span style={helperStyle}>SAP material number or normalized identifier</span>
          </label>
          <label style={labelStyle}>
            Batch ID
            <input
              type="text"
              value={batchId}
              onChange={e => setBatchId(e.target.value)}
              data-testid="input-batch-id"
              placeholder="e.g. 8000049668"
              style={inputStyle}
            />
            <span style={helperStyle}>SAP batch / lot identifier (preserves leading zeros)</span>
          </label>
          <label style={labelStyle}>
            Plant ID
            <input
              type="text"
              value={plantId}
              onChange={e => setPlantId(e.target.value)}
              data-testid="input-plant-id"
              placeholder="e.g. C061"
              style={inputStyle}
            />
            <span style={helperStyle}>SAP plant code</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', borderTop: '1px solid var(--shell-line)', paddingTop: '16px' }}>
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
              <option value={5}>5</option>
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
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
            <button
              type="button"
              onClick={handleReset}
              data-testid="btn-reset"
              style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid var(--shell-line)', background: 'transparent', cursor: 'pointer', fontSize: '13px' }}
            >
              Reset
            </button>
            {!hideCandidateButton && (
              <button
                type="button"
                onClick={handleLoadUatCandidate}
                data-testid="btn-load-uat-candidate"
                style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid var(--shell-line)', background: 'var(--shell-surface)', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
              >
                Load UAT Candidate
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              data-testid="btn-copy-payload"
              style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid var(--shell-line)', background: 'transparent', cursor: 'pointer', fontSize: '13px' }}
            >
              {copyLabel}
            </button>
            <button
              type="submit"
              data-testid="btn-run-trace"
              style={{
                padding: '8px 24px',
                borderRadius: '4px',
                border: 'none',
                background: 'var(--shell-accent, #0066CC)',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Run Trace
            </button>
          </div>
        </div>
      </form>

      {recentSearches.length > 0 && (
        <div
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}
          aria-label="Recent searches"
        >
          <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Recent:</span>
          {recentSearches.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => reloadRecent(r)}
              data-testid={`btn-recent-${i}`}
              style={{ fontSize: 11, padding: '2px 8px', fontFamily: 'monospace' }}
            >
              {r.materialId} / {r.batchId}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
