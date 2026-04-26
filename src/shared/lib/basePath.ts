const ROOT_BASE_PATH = '/'

export function normalizeBasePath(value?: string): string {
  if (!value) {
    return ROOT_BASE_PATH
  }

  const trimmed = value.trim()

  if (!trimmed || trimmed === ROOT_BASE_PATH) {
    return ROOT_BASE_PATH
  }

  const withLeadingSlash = trimmed.startsWith(ROOT_BASE_PATH) ? trimmed : `${ROOT_BASE_PATH}${trimmed}`
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '')

  return `${withoutTrailingSlash}${ROOT_BASE_PATH}`
}

export function getRouterBasePath(basePath = import.meta.env.BASE_URL): string {
  const normalizedBasePath = normalizeBasePath(basePath)

  return normalizedBasePath === ROOT_BASE_PATH
    ? ROOT_BASE_PATH
    : normalizedBasePath.replace(/\/$/, '')
}

export function resolveBaseAssetPath(assetPath: string, basePath = import.meta.env.BASE_URL): string {
  const normalizedBasePath = normalizeBasePath(basePath)
  const normalizedAssetPath = assetPath.replace(/^\/+/, '')

  return `${normalizedBasePath}${normalizedAssetPath}`
}
