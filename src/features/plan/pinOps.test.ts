import { describe, expect, it } from 'vitest'
import {
  movePin,
  nudgePin,
  placePhotoOnPlan,
  removePin,
  restorePin,
  setPinLabel,
} from '@/features/plan/pinOps'
import { deepFreeze } from '@/test/deepFreeze'
import { makeFullVisit } from '@/test/fixtures'
import type { Visit } from '@/types/visit'

// Fixture: pin-1 (n°1) on plan-x for photo-x, nextPinNumber 2.
const frozen = (overrides: Partial<Visit> = {}) => deepFreeze(makeFullVisit(overrides))

describe('pinOps', () => {
  it('never mutates and is deterministic', () => {
    const visit = frozen()
    const ops = [
      () => placePhotoOnPlan(visit, { pinId: 'n', planId: 'p', photoId: 'new', x: 0.2, y: 0.3 }),
      () => placePhotoOnPlan(visit, { pinId: 'n', planId: 'p2', photoId: 'photo-x', x: 2, y: -1 }),
      () => movePin(visit, 'pin-1', 0.9, 0.1),
      () => nudgePin(visit, 'pin-1', 0.05, -0.005),
      () => setPinLabel(visit, 'pin-1', ' Fuite '),
      () => removePin(visit, 'pin-1'),
    ]
    for (const op of ops) {
      expect(op).not.toThrow()
      expect(op()).toEqual(op())
    }
  })

  it('placing a new photo creates a pin with the next number and increments the counter', () => {
    const { visit, pin, moved } = placePhotoOnPlan(frozen(), {
      pinId: 'pin-new',
      planId: 'plan-a',
      photoId: 'photo-new',
      x: 0.25,
      y: 0.75,
    })
    expect(moved).toBe(false)
    expect(pin).toEqual({
      id: 'pin-new',
      planId: 'plan-a',
      photoId: 'photo-new',
      x: 0.25,
      y: 0.75,
      number: 2,
    })
    expect(visit.nextPinNumber).toBe(3)
    expect(visit.pins).toHaveLength(2)
  })

  it('placing an already placed photo moves its pin (other plan too), keeping its number', () => {
    const before = frozen()
    const { visit, pin, moved } = placePhotoOnPlan(before, {
      pinId: 'ignored',
      planId: 'plan-other',
      photoId: 'photo-x',
      x: 0.6,
      y: 0.4,
    })
    expect(moved).toBe(true)
    expect(pin).toEqual({
      id: 'pin-1',
      planId: 'plan-other',
      photoId: 'photo-x',
      x: 0.6,
      y: 0.4,
      number: 1,
    })
    expect(visit.nextPinNumber).toBe(before.nextPinNumber)
    expect(visit.pins).toHaveLength(1)
  })

  it('clamps coordinates to 0–1', () => {
    const placed = placePhotoOnPlan(frozen(), {
      pinId: 'n',
      planId: 'p',
      photoId: 'q',
      x: 1.4,
      y: -0.2,
    })
    expect([placed.pin.x, placed.pin.y]).toEqual([1, 0])
    const moved = movePin(frozen(), 'pin-1', -3, 7).pins[0]
    expect([moved?.x, moved?.y]).toEqual([0, 1])
    const nudged = nudgePin(frozen(), 'pin-1', 0.9, -0.9).pins[0]
    expect([nudged?.x, nudged?.y]).toEqual([1, 0])
    const small = nudgePin(frozen(), 'pin-1', 0.005, 0.05).pins[0]
    expect(small?.x).toBeCloseTo(0.255)
    expect(small?.y).toBeCloseTo(0.55)
  })

  it('sets and clears labels', () => {
    expect(setPinLabel(frozen(), 'pin-1', '  Fuite toiture ').pins[0]?.label).toBe('Fuite toiture')
    const labelled = setPinLabel(frozen(), 'pin-1', 'A')
    expect('label' in (setPinLabel(labelled, 'pin-1', '   ').pins[0] ?? {})).toBe(false)
    const visit = frozen()
    expect(setPinLabel(visit, 'unknown', 'x')).toBe(visit)
  })

  it('removing a pin does not free its number; restore brings it back identically', () => {
    const before = frozen()
    const { visit, removed, index } = removePin(before, 'pin-1')
    expect(visit.pins).toEqual([])
    expect(visit.nextPinNumber).toBe(2)
    const next = placePhotoOnPlan(visit, {
      pinId: 'n',
      planId: 'p',
      photoId: 'other',
      x: 0.5,
      y: 0.5,
    })
    expect(next.pin.number).toBe(2)
    expect(restorePin(visit, removed!, index).pins).toEqual(before.pins)
    // No duplicate when the photo was placed again meanwhile.
    const replaced = placePhotoOnPlan(visit, {
      pinId: 'z',
      planId: 'p',
      photoId: 'photo-x',
      x: 0,
      y: 0,
    }).visit
    expect(restorePin(replaced, removed!, index)).toBe(replaced)
  })
})
