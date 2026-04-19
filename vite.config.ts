import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    headers: noStoreHeaders,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    headers: noStoreHeaders,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
