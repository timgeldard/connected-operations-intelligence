import type { ProcessOrderSearchItem, ProcessOrderSearchMatchType } from '@connectio/data-contracts'

export interface ResolvedPohConsumerRequest {
  readonly processOrderId: string
  readonly plantId: string
  readonly materialId?: string
  readonly batchId?: string
}

export interface PohConsumerPlantOption {
  readonly id: string
  readonly name: string
}

export interface PohConsumerMatchedOrder {
  readonly processOrderId: string
  readonly materialId: string
  readonly materialDescription: string
  readonly batchId?: string | null
  readonly plantId: string
  readonly plantName: string
  readonly orderStatus: string
  readonly plannedQuantity?: number | null
  readonly confirmedQuantity?: number | null
  readonly uom?: string | null
  readonly plannedStart?: string | null
  readonly plannedFinish?: string | null
  readonly matchTypes: readonly ProcessOrderSearchMatchType[]
}

export interface PohConsumerMaterialOption {
  readonly materialId: string
  readonly description: string
  readonly orderCount: number
  readonly matchTypes: readonly ProcessOrderSearchMatchType[]
}

export type PohConsumerSearchStep =
  | 'idle'
  | 'materials-for-query'
  | 'orders-for-material'
  | 'select-plant'
  | 'no-results'
  | 'resolved'

export type PohConsumerSearchResult =
  | {
      readonly step: 'materials-for-query'
      readonly materials: readonly PohConsumerMaterialOption[]
      readonly orders: readonly PohConsumerMatchedOrder[]
    }
  | {
      readonly step: 'orders-for-material'
      readonly orders: PohConsumerMatchedOrder[]
      readonly selectedMaterial: { readonly id: string; readonly description: string } | null
    }
  | {
      readonly step: 'select-plant'
      readonly processOrderId: string
      readonly materialId?: string
      readonly batchId?: string
      readonly plants: readonly PohConsumerPlantOption[]
    }
  | {
      readonly step: 'resolved'
      readonly request: ResolvedPohConsumerRequest
    }
  | {
      readonly step: 'no-results'
    }

export function parsePohConsumerCombinedSearch(query: string): { processOrderId: string } | null {
  const q = query.trim()
  if (!q) return null
  // Simple order ID matching (e.g. starts with PO- or is numeric and 10 digits)
  if (/^PO-\d+-\d+$/i.test(q) || /^\d{10}$/.test(q)) {
    return { processOrderId: q }
  }
  return null
}

export function resolvePohConsumerSearch(
  query: string,
  items: readonly ProcessOrderSearchItem[],
): PohConsumerSearchResult {
  if (items.length === 0) {
    return { step: 'no-results' }
  }

  // If query is an exact match for a single processOrderId across exactly one plant, resolve immediately
  const exactOrderMatches = items.filter(
    (item) => item.processOrderId.toLowerCase() === query.trim().toLowerCase(),
  )
  if (exactOrderMatches.length === 1) {
    return {
      step: 'resolved',
      request: {
        processOrderId: exactOrderMatches[0].processOrderId,
        plantId: exactOrderMatches[0].plantId,
        materialId: exactOrderMatches[0].materialId,
        batchId: exactOrderMatches[0].batchId ?? undefined,
      },
    }
  }

  // If same order ID is found across multiple plants, show plant selector
  if (exactOrderMatches.length > 1) {
    const plants = exactOrderMatches.map((item) => ({
      id: item.plantId,
      name: item.plantName,
    }))
    return {
      step: 'select-plant',
      processOrderId: exactOrderMatches[0].processOrderId,
      materialId: exactOrderMatches[0].materialId,
      batchId: exactOrderMatches[0].batchId ?? undefined,
      plants,
    }
  }

  // Group items by material to see if description search matched multiple materials
  const materialMap = new Map<string, { description: string; count: number; matchTypes: Set<ProcessOrderSearchMatchType> }>()
  const mappedOrders: PohConsumerMatchedOrder[] = items.map((item) => ({
    processOrderId: item.processOrderId,
    materialId: item.materialId,
    materialDescription: item.materialDescription,
    batchId: item.batchId,
    plantId: item.plantId,
    plantName: item.plantName,
    orderStatus: item.orderStatus,
    plannedQuantity: item.plannedQuantity,
    confirmedQuantity: item.confirmedQuantity,
    uom: item.uom,
    plannedStart: item.plannedStart,
    plannedFinish: item.plannedFinish,
    matchTypes: item.matchTypes,
  }))

  for (const item of items) {
    const existing = materialMap.get(item.materialId)
    const matchSet = new Set<ProcessOrderSearchMatchType>(item.matchTypes)
    if (existing) {
      existing.count += 1
      item.matchTypes.forEach((m) => existing.matchTypes.add(m))
    } else {
      materialMap.set(item.materialId, {
        description: item.materialDescription,
        count: 1,
        matchTypes: matchSet,
      })
    }
  }

  // If multiple materials are matched, let the user select a material first
  if (materialMap.size > 1) {
    const materials: PohConsumerMaterialOption[] = []
    materialMap.forEach((val, key) => {
      materials.push({
        materialId: key,
        description: val.description,
        orderCount: val.count,
        matchTypes: Array.from(val.matchTypes),
      })
    })
    return {
      step: 'materials-for-query',
      materials,
      orders: mappedOrders,
    }
  }

  // If all matched items belong to the same material, list the process orders for that material
  if (materialMap.size === 1) {
    const [materialId] = Array.from(materialMap.keys())
    const matDetails = materialMap.get(materialId)!
    return {
      step: 'orders-for-material',
      orders: mappedOrders.filter((o) => o.materialId === materialId),
      selectedMaterial: { id: materialId, description: matDetails.description },
    }
  }

  return { step: 'no-results' }
}

export function resolvePohConsumerSelection(
  processOrderId: string,
  orders: readonly PohConsumerMatchedOrder[],
): PohConsumerSearchResult {
  const matches = orders.filter((o) => o.processOrderId === processOrderId)
  if (matches.length === 1) {
    return {
      step: 'resolved',
      request: {
        processOrderId: matches[0].processOrderId,
        plantId: matches[0].plantId,
        materialId: matches[0].materialId,
        batchId: matches[0].batchId ?? undefined,
      },
    }
  }

  if (matches.length > 1) {
    return {
      step: 'select-plant',
      processOrderId,
      materialId: matches[0].materialId,
      batchId: matches[0].batchId ?? undefined,
      plants: matches.map((m) => ({ id: m.plantId, name: m.plantName })),
    }
  }

  return { step: 'no-results' }
}
