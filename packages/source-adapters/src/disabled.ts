import type { AdapterResult, AdapterSource } from './types.js'

/**
 * Creates a JS Proxy that intercepts all method calls on the target adapter
 * and returns a standard disabled error result.
 */
export function createDisabledAdapter<T extends object>(mode: AdapterSource, message: string): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      if (typeof prop === 'string') {
        return async (..._args: unknown[]): Promise<AdapterResult<unknown>> => {
          return {
            ok: false,
            error: {
              code: 'unauthorized',
              message,
              retryable: false,
            },
            displayState: 'error',
            source: mode,
          }
        }
      }
      return undefined
    },
  })
}
