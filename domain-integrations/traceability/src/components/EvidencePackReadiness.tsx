import React, { useState, useEffect, useRef } from 'react'
import type { ConfidenceResult } from './EvidenceConfidence.js'

export interface EvidencePackReadinessProps {
  readonly confidence: ConfidenceResult
  readonly style?: React.CSSProperties
}

export function EvidencePackReadiness({ confidence, style }: EvidencePackReadinessProps) {
  const initialSectors = [
    { id: 'lineage', label: 'Lineage map loaded', autoCompleted: confidence.details.lineage === 'complete' },
    { id: 'customers', label: 'Customer & delivery records available', autoCompleted: confidence.details.customers === 'complete' },
    { id: 'massBalance', label: 'Mass balance reconciled', autoCompleted: confidence.details.massBalance === 'complete' },
    { id: 'quality', label: 'Quality inspection lots parsed', autoCompleted: confidence.details.quality === 'complete' },
    { id: 'coa', label: 'Certificate of Analysis issued', autoCompleted: confidence.details.coa === 'complete' },
    { id: 'suppliers', label: 'Upstream suppliers verified', autoCompleted: confidence.details.suppliers === 'complete' },
  ]

  // Keep track of manual QA override checkmarks (initialize with system-verified checkmarks)
  const [checkedSectors, setCheckedSectors] = useState<Record<string, boolean>>(() => ({
    lineage: confidence.details.lineage === 'complete',
    customers: confidence.details.customers === 'complete',
    massBalance: confidence.details.massBalance === 'complete',
    quality: confidence.details.quality === 'complete',
    coa: confidence.details.coa === 'complete',
    suppliers: confidence.details.suppliers === 'complete',
  }))
  const [dossierCompiled, setDossierCompiled] = useState(false)

  // Keep track of previous confidence details to prevent resetting manual overrides on re-render
  const { lineage, customers, massBalance, quality, coa, suppliers } = confidence.details
  const prevDetailsRef = useRef({ lineage, customers, massBalance, quality, coa, suppliers })

  // Sync automatic checkmarks from the calculated payload when primitive statuses change
  useEffect(() => {
    const prevDetails = prevDetailsRef.current
    let changed = false
    const changes: Record<string, boolean> = {}

    const currentDetails = { lineage, customers, massBalance, quality, coa, suppliers }
    const keys = ['lineage', 'customers', 'massBalance', 'quality', 'coa', 'suppliers'] as const
    for (const key of keys) {
      const wasComplete = prevDetails[key] === 'complete'
      const isComplete = currentDetails[key] === 'complete'
      if (isComplete !== wasComplete) {
        changes[key] = isComplete
        changed = true
      }
    }

    if (changed) {
      setCheckedSectors((prev) => ({
        ...prev,
        ...changes,
      }))
      setDossierCompiled(false)
    }

    prevDetailsRef.current = currentDetails
  }, [lineage, customers, massBalance, quality, coa, suppliers])

  const handleToggle = (id: string) => {
    if (dossierCompiled) return
    setCheckedSectors((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const totalSectors = initialSectors.length
  const verifiedCount = Object.values(checkedSectors).filter(Boolean).length
  const percentCompleted = Math.round((verifiedCount / totalSectors) * 100)
  const isFullyReady = verifiedCount === totalSectors

  return (
    <div
      style={{
        background: 'var(--shell-surface, #FFFFFF)',
        border: '1px solid var(--shell-line, #DAD9C9)',
        borderRadius: 8,
        padding: '24px 28px',
        boxShadow: '0 2px 6px rgba(14, 31, 10, 0.04)',
        fontFamily: 'var(--font-sans, sans-serif)',
        ...style,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: 'var(--shell-fg, #0E1F0A)', fontWeight: 600 }}>
          Evidence Pack Readiness
        </h3>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--shell-fg-2, #4A5C45)', lineHeight: 1.4 }}>
          Dossier compilation checklist for quality and food safety compliance.
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: 'var(--shell-fg, #0E1F0A)' }}>Readiness Progress</span>
          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: 'var(--shell-accent, #005776)' }}>
            {verifiedCount} / {totalSectors} ({percentCompleted}%)
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--shell-bg, #F7F7F1)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
          <div
            style={{
              width: `${percentCompleted}%`,
              height: '100%',
              background: isFullyReady ? 'var(--shell-good, #1F8B4C)' : 'var(--shell-accent, #005776)',
              transition: 'width 0.3s ease, background-color 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Checklist Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {initialSectors.map((s) => {
          const isChecked = !!checkedSectors[s.id]
          return (
            <label
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 12px',
                border: '1px solid var(--shell-line, #DAD9C9)',
                background: isChecked ? 'var(--shell-surface, #FFFFFF)' : 'var(--shell-surface-2, #FAFAF3)',
                borderRadius: 6,
                cursor: dossierCompiled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggle(s.id)}
                disabled={dossierCompiled}
                style={{
                  width: 14,
                  height: 14,
                  accentColor: 'var(--shell-accent, #005776)',
                  cursor: dossierCompiled ? 'not-allowed' : 'pointer',
                }}
              />
              <span
                style={{
                  fontSize: 12.5,
                  color: isChecked ? 'var(--shell-fg, #0E1F0A)' : 'var(--shell-fg-3, #7A8A75)',
                  fontWeight: isChecked ? 500 : 400,
                  textDecoration: isChecked && dossierCompiled ? 'line-through' : 'none',
                }}
              >
                {s.label}
              </span>
              {s.autoCompleted && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 9,
                    color: 'var(--shell-good, #1F8B4C)',
                    background: 'rgba(31, 139, 76, 0.08)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                  }}
                >
                  System Verified
                </span>
              )}
            </label>
          )
        })}
      </div>

      {/* Interactive Action Button */}
      {dossierCompiled ? (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(31, 139, 76, 0.08)',
            border: '1px solid rgba(31, 139, 76, 0.25)',
            borderRadius: 6,
            textAlign: 'center',
            color: 'var(--shell-good, #1F8B4C)',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          ✓ Dossier Compiled & Digitally Signed by Kerry QA
        </div>
      ) : (
        <button
          onClick={() => {
            if (isFullyReady) setDossierCompiled(true)
          }}
          disabled={!isFullyReady}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: isFullyReady ? 'var(--shell-good, #1F8B4C)' : 'var(--shell-line, #DAD9C9)',
            color: isFullyReady ? '#FFFFFF' : 'var(--shell-fg-3, #7A8A75)',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 13,
            cursor: isFullyReady ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
            textAlign: 'center',
          }}
        >
          {isFullyReady ? 'Compile Evidence Dossier' : 'Complete Verification to Compile'}
        </button>
      )}
    </div>
  )
}
