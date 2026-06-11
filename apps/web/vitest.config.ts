import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
    // Domain-integration workspace packages are resolved by pnpm symlinks but their
    // transitive source-level deps are not fully declared. Since all test files mock
    // these imports wholesale, configure vitest to treat @connectio/* packages as
    // external (pre-built) rather than traversing their source trees.
    server: {
      deps: {
        external: [/@connectio\//],
      },
    },
  },
})
