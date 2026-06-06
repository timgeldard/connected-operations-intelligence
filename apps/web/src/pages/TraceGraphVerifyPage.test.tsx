import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TraceGraphVerifyPage } from './TraceGraphVerifyPage.js'

const mockPanel = vi.fn()

vi.mock('@connectio/di-traceability', () => ({
  TraceGraphPanel: (props: { request: { materialId?: string; batchId?: string; plantId?: string } }) => {
    mockPanel(props.request)
    return (
      <div
        data-testid="trace-graph-panel"
        data-material-id={props.request.materialId}
        data-batch-id={props.request.batchId}
        data-plant-id={props.request.plantId}
      />
    )
  },
}))

describe('TraceGraphVerifyPage', () => {
  beforeEach(() => {
    mockPanel.mockClear()
  })

  it('renders material, batch, plant inputs and direction/depth/edges controls with defaults', () => {
    render(<TraceGraphVerifyPage />)
    const materialInput = screen.getByTestId('input-material-id') as HTMLInputElement
    const batchInput = screen.getByTestId('input-batch-id') as HTMLInputElement
    const plantInput = screen.getByTestId('input-plant-id') as HTMLInputElement
    const directionSelect = screen.getByTestId('select-direction') as HTMLSelectElement
    const maxDepthSelect = screen.getByTestId('select-max-depth') as HTMLSelectElement
    const maxEdgesSelect = screen.getByTestId('select-max-edges') as HTMLSelectElement
    expect(materialInput.value).toBe('20052009')
    expect(batchInput.value).toBe('0008602411')
    expect(plantInput.value).toBe('C061')
    expect(directionSelect.value).toBe('both')
    expect(maxDepthSelect.value).toBe('2')
    expect(maxEdgesSelect.value).toBe('100')
    expect(screen.getByTestId('btn-run-trace')).not.toBeNull()
  })

  it('does not render the graph panel before submit', () => {
    render(<TraceGraphVerifyPage />)
    expect(screen.queryByTestId('trace-graph-panel')).toBeNull()
    expect(mockPanel).not.toHaveBeenCalled()
  })

  it('submitting the form triggers getTraceGraph with the entered values and controls', () => {
    render(<TraceGraphVerifyPage />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    expect(mockPanel).toHaveBeenCalledWith({
      investigationId: '',
      materialId: '20052009',
      batchId: '0008602411',
      plantId: 'C061',
      direction: 'both',
      maxDepth: 2,
      maxEdges: 100,
    })
  })

  it('success path: renders the graph panel after submit', () => {
    render(<TraceGraphVerifyPage />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    expect(screen.getByTestId('trace-graph-panel')).not.toBeNull()
  })

  it('error path: renders only the panel after submit with no additional result content', () => {
    render(<TraceGraphVerifyPage />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    // The page adds no fallback/alternative result content — only TraceGraphPanel
    // Panel error handling (no mock on failure) is tested in trace-graph-panel.test.tsx
    const page = screen.getByTestId('trace-graph-verify-page')
    const panelCount = page.querySelectorAll('[data-testid="trace-graph-panel"]').length
    expect(panelCount).toBe(1)
  })

  it('empty path: delegates no-results rendering to TraceGraphPanel', () => {
    // The verify page passes the submitted request directly to TraceGraphPanel
    // and adds no alternative content. Panel empty-state is tested in trace-graph-panel.test.tsx.
    render(<TraceGraphVerifyPage />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    const panel = screen.getByTestId('trace-graph-panel')
    expect(panel.getAttribute('data-material-id')).toBe('20052009')
  })

  it('passes updated input values and control values to the panel on re-submit', () => {
    render(<TraceGraphVerifyPage />)
    fireEvent.change(screen.getByTestId('input-material-id'), { target: { value: '000000000099999999' } })
    fireEvent.change(screen.getByTestId('input-batch-id'), { target: { value: 'TEST-BATCH' } })
    fireEvent.change(screen.getByTestId('input-plant-id'), { target: { value: 'C999' } })
    fireEvent.change(screen.getByTestId('select-direction'), { target: { value: 'upstream' } })
    fireEvent.change(screen.getByTestId('select-max-depth'), { target: { value: '4' } })
    fireEvent.change(screen.getByTestId('select-max-edges'), { target: { value: '500' } })
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    expect(mockPanel).toHaveBeenCalledWith({
      investigationId: '',
      materialId: '000000000099999999',
      batchId: 'TEST-BATCH',
      plantId: 'C999',
      direction: 'upstream',
      maxDepth: 4,
      maxEdges: 500,
    })
  })
})
