/** Plans repository. Plan images are stored as blobs in the `plans` table. */
import { Dexie } from 'dexie'
import { touchVisit } from '@/features/visits/visitsRepo'
import { db } from '@/lib/db/db'
import { nowIso } from '@/lib/dates'
import { NotFoundError, withStorageErrors } from '@/lib/errors'
import { createId } from '@/lib/id'
import { parseOrThrow } from '@/lib/validation'
import { planSchema, type Plan } from '@/types/media'

/** Data required to add a plan; `order` defaults to the end of the list. */
export type NewPlanInput = Omit<Plan, 'id' | 'createdAt' | 'order'> & { order?: number }

const planNameSchema = planSchema.shape.name

function plansOfVisit(visitId: string) {
  return db.plans.where('[visitId+order]').between([visitId, Dexie.minKey], [visitId, Dexie.maxKey])
}

/**
 * Adds a plan (image already prepared; PDFs are rendered to an image by the caller).
 * @throws {NotFoundError} if the visit does not exist.
 * @throws {ValidationError} if the data is invalid.
 */
export function addPlan(input: NewPlanInput): Promise<Plan> {
  return withStorageErrors(() =>
    db.transaction('rw', db.plans, db.visits, async () => {
      await touchVisit(input.visitId)
      const last = await plansOfVisit(input.visitId).last()
      const plan = parseOrThrow(planSchema, {
        ...input,
        id: createId(),
        order: input.order ?? (last ? last.order + 1 : 0),
        createdAt: nowIso(),
      })
      await db.plans.add(plan)
      return plan
    }),
  )
}

/** Plans of a visit, sorted by `order`. */
export function listPlans(visitId: string): Promise<Plan[]> {
  return withStorageErrors(() => plansOfVisit(visitId).toArray())
}

/**
 * Renames a plan.
 * @throws {NotFoundError} if the plan does not exist.
 * @throws {ValidationError} if the name is empty or too long.
 */
export function renamePlan(id: string, name: string): Promise<Plan> {
  return withStorageErrors(() =>
    db.transaction('rw', db.plans, db.visits, async () => {
      const plan = await db.plans.get(id)
      if (!plan) throw new NotFoundError('plan', id)
      const next = { ...plan, name: parseOrThrow(planNameSchema, name) }
      await db.plans.put(next)
      await touchVisit(plan.visitId)
      return next
    }),
  )
}

/**
 * Deletes a plan and, in the same transaction, the visit's pins placed on it.
 * @throws {NotFoundError} if the plan does not exist.
 */
export function deletePlan(id: string): Promise<void> {
  return withStorageErrors(() =>
    db.transaction('rw', db.plans, db.visits, async () => {
      const plan = await db.plans.get(id)
      if (!plan) throw new NotFoundError('plan', id)
      await db.plans.delete(id)
      const visit = await touchVisit(plan.visitId)
      await db.visits.put({ ...visit, pins: visit.pins.filter((pin) => pin.planId !== id) })
    }),
  )
}
