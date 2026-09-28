import type { Visit } from '@/types/visit'

/**
 * Reserves the next pin number of a visit.
 *
 * Returns the number to give to the new pin and a copy of the visit whose
 * `nextPinNumber` counter is incremented. The counter only ever grows, so a
 * number is never reassigned, even after the pin holding it is deleted.
 * Call it inside the same `updateVisit` updater that adds the pin:
 *
 * @example
 * updateVisit(id, (visit) => {
 *   const { number, visit: next } = allocatePinNumber(visit)
 *   return { ...next, pins: [...next.pins, { ...pin, number }] }
 * })
 */
export function allocatePinNumber<V extends Pick<Visit, 'nextPinNumber'>>(
  visit: V,
): { number: number; visit: V } {
  const number = visit.nextPinNumber
  return { number, visit: { ...visit, nextPinNumber: number + 1 } }
}
