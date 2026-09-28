/** ISO calendar date `YYYY-MM-DD`. */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
/** Time of day `HH:mm` (24 h). */
const TIME_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/

const longFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  // Rejects overflowing dates such as 2026-02-30 (which Date would roll to March 2).
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null
  return { year, month, day }
}

/**
 * Checks that `value` is an existing calendar date in `YYYY-MM-DD` format.
 * @example isValidIsoDate('2026-02-30') // false
 */
export function isValidIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null
}

/** Checks a `HH:mm` 24-hour time, e.g. `"08:30"`. */
export function isValidTime(value: string): boolean {
  return TIME_HH_MM.test(value)
}

/**
 * Long French date.
 * @example formatDateFr('2026-09-28') // "28 septembre 2026"
 * @returns the input unchanged if it is not a valid ISO date.
 */
export function formatDateFr(isoDate: string): string {
  const parts = parseIsoDate(isoDate)
  if (!parts) return isoDate
  return longFormatter.format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)))
}

/**
 * Short French date.
 * @example formatDateShortFr('2026-09-28') // "28/09/2026"
 * @returns the input unchanged if it is not a valid ISO date.
 */
export function formatDateShortFr(isoDate: string): string {
  if (!parseIsoDate(isoDate)) return isoDate
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

/** Today's date as `YYYY-MM-DD` in the **local** time zone (not UTC). */
export function todayIso(now: Date = new Date()): string {
  const y = String(now.getFullYear()).padStart(4, '0')
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Current timestamp as full ISO 8601 (UTC), used for `createdAt` / `updatedAt`. */
export function nowIso(): string {
  return new Date().toISOString()
}

const relativeFormatter = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

/**
 * Relative French time for a timestamp, e.g. "il y a 5 minutes", "hier",
 * "il y a 3 jours"; "à l’instant" under 45 seconds.
 */
export function formatRelativeFr(timestamp: string, now: number = Date.now()): string {
  const seconds = Math.round((Date.parse(timestamp) - now) / 1000)
  const abs = Math.abs(seconds)
  if (Number.isNaN(seconds)) return ''
  if (abs < 45) return 'à l’instant'
  for (const [unit, size] of RELATIVE_UNITS) {
    if (abs >= size || unit === 'minute') {
      return relativeFormatter.format(Math.round(seconds / size), unit)
    }
  }
  return ''
}
