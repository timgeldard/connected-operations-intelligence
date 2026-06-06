import type { SPCConsumerSearchItem } from './fixtures.js'

export interface ResolvedSPCConsumerRequest {
  readonly materialId: string
  readonly plantId?: string
  readonly characteristicId?: string
  readonly operationId?: string
  readonly batchId?: string
}

export type SPCConsumerSearchStep =
  | 'idle'
  | 'materials-for-query'
  | 'plants-for-material'
  | 'characteristics-for-plant'
  | 'resolved'
  | 'no-results'

export interface SPCConsumerMaterialOption {
  readonly materialId: string
  readonly description: string
}

export interface SPCConsumerPlantOption {
  readonly plantId: string
  readonly plantName: string
}

export interface SPCConsumerCharOption {
  readonly characteristicId: string
  readonly characteristicName: string
  readonly operationId?: string
}

export type SPCConsumerSearchResult =
  | {
      readonly step: 'idle'
    }
  | {
      readonly step: 'materials-for-query'
      readonly materials: readonly SPCConsumerMaterialOption[]
    }
  | {
      readonly step: 'plants-for-material'
      readonly materialId: string
      readonly plants: readonly SPCConsumerPlantOption[]
    }
  | {
      readonly step: 'characteristics-for-plant'
      readonly materialId: string
      readonly plantId: string
      readonly characteristics: readonly SPCConsumerCharOption[]
    }
  | {
      readonly step: 'resolved'
      readonly request: ResolvedSPCConsumerRequest
    }
  | {
      readonly step: 'no-results'
    }

export function resolveSPCConsumerSearch(
  rawQuery: string,
  searchItems: readonly SPCConsumerSearchItem[]
): SPCConsumerSearchResult {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return { step: 'idle' }

  // Check for exact batch match first
  const exactBatchMatch = searchItems.find(item => item.batchId && item.batchId.toLowerCase() === query)
  if (exactBatchMatch) {
    return {
      step: 'resolved',
      request: {
        materialId: exactBatchMatch.materialId,
        plantId: exactBatchMatch.plantId,
        characteristicId: exactBatchMatch.characteristicId,
        batchId: exactBatchMatch.batchId,
      },
    }
  }

  // Filter items matching the query in materialId, materialDescription, characteristicName, batchId
  const matches = searchItems.filter(item => {
    return (
      item.materialId.toLowerCase().includes(query) ||
      item.materialDescription.toLowerCase().includes(query) ||
      item.characteristicName.toLowerCase().includes(query) ||
      item.characteristicId.toLowerCase().includes(query) ||
      (item.batchId && item.batchId.toLowerCase().includes(query))
    )
  })

  if (matches.length === 0) {
    return { step: 'no-results' }
  }

  // Get unique materials
  const uniqueMaterialsMap = new Map<string, string>()
  matches.forEach(m => uniqueMaterialsMap.set(m.materialId, m.materialDescription))

  if (uniqueMaterialsMap.size > 1) {
    const materials: SPCConsumerMaterialOption[] = []
    uniqueMaterialsMap.forEach((description, materialId) => {
      materials.push({ materialId, description })
    })
    return {
      step: 'materials-for-query',
      materials,
    }
  }

  // Only one material matched
  const materialId = Array.from(uniqueMaterialsMap.keys())[0]

  // Get unique plants for this material
  const materialMatches = searchItems.filter(item => item.materialId === materialId)
  const uniquePlantsMap = new Map<string, string>()
  materialMatches.forEach(m => uniquePlantsMap.set(m.plantId, m.plantName))

  if (uniquePlantsMap.size > 1) {
    const plants: SPCConsumerPlantOption[] = []
    uniquePlantsMap.forEach((plantName, plantId) => {
      plants.push({ plantId, plantName })
    })
    return {
      step: 'plants-for-material',
      materialId,
      plants,
    }
  }

  // Only one plant matched
  const plantId = Array.from(uniquePlantsMap.keys())[0]

  // Get unique characteristics for this material and plant
  const plantMatches = materialMatches.filter(item => item.plantId === plantId)
  const uniqueCharsMap = new Map<string, string>()
  plantMatches.forEach(m => uniqueCharsMap.set(m.characteristicId, m.characteristicName))

  if (uniqueCharsMap.size > 1) {
    const characteristics: SPCConsumerCharOption[] = []
    uniqueCharsMap.forEach((characteristicName, characteristicId) => {
      const match = plantMatches.find(m => m.characteristicId === characteristicId)
      const opId = match ? (match as any).operationId : undefined
      characteristics.push({ characteristicId, characteristicName, operationId: opId })
    })
    return {
      step: 'characteristics-for-plant',
      materialId,
      plantId,
      characteristics,
    }
  }

  // Only one characteristic matched
  const characteristicId = Array.from(uniqueCharsMap.keys())[0]
  const matchedItem = plantMatches.find(m => m.characteristicId === characteristicId)
  const operationId = matchedItem ? (matchedItem as any).operationId : undefined

  // Look for matched batch if query resembles one
  const batchMatch = matches.find(m => m.batchId && m.batchId.toLowerCase().includes(query))

  return {
    step: 'resolved',
    request: {
      materialId,
      plantId,
      characteristicId,
      operationId,
      batchId: batchMatch?.batchId,
    },
  }
}
