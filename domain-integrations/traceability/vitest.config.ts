import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/index.ts',
        'src/test-setup.ts',
        'src/TraceabilityWorkspace.tsx',
        'src/registration.ts',
        'src/trace-investigation-registration.ts',
        'src/trace-investigation-workspace.tsx',
        'src/traceabilityClient.ts',
        'src/actions/**',
      ],
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
    },
  },
})
