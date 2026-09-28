import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VISIT_FILTERS,
  filterAndSortVisits,
  hasActiveFilters,
} from '@/features/visits/visitListFilters'
import { normalizeForSearch } from '@/lib/search'
import type { VisitSummary } from '@/types/visit'

const summary = (overrides: Partial<VisitSummary>): VisitSummary => ({
  id: 'id',
  title: 'Titre',
  kind: 'technical_visit',
  date: '2026-01-01',
  siteName: 'Site',
  updatedAt: '2026-01-01T00:00:00.000Z',
  photoCount: 0,
  planCount: 0,
  pinCount: 0,
  ...overrides,
})

const visits = [
  summary({ id: 'a', siteName: 'Évry', date: '2026-02-01', updatedAt: '2026-09-01T00:00:00.000Z' }),
  summary({
    id: 'b',
    siteName: 'arras',
    date: '2026-05-01',
    updatedAt: '2026-09-03T00:00:00.000Z',
    kind: 'meeting',
  }),
  summary({
    id: 'c',
    siteName: 'Dijon',
    date: '2026-05-01',
    updatedAt: '2026-09-02T00:00:00.000Z',
  }),
]
const ids = (list: VisitSummary[]) => list.map((v) => v.id)

describe('visit list filters', () => {
  it('normalizes accents, case and spaces', () => {
    expect(normalizeForSearch('  Entrepôt   ÉVRY  ')).toBe('entrepot evry')
  })

  it('sorts by last update, visit date (tie: last update), site (French collation)', () => {
    expect(ids(filterAndSortVisits(visits, DEFAULT_VISIT_FILTERS))).toEqual(['b', 'c', 'a'])
    expect(ids(filterAndSortVisits(visits, { ...DEFAULT_VISIT_FILTERS, sort: 'date' }))).toEqual([
      'b',
      'c',
      'a',
    ])
    expect(ids(filterAndSortVisits(visits, { ...DEFAULT_VISIT_FILTERS, sort: 'site' }))).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it('filters by kind and by every search term', () => {
    expect(ids(filterAndSortVisits(visits, { ...DEFAULT_VISIT_FILTERS, kind: 'meeting' }))).toEqual(
      ['b'],
    )
    expect(ids(filterAndSortVisits(visits, { ...DEFAULT_VISIT_FILTERS, query: 'evry' }))).toEqual([
      'a',
    ])
    expect(
      ids(filterAndSortVisits(visits, { ...DEFAULT_VISIT_FILTERS, query: 'titre dijon' })),
    ).toEqual(['c'])
    expect(filterAndSortVisits(visits, { ...DEFAULT_VISIT_FILTERS, query: 'lyon' })).toEqual([])
  })

  it('does not mutate the input and detects active filters', () => {
    const copy = [...visits]
    filterAndSortVisits(visits, { ...DEFAULT_VISIT_FILTERS, sort: 'site' })
    expect(visits).toEqual(copy)
    expect(hasActiveFilters(DEFAULT_VISIT_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_VISIT_FILTERS, sort: 'site' })).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_VISIT_FILTERS, query: ' x ' })).toBe(true)
  })
})
