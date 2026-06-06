/** Custom error class for API response errors. */
export class ApiError extends Error {
  readonly status: number
  readonly detail: unknown

  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : `Error ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}))
  }
  return response.text().catch(() => response.statusText)
}

function errorDetail(body: unknown, status: number): unknown {
  if (body && typeof body === 'object' && 'detail' in body) {
    return (body as { detail?: unknown }).detail ?? `Error ${status}`
  }
  return body ?? `Error ${status}`
}

/**
 * Standardized fetch wrapper for JSON responses.
 * Handles 204 No Content, parse errors, and maps non-OK responses to ApiError.
 */
export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has('x-request-id')) {
    headers.set('x-request-id', crypto.randomUUID())
  }
  const response = await fetch(input, { ...init, headers })
  if (response.status === 204) {
    return undefined as T
  }
  const body = await readResponseBody(response)
  if (!response.ok) {
    throw new ApiError(response.status, errorDetail(body, response.status))
  }
  return body as T
}

/** Configuration options for the API client. */
export interface ApiClientOptions {
  baseUrl?: string
  credentials?: RequestCredentials
  headers?: HeadersInit
}

/** Options for an individual API request. */
export interface ApiRequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | null | undefined>
}

function joinUrl(baseUrl: string, path: string, query?: ApiRequestOptions['query']): string {
  const normalizedBase = baseUrl.replace(/\/$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${normalizedBase}${normalizedPath}`
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }
  const queryString = params.toString()
  return queryString ? `${url}?${queryString}` : url
}

function mergeHeaders(defaultHeaders?: HeadersInit, requestHeaders?: HeadersInit): Headers {
  const headers = new Headers(defaultHeaders)
  const request = new Headers(requestHeaders)
  request.forEach((value, key) => headers.set(key, value))
  return headers
}

/**
 * Creates a typed JSON API client for ConnectIO-RAD V2.
 * Propagates correlation IDs, cookie passthrough, and standard error handling.
 */
export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? ''
  const credentials = options.credentials ?? 'include'

  return {
    get<T>(path: string, request?: ApiRequestOptions): Promise<T> {
      return fetchJson<T>(joinUrl(baseUrl, path, request?.query), {
        ...request,
        method: 'GET',
        credentials: request?.credentials ?? credentials,
        headers: mergeHeaders(options.headers, request?.headers),
      })
    },
    post<T>(path: string, body: unknown, request?: ApiRequestOptions): Promise<T> {
      const headers = mergeHeaders(options.headers, request?.headers)
      headers.set('Content-Type', 'application/json')
      return fetchJson<T>(joinUrl(baseUrl, path, request?.query), {
        ...request,
        method: 'POST',
        credentials: request?.credentials ?? credentials,
        headers,
        body: JSON.stringify(body),
      })
    },
    patch<T>(path: string, body: unknown, request?: ApiRequestOptions): Promise<T> {
      const headers = mergeHeaders(options.headers, request?.headers)
      headers.set('Content-Type', 'application/json')
      return fetchJson<T>(joinUrl(baseUrl, path, request?.query), {
        ...request,
        method: 'PATCH',
        credentials: request?.credentials ?? credentials,
        headers,
        body: JSON.stringify(body),
      })
    },
    delete<T>(path: string, request?: ApiRequestOptions): Promise<T> {
      return fetchJson<T>(joinUrl(baseUrl, path, request?.query), {
        ...request,
        method: 'DELETE',
        credentials: request?.credentials ?? credentials,
        headers: mergeHeaders(options.headers, request?.headers),
      })
    },
  }
}
