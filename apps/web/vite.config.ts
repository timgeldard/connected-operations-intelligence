import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Workspace source aliases mirroring tsconfig.base.json "paths" (the build resolves
// package sources directly; packages are not individually pre-built).
const r = (p: string) => resolve(__dirname, '../../', p)
const workspaceAliases = {
  // Subpath exports must be aliased BEFORE the bare package name (first match wins).
  '@connectio/design-system/tokens': r('packages/ui/src/tokens/tokens.css'),
  '@connectio/design-system/shell': r('packages/ui/src/tokens/shell.css'),
  '@connectio/product-model': r('packages/domain-models/src/index.ts'),
  '@connectio/data-contracts': r('packages/data-contracts/src/index.ts'),
  '@connectio/design-system': r('packages/ui/src/index.ts'),
  '@connectio/workspace-runtime': r('packages/workspace-runtime/src/index.ts'),
  '@connectio/evidence-panel-runtime': r('packages/evidence-panel-runtime/src/index.ts'),
  '@connectio/personalization': r('packages/personalization/src/index.ts'),
  '@connectio/auth-scope': r('packages/auth-scope/src/index.ts'),
  '@connectio/source-adapters': r('packages/source-adapters/src/index.ts'),
  '@connectio/telemetry': r('packages/telemetry/src/index.ts'),
  '@connectio/feature-flags': r('packages/feature-flags/src/index.ts'),
  '@connectio/di-traceability': r('domain-integrations/traceability/src/index.ts'),
  '@connectio/di-quality': r('domain-integrations/quality/src/index.ts'),
  '@connectio/di-spc': r('domain-integrations/spc/src/index.ts'),
  '@connectio/di-operations': r('domain-integrations/operations/src/index.ts'),
  '@connectio/di-warehouse': r('domain-integrations/warehouse/src/index.ts'),
  '@connectio/di-envmon': r('domain-integrations/envmon/src/index.ts'),
  '@connectio/di-maintenance': r('domain-integrations/maintenance/src/index.ts'),
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: workspaceAliases,
  },
  server: {
    port: 4200,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    // Warn when any chunk exceeds 400 kB (uncompressed).
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core framework — always loaded
          react: ['react', 'react-dom'],
          query: ['@tanstack/react-query'],
          // Design-system — shared across all pages
          'design-system': ['@connectio/design-system'],
          // Phase 4 live domain packages
          'di-traceability': ['@connectio/di-traceability'],
          'di-quality': ['@connectio/di-quality'],
          'di-operations': ['@connectio/di-operations'],
          'di-envmon': ['@connectio/di-envmon'],
          'di-warehouse': ['@connectio/di-warehouse'],
          // Phase 5 pilot domain packages
          'di-spc': ['@connectio/di-spc'],
          'di-maintenance': ['@connectio/di-maintenance'],
        },
      },
    },
  },
})
