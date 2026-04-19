import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const SERVICE_WORKER_RESET_KEY = 'ucam-service-worker-reset'

async function clearStaleServiceWorkers() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  const registrations = await navigator.serviceWorker.getRegistrations()
  const isControlled = Boolean(navigator.serviceWorker.controller)

  if (!registrations.length && !isControlled) {
    sessionStorage.removeItem(SERVICE_WORKER_RESET_KEY)
    return
  }

  await Promise.all(registrations.map((registration) => registration.unregister()))

  if ('caches' in window) {
    const cacheKeys = await caches.keys()
    await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)))
  }

  if (isControlled && sessionStorage.getItem(SERVICE_WORKER_RESET_KEY) !== 'done') {
    sessionStorage.setItem(SERVICE_WORKER_RESET_KEY, 'done')
    window.location.reload()
    return
  }

  sessionStorage.removeItem(SERVICE_WORKER_RESET_KEY)
}

void clearStaleServiceWorkers().catch(() => undefined)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
