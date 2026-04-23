import styles from './ArcGisLayerPanel.module.css'
import {
  getArcGisGeometryTypeLabel,
  getArcGisLayerColor,
  type ArcGisLayerConfig,
} from './arcgis-rest'

interface ArcGisLayerPanelProps {
  activeLayerCount: number
  inputError: string | null
  inputValue: string
  isAdding: boolean
  layers: ArcGisLayerConfig[]
  onAddLayer: () => void
  onClose: () => void
  onInputChange: (value: string) => void
  onMinZoomChange: (layerId: string, minZoom: number) => void
  onRemoveLayer: (layerId: string) => void
  onToggleLayer: (layerId: string, enabled: boolean) => void
}

function getLayerHostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return url
  }
}

export function ArcGisLayerPanel({
  activeLayerCount,
  inputError,
  inputValue,
  isAdding,
  layers,
  onAddLayer,
  onClose,
  onInputChange,
  onMinZoomChange,
  onRemoveLayer,
  onToggleLayer,
}: ArcGisLayerPanelProps) {
  const enabledLayers = layers.filter((layer) => layer.enabled)

  return (
    <div className={styles.panel} role="dialog" aria-label="External ArcGIS layers">
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>ArcGIS REST</span>
          <strong className={styles.title}>External map layers</strong>
          <span className={styles.summaryMeta}>{activeLayerCount} active of {layers.length}</span>
        </div>
        <button className={styles.closeButton} type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.body}>
        <p className={styles.note}>
          Configure preset ArcGIS layers here. Nothing loads until a layer is toggled on, and visible data stays scoped to the current map extent.
        </p>

        <div className={styles.legendBlock}>
          <div className={styles.legendHeader}>
            <strong>Legend</strong>
            <span>{enabledLayers.length ? `${enabledLayers.length} visible` : 'No layers visible'}</span>
          </div>

          {enabledLayers.length ? (
            <ul className={styles.legendList}>
              {enabledLayers.map((layer) => (
                <li key={`${layer.id}-legend`} className={styles.legendItem}>
                  <span
                    className={styles.legendSwatch}
                    aria-hidden="true"
                    style={{ backgroundColor: getArcGisLayerColor(layer.id) }}
                  />
                  <span className={styles.legendLabelBlock}>
                    <span className={styles.legendTitle}>{layer.title}</span>
                    <span className={styles.legendMeta}>
                      {getArcGisGeometryTypeLabel(layer.geometryType)}
                      {layer.labelsEnabled && layer.labelField ? ` · Labels: ${layer.labelField}` : ' · Labels off'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyLegend}>Turn a layer on to show its legend swatch and label rule.</p>
          )}
        </div>

        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            onAddLayer()
          }}
        >
          <input
            className={styles.input}
            type="url"
            inputMode="url"
            placeholder="Paste a public .../MapServer/0 or .../FeatureServer/0 URL"
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
          />
          <button className={styles.submitButton} type="submit" disabled={isAdding}>
            {isAdding ? 'Adding...' : 'Add Layer'}
          </button>
        </form>

        {inputError ? <p className={styles.error}>{inputError}</p> : null}

        {layers.length ? (
          <ul className={styles.list}>
            {layers.map((layer) => (
              <li key={layer.id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={layer.enabled}
                      onChange={(event) => onToggleLayer(layer.id, event.target.checked)}
                    />
                    <span className={styles.titleBlock}>
                      <span className={styles.title}>{layer.title}</span>
                      <span className={styles.meta}>
                        <span className={styles.pill}>{layer.isRemovable ? 'Custom' : 'Preset'}</span>
                        <span className={styles.pill}>{getLayerHostLabel(layer.url)}</span>
                        <span className={styles.pill}>{getArcGisGeometryTypeLabel(layer.geometryType)}</span>
                        <span className={styles.pill}>Zoom {layer.minZoom}+</span>
                        <span className={styles.pill}>
                          {layer.labelsEnabled && layer.labelField ? `Label ${layer.labelField}` : 'Labels off'}
                        </span>
                      </span>
                    </span>
                  </label>

                  {layer.isRemovable ? (
                    <button
                      className={styles.removeButton}
                      type="button"
                      onClick={() => onRemoveLayer(layer.id)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className={styles.itemFooter}>
                  <label className={styles.minZoomField}>
                    <span>Min zoom</span>
                    <input
                      className={styles.minZoomInput}
                      type="number"
                      min="0"
                      max="22"
                      step="1"
                      value={layer.minZoom}
                      onChange={(event) => {
                        const nextMinZoom = Number.parseInt(event.target.value, 10)

                        if (Number.isFinite(nextMinZoom)) {
                          onMinZoomChange(layer.id, nextMinZoom)
                        }
                      }}
                    />
                  </label>
                </div>

                <p className={styles.url}>{layer.url}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>Add a public ArcGIS layer URL to start drawing data from the current view.</p>
        )}
      </div>
    </div>
  )
}