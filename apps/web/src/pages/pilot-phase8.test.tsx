import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { PilotExecutionDashboardPage } from './PilotExecutionDashboardPage.js'
import { ScenarioExecutionTrackingPage } from './ScenarioExecutionTrackingPage.js'
import { FeedbackBurnDownPage } from './FeedbackBurnDownPage.js'
import { PilotIssueRegisterPage } from './PilotIssueRegisterPage.js'
import { PilotSuccessMetricsPage } from './PilotSuccessMetricsPage.js'
import { TrainingReadinessPage } from './TrainingReadinessPage.js'
import { SupportReadinessPage } from './SupportReadinessPage.js'
import { DataQualityGapsPage } from './DataQualityGapsPage.js'
import { AccessExceptionsPage } from './AccessExceptionsPage.js'
import { WorkspaceAdoptionPage } from './WorkspaceAdoptionPage.js'
import { CutoverRecommendationPage } from './CutoverRecommendationPage.js'
import { GoNoGoAssessmentPage } from './GoNoGoAssessmentPage.js'
import { RolloutWavePlanPage } from './RolloutWavePlanPage.js'
import { LessonsLearnedPage } from './LessonsLearnedPage.js'

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
}

describe('PilotExecutionDashboardPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><PilotExecutionDashboardPage /></Wrapper>)
  })

  it('has data-testid root', async () => {
    render(<Wrapper><PilotExecutionDashboardPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="pilot-execution-dashboard"]')).not.toBeNull()
    })
  })

  it('shows no-go recommendation', async () => {
    render(<Wrapper><PilotExecutionDashboardPage /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/NO.GO/i)).toBeTruthy()
    })
  })

  it('shows active pilot status badge', async () => {
    render(<Wrapper><PilotExecutionDashboardPage /></Wrapper>)
    await waitFor(() => {
      expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0)
    })
  })
})

describe('ScenarioExecutionTrackingPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><ScenarioExecutionTrackingPage /></Wrapper>)
  })

  it('has data-testid root', async () => {
    render(<Wrapper><ScenarioExecutionTrackingPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="scenario-execution-tracking"]')).not.toBeNull()
    })
  })

  it('renders EXE-001 execution card', async () => {
    render(<Wrapper><ScenarioExecutionTrackingPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="execution-EXE-001"]')).not.toBeNull()
    })
  })

  it('renders all 6 execution cards', async () => {
    render(<Wrapper><ScenarioExecutionTrackingPage /></Wrapper>)
    await waitFor(() => {
      for (const id of ['EXE-001', 'EXE-002', 'EXE-003', 'EXE-004', 'EXE-005', 'EXE-006']) {
        expect(document.querySelector(`[data-testid="execution-${id}"]`)).not.toBeNull()
      }
    })
  })

  it('shows pass rate', async () => {
    render(<Wrapper><ScenarioExecutionTrackingPage /></Wrapper>)
    await waitFor(() => {
      expect(screen.getAllByText(/pass rate/i).length).toBeGreaterThan(0)
    })
  })
})

describe('FeedbackBurnDownPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><FeedbackBurnDownPage /></Wrapper>)
  })

  it('has data-testid root', async () => {
    render(<Wrapper><FeedbackBurnDownPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="feedback-burndown"]')).not.toBeNull()
    })
  })

  it('renders at least one issue card', async () => {
    render(<Wrapper><FeedbackBurnDownPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="issue-ISS-001"]')).not.toBeNull()
    })
  })

  it('shows trend badge', async () => {
    render(<Wrapper><FeedbackBurnDownPage /></Wrapper>)
    await waitFor(() => {
      const el = document.querySelector('[data-testid="feedback-burndown"]')
      expect(el?.textContent).toMatch(/improving|stable|worsening/i)
    })
  })
})

describe('PilotIssueRegisterPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><PilotIssueRegisterPage /></Wrapper>)
  })

  it('has data-testid root', async () => {
    render(<Wrapper><PilotIssueRegisterPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="pilot-issue-register"]')).not.toBeNull()
    })
  })

  it('renders ISS-004 card', async () => {
    render(<Wrapper><PilotIssueRegisterPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="pilot-issue-ISS-004"]')).not.toBeNull()
    })
  })

  it('shows pilot exit blocker badge on ISS-004', async () => {
    render(<Wrapper><PilotIssueRegisterPage /></Wrapper>)
    await waitFor(() => {
      const card = document.querySelector('[data-testid="pilot-issue-ISS-004"]')
      expect(card?.textContent).toMatch(/pilot exit blocker/i)
    })
  })
})

describe('PilotSuccessMetricsPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><PilotSuccessMetricsPage /></Wrapper>)
  })

  it('has data-testid root', async () => {
    render(<Wrapper><PilotSuccessMetricsPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="pilot-success-metrics"]')).not.toBeNull()
    })
  })

  it('renders PSM-001 metric card', async () => {
    render(<Wrapper><PilotSuccessMetricsPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="metric-PSM-001"]')).not.toBeNull()
    })
  })

  it('shows overall metric status', async () => {
    render(<Wrapper><PilotSuccessMetricsPage /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Overall/i)).toBeTruthy()
    })
  })
})

describe('TrainingReadinessPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><TrainingReadinessPage /></Wrapper>)
  })

  it('has data-testid root', async () => {
    render(<Wrapper><TrainingReadinessPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="training-readiness"]')).not.toBeNull()
    })
  })

  it('renders quality-lead training card', async () => {
    render(<Wrapper><TrainingReadinessPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="training-role-quality-lead"]')).not.toBeNull()
    })
  })

  it('renders plant-manager training card with blocked state', async () => {
    render(<Wrapper><TrainingReadinessPage /></Wrapper>)
    await waitFor(() => {
      const card = document.querySelector('[data-testid="training-role-plant-manager"]')
      expect(card?.textContent).toMatch(/blocked/i)
    })
  })
})

describe('SupportReadinessPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><SupportReadinessPage /></Wrapper>)
  })

  it('has data-testid root', async () => {
    render(<Wrapper><SupportReadinessPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="support-readiness"]')).not.toBeNull()
    })
  })

  it('renders quality-batch-release area card', async () => {
    render(<Wrapper><SupportReadinessPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="support-area-quality-batch-release"]')).not.toBeNull()
    })
  })
})

describe('DataQualityGapsPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><DataQualityGapsPage /></Wrapper>)
  })

  it('has data-testid root', async () => {
    render(<Wrapper><DataQualityGapsPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="data-quality-gaps"]')).not.toBeNull()
    })
  })

  it('renders DQG-001 gap card', async () => {
    render(<Wrapper><DataQualityGapsPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="gap-DQG-001"]')).not.toBeNull()
    })
  })

  it('shows production blocker badge on DQG-001', async () => {
    render(<Wrapper><DataQualityGapsPage /></Wrapper>)
    await waitFor(() => {
      const card = document.querySelector('[data-testid="gap-DQG-001"]')
      expect(card?.textContent).toMatch(/blocks production/i)
    })
  })
})

describe('AccessExceptionsPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><AccessExceptionsPage /></Wrapper>)
  })

  it('has data-testid root', async () => {
    render(<Wrapper><AccessExceptionsPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="access-exceptions"]')).not.toBeNull()
    })
  })

  it('renders AE-003 exception card', async () => {
    render(<Wrapper><AccessExceptionsPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="access-exception-AE-003"]')).not.toBeNull()
    })
  })
})

describe('WorkspaceAdoptionPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><WorkspaceAdoptionPage /></Wrapper>)
  })

  it('has data-testid root', async () => {
    render(<Wrapper><WorkspaceAdoptionPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="workspace-adoption"]')).not.toBeNull()
    })
  })

  it('renders quality-batch-release adoption card', async () => {
    render(<Wrapper><WorkspaceAdoptionPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="adoption-quality-batch-release"]')).not.toBeNull()
    })
  })

  it('shows overall adoption percentage', async () => {
    render(<Wrapper><WorkspaceAdoptionPage /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText(/Overall/i)).toBeTruthy()
    })
  })
})

describe('CutoverRecommendationPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><CutoverRecommendationPage /></Wrapper>)
  })

  it('has data-testid root', async () => {
    render(<Wrapper><CutoverRecommendationPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="cutover-recommendation"]')).not.toBeNull()
    })
  })

  it('shows NO-GO recommendation', async () => {
    render(<Wrapper><CutoverRecommendationPage /></Wrapper>)
    await waitFor(() => {
      expect(screen.getByText('NO-GO')).toBeTruthy()
    })
  })

  it('shows blockers section', async () => {
    render(<Wrapper><CutoverRecommendationPage /></Wrapper>)
    await waitFor(() => {
      expect(screen.getAllByText(/Blockers/i).length).toBeGreaterThan(0)
    })
  })
})

describe('GoNoGoAssessmentPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><GoNoGoAssessmentPage /></Wrapper>)
  })

  it('has data-testid root', async () => {
    render(<Wrapper><GoNoGoAssessmentPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="go-no-go-assessment"]')).not.toBeNull()
    })
  })

  it('renders GNG-001 dimension card', async () => {
    render(<Wrapper><GoNoGoAssessmentPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="gng-dimension-GNG-001"]')).not.toBeNull()
    })
  })

  it('shows NO-GO overall verdict', async () => {
    render(<Wrapper><GoNoGoAssessmentPage /></Wrapper>)
    await waitFor(() => {
      const root = document.querySelector('[data-testid="go-no-go-assessment"]')
      expect(root?.textContent).toMatch(/NO-GO/i)
    })
  })
})

describe('RolloutWavePlanPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><RolloutWavePlanPage /></Wrapper>)
  })

  it('has data-testid root', async () => {
    render(<Wrapper><RolloutWavePlanPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="rollout-wave-plan"]')).not.toBeNull()
    })
  })

  it('renders all 4 wave cards', async () => {
    render(<Wrapper><RolloutWavePlanPage /></Wrapper>)
    await waitFor(() => {
      for (const waveId of ['WAVE-0', 'WAVE-1', 'WAVE-2', 'WAVE-3']) {
        expect(document.querySelector(`[data-testid="wave-${waveId}"]`)).not.toBeNull()
      }
    })
  })

  it('WAVE-0 shows active status', async () => {
    render(<Wrapper><RolloutWavePlanPage /></Wrapper>)
    await waitFor(() => {
      const wave = document.querySelector('[data-testid="wave-WAVE-0"]')
      expect(wave?.textContent).toMatch(/active/i)
    })
  })
})

describe('LessonsLearnedPage', () => {
  it('renders without crashing', () => {
    render(<Wrapper><LessonsLearnedPage /></Wrapper>)
  })

  it('has data-testid root', async () => {
    render(<Wrapper><LessonsLearnedPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="lessons-learned"]')).not.toBeNull()
    })
  })

  it('renders LL-001 lesson card', async () => {
    render(<Wrapper><LessonsLearnedPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="lesson-LL-001"]')).not.toBeNull()
    })
  })

  it('renders LL-012 accessibility lesson', async () => {
    render(<Wrapper><LessonsLearnedPage /></Wrapper>)
    await waitFor(() => {
      expect(document.querySelector('[data-testid="lesson-LL-012"]')).not.toBeNull()
    })
  })

  it('shows high priority count', async () => {
    render(<Wrapper><LessonsLearnedPage /></Wrapper>)
    await waitFor(() => {
      expect(screen.getAllByText(/High Priority/i).length).toBeGreaterThan(0)
    })
  })
})
