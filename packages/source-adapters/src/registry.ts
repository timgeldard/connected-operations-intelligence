import type { SourceAdapter } from './types.js'

/** Global registry mapping panelId → adapter instance. */
export class SourceAdapterRegistry {
  private readonly adapters = new Map<string, SourceAdapter<unknown, unknown>>()

  register<TRequest, TResult>(
    panelId: string,
    adapter: SourceAdapter<TRequest, TResult>,
  ): void {
    this.adapters.set(panelId, adapter as SourceAdapter<unknown, unknown>)
  }

  get<TRequest, TResult>(panelId: string): SourceAdapter<TRequest, TResult> | undefined {
    return this.adapters.get(panelId) as SourceAdapter<TRequest, TResult> | undefined
  }

  has(panelId: string): boolean {
    return this.adapters.has(panelId)
  }
}

/** Singleton registry instance. */
export const adapterRegistry = new SourceAdapterRegistry()
