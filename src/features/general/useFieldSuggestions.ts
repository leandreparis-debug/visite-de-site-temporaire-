import { useMemo } from 'react'
import { listVisits } from '@/features/visits/visitsRepo'
import { useLiveResult } from '@/lib/db/useLiveResult'
import { computeFieldSuggestions, type FieldSuggestions } from './fieldSuggestions'

/**
 * Reactive `<datalist>` suggestions built from all stored visits (authors,
 * sites, cities, participants…), most used first. While loading (or if the
 * storage fails), only the default authors are returned.
 *
 * @param excludeVisitId the visit being edited, whose own values are skipped.
 */
export function useFieldSuggestions(excludeVisitId?: string): FieldSuggestions {
  const { data } = useLiveResult(listVisits, 'field-suggestions')
  return useMemo(() => computeFieldSuggestions(data ?? [], excludeVisitId), [data, excludeVisitId])
}
