import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TraceQueryForm } from './trace-query-form.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

const mockClipboard = { writeText: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, configurable: true })
  mockClipboard.writeText.mockResolvedValue(undefined)
})

describe('TraceQueryForm — defaults', () => {
  it('renders with default material, batch, plant values', () => {
    render(<TraceQueryForm onSubmit={vi.fn()} />)
    expect((screen.getByTestId('input-material-id') as HTMLInputElement).value).toBe('100023847')
    expect((screen.getByTestId('input-batch-id') as HTMLInputElement).value).toBe('CH-240308-0047')
    expect((screen.getByTestId('input-plant-id') as HTMLInputElement).value).toBe('IE10')
  })

  it('renders with default direction=both, maxDepth=5, maxEdges=1000', () => {
    render(<TraceQueryForm onSubmit={vi.fn()} />)
    expect((screen.getByTestId('select-direction') as HTMLSelectElement).value).toBe('both')
    expect((screen.getByTestId('select-max-depth') as HTMLSelectElement).value).toBe('5')
    expect((screen.getByTestId('select-max-edges') as HTMLSelectElement).value).toBe('1000')
    expect(screen.getByText(/Max depth/)).not.toBeNull()
    expect(screen.getByText(/Max edges/)).not.toBeNull()
  })

  it('renders Run Trace, Reset to test case, and Copy payload buttons', () => {
    render(<TraceQueryForm onSubmit={vi.fn()} />)
    expect(screen.getByTestId('btn-run-trace')).not.toBeNull()
    expect(screen.getByTestId('btn-reset')).not.toBeNull()
    expect(screen.getByTestId('btn-copy-payload')).not.toBeNull()
  })

  it('does not show recent searches section initially', () => {
    render(<TraceQueryForm onSubmit={vi.fn()} />)
    expect(screen.queryByLabelText('Recent searches')).toBeNull()
  })

  it('does not show material ID suggestion for normal material ID', () => {
    render(<TraceQueryForm onSubmit={vi.fn()} />)
    expect(screen.queryByTestId('material-id-suggestion')).toBeNull()
  })
})

describe('TraceQueryForm — initial values from props', () => {
  it('uses provided initial material, batch, plant when given', () => {
    render(
      <TraceQueryForm
        onSubmit={vi.fn()}
        initialMaterialId="SCOPE-MAT"
        initialBatchId="SCOPE-BATCH"
        initialPlantId="C999"
      />,
    )
    expect((screen.getByTestId('input-material-id') as HTMLInputElement).value).toBe('SCOPE-MAT')
    expect((screen.getByTestId('input-batch-id') as HTMLInputElement).value).toBe('SCOPE-BATCH')
    expect((screen.getByTestId('input-plant-id') as HTMLInputElement).value).toBe('C999')
  })

  it('falls back to defaults for fields not provided', () => {
    render(<TraceQueryForm onSubmit={vi.fn()} initialMaterialId="CUSTOM-MAT" />)
    expect((screen.getByTestId('input-batch-id') as HTMLInputElement).value).toBe('CH-240308-0047')
    expect((screen.getByTestId('input-plant-id') as HTMLInputElement).value).toBe('IE10')
  })
})

describe('TraceQueryForm — material ID suggestion (§6)', () => {
  it('shows suggestion when 18-char zero-padded material ID is entered', () => {
    render(<TraceQueryForm onSubmit={vi.fn()} />)
    fireEvent.change(screen.getByTestId('input-material-id'), {
      target: { value: '000000000100023847' },
    })
    const suggestion = screen.getByTestId('material-id-suggestion')
    expect(suggestion).not.toBeNull()
    expect(suggestion.textContent).toContain('100023847')
  })

  it('does not show suggestion when material ID is not 18 chars', () => {
    render(<TraceQueryForm onSubmit={vi.fn()} />)
    fireEvent.change(screen.getByTestId('input-material-id'), { target: { value: '100023847' } })
    expect(screen.queryByTestId('material-id-suggestion')).toBeNull()
  })

  it('does not show suggestion for 18-char non-zero-padded ID', () => {
    render(<TraceQueryForm onSubmit={vi.fn()} />)
    fireEvent.change(screen.getByTestId('input-material-id'), {
      target: { value: '123456789012345678' },
    })
    expect(screen.queryByTestId('material-id-suggestion')).toBeNull()
  })

  it('does not show suggestion for 18-char non-numeric string starting with 0', () => {
    render(<TraceQueryForm onSubmit={vi.fn()} />)
    fireEvent.change(screen.getByTestId('input-material-id'), {
      target: { value: '000000000A10023847' },
    })
    expect(screen.queryByTestId('material-id-suggestion')).toBeNull()
  })
})

describe('TraceQueryForm — form submission', () => {
  it('calls onSubmit with correct snake_case-mapped request when form is submitted', () => {
    const onSubmit = vi.fn()
    render(<TraceQueryForm onSubmit={onSubmit} />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    expect(onSubmit).toHaveBeenCalledWith<[Trace2AdapterRequest]>({
      investigationId: '',
      materialId: '100023847',
      batchId: 'CH-240308-0047',
      plantId: 'IE10',
      direction: 'both',
      maxDepth: 5,
      maxEdges: 1000,
    })
  })

  it('includes changed direction, maxDepth, maxEdges in submitted request', () => {
    const onSubmit = vi.fn()
    render(<TraceQueryForm onSubmit={onSubmit} />)
    fireEvent.change(screen.getByTestId('select-direction'), { target: { value: 'upstream' } })
    fireEvent.change(screen.getByTestId('select-max-depth'), { target: { value: '3' } })
    fireEvent.change(screen.getByTestId('select-max-edges'), { target: { value: '500' } })
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    const req = onSubmit.mock.calls[0][0] as Trace2AdapterRequest
    expect(req.direction).toBe('upstream')
    expect(req.maxDepth).toBe(3)
    expect(req.maxEdges).toBe(500)
  })
})

describe('TraceQueryForm — reset button', () => {
  it('resets all fields to defaults after user edits them', () => {
    render(<TraceQueryForm onSubmit={vi.fn()} />)
    fireEvent.change(screen.getByTestId('input-material-id'), { target: { value: 'EDITED' } })
    fireEvent.change(screen.getByTestId('select-direction'), { target: { value: 'downstream' } })
    fireEvent.click(screen.getByTestId('btn-reset'))
    expect((screen.getByTestId('input-material-id') as HTMLInputElement).value).toBe('100023847')
    expect((screen.getByTestId('select-direction') as HTMLSelectElement).value).toBe('both')
  })
})

describe('TraceQueryForm — recent searches (§5)', () => {
  it('shows recent searches section after first submission', () => {
    render(<TraceQueryForm onSubmit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    expect(screen.getByLabelText('Recent searches')).not.toBeNull()
    expect(screen.getByTestId('btn-recent-0')).not.toBeNull()
  })

  it('shows at most 3 recent searches', () => {
    render(<TraceQueryForm onSubmit={vi.fn()} />)
    for (let i = 0; i < 4; i++) {
      fireEvent.change(screen.getByTestId('input-material-id'), { target: { value: `MAT-${i}` } })
      fireEvent.click(screen.getByTestId('btn-run-trace'))
    }
    expect(screen.queryByTestId('btn-recent-3')).toBeNull()
    expect(screen.getByTestId('btn-recent-2')).not.toBeNull()
  })

  it('deduplicates identical submissions', () => {
    render(<TraceQueryForm onSubmit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    expect(screen.queryByTestId('btn-recent-1')).toBeNull()
  })

  it('clicking a recent search calls onSubmit with that request', () => {
    const onSubmit = vi.fn()
    render(<TraceQueryForm onSubmit={onSubmit} />)
    // Submit once with default values
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    // Change to a different material and submit
    fireEvent.change(screen.getByTestId('input-material-id'), { target: { value: 'MAT-NEW' } })
    fireEvent.click(screen.getByTestId('btn-run-trace'))
    // The first submission is now at index 1 in recent searches
    onSubmit.mockClear()
    fireEvent.click(screen.getByTestId('btn-recent-1'))
    const req = onSubmit.mock.calls[0][0] as Trace2AdapterRequest
    expect(req.materialId).toBe('100023847')
  })
})
