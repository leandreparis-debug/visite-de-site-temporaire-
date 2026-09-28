import { describe, expect, it } from 'vitest'
import { allocatePinNumber } from '@/features/plan/pins'
import { addPlan, deletePlan } from '@/features/plan/plansRepo'
import { createVisit, duplicateVisit, getVisit, updateVisit } from '@/features/visits/visitsRepo'
import { db } from '@/lib/db/db'
import { makeFullVisit, makePlanInput } from '@/test/fixtures'
import { normalizeVisit, type StoredVisit, type Visit } from '@/types/visit'

const newVisit = () =>
  createVisit({ kind: 'technical_visit', title: 'Visite', date: '2026-09-28', siteName: 'Site' })

/** Adds a pin the way the plan feature must: allocate + push in the same updater. */
function addPin(visitId: string, planId: string): Promise<Visit> {
  return updateVisit(visitId, (visit) => {
    const { number, visit: next } = allocatePinNumber(visit)
    return {
      ...next,
      pins: [...next.pins, { id: `pin-${number}`, planId, photoId: 'ph', x: 0.5, y: 0.5, number }],
    }
  })
}

describe('pin numbering', () => {
  it('allocatePinNumber returns the counter and increments it (pure)', () => {
    const visit = makeFullVisit({ nextPinNumber: 7 })
    const { number, visit: next } = allocatePinNumber(visit)
    expect(number).toBe(7)
    expect(next.nextPinNumber).toBe(8)
    expect(visit.nextPinNumber).toBe(7)
  })

  it('new visits start at 1', async () => {
    expect((await newVisit()).nextPinNumber).toBe(1)
  })

  it('never reassigns the number of a deleted pin, even the highest one', async () => {
    const visit = await newVisit()
    const plan = await addPlan(makePlanInput(visit.id))
    await addPin(visit.id, plan.id)
    await addPin(visit.id, plan.id)
    const withThree = await addPin(visit.id, plan.id)
    expect(withThree.pins.map((p) => p.number)).toEqual([1, 2, 3])

    // Delete the highest-numbered pin.
    await updateVisit(visit.id, (v) => ({ ...v, pins: v.pins.filter((p) => p.number !== 3) }))
    const next = await addPin(visit.id, plan.id)
    expect(next.pins.map((p) => p.number)).toEqual([1, 2, 4])

    // Deleting the plan (cascade on its pins) does not reset the counter either.
    await deletePlan(plan.id)
    const plan2 = await addPlan(makePlanInput(visit.id))
    expect((await addPin(visit.id, plan2.id)).pins.map((p) => p.number)).toEqual([5])
  })

  it('normalizes a stored visit without nextPinNumber to max + 1', async () => {
    const { nextPinNumber: _omitted, ...legacy } = makeFullVisit({
      id: 'legacy',
      nextPinNumber: 9,
      pins: [
        { id: 'a', planId: 'pl', photoId: 'ph', x: 0, y: 0, number: 2 },
        { id: 'b', planId: 'pl', photoId: 'ph', x: 1, y: 1, number: 5 },
      ],
    })
    const stored: StoredVisit = legacy
    expect(normalizeVisit(stored).nextPinNumber).toBe(6)
    expect(normalizeVisit({ ...stored, pins: [] }).nextPinNumber).toBe(1)

    await db.visits.add(stored)
    expect((await getVisit('legacy')).nextPinNumber).toBe(6)
    // Updating a legacy visit persists the computed counter.
    await updateVisit('legacy', (v) => ({ ...v, title: 'Modifiée' }))
    expect((await db.visits.get('legacy'))?.nextPinNumber).toBe(6)
  })

  it('duplication resets the counter to 1 (pins are not copied)', async () => {
    const visit = await newVisit()
    const plan = await addPlan(makePlanInput(visit.id))
    await addPin(visit.id, plan.id)
    await addPin(visit.id, plan.id)
    const copy = await duplicateVisit(visit.id)
    expect(copy.pins).toEqual([])
    expect(copy.nextPinNumber).toBe(1)
  })
})
