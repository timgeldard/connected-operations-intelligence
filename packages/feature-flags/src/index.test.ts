import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  featureFlags,
  setFeatureFlags,
  isFlagEnabled,
  isLifecycleEnabled,
  isWorkspaceFlagEnabled,
} from './index.js'

describe('Feature Flags module', () => {
  beforeEach(() => {
    // Reset flags
    setFeatureFlags({})
    vi.stubGlobal('process', {
      env: {},
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('defaults and environment variable fallback', () => {
    it('returns the default value when no env variable or registry override exists', () => {
      // Default writeBack.sapWriteBack is false
      expect(featureFlags.writeBack.sapWriteBack).toBe(false)
      // Default traceability.workspace is true
      expect(featureFlags.traceability.workspace).toBe(true)
      expect(featureFlags.runtime.enableCrossDomainContext).toBe(false)
    })

    it('falls back to environment variables when present', () => {
      vi.stubGlobal('process', {
        env: {
          VITE_FEATURE_SAP_WRITE_BACK: 'true',
          VITE_FEATURE_TRACEABILITY_WORKSPACE: 'false',
          VITE_FEATURE_ENABLE_CROSS_DOMAIN_CONTEXT: 'true',
        },
      })

      expect(featureFlags.writeBack.sapWriteBack).toBe(true)
      expect(featureFlags.traceability.workspace).toBe(false)
      expect(featureFlags.runtime.enableCrossDomainContext).toBe(true)
    })
  })

  describe('runtime registry overrides', () => {
    it('prefers registry overrides over env variables and defaults', () => {
      vi.stubGlobal('process', {
        env: {
          VITE_FEATURE_SAP_WRITE_BACK: 'true',
        },
      })

      setFeatureFlags({
        'writeBack.sapWriteBack': false,
        'traceability.workspace': false,
      })

      expect(featureFlags.writeBack.sapWriteBack).toBe(false)
      expect(featureFlags.traceability.workspace).toBe(false)
    })
  })

  describe('isWorkspaceFlagEnabled', () => {
    it('correctly maps workspaceId to featureFlags', () => {
      setFeatureFlags({
        'traceability.workspace': false,
        'poh.workspace': false,
        'spc.workspace': false,
        'warehouse.workspace': false,
        'quality.workspace': false,
      })

      expect(isWorkspaceFlagEnabled('trace-investigation')).toBe(false)
      expect(isWorkspaceFlagEnabled('process-order-review')).toBe(false)
      expect(isWorkspaceFlagEnabled('spc-monitoring')).toBe(false)
      expect(isWorkspaceFlagEnabled('warehouse-360-overview')).toBe(false)
      expect(isWorkspaceFlagEnabled('quality-batch-release')).toBe(false)
      expect(isWorkspaceFlagEnabled('some-other-workspace')).toBe(true) // defaults to true
    })
  })

  describe('isFlagEnabled (legacy compatibility)', () => {
    it('resolves string keys against the registry', () => {
      setFeatureFlags({
        'pilot-access': true,
      })
      expect(isFlagEnabled('pilot-access')).toBe(true)
    })

    it('maps camelCase keys to VITE_FEATURE_ env variables', () => {
      vi.stubGlobal('process', {
        env: {
          VITE_FEATURE_PILOT_ACCESS: 'true',
        },
      })
      expect(isFlagEnabled('pilotAccess')).toBe(true)
    })
  })

  describe('isLifecycleEnabled', () => {
    it('behaves correctly for all lifecycle states', () => {
      expect(isLifecycleEnabled('live')).toBe(true)
      expect(isLifecycleEnabled('deprecated')).toBe(false)
      expect(isLifecycleEnabled('hidden')).toBe(false)

      setFeatureFlags({
        'pilot-access': true,
        'concept-lab-access': false,
      })
      expect(isLifecycleEnabled('pilot')).toBe(true)
      expect(isLifecycleEnabled('concept-lab')).toBe(false)
    })
  })
})
