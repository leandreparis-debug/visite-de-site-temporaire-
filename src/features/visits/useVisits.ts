import { useLiveResult, type LiveResult } from '@/lib/db/useLiveResult'
import type { Visit, VisitSummary } from '@/types/visit'
import { getVisit, listVisitSummaries } from './visitsRepo'

/** Reactive list of visit summaries (most recently updated first). */
export function useVisitSummaries(): LiveResult<VisitSummary[]> {
  return useLiveResult(listVisitSummaries, 'visit-summaries')
}

/**
 * Reactive full visit. An unknown id gives `isLoading: false` and a
 * `NotFoundError` in `error` (distinct from "still loading").
 */
export function useVisit(id: string): LiveResult<Visit> {
  return useLiveResult(() => getVisit(id), id)
}
