/**
 * Returns a copy of `object` where `key` is set to `value`, or removed when
 * `value` is `undefined` (keeps stored objects free of `undefined` keys).
 */
export function withOptional<T extends object, K extends keyof T>(
  object: T,
  key: K,
  value: T[K] | undefined,
): T {
  if (value !== undefined) return { ...object, [key]: value }
  const { [key]: _removed, ...rest } = object
  return rest as T
}

/** Trims a string; empty (after trim) becomes `undefined`. */
export function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** Moves the element at `from` to `to` in a new array (no-op when out of bounds). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = [...items]
  if (from < 0 || from >= copy.length || to < 0 || to >= copy.length || from === to) return copy
  const [item] = copy.splice(from, 1) as [T]
  copy.splice(to, 0, item)
  return copy
}

/** Inserts `item` at `index` (clamped to the array bounds) in a new array. */
export function insertAt<T>(items: readonly T[], item: T, index: number): T[] {
  const copy = [...items]
  copy.splice(Math.max(0, Math.min(index, copy.length)), 0, item)
  return copy
}
