import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EvidencePanelFooter } from './EvidencePanelFooter.js'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { FreshnessMetadata, ConfidenceMetadata } from '@connectio/data-contracts'

vi.mock('@connectio/design-system', () => ({
  ConfidenceIndicator: ({ level }: { level: number | null }) => (
    <div data-testid="confidence-indicator" data-level={level} />
  ),
  FreshnessIndicator: ({
    lastRefreshedAt,
    isStale,
  }: {
    lastRefreshedAt: string | null
    isStale: boolean
  }) => (
    <div
      data-testid="freshness-indicator"
      data-stale={String(isStale)}
      data-refreshed-at={lastRefreshedAt ?? ''}
    />
  ),
  DrillThroughButton: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button data-testid="drill-through-button" onClick={onClick}>
      {label}
    </button>
  ),
}))

/** Minimal EvidencePanelRegistration without drillThrough. */
const makeRegistration = (
  overrides?: Partial<EvidencePanelRegistration>,
): EvidencePanelRegistration => ({
  panelId: 'panel-test',
  displayName: 'Test Panel',
  description: 'A test panel',
  ownerDomain: 'quality',
  sourceOwnership: { domainId: 'quality', systemName: 'test-system' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: [],
  requiredContext: [],
  freshnessPolicy: {
    staleAfterSeconds: 300,
    errorAfterSeconds: 600,
    refreshOnFocus: false,
    pollIntervalSeconds: null,
  },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [],
  ...overrides,
})

const freshness: FreshnessMetadata = {
  lastRefreshedAt: '2024-06-01T12:00:00.000Z',
  isStale: false,
  staleAfterSeconds: 300,
}

const confidenceVisible: ConfidenceMetadata = {
  level: 0.9,
  hidden: false,
}

const confidenceHidden: ConfidenceMetadata = {
  level: 0.9,
  hidden: true,
}

describe('EvidencePanelFooter', () => {
  it('renders nothing when no freshness, confidence, or drill-through are provided', () => {
    const { container } = render(<EvidencePanelFooter registration={makeRegistration()} />)
    expect(container.firstChild).toBeNull()
  })

  describe('freshness', () => {
    it('renders the freshness indicator when freshness prop is provided', () => {
      render(
        <EvidencePanelFooter registration={makeRegistration()} freshness={freshness} />,
      )
      expect(screen.getByTestId('freshness-indicator')).toBeInTheDocument()
    })

    it('does not render the freshness indicator when freshness prop is absent', () => {
      render(<EvidencePanelFooter registration={makeRegistration()} />)
      expect(screen.queryByTestId('freshness-indicator')).toBeNull()
    })
  })

  describe('confidence', () => {
    it('renders the confidence indicator when confidence.hidden is false', () => {
      render(
        <EvidencePanelFooter
          registration={makeRegistration()}
          confidence={confidenceVisible}
        />,
      )
      expect(screen.getByTestId('confidence-indicator')).toBeInTheDocument()
    })

    it('does not render the confidence indicator when confidence.hidden is true', () => {
      render(
        <EvidencePanelFooter
          registration={makeRegistration()}
          confidence={confidenceHidden}
        />,
      )
      expect(screen.queryByTestId('confidence-indicator')).toBeNull()
    })

    it('does not render the confidence indicator when confidence prop is absent', () => {
      render(
        <EvidencePanelFooter registration={makeRegistration()} freshness={freshness} />,
      )
      expect(screen.queryByTestId('confidence-indicator')).toBeNull()
    })
  })

  describe('drill-through', () => {
    it('renders the drill-through button when registration has drillThrough and handler is provided', () => {
      const registration = makeRegistration({
        drillThrough: {
          label: 'View in Trace',
          targetWorkspaceId: 'trace',
          contextScopes: ['batch'],
        },
      })
      render(
        <EvidencePanelFooter
          registration={registration}
          onDrillThrough={() => undefined}
        />,
      )
      expect(screen.getByTestId('drill-through-button')).toBeInTheDocument()
      expect(screen.getByText('View in Trace')).toBeInTheDocument()
    })

    it('does not render the drill-through button when registration has no drillThrough', () => {
      render(
        <EvidencePanelFooter
          registration={makeRegistration()}
          onDrillThrough={() => undefined}
          freshness={freshness}
        />,
      )
      expect(screen.queryByTestId('drill-through-button')).toBeNull()
    })

    it('does not render the drill-through button when onDrillThrough handler is absent', () => {
      const registration = makeRegistration({
        drillThrough: {
          label: 'View in Trace',
          targetWorkspaceId: 'trace',
          contextScopes: ['batch'],
        },
      })
      render(<EvidencePanelFooter registration={registration} freshness={freshness} />)
      expect(screen.queryByTestId('drill-through-button')).toBeNull()
    })
  })
})
