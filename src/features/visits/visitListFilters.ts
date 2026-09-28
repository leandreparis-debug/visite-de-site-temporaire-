import { normalizeForSearch } from '@/lib/search'
import type { VisitKind, VisitSummary } from '@/types/visit'

export const VISIT_SORTS = ['updated', 'date', 'site'] as const
export type VisitSort = (typeof VISIT_SORTS)[number]

export const VISIT_SORT_LABELS: Record<VisitSort, string> = {
  updated: 'Dernière modification',
  date: 'Date de visite (récentes d’abord)',
  site: 'Site (A → Z)',
}

export interface VisitListFilters {
  query: string
  kind: VisitKind | 'all'
  sort: VisitSort
}

export const DEFAULT_VISIT_FILTERS: VisitListFilters = { query: '', kind: 'all', sort: 'updated' }

const siteCollator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

/**
 * Filters (search on title + site name, accent/case-insensitive; kind) and
 * sorts visit summaries. Pure: returns a new array.
 */
export function filterAndSortVisits(
  visits: readonly VisitSummary[],
  { query, kind, sort }: VisitListFilters,
): VisitSummary[] {
  const terms = normalizeForSearch(query).split(' ').filter(Boolean)
  const result = visits.filter((visit) => {
    if (kind !== 'all' && visit.kind !== kind) return false
    if (terms.length === 0) return true
    const haystack = normalizeForSearch(`${visit.title} ${visit.siteName}`)
    return terms.every((term) => haystack.includes(term))
  })
  const byUpdated = (a: VisitSummary, b: VisitSummary) => b.updatedAt.localeCompare(a.updatedAt)
  switch (sort) {
    case 'updated':
      return result.sort(byUpdated)
    case 'date':
      return result.sort((a, b) => b.date.localeCompare(a.date) || byUpdated(a, b))
    case 'site':
      return result.sort((a, b) => siteCollator.compare(a.siteName, b.siteName) || byUpdated(a, b))
  }
}

export function hasActiveFilters(filters: VisitListFilters): boolean {
  return filters.query.trim() !== '' || filters.kind !== 'all'
}
