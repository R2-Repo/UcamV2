import { useEffect, useMemo, useState } from 'react'
import { createCameraDetailsLookup } from '../lib/modalCamera'
import { resolveBaseAssetPath } from '../lib/basePath'
import type { CameraDetails, CameraSummary, CuratedRoute } from '../types'

const MIN_SPLASH_MS = 500
const MAX_SPLASH_MS = 2200

interface AppDataState {
  cameras: CameraSummary[]
  cameraDetails: CameraDetails[]
  cameraDetailsById: ReadonlyMap<string, CameraDetails>
  routes: CuratedRoute[]
  isLoading: boolean
  showSplash: boolean
  error: string | null
}

async function fetchJson<T>(input: string, signal: AbortSignal) {
  const response = await fetch(input, { signal })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${input}: ${response.status}`)
  }

  return (await response.json()) as T
}

export function useAppData(): AppDataState {
  const [cameras, setCameras] = useState<CameraSummary[]>([])
  const [cameraDetails, setCameraDetails] = useState<CameraDetails[]>([])
  const [routes, setRoutes] = useState<CuratedRoute[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [minimumElapsed, setMinimumElapsed] = useState(false)
  const [maximumElapsed, setMaximumElapsed] = useState(false)

  useEffect(() => {
    const minTimer = window.setTimeout(() => setMinimumElapsed(true), MIN_SPLASH_MS)
    const maxTimer = window.setTimeout(() => setMaximumElapsed(true), MAX_SPLASH_MS)

    return () => {
      window.clearTimeout(minTimer)
      window.clearTimeout(maxTimer)
    }
  }, [])

  useEffect(() => {
    const abortController = new AbortController()

    Promise.all([
      fetchJson<CameraSummary[]>(resolveBaseAssetPath('data/cameras.summary.json'), abortController.signal),
      fetchJson<CameraDetails[]>(resolveBaseAssetPath('data/cameras.details.json'), abortController.signal),
      fetchJson<CuratedRoute[]>(resolveBaseAssetPath('data/routes.processed.json'), abortController.signal),
    ])
      .then(([nextCameras, nextCameraDetails, nextRoutes]) => {
        setCameras(nextCameras)
        setCameraDetails(nextCameraDetails)
        setRoutes(nextRoutes)
      })
      .catch((nextError: unknown) => {
        if (abortController.signal.aborted) {
          return
        }

        setError(nextError instanceof Error ? nextError.message : 'Unable to load camera data.')
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => abortController.abort()
  }, [])

  const showSplash = useMemo(
    () => !maximumElapsed && (isLoading || !minimumElapsed),
    [isLoading, maximumElapsed, minimumElapsed],
  )

  const cameraDetailsById = useMemo(
    () => createCameraDetailsLookup(cameraDetails),
    [cameraDetails],
  )

  return {
    cameras,
    cameraDetails,
    cameraDetailsById,
    routes,
    isLoading,
    showSplash,
    error,
  }
}