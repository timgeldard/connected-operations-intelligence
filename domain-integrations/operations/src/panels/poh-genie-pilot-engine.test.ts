import { describe, expect, it } from 'vitest'
import { DECISION_BLOCKED_TEMPLATE } from '@connectio/product-model'
import { buildPohGenieReply } from './poh-genie-pilot-engine.js'
import type { PohGenieSnapshot } from './poh-genie-pilot-engine.js'

const snapshot: PohGenieSnapshot = {
  processOrderId: 'PO-240308-3847',
  header: {
    data: {
      processOrderId: 'PO-240308-3847',
      orderType: 'process-order',
      materialId: 'MAT-CH-EMMENTAL-BLOCK',
      materialDescription: 'Emmental Block 4 kg',
      plantId: 'IE10',
      batchId: 'CH-240308-0047',
      plannedQuantity: 2400,
      confirmedQuantity: 1860,
      uom: 'KG',
      plannedStart: '2024-03-08T00:00:00.000Z',
      plannedFinish: '2024-03-08T23:59:00.000Z',
      orderStatus: 'in-process',
    },
    source: 'legacy-api' as const,
  },
  operations: {
    data: [
      {
        operationId: 'OP-010',
        operationNumber: '0010',
        operationText: 'Milk Standardisation',
        workCentre: 'WC-1',
        plannedDurationMinutes: 180,
        status: 'confirmed' as const,
        confirmationStatus: 'final-confirmed' as const,
        confirmed: true,
        hasException: false,
      },
      {
        operationId: 'OP-020',
        operationNumber: '0020',
        operationText: 'Pasteurisation',
        workCentre: 'WC-2',
        plannedDurationMinutes: 90,
        status: 'in-progress' as const,
        confirmationStatus: 'partially-confirmed' as const,
        confirmed: false,
        hasException: true,
      },
    ],
    source: 'databricks-api' as const,
  },
  confirmations: {
    data: [
      {
        confirmationId: 'CONF-001',
        operationId: 'OP-010',
        operationText: 'Milk Standardisation',
        confirmedYield: 1200,
        uom: 'KG',
        isFinalConfirmation: true,
      },
      {
        confirmationId: 'CONF-002',
        operationId: 'OP-020',
        operationText: 'Pasteurisation',
        confirmedYield: 660,
        uom: 'KG',
        isFinalConfirmation: false,
      },
    ],
    source: 'databricks-api' as const,
  },
  goodsMovements: {
    data: [
      {
        movementId: 'GM-001',
        movementType: '261',
        direction: 'input' as const,
        materialId: 'MAT-A',
        quantity: 1200,
        uom: 'KG',
      },
      {
        movementId: 'GM-002',
        movementType: '101',
        direction: 'output' as const,
        materialId: 'MAT-B',
        quantity: 900,
        uom: 'KG',
      },
    ],
    source: 'databricks-api' as const,
  },
}

describe('buildPohGenieReply', () => {
  it('builds a cited combined answer for approved questions', () => {
    const reply = buildPohGenieReply(
      'Summarize the currently loaded operations, confirmations, and goods movements for this process order.',
      snapshot,
    )

    expect(reply.kind).toBe('approved')
    expect(reply.text).toContain('OrderOperationsPanel (databricks-api)')
    expect(reply.text).toContain('OrderConfirmationsPanel (databricks-api)')
    expect(reply.text).toContain('ProcessOrderGoodsMovementsPanel (databricks-api)')
    expect(reply.text).toContain('Conditional header slice from ProcessOrderHeaderPanel (legacy-api)')
  })

  it('refuses blocked lateness questions', () => {
    const reply = buildPohGenieReply('Why is this order late?', snapshot)

    expect(reply.kind).toBe('blocked')
    expect(reply.text).toContain('current POH pilot')
    expect(reply.text).toContain('Approved topics right now')
  })

  it('returns an unsupported response for out-of-pack questions', () => {
    const reply = buildPohGenieReply('Tell me something interesting.', snapshot)

    expect(reply.kind).toBe('unsupported')
    expect(reply.text).toContain('could not match')
  })
})

describe('buildPohGenieReply — blocked topics (governed decisions)', () => {
  const DECISION_QUESTIONS = [
    'Can I close the recall?',
    'Is customer exposure zero?',
    'Can I release this batch?',
    'Is this batch accepted?',
    'Are all customers identified?',
    'Is this process in control?',
    'Can I reject this batch?',
    'Is the recall contained?',
    'Is the supplier at fault?',
    'Post this in SAP',
    'Is the CoA approved?',
  ]

  for (const question of DECISION_QUESTIONS) {
    it(`blocks governed decision question: "${question}"`, () => {
      const reply = buildPohGenieReply(question, snapshot)

      expect(reply.kind).toBe('blocked')
      expect(reply.text.length).toBeGreaterThan(0)
      expect(reply.text).not.toMatch(/\byes\b/i)
      expect(reply.text).not.toMatch(/\bapproved\b/i)
      expect(reply.text).not.toMatch(/\bconfirmed\b/i)
      expect(reply.text).toContain(DECISION_BLOCKED_TEMPLATE)
    })
  }
})

describe('buildPohGenieReply — safe answer requirements', () => {
  it('approved answers contain source/evidence citations', () => {
    const reply = buildPohGenieReply(
      'Show the operations currently returned for this process order.',
      snapshot,
    )

    expect(reply.kind).toBe('approved')
    expect(reply.text).toContain('Citations:')
    expect(reply.text).toContain('OrderOperationsPanel')
  })

  it('approved answers contain the evidence assistant caveat', () => {
    const reply = buildPohGenieReply(
      'Show the confirmations currently returned for this process order.',
      snapshot,
    )

    expect(reply.kind).toBe('approved')
    expect(reply.text).toContain('No records returned from a source must not be interpreted as absence of exposure')
  })

  it('approved answers do not claim operational decisions', () => {
    const reply = buildPohGenieReply(
      'Show the goods movements currently returned for this process order.',
      snapshot,
    )

    expect(reply.kind).toBe('approved')
    expect(reply.text).not.toMatch(/you can release/i)
    expect(reply.text).not.toMatch(/batch is approved/i)
    expect(reply.text).not.toMatch(/recall is closed/i)
    expect(reply.text).not.toMatch(/exposure is zero/i)
  })
})
