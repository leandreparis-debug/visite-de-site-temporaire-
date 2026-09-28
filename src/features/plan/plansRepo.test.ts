import { describe, expect, it } from 'vitest'
import { getNextPinNumber } from '@/features/plan/pins'
import { addPlan, deletePlan, listPlans, renamePlan } from '@/features/plan/plansRepo'
import { createVisit, getVisit, updateVisit } from '@/features/visits/visitsRepo'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { makePlanInput } from '@/test/fixtures'

const newVisit = () =>
  createVisit({ kind: 'technical_visit', title: 'Visite', date: '2026-09-28', siteName: 'Site' })

describe('plansRepo', () => {
  it('adds, lists (by order) and renames plans', async () => {
    const visit = await newVisit()
    const a = await addPlan(makePlanInput(visit.id, { name: 'Bâtiment A' }))
    await addPlan(makePlanInput(visit.id, { name: 'Bâtiment B', sourceType: 'pdf' }))
    expect((await listPlans(visit.id)).map((p) => [p.name, p.order])).toEqual([
      ['Bâtiment A', 0],
      ['Bâtiment B', 1],
    ])

    const renamed = await renamePlan(a.id, 'Cellule 1')
    expect(renamed.name).toBe('Cellule 1')
    expect((await listPlans(visit.id))[0]?.name).toBe('Cellule 1')
    await expect(renamePlan(a.id, '  ')).rejects.toBeInstanceOf(ValidationError)
    await expect(renamePlan('missing', 'X')).rejects.toBeInstanceOf(NotFoundError)
    await expect(addPlan(makePlanInput('missing'))).rejects.toBeInstanceOf(NotFoundError)
  })

  it('deletePlan removes the pins placed on it and keeps the other pins unchanged', async () => {
    const visit = await newVisit()
    const kept = await addPlan(makePlanInput(visit.id))
    const removed = await addPlan(makePlanInput(visit.id))
    const pin = (id: string, planId: string, number: number) => ({
      id,
      planId,
      photoId: 'ph',
      x: 0.5,
      y: 0.5,
      number,
    })
    await updateVisit(visit.id, (v) => ({
      ...v,
      pins: [pin('p1', removed.id, 1), pin('p2', kept.id, 2), pin('p3', kept.id, 3)],
    }))

    await deletePlan(removed.id)

    expect((await listPlans(visit.id)).map((p) => p.id)).toEqual([kept.id])
    const pins = (await getVisit(visit.id)).pins
    expect(pins).toEqual([pin('p2', kept.id, 2), pin('p3', kept.id, 3)])
    // Numbering stays stable: the next pin gets max + 1, deleted numbers are not reassigned.
    expect(getNextPinNumber(pins)).toBe(4)
    await expect(deletePlan(removed.id)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('getNextPinNumber starts at 1', () => {
    expect(getNextPinNumber([])).toBe(1)
  })
})
