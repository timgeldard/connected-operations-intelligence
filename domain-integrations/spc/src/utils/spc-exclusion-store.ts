import { useState, useEffect } from 'react'

type ExclusionListener = () => void
const listeners = new Set<ExclusionListener>()

// Map of characteristicId -> Set of excluded pointIds
const exclusionsMap = new Map<string, Set<string>>()

export function getExclusions(characteristicId: string): Set<string> {
  if (!exclusionsMap.has(characteristicId)) {
    exclusionsMap.set(characteristicId, new Set())
  }
  return exclusionsMap.get(characteristicId)!
}

export function setPointExclusion(characteristicId: string, pointId: string, exclude: boolean) {
  const set = getExclusions(characteristicId)
  if (exclude) {
    set.add(pointId)
  } else {
    set.delete(pointId)
  }
  notify()
}

export function clearExclusions(characteristicId: string) {
  const set = getExclusions(characteristicId)
  set.clear()
  notify()
}

function notify() {
  listeners.forEach(l => l())
}

export function useSPCExclusions(characteristicId: string) {
  const [exclusions, setExclusions] = useState(() => new Set(getExclusions(characteristicId)))

  useEffect(() => {
    const handleUpdate = () => {
      setExclusions(new Set(getExclusions(characteristicId)))
    }
    listeners.add(handleUpdate)
    return () => {
      listeners.delete(handleUpdate)
    }
  }, [characteristicId])

  return {
    exclusions,
    toggleExclusion: (pointId: string, exclude: boolean) => setPointExclusion(characteristicId, pointId, exclude),
    clearExclusions: () => clearExclusions(characteristicId),
  }
}
export type { ExclusionListener }
