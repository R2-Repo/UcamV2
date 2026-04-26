import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CameraSummary } from '../../shared/types'

vi.mock('./MiniOverviewMapCard', () => ({
  MiniOverviewMapCard: ({ cameras, onSelect }: { cameras: CameraSummary[]; onSelect: () => void }) => (
    <button type="button" data-testid="mini-overview-map" onClick={onSelect}>
      overview {cameras.length}
    </button>
  ),
}))

import { GalleryView } from './GalleryView'

function createCamera(id: string): CameraSummary {
  return {
    id,
    source: 'UDOT',
    sourceId: id,
    location: `Camera ${id}`,
    latitude: 40,
    longitude: -111,
    imageUrl: `https://example.com/${id}.jpg`,
    region: '3',
    county: 'Utah',
    city: 'American Fork',
    direction: 'Northbound',
    maintenanceStations: [],
    routeRefs: [],
    status: 'Enabled',
    sortOrder: 0,
    searchText: id,
  }
}

afterEach(() => {
  cleanup()
})

describe('GalleryView', () => {
  it('renders the mini overview map ahead of camera cards when enabled', () => {
    const onOpenMiniOverviewMap = vi.fn()
    const onSelectCamera = vi.fn()

    render(
      <GalleryView
        cameras={[createCamera('cam-1'), createCamera('cam-2')]}
        selectedCameraId={null}
        imageSize={180}
        showMiniOverviewMap
        refreshTokensByCameraId={{}}
        onOpenMiniOverviewMap={onOpenMiniOverviewMap}
        onSelectCamera={onSelectCamera}
      />,
    )

    const gallery = document.getElementById('imageGallery')
    const firstTile = gallery?.firstElementChild

    expect(screen.getByTestId('mini-overview-map')).toBeInTheDocument()
    expect(firstTile?.textContent).toContain('overview 2')
  })

  it('routes mini overview clicks into the provided map opener', () => {
    const onOpenMiniOverviewMap = vi.fn()

    render(
      <GalleryView
        cameras={[createCamera('cam-1')]}
        selectedCameraId={null}
        imageSize={180}
        showMiniOverviewMap
        refreshTokensByCameraId={{}}
        onOpenMiniOverviewMap={onOpenMiniOverviewMap}
        onSelectCamera={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTestId('mini-overview-map'))

    expect(onOpenMiniOverviewMap).toHaveBeenCalledTimes(1)
  })

  it('omits the mini overview map when disabled', () => {
    render(
      <GalleryView
        cameras={[createCamera('cam-1')]}
        selectedCameraId={null}
        imageSize={180}
        refreshTokensByCameraId={{}}
        onOpenMiniOverviewMap={vi.fn()}
        onSelectCamera={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('mini-overview-map')).not.toBeInTheDocument()
  })
})
