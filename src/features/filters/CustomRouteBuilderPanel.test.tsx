import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RouteSegment } from '../../shared/types'
import { CustomRouteBuilderPanel } from './CustomRouteBuilderPanel'

afterEach(() => {
  cleanup()
})

function renderPanel(initialSegments: RouteSegment[]) {
  function Harness() {
    const [segments, setSegments] = useState<RouteSegment[]>(initialSegments)

    return (
      <CustomRouteBuilderPanel
        segments={segments}
        cameraCount={0}
        totalCount={0}
        onChange={setSegments}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )
  }

  return render(<Harness />)
}

describe('CustomRouteBuilderPanel', () => {
  it('preserves a three-digit route value while typing', () => {
    renderPanel([
      {
        routeKey: '',
        mpMin: 3,
        mpMax: 4,
        sortOrder: 'asc',
      },
    ])

    const routeInput = screen.getByLabelText('Route')

    fireEvent.change(routeInput, {
      target: { value: '2' },
    })
    fireEvent.change(routeInput, {
      target: { value: '20' },
    })
    fireEvent.change(routeInput, {
      target: { value: '201' },
    })

    expect(screen.getByLabelText('Route')).toHaveValue('201')
  })
})
