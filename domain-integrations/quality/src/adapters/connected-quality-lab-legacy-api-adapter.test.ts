import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ConnectedQualityLabLegacyApiAdapter } from './connected-quality-lab-legacy-api-adapter.js'

describe('ConnectedQualityLabLegacyApiAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses relative same-origin URL when baseUrl is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ fails: [], data_available: true }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    await adapter.getLabFailures({ plantId: 'IE10' })
    expect(fetchMock).toHaveBeenCalledOnce()
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toMatch(/^\/api\/cq\/lab\/fails/)
  })

  it('prepends baseUrl when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ fails: [], data_available: true }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new ConnectedQualityLabLegacyApiAdapter('https://example.com')
    await adapter.getLabFailures({ plantId: 'IE10' })
    expect(fetchMock).toHaveBeenCalledOnce()
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toMatch(/^https:\/\/example\.com\/api\/cq\/lab\/fails/)
  })

  it('handles error responses status >= 400', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Internal Server Error', { status: 500 })),
    )
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabFailures({ plantId: 'IE10' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.source).toBe('legacy-api')
      expect(result.error.message).toContain('Proxy returned 500')
    }
  })

  it('handles 401 unauthorized status error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Unauthorized access' }), { status: 401 })),
    )
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabFailures({ plantId: 'IE10' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.source).toBe('legacy-api')
      expect(result.error.code).toBe('unauthorized')
      expect(result.error.message).toContain('Proxy returned 401')
    }
  })

  it('handles 404 not found status error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Not Found' }), { status: 404 })),
    )
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabFailures({ plantId: 'IE10' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.source).toBe('legacy-api')
      expect(result.error.code).toBe('not-found')
      expect(result.error.message).toContain('Proxy returned 404')
    }
  })

  it('returns ok: true with empty data when legacy fails array is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ data_available: true }), { status: 200 })),
    )
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabFailures({ plantId: 'IE10' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.fails).toEqual([])
    }
  })

  it('returns source legacy-api on successful getLabFailures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ fails: [], data_available: true }), { status: 200 })),
    )
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabFailures({ plantId: 'IE10' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.source).toBe('legacy-api')
  })

  it('returns error result on network error for getLabPlants', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')))
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabPlants()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.source).toBe('legacy-api')
      expect(result.error.code).toBe('unknown')
      expect(result.error.message).toContain('network failure')
      expect(result.error.retryable).toBe(true)
    }
  })

  it('returns error result on HTTP 500 for getLabPlants', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Internal Server Error', { status: 500 })),
    )
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabPlants()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.source).toBe('legacy-api')
      expect(result.error.code).toBe('network')
      expect(result.error.message).toContain('Proxy returned 500')
      expect(result.error.retryable).toBe(true)
    }
  })

  it('returns error result on HTTP 401 for getLabPlants', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 })),
    )
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabPlants()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.source).toBe('legacy-api')
      expect(result.error.code).toBe('unauthorized')
      expect(result.error.message).toContain('Proxy returned 401')
    }
  })

  it('returns error result on network error for getLabFailures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')))
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabFailures({ plantId: 'IE10' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.source).toBe('legacy-api')
      expect(result.error.retryable).toBe(true)
    }
  })

  it('falls back to mock implementation when required context is missing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new ConnectedQualityLabLegacyApiAdapter('')
    const result = await adapter.getLabFailures({})
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
    expect(result.source).toBe('mock')
  })

  it('strips trailing slash from baseUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ fails: [], data_available: true }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const adapter = new ConnectedQualityLabLegacyApiAdapter('https://example.com/')
    await adapter.getLabFailures({ plantId: 'IE10' })
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).not.toContain('//api')
  })
})

describe('prepare-databricks-app.mjs CQ env var', () => {
  it('documents VITE_CQ_API_BASE_URL in the prepare script', () => {
    let scriptPath = join(process.cwd(), 'scripts/prepare-databricks-app.mjs')
    if (!existsSync(scriptPath)) {
      scriptPath = join(process.cwd(), '../../scripts/prepare-databricks-app.mjs')
    }
    const content = readFileSync(scriptPath, 'utf-8')
    expect(content).toContain('VITE_CQ_API_BASE_URL')
  })
})
