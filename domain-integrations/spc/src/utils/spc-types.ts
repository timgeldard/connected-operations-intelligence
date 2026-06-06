export type RuleSet = 'weco' | 'nelson'
export type QuantChartType = 'imr' | 'xbar_r' | 'xbar_s' | 'ewma' | 'cusum'
export type StratifyByKey = 'plant_id' | 'inspection_lot_id' | 'operation_id'
export type SpecType =
  | 'bilateral_symmetric'
  | 'bilateral_asymmetric'
  | 'unilateral_upper'
  | 'unilateral_lower'
  | 'unspecified'
  | (string & {})

export interface SpecConfig {
  nominal?: number | null
  tolerance?: number | null
  usl?: number | null
  lsl?: number | null
  spec_type?: SpecType | null
  hasMixedSpec?: boolean
  specWarning?: string | null
}

export interface ControlLimits {
  cl?: number | null
  ucl?: number | null
  lcl?: number | null
  ucl_r?: number | null
  lcl_r?: number | null
  sigma_within?: number | null
}

export interface GovernedControlLimits extends ControlLimits {
  cpk?: number | null
  ppk?: number | null
}

export interface CapabilityMetrics {
  cp?: number | null
  cpk?: number | null
  pp?: number | null
  ppk?: number | null
  capabilityMethod?: 'parametric' | 'non_parametric'
  empiricalP00135?: number | null
  empiricalP50?: number | null
  empiricalP99865?: number | null
  zScore?: number | null
  dpmo?: number | null
  spec_type?: SpecType | null
  normality?: NormalityResult | null
  normalityWarning?: string | null
  specWarning?: string | null
  cpkLower95?: number | null
  cpkUpper95?: number | null
  cpLower95?: number | null
  cpUpper95?: number | null
  ppLower95?: number | null
  ppUpper95?: number | null
  ppkLower95?: number | null
  ppkUpper95?: number | null
  dpmo_convention?: string | null
  hasMixedSpec?: boolean
  isStable?: boolean
  instabilityReason?: string | null
}

export interface CapabilityResult extends ControlLimits, CapabilityMetrics {
  usl?: number | null
  lsl?: number | null
  sigmaOverall?: number | null
  xBar?: number | null
}

export interface AutoCleanPhaseIIterationLog {
  iteration: number
  removedCount: number
  removedOriginalIndices: number[]
  ucl?: number | null
  cl?: number | null
  lcl?: number | null
}

export interface AutoCleanPhaseIResult {
  stable: boolean
  cleanedIndices: Set<number>
  iterationLog: AutoCleanPhaseIIterationLog[]
}

export interface RollingCapabilityPoint {
  windowEnd: number
  batchSeq: number
  batchDate?: string | null
  n: number
  cpk?: number | null
  cp?: number | null
  zScore?: number | null
}

export interface NormalityResult {
  method: string
  p_value: number | null
  alpha: number
  is_normal: boolean | null
  warning: string | null
}

export interface AutocorrelationResult {
  rho: number
  n: number
  suspected: boolean
  threshold: number
  basis: 'values' | 'subgroup_means'
}

export interface SPCSignal {
  rule: number
  indices: number[]
  description?: string
  chart?: string
}

export interface ChartDataPoint {
  batch_id?: string | null
  batch_date?: string | null
  batch_seq: number
  sample_seq: number
  value: number
  nominal?: number | null
  tolerance?: number | null
  lsl?: number | null
  usl?: number | null
  valuation?: string | null
  plant_id?: string | null
  stratify_value?: string | null
  is_outlier?: boolean
  spec_type?: string | null
  originalIndex?: number
  excluded?: boolean
}

export interface IndexedChartPoint extends ChartDataPoint {
  originalIndex: number
  excluded: boolean
}

export interface IMRResult {
  xBar: number
  mrBar: number
  sigmaWithin: number
  sigmaMR?: number | null
  sigmaMSSD?: number | null
  sigmaMethod?: 'mr' | 'mssd'
  ucl_x: number
  lcl_x: number
  ucl_mr: number
  lcl_mr: number
  sigma1: number
  sigma2: number
  movingRanges: number[]
}

export interface XbarSubgroupStat {
  batchSeq: number
  batchId?: string | null
  batchDate?: string | null
  n: number
  xbar: number
  range: number
  stddev?: number | null
  ucl_x?: number | null
  lcl_x?: number | null
  ucl_r?: number | null
  lcl_r?: number | null
  ucl_s?: number | null
  lcl_s?: number | null
  sigmaWithin?: number | null
}

export interface XbarSubgroup {
  batchSeq: number
  batchId?: string | null
  batchDate?: string | null
  values: number[]
}

export interface XbarRResult {
  grandMean: number
  rBar: number
  sigmaWithin: number
  pooledSigmaWithin?: number | null
  sigmaFromRanges?: number | null
  sigma1: number
  sigma2: number
  ucl_x: number
  lcl_x: number
  ucl_r: number
  lcl_r: number
  mixedSubgroupSizes?: boolean
  averageSubgroupSize?: number | null
  limitStrategy?: string
  referenceSubgroupSize?: number | null
  subgroupStats: XbarSubgroupStat[]
}

export interface XbarSResult {
  grandMean: number
  sBar: number
  sigmaWithin: number
  pooledSigmaWithin?: number | null
  sigmaFromStddevs?: number | null
  sigma1: number
  sigma2: number
  ucl_x: number
  lcl_x: number
  ucl_s: number
  lcl_s: number
  mixedSubgroupSizes?: boolean
  averageSubgroupSize?: number | null
  limitStrategy?: string
  referenceSubgroupSize?: number | null
  subgroupStats: XbarSubgroupStat[]
}

export interface EWMAChartPoint {
  index: number
  batchSeq?: number | null
  batchId?: string | null
  batchDate?: string | null
  value: number
  ewma: number
  ucl: number
  lcl: number
}

export interface EWMAResult {
  lambda: number
  L: number
  target: number
  sigmaWithin: number
  points: EWMAChartPoint[]
}

export interface CUSUMChartPoint {
  index: number
  batchSeq?: number | null
  batchId?: string | null
  batchDate?: string | null
  value: number
  cPlus: number
  cMinus: number
}

export interface CUSUMResult {
  k: number
  h: number
  target: number
  sigmaWithin: number
  decisionInterval: number
  referenceValue: number
  points: CUSUMChartPoint[]
}

export interface HistogramBin {
  x0: number
  x1: number
  midpoint: number
  count: number
}

export interface HistogramResult {
  bins: HistogramBin[]
  binWidth: number
}

export interface NormalCurvePoint {
  x: number
  y: number
}

export interface SPCComputationResult {
  chartType: QuantChartType
  ruleSet?: RuleSet
  values?: number[]
  nominal?: number | null
  tolerance?: number | null
  specConfig?: SpecConfig
  capability?: CapabilityResult | null
  indexedPoints?: IndexedChartPoint[]
  filteredPointCount?: number
  excludedPointCount?: number
  signals?: SPCSignal[]
  mrSignals?: SPCSignal[]
  sorted?: ChartDataPoint[]
  imr?: IMRResult | null
  xbarR?: XbarRResult | null
  xbarS?: XbarSResult | null
  ewma?: EWMAResult | null
  cusum?: CUSUMResult | null
  subgroups?: XbarSubgroup[] | null
  normality?: NormalityResult | null
  autocorrelation?: AutocorrelationResult | null
  [key: string]: unknown
}

export interface LockedLimits extends ControlLimits {
  locked_at?: string | null
  locked_by?: string | null
  unified_mic_key?: string | null
  mic_origin?: string | null
  spec_signature?: string | null
  locking_note?: string | null
  stale_spec?: boolean
  live_spec_signature?: string | null
}
