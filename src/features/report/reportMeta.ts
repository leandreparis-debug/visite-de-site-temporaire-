/**
 * Date of the last Word report generated for each visit (stored in `meta`).
 * The report being the only lasting archive of a visit, this date is shown
 * in the visit header, the list and before deleting a visit.
 */
import { getMeta, setMeta } from '@/lib/db/meta'
import { formatDateFr, todayIso } from '@/lib/dates'
import { useLiveResult } from '@/lib/db/useLiveResult'

/** Records that a report of `visitId` was generated at `generatedAt` (ISO timestamp). */
export async function recordReportGenerated(visitId: string, generatedAt: string): Promise<void> {
  const current = (await getMeta('reportGeneratedAt')) ?? {}
  await setMeta('reportGeneratedAt', { ...current, [visitId]: generatedAt })
}

/** Removes the date of a deleted visit. */
export async function forgetReportGenerated(visitId: string): Promise<void> {
  const current = await getMeta('reportGeneratedAt')
  if (!current || !(visitId in current)) return
  const { [visitId]: _removed, ...rest } = current
  await setMeta('reportGeneratedAt', rest)
}

/** Reactive map visit id → timestamp of the last report (empty while loading). */
export function useReportDates(): Readonly<Record<string, string>> {
  const { data } = useLiveResult(
    async () => (await getMeta('reportGeneratedAt')) ?? {},
    'report-dates',
  )
  return data ?? {}
}

/** "Rapport généré le 28 septembre 2026" (local date of the timestamp). */
export function formatReportGenerated(timestamp: string): string {
  return `Rapport généré le ${formatDateFr(todayIso(new Date(timestamp)))}`
}
