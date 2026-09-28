import { useLiveResult, type LiveResult } from '@/lib/db/useLiveResult'
import type { Plan } from '@/types/media'
import { listPlans } from './plansRepo'

/** Reactive plans of a visit, sorted by `order`. Use `useObjectUrl` to display blobs. */
export function usePlans(visitId: string): LiveResult<Plan[]> {
  return useLiveResult(() => listPlans(visitId), visitId)
}
