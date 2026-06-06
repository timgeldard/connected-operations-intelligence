import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { ApiErrorEnvelopeSchema, PagedResultSchema } from './api.js'

describe('ApiErrorEnvelopeSchema', () => {
  it('parses a string detail', () => {
    const result = ApiErrorEnvelopeSchema.safeParse({ detail: 'Not found' })
    expect(result.success).toBe(true)
  })

  it('parses a detail with optional status_code and error_id', () => {
    const result = ApiErrorEnvelopeSchema.safeParse({
      detail: 'Forbidden',
      status_code: 403,
      error_id: 'err-abc',
    })
    expect(result.success).toBe(true)
  })

  it('parses an array detail (FastAPI validation errors)', () => {
    const result = ApiErrorEnvelopeSchema.safeParse({
      detail: [{ loc: ['body', 'name'], msg: 'field required', type: 'missing' }],
    })
    expect(result.success).toBe(true)
  })

  it('parses a record detail', () => {
    const result = ApiErrorEnvelopeSchema.safeParse({ detail: { reason: 'invalid input' } })
    expect(result.success).toBe(true)
  })

  it('fails when detail is missing', () => {
    const result = ApiErrorEnvelopeSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('fails when detail is a number', () => {
    const result = ApiErrorEnvelopeSchema.safeParse({ detail: 42 })
    expect(result.success).toBe(false)
  })
})

describe('PagedResultSchema', () => {
  const StringPagedResult = PagedResultSchema(z.string())

  it('parses a valid paged result', () => {
    const result = StringPagedResult.safeParse({
      items: ['a', 'b', 'c'],
      total: 3,
      page: 1,
      pageSize: 10,
      hasNextPage: false,
    })
    expect(result.success).toBe(true)
  })

  it('parses an empty items array', () => {
    const result = StringPagedResult.safeParse({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
      hasNextPage: false,
    })
    expect(result.success).toBe(true)
  })

  it('fails when items is missing', () => {
    const result = StringPagedResult.safeParse({
      total: 0,
      page: 1,
      pageSize: 10,
      hasNextPage: false,
    })
    expect(result.success).toBe(false)
  })

  it('fails when total is missing', () => {
    const result = StringPagedResult.safeParse({
      items: [],
      page: 1,
      pageSize: 10,
      hasNextPage: false,
    })
    expect(result.success).toBe(false)
  })

  it('fails when items contain the wrong type', () => {
    const result = StringPagedResult.safeParse({
      items: [1, 2, 3],
      total: 3,
      page: 1,
      pageSize: 10,
      hasNextPage: false,
    })
    expect(result.success).toBe(false)
  })
})
