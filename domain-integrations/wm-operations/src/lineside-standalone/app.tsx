/**
 * Standalone Lineside Monitor app — PEX-E-35
 *
 * Unattended wallboard route. Plant and line are read from URL search params:
 *   ?plant=C351&line=LINE_A
 *
 * FRESHNESS NOTE (ADR-017):
 * This board shows a persistent STALE banner until the ADR-017 pilot cadence
 * (15-min triggered silver+gold) is enabled. The caveats banner is always visible
 * in standalone mode to ensure operators and supervisors are not misled into treating
 * daily-cadence data as live.
 */

import { useEffect, useState } from 'react'
import { LinesideMonitorView } from '../views/lineside-monitor-view.js'
import { LINESIDE_STANDALONE_CAVEATS } from './caveats.js'
import type { WmOperationsAdapterRequest } from '../adapters/wm-operations-adapter.js'

function getUrlParams(): { plant: string; line: string } {
  if (typeof window === 'undefined') return { plant: '', line: '' }
  const params = new URLSearchParams(window.location.search)
  return {
    plant: (params.get('plant') ?? '').toUpperCase(),
    line: params.get('line') ?? '',
  }
}

export function LinesideMonitorStandaloneApp() {
  const [urlParams, setUrlParams] = useState(getUrlParams)

  // Re-read params if the URL changes (pushState navigation)
  useEffect(() => {
    const handler = () => setUrlParams(getUrlParams())
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const request: WmOperationsAdapterRequest = {
    plantId: urlParams.plant || undefined,
    warehouseId: undefined,
  }

  return (
    <>
      {/* Caveats are injected via the showCaveats prop — always visible in standalone mode */}
      <LinesideMonitorView
        request={request}
        initialLineId={urlParams.line}
        showCaveats
        refreshIntervalMs={60_000}
      />
      {/* Hidden element carrying full caveats for accessibility / screen reader */}
      <div id="lineside-caveats" style={{ display: 'none' }}>
        {LINESIDE_STANDALONE_CAVEATS.map(caveat => (
          <p key={caveat}>{caveat}</p>
        ))}
      </div>
    </>
  )
}
