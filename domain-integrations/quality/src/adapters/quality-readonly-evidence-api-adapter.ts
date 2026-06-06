import type { QualityEvidenceResponse } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { QualityReadOnlyEvidenceAdapter, type QualityReadOnlyEvidenceAdapterRequest } from './quality-readonly-evidence-adapter.js'

export class QualityReadOnlyEvidenceApiAdapter extends QualityReadOnlyEvidenceAdapter {
  private readonly baseUrl: string
  private readonly adapterSource: 'legacy-api' | 'databricks-api'

  constructor(baseUrl: string, source: 'legacy-api' | 'databricks-api') {
    super({ source })
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.adapterSource = source
  }

  override async getQualityEvidence(
    request: QualityReadOnlyEvidenceAdapterRequest
  ): Promise<AdapterResult<QualityEvidenceResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/quality/read-only-evidence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        credentials: 'include',
      })

      if (!response.ok) {
        const code =
          response.status === 401
            ? ('unauthorized' as const)
            : response.status === 404
              ? ('not-found' as const)
              : ('network' as const)
              
        return {
          ok: false,
          error: {
            code,
            message: `Backend returned ${response.status}`,
            retryable: response.status >= 500,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: this.adapterSource,
        }
      }

      const data = await response.json()
      
      return {
        ok: true,
        data,
        fetchedAt: new Date().toISOString(),
        source: this.adapterSource,
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: this.adapterSource,
      }
    }
  }
}
