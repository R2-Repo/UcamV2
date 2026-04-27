import type { ChangeEvent } from 'react'
import type { RouteSegment } from '../../shared/types'
import {
  cloneRouteSegments,
  createEmptyCustomRouteSegment,
  getCustomRouteLabel,
  getSegmentDisplayEnd,
  getSegmentDisplayStart,
  hasCustomRouteSegments,
  isCustomRouteSegmentComplete,
  swapCustomRouteSegment,
  updateCustomRouteSegment,
} from './customRoute'
import styles from './CustomRouteBuilderPanel.module.css'

interface CustomRouteBuilderPanelProps {
  segments: RouteSegment[]
  cameraCount: number
  totalCount: number
  onChange: (segments: RouteSegment[]) => void
  onClose: () => void
  onSave: (segments: RouteSegment[]) => void
}

function parseNumberInput(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function moveSegment(segments: RouteSegment[], fromIndex: number, toIndex: number): RouteSegment[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= segments.length || toIndex >= segments.length) {
    return cloneRouteSegments(segments)
  }

  const nextSegments = cloneRouteSegments(segments)
  const [segment] = nextSegments.splice(fromIndex, 1)
  nextSegments.splice(toIndex, 0, segment)
  return nextSegments
}

export function CustomRouteBuilderPanel({
  segments,
  cameraCount,
  totalCount,
  onChange,
  onClose,
  onSave,
}: CustomRouteBuilderPanelProps) {
  const draftSegments = segments.length ? segments : [createEmptyCustomRouteSegment()]
  const completeSegments = draftSegments.filter((segment) => isCustomRouteSegmentComplete(segment))
  const canSave = hasCustomRouteSegments(draftSegments)
  const previewLabel = canSave ? getCustomRouteLabel(completeSegments) : 'Custom Route'

  const updateSegmentAt = (index: number, updater: (segment: RouteSegment) => RouteSegment) => {
    onChange(
      draftSegments.map((segment, segmentIndex) => (segmentIndex === index ? updater(segment) : segment)),
    )
  }

  const handleRouteKeyChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    updateSegmentAt(index, (segment) =>
      updateCustomRouteSegment(segment, {
        routeKey: event.target.value,
      }),
    )
  }

  const handleStartChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    updateSegmentAt(index, (segment) =>
      updateCustomRouteSegment(segment, {
        start: parseNumberInput(event.target.value),
      }),
    )
  }

  const handleEndChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    updateSegmentAt(index, (segment) =>
      updateCustomRouteSegment(segment, {
        end: parseNumberInput(event.target.value),
      }),
    )
  }

  const handleSwap = (index: number) => {
    updateSegmentAt(index, (segment): RouteSegment => swapCustomRouteSegment(segment))
  }

  const handleMove = (index: number, direction: -1 | 1) => {
    onChange(moveSegment(draftSegments, index, index + direction))
  }

  const handleRemove = (index: number) => {
    if (draftSegments.length === 1) {
      onChange([createEmptyCustomRouteSegment()])
      return
    }

    onChange(draftSegments.filter((_, segmentIndex) => segmentIndex !== index))
  }

  const handleAddSegment = () => {
    onChange([...draftSegments, createEmptyCustomRouteSegment()])
  }

  const handleReset = () => {
    onChange([createEmptyCustomRouteSegment()])
  }

  return (
    <section className={styles.panel} aria-label="Custom route builder">
      <div className={styles.header}>
        <p className={styles.eyebrow}>Custom route builder</p>
        <h3 className={styles.title}>{previewLabel}</h3>
        <p className={styles.description}>
          Build a multi-route milepost sequence, preview it on the full map, then save it into the gallery filter state.
        </p>
      </div>

      <div className={styles.body}>
        <div className={styles.summary}>
          <div>
            <strong>{completeSegments.length}</strong>
            <span>Ready segments</span>
          </div>
          <div>
            <strong>{cameraCount}</strong>
            <span>Preview cameras</span>
          </div>
        </div>

        <div className={styles.segmentList} role="list">
          {draftSegments.map((segment, index) => {
            const isFirst = index === 0
            const isLast = index === draftSegments.length - 1

            return (
              <article
                key={`${index}-${segment.routeKey}-${segment.mpMin}-${segment.mpMax}-${segment.sortOrder}`}
                className={styles.segmentCard}
                role="listitem"
              >
                <div className={styles.segmentHeader}>
                  <div className={styles.segmentTitleBlock}>
                    <span className={styles.segmentTitle}>Segment {index + 1}</span>
                    <span className={styles.segmentMeta}>
                      {segment.sortOrder === 'desc' ? 'Descending milepost order' : 'Ascending milepost order'}
                    </span>
                  </div>

                  <div className={styles.segmentActions}>
                    <button
                      className={styles.iconButton}
                      type="button"
                      disabled={isFirst}
                      aria-label={`Move segment ${index + 1} up`}
                      onClick={() => handleMove(index, -1)}
                    >
                      <i className="fas fa-arrow-up"></i>
                    </button>
                    <button
                      className={styles.iconButton}
                      type="button"
                      disabled={isLast}
                      aria-label={`Move segment ${index + 1} down`}
                      onClick={() => handleMove(index, 1)}
                    >
                      <i className="fas fa-arrow-down"></i>
                    </button>
                    <button
                      className={`${styles.iconButton} ${styles.swapButton}`.trim()}
                      type="button"
                      aria-label={`Swap mileposts for segment ${index + 1}`}
                      onClick={() => handleSwap(index)}
                    >
                      <i className="fas fa-right-left"></i>
                    </button>
                    <button
                      className={styles.iconButton}
                      type="button"
                      aria-label={`Remove segment ${index + 1}`}
                      onClick={() => handleRemove(index)}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>

                <div className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <label htmlFor={`custom-route-route-${index}`}>Route</label>
                    <input
                      id={`custom-route-route-${index}`}
                      type="text"
                      inputMode="numeric"
                      placeholder="15"
                      value={segment.routeKey.replace(/P$/, '')}
                      onChange={handleRouteKeyChange(index)}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor={`custom-route-start-${index}`}>From MP</label>
                    <input
                      id={`custom-route-start-${index}`}
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={getSegmentDisplayStart(segment) ?? ''}
                      onChange={handleStartChange(index)}
                    />
                  </div>

                  <button
                    className={`${styles.iconButton} ${styles.swapButton}`.trim()}
                    type="button"
                    aria-label={`Reverse segment ${index + 1}`}
                    onClick={() => handleSwap(index)}
                  >
                    <i className="fas fa-rotate"></i>
                  </button>

                  <div className={styles.field}>
                    <label htmlFor={`custom-route-end-${index}`}>To MP</label>
                    <input
                      id={`custom-route-end-${index}`}
                      type="number"
                      inputMode="decimal"
                      placeholder="10"
                      value={getSegmentDisplayEnd(segment) ?? ''}
                      onChange={handleEndChange(index)}
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <button className={styles.addButton} type="button" onClick={handleAddSegment}>
          <i className="fas fa-plus"></i> Add Segment
        </button>
      </div>

      <div className={styles.footer}>
        <p className={styles.saveHint}>Previewing {cameraCount} of {totalCount} cameras on the map.</p>
        <div className={styles.footerActions}>
          <button className={styles.quietButton} type="button" onClick={handleReset}>
            Reset
          </button>
          <button className={styles.ghostButton} type="button" onClick={onClose}>
            Cancel
          </button>
          <button className={styles.primaryButton} type="button" disabled={!canSave} onClick={() => onSave(completeSegments)}>
            Save & Close
          </button>
        </div>
      </div>
    </section>
  )
}
