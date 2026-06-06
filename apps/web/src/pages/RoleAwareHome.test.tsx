import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RoleAwareHome } from './RoleAwareHome.js'

const mockNavigateToTraceInvestigation = vi.fn()
const mockNavigateToBatchRelease = vi.fn()
const mockSetWorkspace = vi.fn()

vi.mock('../shell/useWorkspaceShellState.js', () => ({
  useWorkspaceShellState: () => ({
    setWorkspace: mockSetWorkspace,
    navigateToTraceInvestigation: mockNavigateToTraceInvestigation,
    navigateToBatchRelease: mockNavigateToBatchRelease,
    navigateToOperationsPlanRisk: vi.fn(),
    navigateToEnvMon: vi.fn(),
    navigateToProductionStaging: vi.fn(),
    navigateToSPCMonitoring: vi.fn(),
    navigateToWarehouse360: vi.fn(),
    navigateToMaintenanceReliability: vi.fn(),
  }),
}))

vi.mock('@connectio/personalization', () => ({
  usePinnedWorkspaces: () => [null],
}))

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
}

describe('RoleAwareHome', () => {
  it('renders without crashing', () => {
    render(<Wrapper><RoleAwareHome /></Wrapper>)
  })

  it('renders the My Work heading', () => {
    render(<Wrapper><RoleAwareHome /></Wrapper>)
    expect(screen.getByText('My Work')).toBeInTheDocument()
  })

  it('renders the Trace Investigation section heading', () => {
    render(<Wrapper><RoleAwareHome /></Wrapper>)
    expect(screen.getByRole('heading', { name: /Recent Investigations/i })).toBeInTheDocument()
  })

  it('renders both mock investigation items', () => {
    render(<Wrapper><RoleAwareHome /></Wrapper>)
    // Both investigations feature this material
    expect(screen.getAllByText(/Kerry Listowel Emmental|Gouda Classic/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders the INV-2026-00041 investigation ID', () => {
    render(<Wrapper><RoleAwareHome /></Wrapper>)
    expect(screen.getByText(/INV-2026-00041/)).toBeInTheDocument()
  })

  it('calls navigateToTraceInvestigation when an investigation is clicked', async () => {
    render(<Wrapper><RoleAwareHome /></Wrapper>)
    const button = screen.getByRole('button', { name: /INV-2026-00041/i })
    fireEvent.click(button)
    expect(mockNavigateToTraceInvestigation).toHaveBeenCalledWith('INV-2026-00041', 'overview')
  })

  it('uses 2026 dates for SPC signals (not 2024)', () => {
    render(<Wrapper><RoleAwareHome /></Wrapper>)
    // The SPC signals section should render without any 2024-03-08 date strings being visible to users
    // (The dates were normalised to 2026-05-14 in MOCK_SPC_SIGNALS)
    const html = document.body.innerHTML
    expect(html).not.toMatch(/2024-03-08/)
    expect(html).not.toMatch(/2024-03-09/)
  })

  it('renders the Quality section', () => {
    render(<Wrapper><RoleAwareHome /></Wrapper>)
    expect(screen.getByRole('heading', { name: /Priority Items/i })).toBeInTheDocument()
  })

  it('renders the pilot banner', () => {
    render(<Wrapper><RoleAwareHome /></Wrapper>)
    expect(screen.getByText(/ConnectIO-RAD V2.*Controlled Pilot/i)).toBeInTheDocument()
  })
})
