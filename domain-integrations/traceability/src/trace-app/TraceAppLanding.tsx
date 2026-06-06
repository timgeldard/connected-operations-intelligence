import { useState } from 'react'
import { UAT_CANDIDATE } from '../constants.js'

export interface TraceAppLandingProps {
  /** Submitted when the user picks a (material, batch, plant) to investigate. */
  readonly onSearch: (resolved: { materialId: string; batchId: string; plantId: string }) => void
}

const EXAMPLE_HINTS = [
  { lbl: 'Batch', val: 'CH-240308-0047' },
  { lbl: 'Material', val: '100023847' },
  { lbl: 'Process order', val: 'PO-2024-03-0847' },
  { lbl: 'Delivery', val: '8030054411' },
]

/**
 * Landing screen for the Trace App.
 *
 * @remarks
 * The original design shows a single search input that intends to resolve any
 * of (batch / material / process order / delivery / CoA) to a `{materialId,
 * batchId, plantId}` triple via a backend `searchBatches` endpoint. That
 * endpoint does not exist yet. For slice 1 the landing exposes the three
 * required identifiers as discrete inputs and offers a "Load UAT candidate"
 * shortcut so the workspace is usable end-to-end against the verified
 * Databricks fixtures.
 */
export function TraceAppLanding({ onSearch }: TraceAppLandingProps) {
  const [materialId, setMaterialId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [plantId, setPlantId] = useState('')

  function submit() {
    if (!materialId.trim() || !batchId.trim()) return
    onSearch({
      materialId: materialId.trim(),
      batchId: batchId.trim(),
      plantId: plantId.trim(),
    })
  }

  function loadCandidate() {
    setMaterialId(UAT_CANDIDATE.materialId)
    setBatchId(UAT_CANDIDATE.batchId)
    setPlantId(UAT_CANDIDATE.plantId)
    onSearch({ ...UAT_CANDIDATE })
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '64px 24px',
        minHeight: 'calc(100vh - 100px)',
        background: 'var(--shell-surface, #FAFAF6)',
      }}
    >
      <div style={{ maxWidth: 720, width: '100%' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: 'var(--valentia-slate, #005776)',
            marginBottom: 8,
          }}
        >
          Traceability · Inquiry
        </div>

        <h1
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: 'var(--forest, #143700)',
            margin: '0 0 12px',
            lineHeight: 1.1,
          }}
        >
          Trace a batch.
        </h1>

        <p
          style={{
            fontSize: 15,
            color: 'var(--shell-fg-2)',
            lineHeight: 1.5,
            margin: '0 0 32px',
            maxWidth: 600,
          }}
        >
          Enter the material, batch, and plant to investigate lineage, exposure, holds, and quality
          history. Queries cross plant boundaries — you see the full picture.
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 20,
            border: '1px solid var(--shell-line, #E5E3D7)',
            borderRadius: 12,
            background: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <LandingField
            label="Material ID"
            placeholder="e.g. 100023847"
            value={materialId}
            onChange={setMaterialId}
            onSubmit={submit}
          />
          <LandingField
            label="Batch ID"
            placeholder="e.g. CH-240308-0047 (preserve leading zeros)"
            value={batchId}
            onChange={setBatchId}
            onSubmit={submit}
          />
          <LandingField
            label="Plant ID (optional)"
            placeholder="e.g. IE10. Leave blank to search across all plants the batch touched."
            value={plantId}
            onChange={setPlantId}
            onSubmit={submit}
          />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <button
              type="button"
              onClick={loadCandidate}
              style={{
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid var(--shell-line, #E5E3D7)',
                borderRadius: 6,
                background: 'transparent',
                color: 'var(--valentia-slate, #005776)',
                cursor: 'pointer',
              }}
            >
              Load UAT candidate
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!materialId.trim() || !batchId.trim()}
              style={{
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                borderRadius: 6,
                background:
                  !materialId.trim() || !batchId.trim()
                    ? 'var(--shell-line, #E5E3D7)'
                    : 'var(--valentia-slate, #005776)',
                color: 'white',
                cursor: !materialId.trim() || !batchId.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Investigate
              <ArrowRight />
            </button>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {EXAMPLE_HINTS.map((h) => (
            <div
              key={h.val}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid var(--shell-line, #E5E3D7)',
                background: 'white',
                fontSize: 11,
                color: 'var(--shell-fg-2)',
              }}
            >
              <span style={{ fontWeight: 600, marginRight: 6 }}>{h.lbl}</span>
              <span style={{ fontFamily: 'monospace' }}>{h.val}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 32,
            display: 'flex',
            gap: 12,
            fontSize: 11,
            color: 'var(--shell-fg-2)',
            flexWrap: 'wrap',
          }}
        >
          <span>
            Search scope: <b>all plants</b>
          </span>
          <span>·</span>
          <span>
            Data freshness: <b>live · ERP gold views</b>
          </span>
          <span>·</span>
          <span>Read-only · no posting back to SAP</span>
        </div>
      </div>
    </div>
  )
}

function LandingField({
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--shell-fg-2)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit()
        }}
        style={{
          width: '100%',
          padding: '10px 12px',
          fontSize: 13,
          fontFamily: 'monospace',
          border: '1px solid var(--shell-line, #E5E3D7)',
          borderRadius: 6,
          background: 'var(--shell-surface, #FAFAF6)',
          color: 'var(--forest, #143700)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

function ArrowRight() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}
