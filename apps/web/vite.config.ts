import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
