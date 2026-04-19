import type { CameraDetails, CameraSummary } from '../types'

interface ResolveModalNeighborIdsOptions {
  activeCameraId: string
  orderedCameraIds: string[]
  cameraDetailsById: ReadonlyMap<string, CameraDetails>
}

interface ResolveModalCameraWindowOptions extends ResolveModalNeighborIdsOptions {
  radius?: number
}

export function createCameraDetailsLookup(details: CameraDetails[]) {
  return new Map(details.map((detail) => [detail.id, detail]))
}

export function createCameraLookup(cameras: CameraSummary[]) {
  return new Map(cameras.map((camera) => [camera.id, camera]))
}

function resolveAdjacentCameraId({
  activeCameraId,
  orderedCameraIds,
  cameraDetailsById,
  direction,
}: ResolveModalNeighborIdsOptions & { direction: 'previous' | 'next' }) {
  const activeIndex = orderedCameraIds.indexOf(activeCameraId)
  const detail = cameraDetailsById.get(activeCameraId)

  if (activeIndex === -1) {
    return direction === 'previous'
      ? detail?.neighbors.previous.cameraId ?? null
      : detail?.neighbors.next.cameraId ?? null
  }

  if (direction === 'previous') {
    return activeIndex > 0
      ? orderedCameraIds[activeIndex - 1]
      : detail?.neighbors.previous.cameraId ?? null
  }

  return activeIndex < orderedCameraIds.length - 1
    ? orderedCameraIds[activeIndex + 1]
    : detail?.neighbors.next.cameraId ?? null
}

export function resolveModalNeighborIds({
  activeCameraId,
  orderedCameraIds,
  cameraDetailsById,
}: ResolveModalNeighborIdsOptions) {
  return {
    previousCameraId: resolveAdjacentCameraId({
      activeCameraId,
      orderedCameraIds,
      cameraDetailsById,
      direction: 'previous',
    }),
    nextCameraId: resolveAdjacentCameraId({
      activeCameraId,
      orderedCameraIds,
      cameraDetailsById,
      direction: 'next',
    }),
  }
}

export function resolveModalCameraWindow({
  activeCameraId,
  orderedCameraIds,
  cameraDetailsById,
  radius = 2,
}: ResolveModalCameraWindowOptions) {
  const seen = new Set([activeCameraId])
  const previousCameraIds: string[] = []
  const nextCameraIds: string[] = []

  let previousCursor = activeCameraId
  for (let step = 0; step < radius; step += 1) {
    const previousCameraId = resolveAdjacentCameraId({
      activeCameraId: previousCursor,
      orderedCameraIds,
      cameraDetailsById,
      direction: 'previous',
    })

    if (!previousCameraId || seen.has(previousCameraId)) {
      break
    }

    previousCameraIds.unshift(previousCameraId)
    seen.add(previousCameraId)
    previousCursor = previousCameraId
  }

  let nextCursor = activeCameraId
  for (let step = 0; step < radius; step += 1) {
    const nextCameraId = resolveAdjacentCameraId({
      activeCameraId: nextCursor,
      orderedCameraIds,
      cameraDetailsById,
      direction: 'next',
    })

    if (!nextCameraId || seen.has(nextCameraId)) {
      break
    }

    nextCameraIds.push(nextCameraId)
    seen.add(nextCameraId)
    nextCursor = nextCameraId
  }

  return [...previousCameraIds, activeCameraId, ...nextCameraIds]
}