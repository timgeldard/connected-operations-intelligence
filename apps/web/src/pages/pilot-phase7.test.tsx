import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PilotWorkspacePackPage } from './PilotWorkspacePackPage.js'
import { ScenarioValidationPage } from './ScenarioValidationPage.js'
import { FeedbackTriagePage } from './FeedbackTriagePage.js'
import { StakeholderSignoffPage } from './StakeholderSignoffPage.js'
import { ReleaseGatePage } from './ReleaseGatePage.js'
import { PilotExitCriteriaPage } from './PilotExitCriteriaPage.js'
import { DataIntegrationReadinessPage } from './DataIntegrationReadinessPage.js'
import { SecurityAccessReviewPage } from './SecurityAccessReviewPage.js'
import { HelpGettingStartedPage } from './HelpGettingStartedPage.js'
import { HelpConceptsPage } from './HelpConceptsPage.js'
import { HelpScenariosPage } from './HelpScenariosPage.js'
import { FeedbackProvider } from '../feedback/FeedbackContext.js'
import { isValidationPassed, isSignoffApproved, isGatePassed, aggregateGateStatus } from '@connectio/product-model'
import type { ValidationScenarioStatus, StakeholderSignoffStatus, ReleaseGateStatus, ReleaseGate } from '@connectio/product-model'

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

function FeedbackWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <FeedbackProvider>
        {children}
      </FeedbackProvider>
    </QueryClientProvider>
  )
}

// ——— Pilot Workspace Pack ———
describe('PilotWorkspacePackPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><PilotWorkspacePackPage /></Wrapper>)
  })

  it('renders the pilot-workspace-pack root element', async () => {
    render(<Wrapper><PilotWorkspacePackPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="pilot-workspace-pack"]')).not.toBeNull()
    })
  })

  it('renders trace-investigation workspace card', async () => {
    render(<Wrapper><PilotWorkspacePackPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="pilot-workspace-trace-investigation"]')).not.toBeNull()
    })
  })

  it('renders quality-batch-release workspace card', async () => {
    render(<Wrapper><PilotWorkspacePackPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="pilot-workspace-quality-batch-release"]')).not.toBeNull()
    })
  })
})

// ——— Scenario Validation Centre ———
describe('ScenarioValidationPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><ScenarioValidationPage /></Wrapper>)
  })

  it('renders the scenario-validation-centre root element', async () => {
    render(<Wrapper><ScenarioValidationPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="scenario-validation-centre"]')).not.toBeNull()
    })
  })

  it('renders SCN-001 scenario card', async () => {
    render(<Wrapper><ScenarioValidationPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="scenario-SCN-001"]')).not.toBeNull()
    })
  })

  it('renders SCN-004 (passed) scenario card', async () => {
    render(<Wrapper><ScenarioValidationPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="scenario-SCN-004"]')).not.toBeNull()
    })
  })
})

// ——— Feedback Triage ———
describe('FeedbackTriagePage', () => {
  it('renders without crashing', () => {
    render(<FeedbackWrapper><FeedbackTriagePage /></FeedbackWrapper>)
  })

  it('renders the feedback-triage root element', async () => {
    render(<FeedbackWrapper><FeedbackTriagePage /></FeedbackWrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="feedback-triage"]')).not.toBeNull()
    })
  })

  it('renders seed feedback item FB-SEED-001', async () => {
    render(<FeedbackWrapper><FeedbackTriagePage /></FeedbackWrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="feedback-FB-SEED-001"]')).not.toBeNull()
    })
  })

  it('renders seed feedback item FB-SEED-003 (accessibility blocker)', async () => {
    render(<FeedbackWrapper><FeedbackTriagePage /></FeedbackWrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="feedback-FB-SEED-003"]')).not.toBeNull()
    })
  })
})

// ——— Stakeholder Sign-Off ———
describe('StakeholderSignoffPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><StakeholderSignoffPage /></Wrapper>)
  })

  it('renders the stakeholder-signoff root element', async () => {
    render(<Wrapper><StakeholderSignoffPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="stakeholder-signoff"]')).not.toBeNull()
    })
  })

  it('renders SO-001 (Quality & Food Safety) sign-off card', async () => {
    render(<Wrapper><StakeholderSignoffPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="signoff-SO-001"]')).not.toBeNull()
    })
  })

  it('renders SO-004 (Maintenance — not-requested) sign-off card', async () => {
    render(<Wrapper><StakeholderSignoffPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="signoff-SO-004"]')).not.toBeNull()
    })
  })
})

// ——— Release Gate Dashboard ———
describe('ReleaseGatePage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><ReleaseGatePage /></Wrapper>)
  })

  it('renders the release-gate-dashboard root element', async () => {
    render(<Wrapper><ReleaseGatePage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="release-gate-dashboard"]')).not.toBeNull()
    })
  })

  it('renders GATE-001 (Product Model Gate — passed)', async () => {
    render(<Wrapper><ReleaseGatePage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="gate-GATE-001"]')).not.toBeNull()
    })
  })

  it('renders GATE-010 (Stakeholder Sign-Off Gate)', async () => {
    render(<Wrapper><ReleaseGatePage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="gate-GATE-010"]')).not.toBeNull()
    })
  })
})

// ——— Pilot Exit Criteria ———
describe('PilotExitCriteriaPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><PilotExitCriteriaPage /></Wrapper>)
  })

  it('renders the pilot-exit-criteria root element', async () => {
    render(<Wrapper><PilotExitCriteriaPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="pilot-exit-criteria"]')).not.toBeNull()
    })
  })

  it('renders PEC-003 (design-system compliance — passed)', async () => {
    render(<Wrapper><PilotExitCriteriaPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="exit-criteria-PEC-003"]')).not.toBeNull()
    })
  })

  it('renders PEC-010 (stakeholder sign-off — not-started)', async () => {
    render(<Wrapper><PilotExitCriteriaPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="exit-criteria-PEC-010"]')).not.toBeNull()
    })
  })
})

// ——— Data Integration Readiness ———
describe('DataIntegrationReadinessPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><DataIntegrationReadinessPage /></Wrapper>)
  })

  it('renders the data-integration-readiness root element', async () => {
    render(<Wrapper><DataIntegrationReadinessPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="data-integration-readiness"]')).not.toBeNull()
    })
  })
})

// ——— Security Access Review ———
describe('SecurityAccessReviewPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><SecurityAccessReviewPage /></Wrapper>)
  })

  it('renders the security-access-review root element', async () => {
    render(<Wrapper><SecurityAccessReviewPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="security-access-review"]')).not.toBeNull()
    })
  })

  it('renders SAR-004 (quality-lead over-permissioned for operations)', async () => {
    render(<Wrapper><SecurityAccessReviewPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="sar-SAR-004"]')).not.toBeNull()
    })
  })

  it('renders SAR-017 (concept-lab correctly hidden)', async () => {
    render(<Wrapper><SecurityAccessReviewPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="sar-SAR-017"]')).not.toBeNull()
    })
  })
})

// ——— Help Pages ———
describe('HelpGettingStartedPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><HelpGettingStartedPage /></Wrapper>)
  })

  it('renders the help-getting-started root element', async () => {
    render(<Wrapper><HelpGettingStartedPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="help-getting-started"]')).not.toBeNull()
    })
  })
})

describe('HelpConceptsPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><HelpConceptsPage /></Wrapper>)
  })

  it('renders the help-concepts root element', async () => {
    render(<Wrapper><HelpConceptsPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="help-concepts"]')).not.toBeNull()
    })
  })
})

describe('HelpScenariosPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><HelpScenariosPage /></Wrapper>)
  })

  it('renders the help-scenarios root element', async () => {
    render(<Wrapper><HelpScenariosPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="help-scenarios"]')).not.toBeNull()
    })
  })

  it('renders TRN-001 training scenario', async () => {
    render(<Wrapper><HelpScenariosPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="training-scenario-TRN-001"]')).not.toBeNull()
    })
  })
})

// ——— Pilot helper functions (unit tests) ———
describe('isValidationPassed', () => {
  it('returns true for passed', () => expect(isValidationPassed('passed' as ValidationScenarioStatus)).toBe(true))
  it('returns true for passed-with-observations', () => expect(isValidationPassed('passed-with-observations' as ValidationScenarioStatus)).toBe(true))
  it('returns false for failed', () => expect(isValidationPassed('failed' as ValidationScenarioStatus)).toBe(false))
  it('returns false for in-progress', () => expect(isValidationPassed('in-progress' as ValidationScenarioStatus)).toBe(false))
  it('returns false for not-started', () => expect(isValidationPassed('not-started' as ValidationScenarioStatus)).toBe(false))
  it('returns false for blocked', () => expect(isValidationPassed('blocked' as ValidationScenarioStatus)).toBe(false))
})

describe('isSignoffApproved', () => {
  it('returns true for approved', () => expect(isSignoffApproved('approved' as StakeholderSignoffStatus)).toBe(true))
  it('returns true for approved-with-conditions', () => expect(isSignoffApproved('approved-with-conditions' as StakeholderSignoffStatus)).toBe(true))
  it('returns false for requested', () => expect(isSignoffApproved('requested' as StakeholderSignoffStatus)).toBe(false))
  it('returns false for rejected', () => expect(isSignoffApproved('rejected' as StakeholderSignoffStatus)).toBe(false))
  it('returns false for not-requested', () => expect(isSignoffApproved('not-requested' as StakeholderSignoffStatus)).toBe(false))
  it('returns false for blocked', () => expect(isSignoffApproved('blocked' as StakeholderSignoffStatus)).toBe(false))
})

describe('isGatePassed', () => {
  it('returns true for passed', () => expect(isGatePassed('passed' as ReleaseGateStatus)).toBe(true))
  it('returns true for passed-with-conditions', () => expect(isGatePassed('passed-with-conditions' as ReleaseGateStatus)).toBe(true))
  it('returns false for in-progress', () => expect(isGatePassed('in-progress' as ReleaseGateStatus)).toBe(false))
  it('returns false for not-started', () => expect(isGatePassed('not-started' as ReleaseGateStatus)).toBe(false))
  it('returns false for failed', () => expect(isGatePassed('failed' as ReleaseGateStatus)).toBe(false))
  it('returns false for blocked', () => expect(isGatePassed('blocked' as ReleaseGateStatus)).toBe(false))
})

describe('aggregateGateStatus', () => {
  function makeGate(status: ReleaseGateStatus): ReleaseGate {
    return {
      gateId: 'G1', name: 'Test Gate', description: '', status,
      owner: 'owner', requiredFindingsClosed: [], requiredSignoffs: [],
      requiredScenarios: [], blockers: [], dueAt: '2026-06-01', evidenceLinks: [],
    }
  }

  it('returns not-started for empty array', () => expect(aggregateGateStatus([])).toBe('not-started'))
  it('returns failed if any gate failed', () => {
    expect(aggregateGateStatus([makeGate('passed'), makeGate('failed')])).toBe('failed')
  })
  it('failed takes priority over blocked', () => {
    expect(aggregateGateStatus([makeGate('blocked'), makeGate('failed')])).toBe('failed')
  })
  it('returns blocked if any gate blocked (no failed)', () => {
    expect(aggregateGateStatus([makeGate('passed'), makeGate('blocked')])).toBe('blocked')
  })
  it('returns in-progress if any gate in-progress (no failed/blocked)', () => {
    expect(aggregateGateStatus([makeGate('passed'), makeGate('in-progress')])).toBe('in-progress')
  })
  it('returns passed if all gates passed', () => {
    expect(aggregateGateStatus([makeGate('passed'), makeGate('passed-with-conditions')])).toBe('passed')
  })
})
