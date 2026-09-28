/** Pure helpers computing a new photo order (list of ids). */

/** Moves `id` to `index` (clamped). Returns the same array when nothing changes. */
export function moveIdTo(ids: readonly string[], id: string, index: number): readonly string[] {
  const from = ids.indexOf(id)
  const to = Math.max(0, Math.min(index, ids.length - 1))
  if (from === -1 || from === to) return ids
  const next = ids.filter((other) => other !== id)
  next.splice(to, 0, id)
  return next
}

/** Moves `id` just before or after `targetId` (drag and drop). */
export function moveIdNextTo(
  ids: readonly string[],
  id: string,
  targetId: string,
  side: 'before' | 'after',
): readonly string[] {
  if (id === targetId || !ids.includes(id) || !ids.includes(targetId)) return ids
  const next = ids.filter((other) => other !== id)
  const at = next.indexOf(targetId) + (side === 'after' ? 1 : 0)
  next.splice(at, 0, id)
  return next.every((value, i) => value === ids[i]) ? ids : next
}

/**
 * Moves `id` one step within the visible list (`visibleIds`, e.g. filtered):
 * it takes the place of its visible neighbour in the full order.
 */
export function moveIdByStep(
  ids: readonly string[],
  visibleIds: readonly string[],
  id: string,
  step: -1 | 1,
): readonly string[] {
  const neighbour = visibleIds[visibleIds.indexOf(id) + step]
  if (neighbour === undefined || !visibleIds.includes(id)) return ids
  return moveIdNextTo(ids, id, neighbour, step === 1 ? 'after' : 'before')
}
