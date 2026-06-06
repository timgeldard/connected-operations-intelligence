import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EvidencePanelStateRenderer } from './EvidencePanelStateRenderer.js'

vi.mock('@connectio/design-system', () => ({
  LoadingState: ({ lines }: { lines?: number }) => (
    <div data-testid="loading-state" data-lines={lines} />
  ),
  ErrorState: ({ message }: { message: string }) => (
    <div data-testid="error-state">{message}</div>
  ),
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}))

describe('EvidencePanelStateRenderer', () => {
  describe('loading state', () => {
    it('renders the loading skeleton', () => {
      render(<EvidencePanelStateRenderer displayState="loading" />)
      expect(screen.getByTestId('loading-state')).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('renders the error state with a custom message', () => {
      render(
        <EvidencePanelStateRenderer displayState="error" errorMessage="Query failed" />,
      )
      expect(screen.getByTestId('error-state')).toBeInTheDocument()
      expect(screen.getByText('Query failed')).toBeInTheDocument()
    })

    it('renders a fallback message when errorMessage is not provided', () => {
      render(<EvidencePanelStateRenderer displayState="error" />)
      expect(screen.getByText('Panel failed to load')).toBeInTheDocument()
    })
  })

  describe('unauthorized state', () => {
    it('renders a permission-denied message', () => {
      render(<EvidencePanelStateRenderer displayState="unauthorized" />)
      expect(
        screen.getByText('You do not have permission to view this panel'),
      ).toBeInTheDocument()
    })
  })

  describe('not-applicable state', () => {
    it('renders the empty state with Not applicable title', () => {
      render(<EvidencePanelStateRenderer displayState="not-applicable" />)
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
      expect(screen.getByText('Not applicable')).toBeInTheDocument()
    })

    it('renders the out-of-scope description', () => {
      render(<EvidencePanelStateRenderer displayState="not-applicable" />)
      expect(
        screen.getByText('This panel is not relevant to the current scope.'),
      ).toBeInTheDocument()
    })
  })

  describe('waiting-for-context state', () => {
    it('renders a recoverable context waiting message', () => {
      render(<EvidencePanelStateRenderer displayState="waiting-for-context" />)
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
      expect(screen.getByText('Waiting for investigation context')).toBeInTheDocument()
    })
  })

  describe('partial state', () => {
    it('renders children alongside the partial-data footnote', () => {
      render(
        <EvidencePanelStateRenderer displayState="partial">
          <span>chart content</span>
        </EvidencePanelStateRenderer>,
      )
      expect(screen.getByText('chart content')).toBeInTheDocument()
      expect(screen.getByText('Partial data')).toBeInTheDocument()
    })
  })

  describe('stale state', () => {
    it('renders children with the stale indicator strip', () => {
      render(
        <EvidencePanelStateRenderer displayState="stale">
          <span>stale content</span>
        </EvidencePanelStateRenderer>,
      )
      expect(screen.getByText('stale content')).toBeInTheDocument()
      expect(screen.getByLabelText('Data may be out of date')).toBeInTheDocument()
    })
  })

  describe('ready state', () => {
    it('renders children directly', () => {
      render(
        <EvidencePanelStateRenderer displayState="ready">
          <span>ready content</span>
        </EvidencePanelStateRenderer>,
      )
      expect(screen.getByText('ready content')).toBeInTheDocument()
    })
  })
})
