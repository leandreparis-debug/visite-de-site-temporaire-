import { formatDateShortFr, todayIso } from '@/lib/dates'

/** Version of the tool (package.json), injected at build time. */
export const APP_VERSION = __APP_VERSION__

/** Build timestamp (ISO 8601), injected at build time. */
export const BUILD_DATE = __BUILD_DATE__

/**
 * "v1.0.0 — build du 28/09/2026" (local date of the build).
 * @param buildDate ISO timestamp of the build (defaults to the injected one).
 */
export function formatBuildLabel(version = APP_VERSION, buildDate = BUILD_DATE): string {
  return `v${version} — build du ${formatDateShortFr(todayIso(new Date(buildDate)))}`
}
