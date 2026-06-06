/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CharacteristicCapabilityPanel } from './characteristic-capability-panel.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'
import type { CharacteristicCapability } from '@connectio/data-contracts'

// Mock the query hooks
vi.mock('../adapters/spc-monitoring-queries.js', () => ({
  useCharacteristicCapability: vi.fn(),
  useControlChartSeries: vi.fn(),
}))

import { useCharacteristicCapability, useControlChartSeries } from '../adapters/spc-monitoring-queries.js'

const request: SPCMonitoringAdapterRequest = { materialId: 'MAT-12345', plantId: 'IE10', characteristicId: 'CHAR-TEST-001' }

const baseCapability: CharacteristicCapability = {
  characteristicId: 'CHAR-TEST-001',
  characteristicName: 'Test Characteristic',
  cp: 1.5,
  cpk: 1.45,
  pp: 1.4,
  ppk: 1.35,
  mean: 10.123,
  standardDeviation: 0.4567,
  sampleCount: 50,
  confidence: 0.95,
  interpretation: 'capable',
}

function makeResult(cap: CharacteristicCapability) {
  return { data: { ok: true as const, data: cap, fetchedAt: '2024-03-08T10:00:00.000Z', source: 'mock' }, isLoading: false }
}

beforeEach(() => {
  vi.mocked(useCharacteristicCapability).mockReturnValue(makeResult(baseCapability) as ReturnType<typeof useCharacteristicCapability>)
  vi.mocked(useControlChartSeries).mockReturnValue({
    data: { ok: true, data: { points: [], chartType: 'imr' }, fetchedAt: '2024-03-08T10:00:00.000Z', source: 'mock' },
    isLoading: false,
  } as any)
})

describe('CharacteristicCapabilityPanel', () => {
  it('renders standard capability data successfully with approval warning', async () => {
    render(<CharacteristicCapabilityPanel request={request} />)
 
    await waitFor(() => {
      expect(screen.getByText('Test Characteristic')).toBeInTheDocument()
      expect(screen.getByText('capable')).toBeInTheDocument()
      // Indices Cp, Cpk, Pp, Ppk
      expect(screen.getByText('1.50')).toBeInTheDocument()
      expect(screen.getByText('1.45')).toBeInTheDocument()
      expect(screen.getByText('1.40')).toBeInTheDocument()
      expect(screen.getByText('1.35')).toBeInTheDocument()
      // Stats
      expect(screen.getByText('10.123')).toBeInTheDocument()
      expect(screen.getByText('0.4567')).toBeInTheDocument()
      expect(screen.getByText('50')).toBeInTheDocument()
      expect(screen.getByText('95%')).toBeInTheDocument()
      // Approval warning
      expect(screen.getByText(/Capability approval source not verified/)).toBeInTheDocument()
    })
  })

  it('handles interpretation of insufficient-data gracefully', async () => {
    const insufficientCapability: CharacteristicCapability = {
      ...baseCapability,
      interpretation: 'insufficient-data',
      cp: 0,
      cpk: 0,
      pp: 0,
      ppk: 0,
      mean: 0,
      standardDeviation: 0,
      sampleCount: 2,
      confidence: 0,
    }
    vi.mocked(useCharacteristicCapability).mockReturnValue(
      makeResult(insufficientCapability) as ReturnType<typeof useCharacteristicCapability>
    )

    render(<CharacteristicCapabilityPanel request={request} />)

    await waitFor(() => {
      expect(screen.getByText('insufficient data')).toBeInTheDocument()
      // Checks for placeholder '—' instead of '0.00'
      const dashElements = screen.getAllByText('—')
      expect(dashElements.length).toBeGreaterThanOrEqual(4) // Cp, Cpk, Pp, Ppk
      expect(screen.getByText(/Insufficient sample size to calculate reliable capability indices/i)).toBeInTheDocument()
    })
  })
})
