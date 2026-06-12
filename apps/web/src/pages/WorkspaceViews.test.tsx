import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WorkspaceViews from './WorkspaceViews.js'

vi.mock('../shell/useWorkspaceShellState.js', () => ({
  useWorkspaceShellState: () => ({
    investigationId: null,
    releaseCaseId: null,
    planDate: null,
    viewId: null,
    setReleaseCaseId: vi.fn(),
    navigateToBatchRelease: vi.fn(),
    setView: vi.fn(),
    setWorkspace: vi.fn(),
  }),
}))

vi.mock('@connectio/auth-scope', () => ({
  useAuthScope: () => ({ activeScope: {} }),
}))

vi.mock('@connectio/di-traceability', () => ({
  TraceInvestigationWorkspace: () => <div data-testid="trace-investigation-workspace" />,
}))

vi.mock('@connectio/di-quality', () => ({
  BatchReleaseWorkspace: () => <div data-testid="batch-release-workspace" />,
}))

vi.mock('@connectio/di-operations', () => ({
  ProcessOrderReviewWorkspace: () => <div data-testid="process-order-review-workspace" />,
}))

vi.mock('@connectio/di-envmon', () => ({
  EnvMonConsumerWorkspace: () => <div data-testid="envmon-consumer-workspace" />,
}))

vi.mock('@connectio/di-warehouse', () => ({
  Warehouse360Workspace: () => <div data-testid="warehouse-360-workspace" />,
}))

vi.mock('@connectio/di-spc', () => ({
  SPCMonitoringWorkspace: () => <div data-testid="spc-monitoring-workspace" />,
}))

describe('WorkspaceViews — traceability-workspace', () => {
  it('renders TraceInvestigationWorkspace for traceability-workspace', () => {
    render(<WorkspaceViews workspaceId="traceability-workspace" />)
    expect(screen.getByTestId('trace-investigation-workspace')).not.toBeNull()
  })

  it('does not render the placeholder for traceability-workspace', () => {
    render(<WorkspaceViews workspaceId="traceability-workspace" />)
    expect(screen.queryByText(/implementation pending/)).toBeNull()
    expect(screen.queryByText(/Phase 3\+/)).toBeNull()
  })

  it('still renders placeholder for an unknown workspaceId', () => {
    render(<WorkspaceViews workspaceId="unknown-workspace-xyz" />)
    expect(screen.getByText(/implementation pending/)).not.toBeNull()
  })
})
