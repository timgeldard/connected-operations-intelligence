/** Caveats that keep the standalone Lab Board truthful while it is adapter-backed. */
export const LAB_BOARD_STANDALONE_CAVEATS: readonly string[] = [
  'Plant and failure data are read through the Connected Quality lab adapter; source mode remains visible in the footer.',
  'If the adapter mode is mock, records are not live SAP QM evidence even though the screen is data-wired.',
  'Do not treat this wallboard as production release, reject, or hold decision evidence.',
]
