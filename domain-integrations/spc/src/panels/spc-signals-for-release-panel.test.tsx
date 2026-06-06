/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SPCSignalsForReleasePanel } from './spc-signals-for-release-panel.js'
import type { SPCSignalsAdapterRequest } from '../adapters/spc-signals-adapter.js'
import type { SPCSignalSummary } from '@connectio/data-contracts'

// Mock the query hook
vi.mock('../adapters/spc-signals-queries.js', () => ({
  useSPCSignals: vi.fn(),
}))

import { useSPCSignals } from '../adapters/spc-signals-queries.js'

const request: SPCSignalsAdapterRequest = { batchId: 'B-123', processOrderId: 'PO-456' }

const baseSummary: SPCSignalSummary = {
  batchId: 'B-123',
  processOrderId: 'PO-456',
  activeAlarmCount: 2,
  criticalAlarmCount: 1,
  resolvedAlarmCount: 3,
  lastCheckedAt: '2026-05-19T08:00:00Z',
  alarms: [
    {
      alarmId: 'A-1',
      parameter: 'pH',
      severity: 'critical',
      status: 'active',
      ruleViolated: 'Rule 1: Outside control limits',
      chartType: 'individuals',
      firedAt: '2026-05-13T06:00:00.000Z',
    },
    {
      alarmId: 'A-2',
      parameter: 'Moisture',
      severity: 'major',
      status: 'active',
      ruleViolated: 'Rule 2: 9 points on one side of center line',
      chartType: 'individuals',
      firedAt: '2026-05-13T07:00:00.000Z',
    },
    {
      alarmId: 'A-3',
      parameter: 'Fat',
      severity: 'minor',
      status: 'resolved',
      ruleViolated: 'Rule 3: Trend',
      chartType: 'individuals',
      firedAt: '2026-05-13T08:00:00.000Z',
    },
  ],
}

function makeResult(sum: SPCSignalSummary) {
  return { data: { ok: true as const, data: sum, fetchedAt: '2024-03-08T10:00:00.000Z', source: 'mock' }, isLoading: false }
}

beforeEach(() => {
  vi.mocked(useSPCSignals).mockReturnValue(makeResult(baseSummary) as ReturnType<typeof useSPCSignals>)
})

describe('SPCSignalsForReleasePanel', () => {
  it('renders signal metrics and alarm lists successfully', async () => {
    render(<SPCSignalsForReleasePanel request={request} />)

    await waitFor(() => {
      expect(screen.getByText(/Active Alarms/i)).toBeInTheDocument()
      expect(screen.getByText(/Critical Alarms/i)).toBeInTheDocument()
      expect(screen.getAllByText(/Resolved/i).length).toBe(2)

      // Values
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()

      // Alarm list items
      expect(screen.getByText(/pH/i)).toBeInTheDocument()
      expect(screen.getByText(/Outside control limits/i)).toBeInTheDocument()
      expect(screen.getByText(/Moisture/i)).toBeInTheDocument()
      expect(screen.getByText(/9 points on one side/i)).toBeInTheDocument()
      expect(screen.getByText(/Fat/i)).toBeInTheDocument()
      expect(screen.getByText(/Trend/i)).toBeInTheDocument()
    })
  })

  it('renders error state and propagates source successfully', async () => {
    vi.mocked(useSPCSignals).mockReturnValue({
      data: {
        ok: false,
        error: { code: 'network', message: 'Failed to fetch SPC signals', retryable: true },
        displayState: 'error',
        source: 'mock',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useSPCSignals>)

    render(<SPCSignalsForReleasePanel request={request} />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch SPC signals/i)).toBeInTheDocument()
    })
  })
})
