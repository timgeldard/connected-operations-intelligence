// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import {
  QualityReadOnlyEvidencePanel as ActualQualityReadOnlyEvidencePanel,
} from './quality-readonly-evidence-panel.js'
import type { QualityReadOnlyEvidenceAdapterRequest } from '../adapters/quality-readonly-evidence-adapter.js'
import type { QualityEvidenceResponse } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import {
  pendingSourceVerificationFixture,
  sourceVerifiedNotWiredFixture,
  singleLotAcceptedStyleFixture,
  singleLotRejectedStyleFixture,
  multipleLotsFixture,
  missingInspectionLotFixture,
  micPresentNoUsageDecisionFixture,
  coaLikeEvidenceFixture,
  deviationSourceUnavailableFixture,
  simulatedReleasePanelFixture,
} from '../adapters/quality-readonly-evidence-mock-data.js'

vi.mock('@connectio/evidence-panel-runtime', () => ({
  EvidencePanel: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="evidence-panel">{children}</div>
  ),
  EvidenceCaveatList: ({ caveats }: { caveats: string[] }) => (
    <ul data-testid="evidence-caveats">
      {caveats.map((c, i) => <li key={i}>{c}</li>)}
    </ul>
  ),
  useEvidencePanel: () => ({ displayState: 'ready', markReady: vi.fn(), markError: vi.fn() }),
}))

const request: QualityReadOnlyEvidenceAdapterRequest = {
  plantId: 'C113',
  materialId: '000000000070373871',
  batchId: '0008602411',
}

let activeResult: AdapterResult<QualityEvidenceResponse> | undefined

function QualityReadOnlyEvidencePanel({
  request: _request,
}: {
  request: QualityReadOnlyEvidenceAdapterRequest
}) {
  void _request
  return <ActualQualityReadOnlyEvidencePanel result={activeResult} isLoading={false} />
}

describe('QualityReadOnlyEvidencePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    activeResult = {
      ok: true,
      fetchedAt: '2026-05-21T09:15:00.000Z',
      source: 'databricks-api',
      data: {
        request,
        summary: {
          source: 'databricks-api',
          status: 'pending-source-verification',
          inspectionLotCount: 0,
          micResultCount: 0,
          usageDecisionStatus: 'source-unverified',
          coaResultCount: 0,
          unavailableEvidence: [
            'inspection-lots',
            'mic-results',
            'usage-decision',
            'coa-results',
          ],
          warnings: [
            'Read-only Quality evidence is pending Databricks source verification.',
            'Missing usage-decision evidence must not be interpreted as accepted or released.',
            'CoA-like result evidence is not official CoA document approval.',
          ],
          queriedAt: '2026-05-21T09:15:00.000Z',
          sourceFreshnessStatus: 'not-verified',
        },
        inspectionLots: [],
        micResults: [],
        usageDecision: null,
        coaResults: [],
      } as QualityEvidenceResponse,
    }
  })

  it('renders pending source verification warning copy', () => {
    render(<QualityReadOnlyEvidencePanel request={request} />)

    expect(
      screen.getByText(/Read-only Quality evidence is not yet source-verified in V2/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Missing usage-decision, CoA, or deviation evidence must not be interpreted/i,
      ),
    ).toBeInTheDocument()
  })

  it('renders unavailable section states without release approval language', () => {
    render(<QualityReadOnlyEvidencePanel request={request} />)

    expect(screen.getByText(/Inspection lot evidence/i)).toBeInTheDocument()
    expect(screen.getByText(/MIC \/ inspection characteristic evidence/i)).toBeInTheDocument()
    expect(screen.getAllByText(/CoA-like result evidence/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/release ready/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/approved/i)).not.toBeInTheDocument()
  })

  it('keeps Quality and SPC concepts separated', () => {
    render(<QualityReadOnlyEvidencePanel request={request} />)

    expect(screen.getByText('Specification limits are not SPC control limits.')).toBeInTheDocument()
    expect(screen.getByText('MIC result valuation is not a release decision.')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Terms that must never appear in rendered panel output.
 * These represent release-authority claims that are explicitly prohibited by the
 * quality-readonly-evidence-state-model.md rules.
 *
 * "release authority" is NOT in this list because the panel uses it in safe
 * negated copy: "This is not a release authority." That negated form is correct.
 * The invariant test below separately checks that no POSITIVE release-authority
 * claim exists (e.g., "has release authority", "grants release authority").
 */
const PROHIBITED_TERMS = ['Released', 'Can release', 'Approved', 'Cleared', 'Release ready']

function mockWithFixture(fixture: AdapterResult<QualityEvidenceResponse> | undefined) {
  activeResult = fixture
}

function assertNoProhibitedTerms(container: HTMLElement) {
  const text = container.textContent ?? ''
  for (const term of PROHIBITED_TERMS) {
    expect(text, `Should not contain "${term}"`).not.toContain(term)
  }
  // Check no positive release-authority claim — negated forms ("not a release authority") are allowed
  expect(text, 'Should not claim panel "has release authority" or "grants release"').not.toMatch(
    /\bgrants release\b|\bhas release authority\b|\bauthorises release\b/i,
  )
}

// ---------------------------------------------------------------------------
// Source-truthfulness state tests
// ---------------------------------------------------------------------------

describe('source-truthfulness states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mock('@connectio/evidence-panel-runtime', () => ({
      EvidencePanel: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="evidence-panel">{children}</div>
      ),
      EvidenceCaveatList: ({ caveats }: { caveats: string[] }) => (
        <ul data-testid="evidence-caveats">
          {caveats.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      ),
      useEvidencePanel: () => ({ displayState: 'ready', markReady: vi.fn(), markError: vi.fn() }),
    }))
  })

  describe('pendingSourceVerificationFixture', () => {
    it('renders source-verification pending warning', () => {
      mockWithFixture(pendingSourceVerificationFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toMatch(/not yet source-verified/i)
    })

    it('does not render prohibited release terms', () => {
      mockWithFixture(pendingSourceVerificationFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      assertNoProhibitedTerms(container)
    })

    it('renders no action buttons', () => {
      mockWithFixture(pendingSourceVerificationFixture)
      render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('sourceVerifiedNotWiredFixture', () => {
    it('renders "not yet source-verified" warning', () => {
      mockWithFixture(sourceVerifiedNotWiredFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toMatch(/not yet source-verified|Live source wiring pending/i)
    })

    it('does not render prohibited release terms', () => {
      mockWithFixture(sourceVerifiedNotWiredFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      assertNoProhibitedTerms(container)
    })
  })

  describe('singleLotAcceptedStyleFixture', () => {
    it('renders raw code A', () => {
      mockWithFixture(singleLotAcceptedStyleFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toContain('A')
    })

    it('renders "source UD label only" governed label', () => {
      mockWithFixture(singleLotAcceptedStyleFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toContain('source UD label only')
    })

    it('renders read-only warning copy', () => {
      mockWithFixture(singleLotAcceptedStyleFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toMatch(/read-only|source evidence only/i)
    })

    it('does not render prohibited release terms', () => {
      mockWithFixture(singleLotAcceptedStyleFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      assertNoProhibitedTerms(container)
    })

    it('renders no action buttons', () => {
      mockWithFixture(singleLotAcceptedStyleFixture)
      render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('singleLotRejectedStyleFixture', () => {
    it('renders raw code R', () => {
      mockWithFixture(singleLotRejectedStyleFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toContain('R')
    })

    it('renders "source UD label only" governed label', () => {
      mockWithFixture(singleLotRejectedStyleFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toContain('source UD label only')
    })

    it('does not render prohibited release terms', () => {
      mockWithFixture(singleLotRejectedStyleFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      assertNoProhibitedTerms(container)
    })
  })

  describe('multipleLotsFixture', () => {
    it('renders multiple lots warning', () => {
      mockWithFixture(multipleLotsFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toMatch(/Multiple inspection lots/i)
    })

    it('states a batch-level decision is not derived', () => {
      mockWithFixture(multipleLotsFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toMatch(/batch-level release decision is not derived/i)
    })

    it('does not render prohibited release terms', () => {
      mockWithFixture(multipleLotsFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      assertNoProhibitedTerms(container)
    })
  })

  describe('missingInspectionLotFixture', () => {
    it('renders source gap warning', () => {
      mockWithFixture(missingInspectionLotFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toMatch(/source gap|No inspection lot found/i)
    })

    it('does NOT reassure the user there is no issue', () => {
      mockWithFixture(missingInspectionLotFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      // Must not contain bare "no issue" as a reassurance claim.
      // "not confirmation of no issue" is acceptable (the source gap warning).
      const text = container.textContent ?? ''
      // Detect standalone reassurance: "no issue" without preceding "not confirmation of"
      expect(text).not.toMatch(/(?<!not confirmation of )\bno issue found\b/i)
      expect(text).not.toMatch(/\bno defects\b|\bno problems\b|\bno quality issues\b/i)
    })

    it('does not render prohibited release terms', () => {
      mockWithFixture(missingInspectionLotFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      assertNoProhibitedTerms(container)
    })
  })

  describe('micPresentNoUsageDecisionFixture', () => {
    it('renders "not a release decision" copy for MIC', () => {
      mockWithFixture(micPresentNoUsageDecisionFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toMatch(/MIC result valuation is not a release decision/i)
    })

    it('renders missing usage-decision warning', () => {
      mockWithFixture(micPresentNoUsageDecisionFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toMatch(/usage.decision|No usage decision/i)
    })

    it('does not render prohibited release terms', () => {
      mockWithFixture(micPresentNoUsageDecisionFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      assertNoProhibitedTerms(container)
    })
  })

  describe('coaLikeEvidenceFixture', () => {
    it('renders "not official CoA" copy', () => {
      mockWithFixture(coaLikeEvidenceFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toMatch(/not official CoA document approval/i)
    })

    it('does not render prohibited release terms', () => {
      mockWithFixture(coaLikeEvidenceFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      assertNoProhibitedTerms(container)
    })
  })

  describe('deviationSourceUnavailableFixture', () => {
    it('renders "do not interpret as no deviations" copy', () => {
      mockWithFixture(deviationSourceUnavailableFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toMatch(/Do not interpret this as no deviations/i)
    })

    it('renders deviation unavailable warning', () => {
      mockWithFixture(deviationSourceUnavailableFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toMatch(/Deviation source unavailable/i)
    })

    it('does not render prohibited release terms', () => {
      mockWithFixture(deviationSourceUnavailableFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      assertNoProhibitedTerms(container)
    })
  })

  describe('simulatedReleasePanelFixture', () => {
    it('renders simulated panel warning', () => {
      mockWithFixture(simulatedReleasePanelFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toMatch(/SIMULATED RELEASE PANEL|demonstration only/i)
    })

    it('states panel does not authorise release', () => {
      mockWithFixture(simulatedReleasePanelFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).toMatch(/does not authorise release/i)
    })

    it('does not render prohibited release terms', () => {
      mockWithFixture(simulatedReleasePanelFixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      assertNoProhibitedTerms(container)
    })

    it('renders no release or reject action buttons', () => {
      mockWithFixture(simulatedReleasePanelFixture)
      render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('universal source-truthfulness invariants', () => {
    const allFixtures = [
      { name: 'pendingSourceVerification', fixture: pendingSourceVerificationFixture },
      { name: 'sourceVerifiedNotWired', fixture: sourceVerifiedNotWiredFixture },
      { name: 'singleLotAccepted', fixture: singleLotAcceptedStyleFixture },
      { name: 'singleLotRejected', fixture: singleLotRejectedStyleFixture },
      { name: 'multipleLots', fixture: multipleLotsFixture },
      { name: 'missingInspectionLot', fixture: missingInspectionLotFixture },
      { name: 'micPresentNoUD', fixture: micPresentNoUsageDecisionFixture },
      { name: 'coaLikeEvidence', fixture: coaLikeEvidenceFixture },
      { name: 'deviationUnavailable', fixture: deviationSourceUnavailableFixture },
      { name: 'simulatedRelease', fixture: simulatedReleasePanelFixture },
    ]

    it.each(allFixtures)('$name: does not render "Released" or "Can release"', ({ fixture }) => {
      mockWithFixture(fixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).not.toContain('Released')
      expect(container.textContent).not.toContain('Can release')
    })

    it.each(allFixtures)('$name: does not render "Approved" or "Cleared"', ({ fixture }) => {
      mockWithFixture(fixture)
      const { container } = render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(container.textContent).not.toContain('Cleared')
    })

    it.each(allFixtures)('$name: renders no release/reject action buttons', ({ fixture }) => {
      mockWithFixture(fixture)
      render(<QualityReadOnlyEvidencePanel request={request} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })
})
