/**
 * Visits repository: CRUD on the `visits` table (+ cascades on photos/plans).
 * Every write is validated with Zod; errors are typed (`NotFoundError`,
 * `ValidationError`, `StorageQuotaError`, `StorageUnavailableError`).
 */
import { db } from '@/lib/db/db'
import { nowIso, todayIso } from '@/lib/dates'
import { NotFoundError, withStorageErrors } from '@/lib/errors'
import { createId } from '@/lib/id'
import { parseOrThrow } from '@/lib/validation'
import { notifyStorageChange } from '@/lib/db/storage'
import { normalizeVisit, visitSchema, type Visit, type VisitSummary } from '@/types/visit'
import { createEmptyVisit, duplicateVisitData, type NewVisitInput } from './visitFactory'

/**
 * Reads and normalizes a visit (fills fields missing from older rows).
 * Use instead of `db.visits.get` everywhere.
 */
export async function readVisit(id: string): Promise<Visit | undefined> {
  const stored = await db.visits.get(id)
  return stored && normalizeVisit(stored)
}

/**
 * Returns a timestamp strictly greater than `previous`, so that two quick
 * successive writes still get distinct, increasing `updatedAt` values.
 */
export function nextTimestamp(previous: string): string {
  const now = nowIso()
  if (now > previous) return now
  return new Date(Date.parse(previous) + 1).toISOString()
}

function countKeys(keys: readonly unknown[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const key of keys) {
    if (typeof key === 'string') counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/**
 * Lists every visit as a light summary, most recently updated first.
 * Photo counts are computed from the `visitId` index (no blob is loaded).
 */
export function listVisitSummaries(): Promise<VisitSummary[]> {
  return withStorageErrors(() =>
    db.transaction('r', db.visits, db.photos, db.plans, async () => {
      const [visits, photoVisitIds, planVisitIds] = await Promise.all([
        db.visits.orderBy('updatedAt').reverse().toArray(),
        db.photos.orderBy('visitId').keys(),
        db.plans.orderBy('visitId').keys(),
      ])
      const photoCounts = countKeys(photoVisitIds)
      const planCounts = countKeys(planVisitIds)
      return visits.map((visit) => ({
        id: visit.id,
        title: visit.title,
        kind: visit.kind,
        date: visit.date,
        siteName: visit.site.name,
        updatedAt: visit.updatedAt,
        photoCount: photoCounts.get(visit.id) ?? 0,
        planCount: planCounts.get(visit.id) ?? 0,
        pinCount: visit.pins.length,
      }))
    }),
  )
}

/** Every visit, normalized (used for field suggestions; no blob is loaded). */
export function listVisits(): Promise<Visit[]> {
  return withStorageErrors(async () => (await db.visits.toArray()).map(normalizeVisit))
}

/**
 * Loads a full visit.
 * @throws {NotFoundError} if no visit has this id.
 */
export function getVisit(id: string): Promise<Visit> {
  return withStorageErrors(async () => {
    const visit = await readVisit(id)
    if (!visit) throw new NotFoundError('visit', id)
    return visit
  })
}

/**
 * Creates and saves a new empty visit.
 * @throws {ValidationError} if the input is invalid (e.g. empty title).
 */
export function createVisit(input: NewVisitInput): Promise<Visit> {
  return withStorageErrors(async () => {
    const visit = parseOrThrow(visitSchema, createEmptyVisit(input))
    await db.visits.add(visit)
    return visit
  })
}

/**
 * Reads a visit, applies `updater`, validates and saves the result in a single
 * transaction. `id`, `schemaVersion` and `createdAt` cannot be changed;
 * `updatedAt` is refreshed. If validation fails, nothing is written.
 *
 * @param updater receives a deep copy of the visit; may mutate and/or return it.
 * @throws {NotFoundError} if the visit does not exist.
 * @throws {ValidationError} if the updated visit is invalid.
 */
export function updateVisit(id: string, updater: (visit: Visit) => Visit): Promise<Visit> {
  return withStorageErrors(() =>
    db.transaction('rw', db.visits, async () => {
      const current = await readVisit(id)
      if (!current) throw new NotFoundError('visit', id)
      const draft = updater(structuredClone(current))
      const next = parseOrThrow(visitSchema, {
        ...draft,
        id: current.id,
        schemaVersion: current.schemaVersion,
        createdAt: current.createdAt,
        updatedAt: nextTimestamp(current.updatedAt),
      })
      await db.visits.put(next)
      return next
    }),
  )
}

/**
 * Deletes a visit and, in the same transaction, all its photos and plans.
 * @throws {NotFoundError} if the visit does not exist.
 */
export function deleteVisit(id: string): Promise<void> {
  return withStorageErrors(() =>
    db
      .transaction('rw', db.visits, db.photos, db.plans, async () => {
        const existing = await db.visits.get(id)
        if (!existing) throw new NotFoundError('visit', id)
        await db.photos.where('visitId').equals(id).delete()
        await db.plans.where('visitId').equals(id).delete()
        await db.visits.delete(id)
      })
      .then(notifyStorageChange),
  )
}

/** Number of photos and plans stored for a visit (e.g. before deleting it). */
export function getVisitMediaCounts(
  id: string,
): Promise<{ photoCount: number; planCount: number }> {
  return withStorageErrors(() =>
    db.transaction('r', db.photos, db.plans, async () => ({
      photoCount: await db.photos.where('visitId').equals(id).count(),
      planCount: await db.plans.where('visitId').equals(id).count(),
    })),
  )
}

/**
 * Creates a follow-up visit dated today, titled "Copie — {title}".
 * Keeps the follow-up data and copies the plans (blobs included);
 * drops notes, photos and pins. See `duplicateVisitData` for details.
 *
 * @returns the new visit.
 * @throws {NotFoundError} if the source visit does not exist.
 */
export function duplicateVisit(id: string): Promise<Visit> {
  return withStorageErrors(() =>
    db.transaction('rw', db.visits, db.plans, async () => {
      const source = await readVisit(id)
      if (!source) throw new NotFoundError('visit', id)
      const now = nowIso()
      const copy = parseOrThrow(visitSchema, duplicateVisitData(source, todayIso(), now))
      const plans = await db.plans.where('visitId').equals(id).toArray()
      await db.visits.add(copy)
      await db.plans.bulkAdd(
        plans.map((plan) => ({ ...plan, id: createId(), visitId: copy.id, createdAt: now })),
      )
      return copy
    }),
  )
}

/**
 * Refreshes a visit's `updatedAt` (used when its photos or plans change).
 * Must be called inside a transaction that includes `db.visits`.
 */
export async function touchVisit(visitId: string): Promise<Visit> {
  const visit = await readVisit(visitId)
  if (!visit) throw new NotFoundError('visit', visitId)
  const next = { ...visit, updatedAt: nextTimestamp(visit.updatedAt) }
  await db.visits.put(next)
  return next
}
