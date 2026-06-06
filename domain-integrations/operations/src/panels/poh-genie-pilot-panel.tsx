import { useEffect, useMemo, useState } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'
import {
  useOrderConfirmations,
  useOrderGoodsMovements,
  useOrderOperations,
  useProcessOrderHeader,
} from '../adapters/process-order-review-queries.js'
import {
  buildPohGenieReply,
  POH_GENIE_STARTER_PROMPTS,
} from './poh-genie-pilot-engine.js'
import type { AdapterSource } from '@connectio/source-adapters'

const registration: EvidencePanelRegistration = {
  panelId: 'poh-genie-pilot',
  displayName: 'POH Assistant Pilot',
  description: 'Domain-scoped POH assistant pilot limited to approved operations, confirmations, goods movements, and conditional header topics.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['process-order-review'],
  requiredContext: [{ contextKey: 'processOrderId', scopeLevel: 'process-order', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.order.read', displayName: 'Operations Order Read' }],
}

interface Message {
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly kind?: 'approved' | 'blocked' | 'unsupported'
}

export interface PohGeniePilotPanelProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

function firstErrorMessage(messages: Array<string | undefined>): string | undefined {
  return messages.find(Boolean)
}

function combineSources(sources: Array<AdapterSource | undefined>): AdapterSource | undefined {
  const distinct = Array.from(new Set(sources.filter(Boolean)))
  if (distinct.length === 0) return undefined
  if (distinct.length === 1) return distinct[0]
  return 'mixed'
}

export function PohGeniePilotPanel({ request }: PohGeniePilotPanelProps) {
  const hasContext = Boolean(request.processOrderId?.trim())

  const headerQuery = useProcessOrderHeader(request, { enabled: hasContext })
  const operationsQuery = useOrderOperations(request, { enabled: hasContext })
  const confirmationsQuery = useOrderConfirmations(request, { enabled: hasContext })
  const goodsMovementsQuery = useOrderGoodsMovements(request, { enabled: hasContext })

  const operationsResult = operationsQuery.data
  const confirmationsResult = confirmationsQuery.data
  const goodsMovementsResult = goodsMovementsQuery.data
  const headerResult = headerQuery.data

  const coreLoading = hasContext && (
    operationsQuery.isLoading ||
    confirmationsQuery.isLoading ||
    goodsMovementsQuery.isLoading
  )

  const coreErrorMessages = [
    operationsResult && !operationsResult.ok ? operationsResult.error.message : undefined,
    confirmationsResult && !confirmationsResult.ok ? confirmationsResult.error.message : undefined,
    goodsMovementsResult && !goodsMovementsResult.ok ? goodsMovementsResult.error.message : undefined,
  ]

  const coreHasError = coreErrorMessages.some(Boolean)

  const lastRefreshedAt = useMemo(() => {
    const successful = [
      operationsResult?.ok ? operationsResult.fetchedAt : null,
      confirmationsResult?.ok ? confirmationsResult.fetchedAt : null,
      goodsMovementsResult?.ok ? goodsMovementsResult.fetchedAt : null,
      headerResult?.ok ? headerResult.fetchedAt : null,
    ].filter(Boolean)

    return successful.length > 0 ? successful.sort().at(-1) ?? null : null
  }, [operationsResult, confirmationsResult, goodsMovementsResult, headerResult])

  const { displayState: managedDisplayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (!hasContext || coreLoading) return
    if (coreHasError) markError()
    else if (operationsResult?.ok && confirmationsResult?.ok && goodsMovementsResult?.ok) markReady()
  }, [
    hasContext,
    coreLoading,
    coreHasError,
    operationsResult,
    confirmationsResult,
    goodsMovementsResult,
    markError,
    markReady,
  ])

  const displayState = !hasContext
    ? 'waiting-for-context'
    : managedDisplayState

  const source = combineSources([
    operationsResult?.source,
    confirmationsResult?.source,
    goodsMovementsResult?.source,
    headerResult?.source,
  ])

  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<readonly Message[]>([])

  useEffect(() => {
    setMessages([])
    setDraft('')
  }, [request.processOrderId])

  const headerUnavailableNote = hasContext && headerResult && !headerResult.ok
    ? `Conditional header slice unavailable: ${headerResult.error.message}`
    : null

  const handleAsk = (question: string) => {
    if (!hasContext || !operationsResult?.ok || !confirmationsResult?.ok || !goodsMovementsResult?.ok) {
      return
    }

    const trimmed = question.trim()
    if (!trimmed) return

    const reply = buildPohGenieReply(trimmed, {
      processOrderId: request.processOrderId!,
      header: headerResult?.ok ? { data: headerResult.data, source: headerResult.source } : undefined,
      operations: { data: operationsResult.data, source: operationsResult.source },
      confirmations: { data: confirmationsResult.data, source: confirmationsResult.source },
      goodsMovements: { data: goodsMovementsResult.data, source: goodsMovementsResult.source },
    })

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
              Operations, confirmations, goods movements, and the conditional header slice only.
              Blocked topics include lateness root cause, OEE, planning, downtime, genealogy, and release decisions.
            </div>
            {headerUnavailableNote && (
              <div style={{ fontSize: 10, color: '#D97706', marginTop: 8 }}>
                {headerUnavailableNote}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--shell-fg)', marginBottom: 8 }}>
              Starter prompts
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {POH_GENIE_STARTER_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleAsk(prompt)}
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
            <label htmlFor="poh-genie-pilot-input" style={{ fontSize: 11, fontWeight: 700, color: 'var(--shell-fg)' }}>
              Ask within approved POH scope
            </label>
            <textarea
              id="poh-genie-pilot-input"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              placeholder="Ask about operations, confirmations, goods movements, or the combined currently loaded evidence."
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
                Answers cite the contributing POH panels and source modes.
              </div>
              <button
                type="button"
                onClick={() => handleAsk(draft)}
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
                No prompt asked yet. Use a starter prompt or enter a question within the approved POH pilot scope.
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
                      {message.role === 'assistant' ? 'POH Assistant Pilot' : 'You'}
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
