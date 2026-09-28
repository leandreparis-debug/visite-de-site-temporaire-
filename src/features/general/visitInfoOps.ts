/**
 * Pure operation on the visit header and site fields. Never mutate; never
 * compute dates here (replayed by the autosave).
 */
import { isValidIsoDate, isValidTime } from '@/lib/dates'
import { cleanOptional, withOptional } from '@/lib/objects'
import type { Site, Visit } from '@/types/visit'

/** Fields editable in the "Informations générales" tab. */
export interface VisitInfoPatch {
  kind?: Visit['kind']
  date?: string
  /** `HH:mm`, or empty to clear. */
  startTime?: string
  author?: string
  purpose?: string
  site?: Partial<Site>
}

/**
 * Applies visit/site fields. Strings are trimmed; empty optional fields are
 * removed. Invalid required values (empty site name, invalid date) and invalid
 * times are ignored: the corresponding field keeps its previous value, so an
 * invalid state is never sent to the autosave.
 */
export function setVisitInfo(visit: Visit, patch: VisitInfoPatch): Visit {
  let next = visit
  if (patch.kind !== undefined && patch.kind !== next.kind) next = { ...next, kind: patch.kind }
  if (patch.date !== undefined && isValidIsoDate(patch.date) && patch.date !== next.date) {
    next = { ...next, date: patch.date }
  }
  if ('startTime' in patch) {
    const time = cleanOptional(patch.startTime)
    if (time === undefined || isValidTime(time)) next = withOptional(next, 'startTime', time)
  }
  if ('author' in patch) next = withOptional(next, 'author', cleanOptional(patch.author))
  if ('purpose' in patch) next = withOptional(next, 'purpose', cleanOptional(patch.purpose))
  if (patch.site) next = { ...next, site: setSiteFields(next.site, patch.site) }
  return sameVisit(visit, next) ? visit : next
}

function setSiteFields(site: Site, patch: Partial<Site>): Site {
  let next = { ...site }
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (name) next.name = name
  }
  for (const key of ['code', 'address', 'city'] as const) {
    if (key in patch) next = withOptional(next, key, cleanOptional(patch[key]))
  }
  return next
}

function sameVisit(a: Visit, b: Visit): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
