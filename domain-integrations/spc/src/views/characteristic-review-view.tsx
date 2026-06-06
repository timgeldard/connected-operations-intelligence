import { useState } from 'react'
import type { CSSProperties } from 'react'
import { ControlChartPanel } from '../panels/control-chart-panel.js'
import { CharacteristicCapabilityPanel } from '../panels/characteristic-capability-panel.js'
import { useMonitoredCharacteristics } from '../adapters/spc-monitoring-queries.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'
import { SPCSandboxBanner } from './chart-overview-view.js'

const PANEL_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  alignItems: 'start',
}

const SEVERITY_DOT: Record<string, string> = {
  critical: '#D32F2F',
  high: 'var(--sunset, #F24A00)',
  medium: '#D97706',
  low: '#388E3C',
}

export interface CharacteristicReviewViewProps {
  readonly request: SPCMonitoringAdapterRequest
}

export function CharacteristicReviewView({ request }: CharacteristicReviewViewProps) {
  const { data: charsResult } = useMonitoredCharacteristics(request)
  const characteristics = charsResult?.ok ? charsResult.data : []

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const effectiveId = selectedId ?? characteristics[0]?.characteristicId ?? request.characteristicId
  const selectedRequest: SPCMonitoringAdapterRequest = effectiveId
    ? { ...request, characteristicId: effectiveId }
    : request

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <SPCSandboxBanner />
      {characteristics.length > 0 && (
        <div
          role="group"
          aria-label="Characteristic selector"
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
        >
          {characteristics.map(char => {
            const isSelected = effectiveId === char.characteristicId
            const dotColor = char.hasActiveSignal
              ? SEVERITY_DOT[char.highestSignalSeverity ?? 'low'] ?? '#D97706'
              : null
            return (
              <button
                key={char.characteristicId}
                onClick={() => setSelectedId(char.characteristicId)}
                style={{
                  padding: '4px 12px',
                  fontSize: 11,
                  borderRadius: 4,
                  border: `1px solid ${isSelected ? '#2563EB' : 'var(--shell-line)'}`,
                  background: isSelected ? '#2563EB' : 'var(--shell-surface)',
                  color: isSelected ? '#fff' : 'var(--shell-fg)',
                  cursor: 'pointer',
                  fontWeight: isSelected ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                aria-pressed={isSelected}
              >
                {char.characteristicName}
                {dotColor && (
                  <span
                    style={{ width: 6, height: 6, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.85)' : dotColor, flexShrink: 0 }}
                    aria-label={`Active signal: ${char.highestSignalSeverity}`}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
      <div style={PANEL_GRID}>
        <ControlChartPanel request={selectedRequest} />
        <CharacteristicCapabilityPanel request={selectedRequest} />
      </div>
    </div>
  )
}
