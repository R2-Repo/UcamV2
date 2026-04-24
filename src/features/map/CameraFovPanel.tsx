import type {
  CameraFovArea,
  CameraFovSelectionMode,
  CameraFovSummary,
} from './camera-fov-analysis'
import styles from './CameraFovPanel.module.css'

interface CameraFovPanelProps {
  area: CameraFovArea | null
  candidateCameraCount: number
  error: string | null
  isRunning: boolean
  onClear: () => void
  onClose: () => void
  onRun: () => void
  onSelectionModeChange: (mode: Extract<CameraFovSelectionMode, 'rectangle' | 'polygon'>) => void
  selectionMode: CameraFovSelectionMode
  summary: CameraFovSummary | null
}

function getSelectionHint(selectionMode: CameraFovSelectionMode, area: CameraFovArea | null) {
  if (selectionMode === 'rectangle') {
    return 'Click two corners on the map to define the analysis window.'
  }

  if (selectionMode === 'polygon') {
    return 'Click polygon vertices, then double-click the map to finish the area.'
  }

  if (area) {
    return 'Selection is ready. Run the analysis or clear it and draw a new area.'
  }

  return 'Choose rectangle or polygon drawing, then select only the cameras you want to analyze.'
}

function getAreaLabel(area: CameraFovArea | null) {
  if (!area) {
    return 'No area selected'
  }

  return area.kind === 'rectangle' ? 'Rectangle area' : 'Polygon area'
}

export function CameraFovPanel({
  area,
  candidateCameraCount,
  error,
  isRunning,
  onClear,
  onClose,
  onRun,
  onSelectionModeChange,
  selectionMode,
  summary,
}: CameraFovPanelProps) {
  const selectionHint = getSelectionHint(selectionMode, area)

  return (
    <div className={styles.panel} role="dialog" aria-label="Camera field of view analysis">
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>Terrain Aware V1</span>
          <strong className={styles.title}>Camera field of view</strong>
          <span className={styles.summaryMeta}>
            {summary
              ? `${summary.cameraCountAnalyzed} selected cameras, ${summary.coverageCameraCount} matched to centerlines`
              : area
                ? `${candidateCameraCount} cameras inside the current area`
                : 'Front-end only, session graphics only'}
          </span>
        </div>
        <button className={styles.closeButton} type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.body}>
        <p className={styles.note}>
          Runs on the currently filtered camera set only. Results stay temporary, with no saved edits and no backend changes.
        </p>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <strong>Selection</strong>
            <span>{area ? getAreaLabel(area) : 'Waiting for a map area'}</span>
          </div>

          <div className={styles.modeButtons}>
            <button
              className={styles.modeButton}
              data-active={selectionMode === 'rectangle'}
              type="button"
              onClick={() => onSelectionModeChange('rectangle')}
            >
              Rectangle
            </button>
            <button
              className={styles.modeButton}
              data-active={selectionMode === 'polygon'}
              type="button"
              onClick={() => onSelectionModeChange('polygon')}
            >
              Polygon
            </button>
          </div>

          <p className={styles.helperText}>{selectionHint}</p>

          <dl className={styles.metricList}>
            <div className={styles.metricRow}>
              <dt>Cameras in area</dt>
              <dd>{candidateCameraCount.toLocaleString()}</dd>
            </div>
            <div className={styles.metricRow}>
              <dt>Status</dt>
              <dd>
                {isRunning
                  ? 'Analyzing...'
                  : selectionMode !== 'idle'
                    ? 'Drawing on map'
                    : area
                      ? 'Ready to run'
                      : 'Select an area'}
              </dd>
            </div>
          </dl>

          <div className={styles.actionRow}>
            <button className={styles.runButton} type="button" disabled={!area || isRunning} onClick={onRun}>
              {isRunning ? 'Running...' : 'Run Analysis'}
            </button>
            <button className={styles.clearButton} type="button" onClick={onClear}>
              Clear
            </button>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
        </section>

        {summary ? (
          <>
            <div className={styles.highlights}>
              <article className={styles.highlight}>
                <span className={styles.highlightLabel}>Analyzed</span>
                <strong className={styles.highlightValue}>{summary.cameraCountAnalyzed.toLocaleString()}</strong>
                <span className={styles.highlightMeta}>Filtered cameras inside the selected area</span>
              </article>

              <article className={styles.highlight}>
                <span className={styles.highlightLabel}>Road Matched</span>
                <strong className={styles.highlightValue}>{summary.coverageCameraCount.toLocaleString()}</strong>
                <span className={styles.highlightMeta}>Cameras aligned to nearby road centerlines</span>
              </article>

              <article className={styles.highlight}>
                <span className={styles.highlightLabel}>Road Context</span>
                <strong className={styles.highlightValue}>{summary.routeContext}</strong>
                <span className={styles.highlightMeta}>Dominant route references in the selected area</span>
              </article>

              <article className={styles.highlight}>
                <span className={styles.highlightLabel}>Nearest Milepost</span>
                <strong className={styles.highlightValue}>{summary.nearestMilepost ?? 'Not available'}</strong>
                <span className={styles.highlightMeta}>Nearest public milepost point to the selected area center</span>
              </article>
            </div>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <strong>Analysis Notes</strong>
                <span>{summary.notes.length} notes</span>
              </div>

              <ul className={styles.noteList}>
                {summary.notes.map((note) => (
                  <li key={note} className={styles.noteItem}>
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}