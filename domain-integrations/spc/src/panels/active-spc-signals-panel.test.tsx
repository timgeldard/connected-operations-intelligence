/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActiveSPCSignalsPanel } from './active-spc-signals-panel.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'
import type { SPCSignal } from '@connectio/data-contracts'

vi.mock('../adapters/spc-monitoring-queries.js', () => ({
  useActiveSPCSignals: vi.fn(),
}))

vi.mock('@connectio/evidence-panel-runtime', () => ({
  EvidencePanel: ({ children }: { children?: React.ReactNode }) => <div data-testid="evidence-panel">{children}</div>,
  useEvidencePanel: () => ({ displayState: 'ready', markReady: vi.fn(), markError: vi.fn() }),
}))

import { useActiveSPCSignals } from '../adapters/spc-monitoring-queries.js'

const request: SPCMonitoringAdapterRequest = { materialId: 'MAT-12345', plantId: 'IE10' }

const mockSignals: SPCSignal[] = [
  {
    signalId: 'SIG-001',
    characteristicId: 'CHAR-PH-001',
    characteristicName: 'pH',
    materialId: 'MAT-001',
    batchId: 'CH-240308-0047',
    plantId: 'IE10',
    chartType: 'xbar-r',
    rule: 'Rule 1: Point beyond 3σ control limit (upper)',
    ruleCode: 'WE1',
    severity: 'high',
    detectedAt: '2026-05-14T05:45:00.000Z',
    samplePointId: 'SP-001',
    resultValue: 6.92,
    recommendedAction: 'Check pasteurisation temperature.',
    status: 'active',
  },
]

beforeEach(() => {
  vi.mocked(useActiveSPCSignals).mockReturnValue({
    data: { ok: true, data: mockSignals, fetchedAt: '2026-05-14T10:00:00.000Z' },
    isLoading: false,
  } as ReturnType<typeof useActiveSPCSignals>)
})

describe('ActiveSPCSignalsPanel', () => {
  it('renders the evidence panel', () => {
    render(<ActiveSPCSignalsPanel request={request} />)
    expect(screen.getByTestId('evidence-panel')).toBeDefined()
  })

  it('renders signal characteristic name', () => {
    render(<ActiveSPCSignalsPanel request={request} />)
    expect(screen.getByText('pH')).toBeDefined()
  })

  it('renders signal severity', () => {
    render(<ActiveSPCSignalsPanel request={request} />)
    expect(screen.getByText('high')).toBeDefined()
  })

  it('renders the rule violated', () => {
    render(<ActiveSPCSignalsPanel request={request} />)
    expect(screen.getByText(/Rule 1: Point beyond 3σ/)).toBeDefined()
  })

  it('renders the detected timestamp', () => {
    render(<ActiveSPCSignalsPanel request={request} />)
    // Should include a formatted date — check for "Detected:" label
    expect(screen.getByText(/Detected:/)).toBeDefined()
  })

  it('renders the plant ID alongside the timestamp', () => {
    render(<ActiveSPCSignalsPanel request={request} />)
    expect(screen.getByText(/Plant: IE10/)).toBeDefined()
  })

  it('renders the result value', () => {
    render(<ActiveSPCSignalsPanel request={request} />)
    expect(screen.getByText(/6\.92/)).toBeDefined()
  })

  it('renders the batch ID', () => {
    render(<ActiveSPCSignalsPanel request={request} />)
    expect(screen.getByText(/CH-240308-0047/)).toBeDefined()
  })

  it('renders the recommended action', () => {
    render(<ActiveSPCSignalsPanel request={request} />)
    expect(screen.getByText(/Check pasteurisation temperature/)).toBeDefined()
  })

  it('shows empty state when no signals', () => {
    vi.mocked(useActiveSPCSignals).mockReturnValue({
      data: { ok: true, data: [], fetchedAt: '2026-05-14T10:00:00.000Z' },
      isLoading: false,
    } as unknown as ReturnType<typeof useActiveSPCSignals>)
    render(<ActiveSPCSignalsPanel request={request} />)
    expect(screen.getByText(/No active signals/)).toBeDefined()
  })
})
