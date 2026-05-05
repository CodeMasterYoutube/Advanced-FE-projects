import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    // Warn when any single chunk exceeds 500KB — a useful CI gate
    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        /**
         * manualChunks: isolate vendor code into stable, long-cached chunks.
         *
         * Route chunks (Dashboard, Analytics, Reports, Editor, Settings) are
         * automatically split by Rollup because of the dynamic import() calls
         * in src/router/index.tsx — no manual config needed for those.
         */
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return

          if (id.includes('react-dom') || id.includes('react-router')) {
            return 'react-vendor'
          }
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
            return 'chart-vendor'
          }
          if (id.includes('@tanstack')) {
            return 'table-vendor'
          }
          if (
            id.includes('@uiw') ||
            id.includes('@codemirror') ||
            id.includes('codemirror') ||
            id.includes('unified') ||
            id.includes('remark') ||
            id.includes('rehype')
          ) {
            return 'editor-vendor'
          }

          return 'vendor'
        },
      },
    },
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
})
