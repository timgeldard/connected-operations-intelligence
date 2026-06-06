import { useEffect, useMemo, useState } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'
import { useBatchHeaderSummary, useTraceGraph } from '../adapters/trace2-queries.js'
import { buildTraceGenieReply, TRACE_GENIE_STARTER_PROMPTS, type TraceGenieSnapshot } from './trace-genie-pilot-engine.js'

const registration: EvidencePanelRegistration = {
  panelId: 'trace-genie-pilot',
  displayName: 'Trace Assistant Pilot',
  description: 'Domain-scoped Traceability assistant pilot limited to focal batch and visible graph evidence.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['trace-investigation', 'traceability-workspace'],
  requiredContext: [
    { contextKey: 'batchId', scopeLevel: 'batch', required: true },
    { contextKey: 'materialId', scopeLevel: 'material', required: true },
  ],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

interface Message {
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly kind?: 'approved' | 'blocked' | 'unsupported'
}

export interface TraceGeniePilotPanelProps {
  readonly request: Trace2AdapterRequest
}

function firstErrorMessage(messages: Array<string | undefined>): string | undefined {
  return messages.find(Boolean)
}

function combineSources(sources: Array<string | undefined>): 'mock' | 'legacy-api' | 'databricks-api' | 'mixed' | undefined {
  const distinct = Array.from(new Set(sources.filter(Boolean)))
  if (distinct.length === 0) return undefined
  if (distinct.length === 1) {
    const [value] = distinct
    if (value === 'mock' || value === 'legacy-api' || value === 'databricks-api' || value === 'mixed') return value
  }
  return 'mixed'
}

export function TraceGeniePilotPanel({ request }: TraceGeniePilotPanelProps) {
  const hasContext = Boolean(request.batchId?.trim() && request.materialId?.trim())

  const batchHeaderQuery = useBatchHeaderSummary(request, { enabled: hasContext })
  const traceGraphQuery = useTraceGraph(request, { enabled: hasContext })

  const batchHeaderResult = batchHeaderQuery.data
  const traceGraphResult = traceGraphQuery.data

  const coreLoading = hasContext && (batchHeaderQuery.isLoading || traceGraphQuery.isLoading)
  const coreErrorMessages = [
    batchHeaderResult && !batchHeaderResult.ok ? batchHeaderResult.error.message : undefined,
    traceGraphResult && !traceGraphResult.ok ? traceGraphResult.error.message : undefined,
  ]
  const coreHasError = coreErrorMessages.some(Boolean)

  const lastRefreshedAt = useMemo(() => {
    const successful = [
      batchHeaderResult?.ok ? batchHeaderResult.fetchedAt : null,
      traceGraphResult?.ok ? traceGraphResult.fetchedAt : null,
    ].filter(Boolean)
    return successful.length > 0 ? successful.sort().at(-1) ?? null : null
  }, [batchHeaderResult, traceGraphResult])

  const { displayState: managedDisplayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (!hasContext || coreLoading) return
    if (coreHasError) markError()
    else if (batchHeaderResult?.ok && traceGraphResult?.ok) markReady()
  }, [hasContext, coreLoading, coreHasError, batchHeaderResult, traceGraphResult, markError, markReady])

  const displayState = !hasContext ? 'waiting-for-context' : managedDisplayState
  const source = combineSources([batchHeaderResult?.source, traceGraphResult?.source])

  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<readonly Message[]>([])

  useEffect(() => {
    setMessages([])
    setDraft('')
  }, [request.batchId, request.materialId, request.plantId])

  function ask(question: string) {
    if (!batchHeaderResult?.ok || !traceGraphResult?.ok) return

    const trimmed = question.trim()
    if (!trimmed) return

    const reply = buildTraceGenieReply(trimmed, {
      batchHeader: { data: batchHeaderResult.data, source: batchHeaderResult.source },
      traceGraph: { data: traceGraphResult.data, source: traceGraphResult.source },
    } satisfies TraceGenieSnapshot)

    setMessages(previous => [
      ...previous,
      { role: 'user', text: trimmed },
      { role: 'assistant', text: reply.text, kind: reply.kind },
    ])
    setDraft('')
  }

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={firstErrorMessage(coreErrorMessages)}
      source={source}
    >
      {displayState !== 'waiting-for-context' && displayState !== 'error' && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <div style={{
            background: 'rgba(0, 87, 118, 0.06)',
            border: '1px solid rgba(0, 87, 118, 0.18)',
            borderRadius: 8,
            padding: 12,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--shell-fg)', marginBottom: 6 }}>
              Approved pilot scope
            </div>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', lineHeight: 1.5 }}>
              Focal batch summary and the currently visible trace graph only. Customer exposure, supplier impact, mass balance, quality/release reasoning, timeline, and recall actions are blocked.
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--shell-fg)', marginBottom: 8 }}>
              Starter prompts
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TRACE_GENIE_STARTER_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => ask(prompt)}
                  style={{
                    border: '1px solid var(--shell-line)',
                    background: 'var(--shell-surface-2, #f7f7f8)',
                    color: 'var(--shell-fg)',
                    borderRadius: 999,
                    padding: '6px 10px',
                    fontSize: 11,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <label htmlFor="trace-genie-pilot-input" style={{ fontSize: 11, fontWeight: 700, color: 'var(--shell-fg)' }}>
              Ask within approved Traceability scope
            </label>
            <textarea
              id="trace-genie-pilot-input"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              placeholder="Ask about the focal batch, the visible graph, graph counts, graph warnings, or source citations."
              rows={3}
              style={{
                width: '100%',
                resize: 'vertical',
                borderRadius: 8,
                border: '1px solid var(--shell-line)',
                padding: 10,
                fontSize: 12,
                fontFamily: 'inherit',
                background: 'var(--shell-surface)',
                color: 'var(--shell-fg)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>
                Answers cite `BatchHeaderPanel` and `TraceGraphPanel`, including source modes.
              </div>
              <button
                type="button"
                onClick={() => ask(draft)}
                disabled={draft.trim().length === 0}
                style={{
                  border: '1px solid #005776',
                  background: draft.trim().length === 0 ? 'var(--shell-surface-2, #f3f4f6)' : '#005776',
                  color: draft.trim().length === 0 ? 'var(--shell-fg-3)' : '#fff',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: draft.trim().length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Ask pilot
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {messages.length === 0 ? (
              <div style={{
                border: '1px dashed var(--shell-line)',
                borderRadius: 8,
                padding: 12,
                fontSize: 11,
                color: 'var(--shell-fg-3)',
              }}>
                No prompt asked yet. Use a starter prompt or enter a question within the approved Traceability pilot scope.
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  style={{
                    border: '1px solid var(--shell-line)',
                    borderRadius: 8,
                    padding: 12,
                    background: message.role === 'assistant' ? 'var(--shell-surface)' : 'var(--shell-surface-2, #f7f7f8)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--shell-fg-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {message.role === 'assistant' ? 'Trace Assistant Pilot' : 'You'}
                    </span>
                    {message.kind && (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: message.kind === 'approved' ? '#388E3C' : message.kind === 'blocked' ? '#D97706' : '#6B7280',
                        textTransform: 'uppercase',
                      }}>
                        {message.kind}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--shell-fg)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {message.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}
