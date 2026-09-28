import type { Pin } from '@/types/media'

/**
 * Next pin number for a visit: max existing number + 1 (1 for the first pin).
 * Numbers are never reused or renumbered after a deletion, so references in
 * a report stay stable.
 */
export function getNextPinNumber(pins: readonly Pick<Pin, 'number'>[]): number {
  return pins.reduce((max, pin) => Math.max(max, pin.number), 0) + 1
}
