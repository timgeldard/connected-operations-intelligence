/**
 * Caveats shown on the Lineside Monitor standalone board.
 *
 * FRESHNESS NOTE (ADR-017 pilot dependency):
 * The live operational value of the Lineside Monitor depends on the ADR-017 pilot cadence
 * decision (15-min triggered silver+gold, ideally a faster sub-cadence for the fast-silver
 * tables that carry operation confirmations and TR-TO movements).  Until that cadence is
 * enabled the gold data refreshes at the standard daily cadence.  The UI displays a STALE
 * banner when the data age exceeds 2× the configured refresh interval.
 */
export const LINESIDE_STANDALONE_CAVEATS: readonly string[] = [
  'Order and operation data are sourced from the io-reporting gold layer (SAP ECC → Silver → Gold pipeline).',
  'Elapsed time and projected finish are computed at query time — they update on every data refresh, not continuously.',
  'CADENCE NOTE: the operational value of this board depends on the ADR-017 pilot cadence decision (15-min triggered gold). Until that cadence is live, data refreshes daily.',
  'Do not use this board as the sole basis for safety-critical line-stop or release decisions.',
]
