import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectedQualityLabBoardPanel } from './connected-quality-lab-board-panel.js'
import type { ConnectedQualityLabAdapterRequest } from '../adapters/connected-quality-lab-adapter.js'

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
}

const request: ConnectedQualityLabAdapterRequest = { plantId: 'IE10' }

describe('ConnectedQualityLabBoardPanel', () => {
  it('renders the panel container', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="evidence-panel-connected-quality-lab-board"]'),
      ).not.toBeNull()
    })
  })

  it('renders the panel display name', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Lab Board')).toBeInTheDocument()
    })
  })

  it('renders lot type filter buttons', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('FP (89)')).toBeInTheDocument()
      expect(screen.getByText('RM (04)')).toBeInTheDocument()
    })
  })

  it('renders failure count from mock data', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    // mock data has 8 failures total
    await waitFor(() => {
      expect(screen.getByText(/8 failures/i)).toBeInTheDocument()
    })
  })

  it('renders a material name from mock data', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Emmental Block 4 kg')).toBeInTheDocument()
    })
  })

  it('renders pagination controls when more than 6 failures', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    // 8 failures > CARDS_PER_PAGE (6), so prev/next should appear
    await waitFor(() => {
      expect(screen.getByText(/← Prev/)).toBeInTheDocument()
      expect(screen.getByText(/Next →/)).toBeInTheDocument()
    })
  })

  it('shows page indicator for multi-page results', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Page 1\/2/)).toBeInTheDocument()
    })
  })

  it('filters to FP lot type on button click', async () => {
    const user = userEvent.setup()
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => expect(screen.getByText('FP (89)')).toBeInTheDocument())
    await user.click(screen.getByText('FP (89)'))
    // After filtering to FP (89), count should be less than 8 (mock has mixed types)
    await waitFor(() => {
      expect(screen.queryByText(/8 failures/i)).toBeNull()
    })
  })

  it('shows empty state when no failures match filter', async () => {
    render(
      <Wrapper>
        <ConnectedQualityLabBoardPanel request={{ plantId: 'IE10', lotType: 'XX' }} />
      </Wrapper>,
    )
    await waitFor(() => {
      expect(screen.getByText('No failures or warnings.')).toBeInTheDocument()
    })
  })

  it('renders FAIL badge for fail severity records', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      const badges = screen.getAllByText('FAIL')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  it('renders WARN badge for warn severity records', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      const badges = screen.getAllByText('WARN')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  it('does not show "Live" when source is mock', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.queryByText(/live/i)).toBeNull()
    })
  })

  it('renders legend with Outside spec and Warning threshold labels', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Outside spec')).toBeInTheDocument()
      expect(screen.getByText('Warning threshold')).toBeInTheDocument()
    })
  })

  it('renders ConnectedQuality Lab Board board header', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/ConnectedQuality · Lab Board/i)).toBeInTheDocument()
    })
  })

  it('shows plant context in board header when plantId provided', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={{ plantId: 'IE20' }} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Plant: IE20')).toBeInTheDocument()
    })
  })

  it('shows Mock SAP QM lab failures source label when source is mock', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('Mock SAP QM lab failures')).toBeInTheDocument()
    })
  })

  it('shows Auto-rotates in page indicator when multiple pages', async () => {
    render(<Wrapper><ConnectedQualityLabBoardPanel request={request} /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Auto-rotates/)).toBeInTheDocument()
    })
  })
})
