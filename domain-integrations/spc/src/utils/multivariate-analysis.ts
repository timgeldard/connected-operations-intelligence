import type { ControlChartSeries } from '@connectio/data-contracts'

export interface CorrelationCell {
  charIdA: string
  charNameA: string
  charIdB: string
  charNameB: string
  r: number | null
}

export interface AlignedBatchPoint {
  batchId: string
  values: { [charId: string]: number }
  timestamp?: string
}

export interface ContributorContribution {
  characteristicId: string
  characteristicName: string
  value: number
  mean: number
  contribution: number
  contributionPercent: number
}

export interface MultivariateT2Point {
  batchId: string
  timestamp: string
  t2: number
  ucl: number
  cl: number
  isOutlier: boolean
  contributors: ContributorContribution[]
}

/**
 * Align multiple control chart series by batchId.
 * For each batchId, calculates the average value for each characteristic.
 */
export function alignSeriesByBatch(
  allSeries: ControlChartSeries[]
): AlignedBatchPoint[] {
  const batchMap = new Map<string, { timestamp: string; values: { [charId: string]: number[] } }>()

  for (const series of allSeries) {
    const charId = series.characteristicId
    for (const pt of series.points) {
      if (!pt.batchId) continue
      const batchId = pt.batchId
      if (!batchMap.has(batchId)) {
        batchMap.set(batchId, {
          timestamp: pt.timestamp || new Date().toISOString(),
          values: {}
        })
      }
      const entry = batchMap.get(batchId)!
      if (!entry.values[charId]) {
        entry.values[charId] = []
      }
      if (pt.value !== null && pt.value !== undefined) {
        entry.values[charId].push(pt.value)
      }
      if (pt.timestamp && (!entry.timestamp || pt.timestamp > entry.timestamp)) {
        entry.timestamp = pt.timestamp
      }
    }
  }

  const alignedPoints: AlignedBatchPoint[] = []
  for (const [batchId, entry] of batchMap.entries()) {
    const values: { [charId: string]: number } = {}
    for (const [charId, list] of Object.entries(entry.values)) {
      if (list.length > 0) {
        const sum = list.reduce((a, b) => a + b, 0)
        values[charId] = sum / list.length
      }
    }
    alignedPoints.push({
      batchId,
      timestamp: entry.timestamp,
      values
    })
  }

  // Sort aligned points by timestamp
  return alignedPoints.sort((a, b) => {
    const tA = a.timestamp || ''
    const tB = b.timestamp || ''
    return tA.localeCompare(tB)
  })
}

/**
 * Calculates Pearson correlation coefficient r between two lists of numbers.
 */
export function calculatePearsonCorrelation(x: number[], y: number[]): number | null {
  const n = x.length
  if (n < 2 || n !== y.length) return null

  const meanX = x.reduce((a, b) => a + b, 0) / n
  const meanY = y.reduce((a, b) => a + b, 0) / n

  let num = 0
  let denX = 0
  let denY = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }

  if (denX === 0 || denY === 0) return null
  return num / Math.sqrt(denX * denY)
}

/**
 * Computes all pairwise Pearson correlations between the characteristics.
 */
export function computeCorrelationMatrix(
  allSeries: ControlChartSeries[],
  alignedPoints: AlignedBatchPoint[]
): CorrelationCell[] {
  const cells: CorrelationCell[] = []
  const n = allSeries.length

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const sA = allSeries[i]
      const sB = allSeries[j]

      // Extract paired values aligned by batchId
      const x: number[] = []
      const y: number[] = []

      for (const pt of alignedPoints) {
        const valA = pt.values[sA.characteristicId]
        const valB = pt.values[sB.characteristicId]
        if (valA !== undefined && valB !== undefined) {
          x.push(valA)
          y.push(valB)
        }
      }

      const r = calculatePearsonCorrelation(x, y)
      cells.push({
        charIdA: sA.characteristicId,
        charNameA: sA.characteristicName,
        charIdB: sB.characteristicId,
        charNameB: sB.characteristicName,
        r
      })
    }
  }

  return cells
}

/**
 * Invert a square matrix using Gauss-Jordan elimination with diagonal regularization.
 */
export function invertMatrix(matrix: number[][]): number[][] | null {
  const n = matrix.length
  // Regularize diagonal slightly to avoid singularity
  const reg = 1e-6
  const A = matrix.map((row, i) => row.map((val, j) => val + (i === j ? reg : 0)))

  // Initialize identity matrix
  const I: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  )

  for (let i = 0; i < n; i++) {
    // Find pivot
    let pivotRow = i
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(A[r][i]) > Math.abs(A[pivotRow][i])) {
        pivotRow = r
      }
    }

    if (Math.abs(A[pivotRow][i]) < 1e-12) {
      return null // Singular matrix
    }

    // Swap rows
    if (pivotRow !== i) {
      const tempA = A[i]
      A[i] = A[pivotRow]
      A[pivotRow] = tempA

      const tempI = I[i]
      I[i] = I[pivotRow]
      I[pivotRow] = tempI
    }

    // Scale row i
    const pivotVal = A[i][i]
    for (let j = 0; j < n; j++) {
      A[i][j] /= pivotVal
      I[i][j] /= pivotVal
    }

    // Subtract from other rows
    for (let r = 0; r < n; r++) {
      if (r === i) continue
      const factor = A[r][i]
      for (let j = 0; j < n; j++) {
        A[r][j] -= factor * A[i][j]
        I[r][j] -= factor * I[i][j]
      }
    }
  }

  return I
}

/**
 * Compute Hotelling's T^2 statistic and contributor breakdown for aligned batch points.
 */
export function computeMultivariateT2(
  allSeries: ControlChartSeries[],
  alignedPoints: AlignedBatchPoint[]
): MultivariateT2Point[] {
  const charIds = allSeries.map(s => s.characteristicId)
  const charNames = allSeries.map(s => s.characteristicName)
  const M = charIds.length

  // Filter aligned points to only include those that have all characteristics present
  const completePoints = alignedPoints.filter(pt =>
    charIds.every(id => pt.values[id] !== undefined)
  )

  if (completePoints.length < 5 || M < 2) {
    return []
  }

  // Calculate Mean Vector (M)
  const means: { [charId: string]: number } = {}
  for (const id of charIds) {
    const sum = completePoints.reduce((acc, pt) => acc + pt.values[id], 0)
    means[id] = sum / completePoints.length
  }

  // Calculate Covariance Matrix (M x M)
  const covMatrix: number[][] = Array.from({ length: M }, () => Array(M).fill(0))
  for (let j = 0; j < M; j++) {
    for (let k = 0; k < M; k++) {
      const idJ = charIds[j]
      const idK = charIds[k]
      let sum = 0
      for (const pt of completePoints) {
        sum += (pt.values[idJ] - means[idJ]) * (pt.values[idK] - means[idK])
      }
      covMatrix[j][k] = sum / (completePoints.length - 1)
    }
  }

  // Invert Covariance Matrix
  const invCov = invertMatrix(covMatrix)
  if (!invCov) {
    return []
  }

  // Calculate T2 for each complete point
  const resultPoints: MultivariateT2Point[] = []

  // Control limit estimation for Hotelling T^2:
  // Using F-distribution approximation or standard chi-square:
  // Typically UCL = (M * (N - 1) * (N + 1)) / (N * (N - M)) * F_alpha(M, N - M)
  // For simplicity and robust default limit, we can use a chi-square alpha=0.01 limit.
  // With 5 variables, Chi-Square critical value at p=0.01 is 15.086, p=0.001 is 20.515.
  // We can calculate UCL using a default standard threshold of 15.0 (for 99% confidence level).
  const uclValue = M === 5 ? 15.086 : M === 4 ? 13.277 : M === 3 ? 11.345 : 9.21
  const clValue = M // Expectation of T^2 is M (number of variables)

  for (const pt of completePoints) {
    // Mean-centered vector dx
    const dx: number[] = []
    for (let j = 0; j < M; j++) {
      dx.push(pt.values[charIds[j]] - means[charIds[j]])
    }

    // Compute invCov * dx
    const invCovDx: number[] = Array(M).fill(0)
    for (let r = 0; r < M; r++) {
      let sum = 0
      for (let c = 0; c < M; c++) {
        sum += invCov[r][c] * dx[c]
      }
      invCovDx[r] = sum
    }

    // Compute T^2 = dx^T * invCov * dx
    let t2 = 0
    for (let j = 0; j < M; j++) {
      t2 += dx[j] * invCovDx[j]
    }

    // Contributor Breakdown (linear contribution decomposition: c_j = dx_j * (invCov * dx)_j)
    const rawContributions = dx.map((val, j) => val * invCovDx[j])
    const totalRawContrib = rawContributions.reduce((a, b) => a + Math.max(0, b), 0) || 1

    const contributors: ContributorContribution[] = charIds.map((id, j) => {
      const rawC = rawContributions[j]
      const contributionPercent = totalRawContrib > 0 ? (Math.max(0, rawC) / totalRawContrib) * 100 : 0
      return {
        characteristicId: id,
        characteristicName: charNames[j],
        value: pt.values[id],
        mean: means[id],
        contribution: rawC,
        contributionPercent: parseFloat(contributionPercent.toFixed(1))
      }
    }).sort((a, b) => b.contribution - a.contribution) // Rank highest contributors first

    resultPoints.push({
      batchId: pt.batchId,
      timestamp: pt.timestamp || new Date().toISOString(),
      t2: parseFloat(t2.toFixed(3)),
      ucl: uclValue,
      cl: clValue,
      isOutlier: t2 > uclValue,
      contributors
    })
  }

  return resultPoints
}
