/** Pure display helpers for attention points (sorting, overdue, summary). */
import type { AttentionPoint, Priority } from '@/types/visit'

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

/**
 * Display order: not done first, then priority (high → low), then due date
 * (earliest first, no due date last). Stable; returns a new array — the stored
 * order is never changed.
 */
export function sortAttentionPointsForDisplay(points: readonly AttentionPoint[]): AttentionPoint[] {
  return points
    .map((point, index) => ({ point, index }))
    .sort((a, b) => {
      const doneDiff = Number(a.point.status === 'done') - Number(b.point.status === 'done')
      if (doneDiff) return doneDiff
      const priorityDiff = PRIORITY_RANK[a.point.priority] - PRIORITY_RANK[b.point.priority]
      if (priorityDiff) return priorityDiff
      const aDue = a.point.dueDate ?? '9999-99-99'
      const bDue = b.point.dueDate ?? '9999-99-99'
      return aDue.localeCompare(bDue) || a.index - b.index
    })
    .map(({ point }) => point)
}

/**
 * `true` when the due date is strictly before `todayIso` and the point is not done.
 * @param todayIso today's date (`YYYY-MM-DD`), computed by the caller at render time.
 */
export function isOverdue(point: AttentionPoint, todayIso: string): boolean {
  return point.status !== 'done' && point.dueDate !== undefined && point.dueDate < todayIso
}

export interface AttentionSummary {
  total: number
  /** Not done (open or in progress). */
  open: number
  overdue: number
  done: number
}

/** Counts for the header ("3 ouverts dont 1 en retard"). */
export function summarizeAttentionPoints(
  points: readonly AttentionPoint[],
  todayIso: string,
): AttentionSummary {
  const done = points.filter((p) => p.status === 'done').length
  return {
    total: points.length,
    open: points.length - done,
    overdue: points.filter((p) => isOverdue(p, todayIso)).length,
    done,
  }
}

/** French sentence for the summary, e.g. "3 ouverts dont 1 en retard". */
export function formatAttentionSummary(summary: AttentionSummary): string {
  if (summary.total === 0) return 'Aucun point'
  if (summary.open === 0) return 'Tous les points sont terminés'
  const open = `${summary.open} ${summary.open > 1 ? 'ouverts' : 'ouvert'}`
  return summary.overdue > 0 ? `${open} dont ${summary.overdue} en retard` : open
}
