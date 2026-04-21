import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FilterState, FilterOptions } from '../../shared/types'
import { FilterBar } from './FilterBar'
import { defaultFilters } from './store'

const options: FilterOptions = {
  regions: ['2', '3'],
  counties: ['Salt Lake', 'Utah'],
  cities: ['Salt Lake City', 'Spanish Fork'],
  maintenanceStations: ['Salt Lake', 'Spanish Fork'],
  routes: [
    {
      id: 'parleys-canyon-1',
      displayName: 'Parleys Canyon',
      segments: [],
    },
  ],
}

function renderFilterBar(filterOverrides: Partial<FilterState> = {}) {
  const onFilterChange = vi.fn()
  const onCopyLink = vi.fn()
  const onImageSizeChange = vi.fn()
  const onRefresh = vi.fn()
  const onReset = vi.fn()
  const onViewModeChange = vi.fn()

  render(
    <FilterBar
      filters={{ ...defaultFilters, ...filterOverrides }}
      options={options}
      filteredCount={12}
      totalCount={99}
      viewMode="gallery"
      imageSize={180}
      onFilterChange={onFilterChange}
      onCopyLink={onCopyLink}
      onImageSizeChange={onImageSizeChange}
      onRefresh={onRefresh}
      onReset={onReset}
      onViewModeChange={onViewModeChange}
    />, 
  )

  return {
    onFilterChange,
    onCopyLink,
  }
}

function getDropdownContainer(trigger: HTMLElement) {
  const dropdown = trigger.closest('details')

  expect(dropdown).not.toBeNull()

  return dropdown as HTMLDetailsElement
}

afterEach(() => {
  cleanup()
})

describe('FilterBar', () => {
  it('closes the status menu after a menu action is selected', () => {
    const { onCopyLink } = renderFilterBar()
    const statusTrigger = screen.getByText('12 Cameras')
    const dropdown = getDropdownContainer(statusTrigger)

    fireEvent.click(statusTrigger)

    expect(dropdown).toHaveAttribute('open')

    fireEvent.click(screen.getByRole('button', { name: /copy view link/i }))

    expect(onCopyLink).toHaveBeenCalledTimes(1)
    expect(dropdown).not.toHaveAttribute('open')
  })

  it('closes the filters menu after selecting a filter option', () => {
    const { onFilterChange } = renderFilterBar()
    const filtersTrigger = screen.getByLabelText('Filters')
    const dropdown = getDropdownContainer(filtersTrigger)

    fireEvent.click(filtersTrigger)

    expect(dropdown).toHaveAttribute('open')

    fireEvent.change(screen.getByRole('combobox', { name: 'Region' }), {
      target: { value: '2' },
    })

    expect(onFilterChange).toHaveBeenCalledWith('region', '2')
    expect(dropdown).not.toHaveAttribute('open')
  })

  it('closes the routes menu after selecting a route', () => {
    const { onFilterChange } = renderFilterBar()
    const routesTrigger = screen.getByLabelText('Routes')
    const dropdown = getDropdownContainer(routesTrigger)

    fireEvent.click(routesTrigger)

    expect(dropdown).toHaveAttribute('open')

    fireEvent.change(screen.getByRole('combobox', { name: 'Curated Route' }), {
      target: { value: 'parleys-canyon-1' },
    })

    expect(onFilterChange).toHaveBeenCalledWith('routeId', 'parleys-canyon-1')
    expect(dropdown).not.toHaveAttribute('open')
  })

  it('exposes a direct full-map toggle in the header controls', () => {
    const onViewModeChange = vi.fn()

    render(
      <FilterBar
        filters={defaultFilters}
        options={options}
        filteredCount={12}
        totalCount={99}
        viewMode="gallery"
        imageSize={180}
        onFilterChange={vi.fn()}
        onCopyLink={vi.fn()}
        onImageSizeChange={vi.fn()}
        onRefresh={vi.fn()}
        onReset={vi.fn()}
        onViewModeChange={onViewModeChange}
      />,
    )

    fireEvent.click(screen.getByTitle('Open Full Map'))

    expect(onViewModeChange).toHaveBeenCalledWith('map')
  })
})