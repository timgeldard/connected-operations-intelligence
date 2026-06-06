import { beforeEach, describe, expect, it, vi } from 'vitest'
import { trackEvent } from '@connectio/telemetry'
import { createActiveInvestigationStore } from './active-investigation-store.js'

vi.mock('@connectio/telemetry', () => ({
  trackEvent: vi.fn(),
}))

describe('createActiveInvestigationStore', () => {
  beforeEach(() => {
    vi.mocked(trackEvent).mockClear()
  })

  it('starts with a valid timestamped empty context', () => {
    const store = createActiveInvestigationStore({
      workspaceId: 'trace-investigation',
      now: () => '2026-05-20T10:00:00.000Z',
    })

    expect(store.getState().context).toEqual({
      timestamp: '2026-05-20T10:00:00.000Z',
    })
  })

  it('merges partial context updates and records the source panel', () => {
    const store = createActiveInvestigationStore({
      workspaceId: 'trace-investigation',
      now: () => '2026-05-20T10:00:00.000Z',
    })

    store.getState().setContext({
      batchId: 'B-001',
      plantId: 'IE10',
      lastChangedByPanel: 'trace-query-form',
    })

    store.getState().setContext({
      processOrderId: '7006965038',
      timestamp: '2026-05-20T10:01:00.000Z',
    })

    expect(store.getState().context).toMatchObject({
      batchId: 'B-001',
      plantId: 'IE10',
      processOrderId: '7006965038',
      lastChangedByPanel: 'trace-query-form',
      timestamp: '2026-05-20T10:01:00.000Z',
    })
  })

  it('rejects invalid context replacements', () => {
    const store = createActiveInvestigationStore({ workspaceId: 'trace-investigation' })

    expect(() => store.getState().replaceContext({
      timestamp: 'not-a-date',
    })).toThrow()
  })

  it('resets back to an empty timestamped context', () => {
    const now = vi.fn()
      .mockReturnValueOnce('2026-05-20T10:00:00.000Z')
      .mockReturnValueOnce('2026-05-20T10:01:00.000Z')
      .mockReturnValueOnce('2026-05-20T10:02:00.000Z')
    const store = createActiveInvestigationStore({ workspaceId: 'trace-investigation', now })

    store.getState().setContext({ batchId: 'B-001' })
    store.getState().resetContext()

    expect(store.getState().context).toEqual({
      timestamp: '2026-05-20T10:02:00.000Z',
    })
  })

  it('does not emit context-change telemetry when only the timestamp changes', () => {
    const store = createActiveInvestigationStore({
      workspaceId: 'trace-investigation',
      initialContext: {
        batchId: 'B-001',
        plantId: 'IE10',
        timestamp: '2026-05-20T10:00:00.000Z',
      },
    })

    store.getState().setContext({
      batchId: 'B-001',
      plantId: 'IE10',
      timestamp: '2026-05-20T10:01:00.000Z',
    })

    expect(trackEvent).not.toHaveBeenCalled()
  })
})
