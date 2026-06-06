/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SPCEvidenceSummaryPanel } from './spc-evidence-summary-panel.js'

describe('SPCEvidenceSummaryPanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders correctly with sections', () => {
    render(
      <SPCEvidenceSummaryPanel 
        sections={[
          { id: '1', name: 'Section 1', status: 'loaded', count: 5, source: 'mock' },
          { id: '2', name: 'Section 2', status: 'unavailable', source: 'databricks-api' }
        ]}
      />
    )

    expect(screen.getByText('SPC Evidence Completeness Summary')).not.toBeNull()
    expect(screen.getByText('Section 1')).not.toBeNull()
    expect(screen.getByText('Section 2')).not.toBeNull()
    expect(screen.getAllByText(/mock/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/databricks-api/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/unavailable/i).length).toBeGreaterThan(0)
    expect(screen.getByText('1 / 2 Loaded')).not.toBeNull()
  })

  it('handles mock-only status', () => {
    render(
      <SPCEvidenceSummaryPanel 
        sections={[
          { id: '1', name: 'Section 1', status: 'mock-only', source: 'mock' }
        ]}
      />
    )
    expect(screen.getByText('1 / 1 Loaded')).not.toBeNull()
    expect(screen.getByText(/mock only/i)).not.toBeNull()
  })
})
