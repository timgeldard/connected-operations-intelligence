export interface PlantDescriptor {
  readonly id: string
  readonly name: string
  readonly country: string
  readonly code: string
  readonly region: string
}

export const PLANTS: readonly PlantDescriptor[] = [
  { id: 'IE10', name: 'Kerry Listowel', country: 'Ireland', code: 'IE10', region: 'EMEA' },
  { id: 'IE20', name: 'Kerry Charleville', country: 'Ireland', code: 'IE20', region: 'EMEA' },
  { id: 'DE30', name: 'Kerry Schwerin', country: 'Germany', code: 'DE30', region: 'EMEA' },
  { id: 'NL40', name: 'Kerry Bodegraven', country: 'Netherlands', code: 'NL40', region: 'EMEA' },
  { id: 'US50', name: 'Kerry Beloit', country: 'United States', code: 'US50', region: 'Americas' },
  { id: 'US60', name: 'Kerry Rochester', country: 'United States', code: 'US60', region: 'Americas' },
  { id: 'BR70', name: 'Kerry Três Corações', country: 'Brazil', code: 'BR70', region: 'Americas' },
  { id: 'MY80', name: 'Kerry Johor', country: 'Malaysia', code: 'MY80', region: 'APMEA' },
]

export type TraceAppTabId =
  | 'investigation'
  | 'passport'
  | 'mass-balance'
  | 'timeline'
  | 'recall'
  | 'holds'
  | 'suppliers'

export interface TraceAppTabDescriptor {
  readonly id: TraceAppTabId
  readonly label: string
  readonly short: string
}

export const TRACE_APP_TABS: readonly TraceAppTabDescriptor[] = [
  { id: 'investigation', label: 'Investigation', short: 'Lineage' },
  { id: 'passport', label: 'Quality Passport', short: 'Passport' },
  { id: 'mass-balance', label: 'Mass Balance', short: 'Balance' },
  { id: 'timeline', label: 'Timeline', short: 'Timeline' },
  { id: 'recall', label: 'Recall & Exposure', short: 'Recall' },
  { id: 'holds', label: 'Holds & Releases', short: 'Holds' },
  { id: 'suppliers', label: 'Supplier Batches', short: 'Suppliers' },
]
