import { formatCoordinatePair, formatDistanceSummary } from './map-actions'
import type { AnalyticsCountStat, CameraAnalytics } from './camera-analytics'
import styles from './AnalyticsPanel.module.css'

const METERS_PER_MILE = 1609.344
const TOP_BREAKDOWN_COUNT = 4

interface AnalyticsPanelProps {
  analysis: CameraAnalytics
  onClose: () => void
}

function formatMiles(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return 'Not available'
  }

  return formatDistanceSummary(value * METERS_PER_MILE)
}

function formatPercent(share: number) {
  const percentage = share * 100

  return `${percentage >= 10 ? percentage.toFixed(0) : percentage.toFixed(1)}%`
}

function formatPatternLabel(analysis: CameraAnalytics) {
  switch (analysis.nearestNeighbor.classification) {
    case 'clustered':
      return 'Clustered'
    case 'dispersed':
      return 'Dispersed'
    case 'random':
      return 'Mixed / random'
    default:
      return 'Need 3+ cameras'
  }
}

function BreakdownBlock({ emptyLabel, stats, title }: { emptyLabel: string; stats: AnalyticsCountStat[]; title: string }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <strong>{title}</strong>
        <span>{stats.length ? `${Math.min(stats.length, TOP_BREAKDOWN_COUNT)} shown` : 'No data'}</span>
      </div>

      {stats.length ? (
        <ul className={styles.countList}>
          {stats.slice(0, TOP_BREAKDOWN_COUNT).map((stat) => (
            <li key={`${title}-${stat.label}`} className={styles.countItem}>
              <span className={styles.countLabel}>{stat.label}</span>
              <span className={styles.countMeta}>
                <strong>{stat.count.toLocaleString()}</strong>
                <span>{formatPercent(stat.share)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptySection}>{emptyLabel}</p>
      )}
    </section>
  )
}

export function AnalyticsPanel({ analysis, onClose }: AnalyticsPanelProps) {
  const centerLabel = analysis.center ? formatCoordinatePair(analysis.center) : 'Not available'
  const nearestNeighborIndex = analysis.nearestNeighbor.index
  const nearestNeighborZScore = analysis.nearestNeighbor.zScore

  return (
    <div className={styles.panel} role="dialog" aria-label="Camera analytics">
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>Turf.js</span>
          <strong className={styles.title}>Camera analytics</strong>
          <span className={styles.summaryMeta}>{analysis.totalCount.toLocaleString()} cameras in current filtered set</span>
        </div>
        <button className={styles.closeButton} type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.body}>
        <p className={styles.note}>
          This panel analyzes only the filtered camera layer. Global pattern uses nearest-neighbor analysis, while local groups use DBSCAN with a {formatMiles(analysis.localClusters.radiusMiles)} search radius.
        </p>

        {analysis.totalCount ? (
          <>
            <div className={styles.highlights}>
              <article className={styles.highlight}>
                <span className={styles.highlightLabel}>Cameras</span>
                <strong className={styles.highlightValue}>{analysis.totalCount.toLocaleString()}</strong>
                <span className={styles.highlightMeta}>Current filtered set</span>
              </article>

              <article className={styles.highlight}>
                <span className={styles.highlightLabel}>Center</span>
                <strong className={styles.highlightValue}>{centerLabel}</strong>
                <span className={styles.highlightMeta}>Mean center of all active points</span>
              </article>

              <article className={styles.highlight}>
                <span className={styles.highlightLabel}>Extent</span>
                <strong className={styles.highlightValue}>{formatMiles(analysis.span?.diagonalMiles ?? null)}</strong>
                <span className={styles.highlightMeta}>Diagonal span across the active set</span>
              </article>

              <article className={styles.highlight}>
                <span className={styles.highlightLabel}>Pattern</span>
                <strong className={styles.highlightValue}>{formatPatternLabel(analysis)}</strong>
                <span className={styles.highlightMeta}>
                  {nearestNeighborIndex === null
                    ? 'Need at least 3 cameras for the global pattern test.'
                    : `NN index ${nearestNeighborIndex.toFixed(2)}${nearestNeighborZScore === null ? '' : ` · z ${nearestNeighborZScore.toFixed(2)}`}`}
                </span>
              </article>
            </div>

            <div className={styles.sectionGrid}>
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <strong>Extent and spread</strong>
                  <span>Spatial footprint</span>
                </div>
                <dl className={styles.metricList}>
                  <div className={styles.metricRow}>
                    <dt>Width</dt>
                    <dd>{formatMiles(analysis.span?.widthMiles ?? null)}</dd>
                  </div>
                  <div className={styles.metricRow}>
                    <dt>Height</dt>
                    <dd>{formatMiles(analysis.span?.heightMiles ?? null)}</dd>
                  </div>
                  <div className={styles.metricRow}>
                    <dt>Average from center</dt>
                    <dd>{formatMiles(analysis.spread?.averageDistanceFromCenterMiles ?? null)}</dd>
                  </div>
                  <div className={styles.metricRow}>
                    <dt>Max from center</dt>
                    <dd>{formatMiles(analysis.spread?.maxDistanceFromCenterMiles ?? null)}</dd>
                  </div>
                </dl>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <strong>Local groups</strong>
                  <span>DBSCAN summary</span>
                </div>
                <dl className={styles.metricList}>
                  <div className={styles.metricRow}>
                    <dt>Cluster count</dt>
                    <dd>{analysis.localClusters.clusterCount.toLocaleString()}</dd>
                  </div>
                  <div className={styles.metricRow}>
                    <dt>Clustered cameras</dt>
                    <dd>{analysis.localClusters.clusteredPointCount.toLocaleString()}</dd>
                  </div>
                  <div className={styles.metricRow}>
                    <dt>Largest cluster</dt>
                    <dd>{analysis.localClusters.largestClusterSize.toLocaleString()}</dd>
                  </div>
                  <div className={styles.metricRow}>
                    <dt>Noise cameras</dt>
                    <dd>{analysis.localClusters.noisePointCount.toLocaleString()}</dd>
                  </div>
                </dl>
              </section>

              <BreakdownBlock
                title="Regions"
                stats={analysis.breakdowns.regions}
                emptyLabel="No regional values are available in the current set."
              />
              <BreakdownBlock
                title="Counties"
                stats={analysis.breakdowns.counties}
                emptyLabel="No county values are available in the current set."
              />
              <BreakdownBlock
                title="Routes"
                stats={analysis.breakdowns.routes}
                emptyLabel="No route references are available in the current set."
              />
              <BreakdownBlock
                title="Maintenance"
                stats={analysis.breakdowns.maintenanceStations}
                emptyLabel="No maintenance stations are available in the current set."
              />
              <BreakdownBlock
                title="Cities"
                stats={analysis.breakdowns.cities}
                emptyLabel="No city values are available in the current set."
              />
              <BreakdownBlock
                title="Status"
                stats={analysis.breakdowns.statuses}
                emptyLabel="No status values are available in the current set."
              />
            </div>
          </>
        ) : (
          <p className={styles.empty}>No cameras match the current filters, so there is nothing to analyze yet.</p>
        )}
      </div>
    </div>
  )
}