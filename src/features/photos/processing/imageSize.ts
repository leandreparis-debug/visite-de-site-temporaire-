/**
 * Target size to fit `width × height` within `maxLongSide` on its long side.
 * Keeps the ratio, never enlarges, rounds to integers (minimum 1 px).
 */
export function computeTargetSize(
  width: number,
  height: number,
  maxLongSide: number,
): { width: number; height: number } {
  const longSide = Math.max(width, height)
  if (longSide <= maxLongSide) return { width: Math.round(width), height: Math.round(height) }
  const scale = maxLongSide / longSide
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
