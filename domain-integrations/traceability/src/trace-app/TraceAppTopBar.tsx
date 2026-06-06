import { useEffect, useRef, useState } from 'react'
import { PLANTS, type PlantDescriptor } from './plants.js'

export interface TraceAppTopBarProps {
  readonly activePlant: PlantDescriptor
  readonly onChangePlant: (plant: PlantDescriptor) => void
  readonly query: string
  readonly onChangeQuery: (next: string) => void
  readonly onSubmitQuery: () => void
  readonly showSearch: boolean
}

export function TraceAppTopBar({
  activePlant,
  onChangePlant,
  query,
  onChangeQuery,
  onSubmitQuery,
  showSearch,
}: TraceAppTopBarProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 20px',
        background: 'linear-gradient(135deg, var(--valentia-slate, #005776) 0%, var(--forest, #143700) 100%)',
        color: 'white',
        boxShadow: 'var(--shadow-md, 0 2px 8px rgba(0,0,0,0.12))',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 0.4,
            color: 'white',
          }}
        >
          Trace
        </div>
      </div>

      <div ref={ref} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            color: 'white',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
          }}
        >
          <PlantIcon />
          <span style={{ textAlign: 'left', lineHeight: 1.1 }}>
            <span style={{ display: 'block', fontSize: 10, opacity: 0.7, textTransform: 'uppercase' }}>
              Active plant
            </span>
            <span style={{ fontWeight: 600 }}>
              {activePlant.name} · {activePlant.code}
            </span>
          </span>
          <CaretIcon />
        </button>
        {open && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              minWidth: 280,
              background: 'white',
              color: 'var(--forest, #143700)',
              border: '1px solid var(--shell-line, #E5E3D7)',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: 6,
              zIndex: 50,
            }}
          >
            <div
              style={{
                padding: '4px 8px',
                fontSize: 11,
                color: 'var(--shell-fg-2)',
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
              Plants you can access
            </div>
            {PLANTS.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onChangePlant(p)
                  setOpen(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onChangePlant(p)
                    setOpen(false)
                  }
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: p.id === activePlant.id ? 'var(--shell-surface-2, #F1F1E5)' : 'transparent',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-2)' }}>
                    {p.code} · {p.country}
                  </div>
                </div>
                {p.id === activePlant.id && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 999,
                      background: 'var(--jade, #44CF93)',
                      color: 'white',
                      fontWeight: 600,
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
            ))}
            <div
              style={{
                borderTop: '1px solid var(--shell-line, #E5E3D7)',
                marginTop: 6,
                paddingTop: 6,
                padding: '6px 8px',
                fontSize: 11,
                color: 'var(--shell-fg-2)',
              }}
            >
              Queries returning data across plants are not filtered by your active plant.
            </div>
          </div>
        )}
      </div>

      {showSearch ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <input
            type="search"
            placeholder="Search batch · material · process order · delivery"
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmitQuery()
            }}
            style={{
              flex: 1,
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              color: 'white',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ textAlign: 'right', lineHeight: 1.1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>S. Murphy</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>QA Lead · {activePlant.region}</div>
        </div>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--sunrise, #F9C20A)',
            color: 'var(--forest, #143700)',
            fontWeight: 700,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          SM
        </div>
      </div>
    </div>
  )
}

function CaretIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function PlantIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
    </svg>
  )
}
