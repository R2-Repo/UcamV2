import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store',
}

function normalizeBasePath(value?: string) {
  if (!value) {
    return '/'
  }

  const trimmed = value.trim()

  if (!trimmed || trimmed === '/') {
    return '/'
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '')

  return `${withoutTrailingSlash}/`
}

// https://vite.dev/config/
export default defineConfig({
  base: normalizeBasePath(process.env.PAGES_BASE_PATH),
  plugins: [react()],
  optimizeDeps: {
    entries: ['index.html'],
  },
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
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: './src/test/setup.ts',
  },
})
