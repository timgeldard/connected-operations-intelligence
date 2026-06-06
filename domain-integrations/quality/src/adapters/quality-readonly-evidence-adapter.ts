import type {
  QualityEvidenceRequest,
  QualityEvidenceResponse,
} from '@connectio/data-contracts'
import type { AdapterResult, AdapterSource } from '@connectio/source-adapters'

export type QualityReadOnlyEvidenceAdapterRequest = QualityEvidenceRequest

export type QualityEvidenceNowFn = () => string

const defaultNow: QualityEvidenceNowFn = () => new Date().toISOString()

export interface QualityReadOnlyEvidenceAdapterOptions {
  readonly now?: QualityEvidenceNowFn
  readonly source?: Exclude<AdapterSource, 'mixed'>
}

/**
 * Read-only Quality evidence adapter skeleton.
 *
 * This intentionally does not fetch Databricks or return mock evidence. Until
 * the source verification pack is run, databricks-api mode returns a valid
 * unavailable response so callers can build UI states without implying live
 * inspection lot, MIC, usage-decision, CoA, deviation, or release evidence.
 */
export class QualityReadOnlyEvidenceAdapter {
  private readonly now: QualityEvidenceNowFn
  private readonly source: Exclude<AdapterSource, 'mixed'>

  constructor(options: QualityReadOnlyEvidenceAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
    this.source = options.source ?? 'databricks-api'
  }

  async getQualityEvidence(
    request: QualityReadOnlyEvidenceAdapterRequest
  ): Promise<AdapterResult<QualityEvidenceResponse>> {
    const queriedAt = this.now()

    return {
      ok: true,
      fetchedAt: queriedAt,
      source: this.source,
      data: {
        request,
        summary: {
          source: this.source,
          status: 'pending-source-verification',
          inspectionLotCount: 0,
          micResultCount: 0,
          usageDecisionStatus: 'source-unverified',
          coaResultCount: 0,
          unavailableEvidence: [
            'inspection-lots',
            'mic-results',
            'usage-decision',
            'coa-results',
            'deviations',
          ],
          warnings: [
            'Read-only Quality evidence is pending Databricks source verification.',
            'Missing usage-decision evidence must not be interpreted as accepted or released.',
            'No-record sections must not be interpreted as proof of absence until source coverage is validated.',
            'CoA-like result evidence is not official CoA document approval.',
          ],
          queriedAt,
          sourceFreshnessStatus: 'not-verified',
        },
        inspectionLots: [],
        micResults: [],
        usageDecision: null,
        coaResults: [],
      },
    }
  }
}
// Removed singleton export, see factory
