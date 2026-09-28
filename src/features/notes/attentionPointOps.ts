/**
 * Pure operations on `visit.attentionPoints`. Never mutate; ids and dates are
 * provided by the caller (the autosave replays these functions). The stored
 * order is the insertion order; display sorting is done by attentionPointView.
 */
import { isValidIsoDate } from '@/lib/dates'
import { cleanOptional, insertAt, withOptional } from '@/lib/objects'
import type { AttentionPoint, Visit } from '@/types/visit'

export type AttentionPointFields = Pick<
  AttentionPoint,
  'text' | 'priority' | 'owner' | 'dueDate' | 'status'
>

function applyFields(
  point: AttentionPoint,
  fields: Partial<AttentionPointFields>,
): AttentionPoint | null {
  let next = { ...point }
  if (fields.text !== undefined) {
    const text = fields.text.trim()
    if (!text) return null
    next.text = text
  }
  if (fields.priority !== undefined) next.priority = fields.priority
  if (fields.status !== undefined) next.status = fields.status
  if ('owner' in fields) next = withOptional(next, 'owner', cleanOptional(fields.owner))
  if ('dueDate' in fields) {
    const dueDate = cleanOptional(fields.dueDate)
    if (dueDate === undefined || isValidIsoDate(dueDate)) {
      next = withOptional(next, 'dueDate', dueDate)
    }
  }
  return next
}

/**
 * Appends an attention point (status "open", priority "medium" by default).
 * Blank texts are ignored.
 */
export function addAttentionPoint(
  visit: Visit,
  point: { id: string; text: string } & Partial<Omit<AttentionPointFields, 'text'>>,
): Visit {
  const created = applyFields(
    { id: point.id, text: '', priority: 'medium', status: 'open' },
    { ...point },
  )
  if (!created || visit.attentionPoints.some((p) => p.id === created.id)) return visit
  return { ...visit, attentionPoints: [...visit.attentionPoints, created] }
}

/** Updates fields of a point (blank text refused, invalid due date ignored). */
export function updateAttentionPoint(
  visit: Visit,
  id: string,
  fields: Partial<AttentionPointFields>,
): Visit {
  const index = visit.attentionPoints.findIndex((p) => p.id === id)
  const current = visit.attentionPoints[index]
  const next = current && applyFields(current, fields)
  if (!next) return visit
  return { ...visit, attentionPoints: visit.attentionPoints.with(index, next) }
}

/** Removes a point; returns it with its index for "Annuler". */
export function removeAttentionPoint(
  visit: Visit,
  id: string,
): { visit: Visit; removed: AttentionPoint | null; index: number } {
  const index = visit.attentionPoints.findIndex((p) => p.id === id)
  const removed = visit.attentionPoints[index]
  if (!removed) return { visit, removed: null, index: -1 }
  return {
    visit: { ...visit, attentionPoints: visit.attentionPoints.filter((p) => p.id !== id) },
    removed,
    index,
  }
}

/** Re-inserts a point at `index` (undo); no-op if already present. */
export function insertAttentionPointAt(visit: Visit, point: AttentionPoint, index: number): Visit {
  if (visit.attentionPoints.some((p) => p.id === point.id)) return visit
  return { ...visit, attentionPoints: insertAt(visit.attentionPoints, point, index) }
}
