import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'
import { TraceGeniePilotView } from './trace-genie-pilot-view.js'

vi.mock('../panels/trace-genie-pilot-panel.js', () => ({
  TraceGeniePilotPanel: (props: { request: Trace2AdapterRequest }) => (
    <div data-testid="trace-genie-pilot-panel" data-batch-id={props.request.batchId} />
  ),
}))

vi.mock('../panels/trace-graph-panel.js', () => ({
  TraceGraphPanel: () => <div data-testid="trace-graph-panel" />,
}))

vi.mock('../panels/batch-header-panel.js', () => ({
  BatchHeaderPanel: () => <div data-testid="batch-header-panel" />,
}))

describe('TraceGeniePilotView', () => {
  it('renders the query form on cold load', () => {
    render(<TraceGeniePilotView request={{ investigationId: '' }} />)
    expect(screen.getByTestId('trace-query-form')).toBeInTheDocument()
  })

  it('renders assistant and underlying evidence after submit', () => {
    render(<TraceGeniePilotView request={{ investigationId: '' }} />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))

    expect(screen.getByTestId('trace-genie-pilot-panel')).toBeInTheDocument()
    expect(screen.getByTestId('trace-graph-panel')).toBeInTheDocument()
    expect(screen.getByTestId('batch-header-panel')).toBeInTheDocument()
  })
})
