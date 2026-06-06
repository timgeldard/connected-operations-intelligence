// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
expect.extend(matchers)
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NativeMonitoringView } from './native-monitoring-view.js'
import { envmonAdapter } from '../adapters/envmon-adapter.js'
import type { EnvMonNativeSwabResult } from '@connectio/data-contracts'

const summary = {
  plantId: 'C061',
  plantName: '',
  zonesMonitored: 2,
  zonesWithAlerts: 1,
  positiveCount: 1,
  positiveRate: 50,
  openCorrectiveActions: 0,
  overdueActions: 0,
  complianceRate: 50,
  riskStatus: 'non-compliant' as const,
  highestSeverity: 'high' as const,
  confidence: 1,
}

const swabRows: EnvMonNativeSwabResult[] = [
  {
    inspectionLotId: '00001234',
    inspectionPointId: 'IP-001',
    sampleId: 'S-001',
    operationId: '0010',
    functionalLocation: 'FL-001',
    sampleSummary: 'Line swab',
    sampleHour: 8,
    plantId: 'C061',
    inspectionType: '14',
    createdDate: '2026-01-15',
    inspectionEndDate: '2026-01-16',
    micId: 'MIC-001',
    micName: 'TVC',
    micCode: 'TVC',
    result: 'REJECT',
    quantitativeResult: 450,
    qualitativeResult: null,
    targetValue: 100,
    upperTolerance: 200,
    lowerTolerance: null,
    unitOfMeasure: 'CFU',
    valuation: 'R',
    status: 'fail',
    inspector: 'USER001',
    inspectionMethod: 'METHOD-001',
    materialId: '000000000020052009',
    batchId: '0008602411',
    processOrderId: '7006965038',
  },
  {
    inspectionLotId: '00001235',
    inspectionPointId: 'IP-002',
    sampleId: 'S-002',
    operationId: '0010',
    functionalLocation: 'FL-002',
    sampleSummary: null,
    sampleHour: null,
    plantId: 'C061',
    inspectionType: 'Z14',
    createdDate: '2026-01-17',
    inspectionEndDate: null,
    micId: 'MIC-002',
    micName: 'Yeast',
    micCode: 'YST',
    result: 'OK',
    quantitativeResult: 5,
    qualitativeResult: null,
    targetValue: null,
    upperTolerance: 20,
    lowerTolerance: null,
    unitOfMeasure: 'CFU',
    valuation: 'A',
    status: 'pass',
    inspector: null,
    inspectionMethod: null,
    materialId: null,
    batchId: null,
    processOrderId: null,
  },
]

describe('NativeMonitoringView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(envmonAdapter, 'getNativeSiteSummary').mockResolvedValue({
      ok: true,
      data: summary,
      fetchedAt: '2026-05-18T12:00:00.000Z',
      source: 'databricks-api',
    })
    vi.spyOn(envmonAdapter, 'getNativeSwabResults').mockResolvedValue({
      ok: true,
      data: swabRows,
      fetchedAt: '2026-05-18T12:00:00.000Z',
      source: 'databricks-api',
    })
  })

  it('renders inputs and source limitations banner', () => {
    render(<NativeMonitoringView />)
    expect(screen.getByTestId('envmon-input-plant')).toBeInTheDocument()
    expect(screen.getByTestId('envmon-input-period-start')).toBeInTheDocument()
    expect(screen.getByTestId('envmon-input-period-end')).toBeInTheDocument()
    expect(screen.getByTestId('envmon-input-limit')).toBeInTheDocument()
    expect(screen.getByTestId('envmon-source-limitations')).toHaveTextContent('CAPA is out of scope')
    expect(screen.getByTestId('envmon-source-limitations')).toHaveTextContent('Spatial floorplan')
  })

  it('submit calls native site-summary and swab-results adapters with form values', async () => {
    render(<NativeMonitoringView />)
    fireEvent.click(screen.getByTestId('envmon-run-query'))

    await waitFor(() => {
      expect(envmonAdapter.getNativeSiteSummary).toHaveBeenCalledWith({
        plantId: 'C061',
        periodStart: '2026-01-01',
        periodEnd: '2026-05-18',
        limit: 100,
      })
      expect(envmonAdapter.getNativeSwabResults).toHaveBeenCalledWith({
        plantId: 'C061',
        periodStart: '2026-01-01',
        periodEnd: '2026-05-18',
        limit: 100,
      })
    })
  })

  it('renders summary cards, swab table, derived indicators, and row detail', async () => {
    render(<NativeMonitoringView />)
    fireEvent.click(screen.getByTestId('envmon-run-query'))

    expect(await screen.findByTestId('envmon-site-summary')).toHaveTextContent('non-compliant')
    expect(screen.getByTestId('envmon-derived-indicators')).toHaveTextContent('2')
    expect(screen.getByTestId('envmon-swab-table')).toHaveTextContent('00001234')
    expect(screen.getByTestId('envmon-swab-table')).toHaveTextContent('TVC')

    fireEvent.click(screen.getByRole('button', { name: '00001234' }))
    const detail = await screen.findByTestId('envmon-result-detail')
    expect(detail).toHaveTextContent('METHOD-001')
    expect(detail).toHaveTextContent('0008602411')
  })

  it('renders empty state for an empty swab result', async () => {
    vi.spyOn(envmonAdapter, 'getNativeSwabResults').mockResolvedValue({
      ok: true,
      data: [],
      fetchedAt: '2026-05-18T12:00:00.000Z',
      source: 'databricks-api',
    })

    render(<NativeMonitoringView />)
    fireEvent.click(screen.getByTestId('envmon-run-query'))

    expect(await screen.findByText(/No EnvMon inspection results found/)).toBeInTheDocument()
  })

  it('renders route error states without mock fallback', async () => {
    vi.spyOn(envmonAdapter, 'getNativeSiteSummary').mockResolvedValue({
      ok: false,
      error: { code: 'unauthorized', message: '401 missing OAuth token', retryable: false },
      displayState: 'error',
      source: 'databricks-api',
    })
    vi.spyOn(envmonAdapter, 'getNativeSwabResults').mockResolvedValue({
      ok: false,
      error: { code: 'network', message: '502 Databricks query execution failed', retryable: true },
      displayState: 'error',
      source: 'databricks-api',
    })

    render(<NativeMonitoringView />)
    fireEvent.click(screen.getByTestId('envmon-run-query'))

    const errors = await screen.findAllByTestId('envmon-route-error')
    expect(errors).toHaveLength(2)
    expect(within(errors[0]).getByText(/OAuth token not forwarded/)).toBeInTheDocument()
    expect(within(errors[1]).getByText(/Query\/source problem/)).toBeInTheDocument()
    expect(screen.queryByText('Raise Environmental Alert')).toBeNull()
  })

  it('does not present CAPA or spatial workflows as implemented', () => {
    render(<NativeMonitoringView />)
    expect(screen.queryByText('Create Corrective Action')).toBeNull()
    expect(screen.queryByText('Request Zone Retest')).toBeNull()
    expect(screen.queryByText('Upload floorplan')).toBeNull()
    expect(screen.getByTestId('envmon-source-limitations')).toHaveTextContent('planned/deferred')
  })
})
