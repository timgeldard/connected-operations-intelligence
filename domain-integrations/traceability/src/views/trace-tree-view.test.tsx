import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TraceTreeView } from './trace-tree-view.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

vi.mock('../panels/trace-graph-panel.js', () => ({
  TraceGraphPanel: (props: { request: Trace2AdapterRequest }) => (
    <div
      data-testid="trace-graph-panel"
      data-material-id={props.request.materialId}
      data-batch-id={props.request.batchId}
      data-direction={props.request.direction}
    />
  ),
}))

vi.mock('../panels/batch-header-panel.js', () => ({
  BatchHeaderPanel: (props: { request: Trace2AdapterRequest }) => (
    <div
      data-testid="batch-header-panel"
      data-material-id={props.request.materialId}
      data-batch-id={props.request.batchId}
    />
  ),
}))

const emptyRequest: Trace2AdapterRequest = { investigationId: '' }

describe('TraceTreeView — cold load (no scope)', () => {
  it('renders the query form on cold load', () => {
    render(<TraceTreeView request={emptyRequest} />)
    expect(screen.getByTestId('trace-query-form')).not.toBeNull()
  })

  it('does not render TraceGraphPanel before form submission', () => {
    render(<TraceTreeView request={emptyRequest} />)
    expect(screen.queryByTestId('trace-graph-panel')).toBeNull()
  })

  it('does not render BatchHeaderPanel before form submission', () => {
    render(<TraceTreeView request={emptyRequest} />)
    expect(screen.queryByTestId('batch-header-panel')).toBeNull()
  })

  it('does not render a risk-signals-panel (adapter not yet wired — always mock)', () => {
    render(<TraceTreeView request={emptyRequest} />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    expect(screen.queryByTestId('risk-signals-panel')).toBeNull()
  })

  it('shows the source description text', () => {
    render(<TraceTreeView request={emptyRequest} />)
    expect(screen.getByText(/gold_batch_lineage/)).not.toBeNull()
  })
})

describe('TraceTreeView — after form submission', () => {
  it('renders TraceGraphPanel after Run Trace is clicked', () => {
    render(<TraceTreeView request={emptyRequest} />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    expect(screen.getByTestId('trace-graph-panel')).not.toBeNull()
  })

  it('passes correct materialId and batchId to TraceGraphPanel', () => {
    render(<TraceTreeView request={emptyRequest} />)
    fireEvent.change(screen.getByTestId('input-material-id'), { target: { value: '100023847' } })
    fireEvent.change(screen.getByTestId('input-batch-id'), { target: { value: 'CH-240308-0047' } })
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    const panel = screen.getByTestId('trace-graph-panel')
    expect(panel.getAttribute('data-material-id')).toBe('100023847')
    expect(panel.getAttribute('data-batch-id')).toBe('CH-240308-0047')
  })

  it('passes direction to TraceGraphPanel', () => {
    render(<TraceTreeView request={emptyRequest} />)
    fireEvent.change(screen.getByTestId('select-direction'), { target: { value: 'upstream' } })
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    const panel = screen.getByTestId('trace-graph-panel')
    expect(panel.getAttribute('data-direction')).toBe('upstream')
  })

  it('renders BatchHeaderPanel after submission when materialId and batchId are set', () => {
    render(<TraceTreeView request={emptyRequest} />)
    // Default form values include materialId='100023847' and batchId='CH-240308-0047'
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    expect(screen.getByTestId('batch-header-panel')).not.toBeNull()
  })

  it('shows the last request payload in the collapsible technical details section', () => {
    render(<TraceTreeView request={emptyRequest} />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    const payload = screen.getByTestId('last-request-payload')
    expect(payload.textContent).toContain('material_id')
    expect(payload.textContent).toContain('100023847')
  })
})

describe('TraceTreeView — scope pre-fill', () => {
  it('pre-fills form with scope materialId when provided', () => {
    const request: Trace2AdapterRequest = {
      investigationId: '',
      materialId: 'SCOPE-MAT',
      batchId: 'SCOPE-BATCH',
      plantId: 'C999',
    }
    render(<TraceTreeView request={request} />)
    expect((screen.getByTestId('input-material-id') as HTMLInputElement).value).toBe('SCOPE-MAT')
    expect((screen.getByTestId('input-batch-id') as HTMLInputElement).value).toBe('SCOPE-BATCH')
  })

  it('does not auto-submit when scope is provided — user must click Run Trace', () => {
    const request: Trace2AdapterRequest = {
      investigationId: '',
      materialId: '100023847',
      batchId: 'CH-240308-0047',
      plantId: 'IE10',
    }
    render(<TraceTreeView request={request} />)
    expect(screen.queryByTestId('trace-graph-panel')).toBeNull()
  })
})
