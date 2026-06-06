import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { FeedbackItem, FeedbackStatus } from '@connectio/product-model'

const STORAGE_KEY = 'connectio.feedback.v1'

type NewFeedbackInput = Omit<FeedbackItem, 'feedbackId' | 'createdAt' | 'updatedAt' | 'status'>

interface FeedbackContextValue {
  readonly items: readonly FeedbackItem[]
  readonly submit: (input: NewFeedbackInput) => void
  readonly updateStatus: (feedbackId: string, status: FeedbackStatus) => void
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

function loadFromStorage(): FeedbackItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as FeedbackItem[]
    return []
  } catch {
    return []
  }
}

function saveToStorage(items: readonly FeedbackItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // storage unavailable — silently ignore
  }
}

let idCounter = Date.now()

function generateId(): string {
  idCounter += 1
  return `FB-${idCounter}`
}

export function FeedbackProvider({ children }: { readonly children: React.ReactNode }) {
  const [items, setItems] = useState<readonly FeedbackItem[]>(loadFromStorage)

  useEffect(() => {
    saveToStorage(items)
  }, [items])

  const submit = useCallback((input: NewFeedbackInput) => {
    const now = new Date().toISOString()
    const item: FeedbackItem = {
      ...input,
      feedbackId: generateId(),
      status: 'new',
      createdAt: now,
      updatedAt: now,
    }
    setItems(prev => [...prev, item])
  }, [])

  const updateStatus = useCallback((feedbackId: string, status: FeedbackStatus) => {
    setItems(prev =>
      prev.map(item =>
        item.feedbackId === feedbackId
          ? { ...item, status, updatedAt: new Date().toISOString() }
          : item,
      ),
    )
  }, [])

  return (
    <FeedbackContext.Provider value={{ items, submit, updateStatus }}>
      {children}
    </FeedbackContext.Provider>
  )
}

export function useFeedbackContext(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedbackContext must be used within FeedbackProvider')
  return ctx
}
