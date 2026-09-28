import { afterEach, describe, expect, it, vi } from 'vitest'
import { addPhoto, listPhotos } from '@/features/photos/photosRepo'
import { addPlan, listPlans } from '@/features/plan/plansRepo'
import {
  createVisit,
  deleteVisit,
  duplicateVisit,
  getVisit,
  listVisitSummaries,
  nextTimestamp,
  updateVisit,
} from '@/features/visits/visitsRepo'
import { db } from '@/lib/db/db'
import { todayIso } from '@/lib/dates'
import { NotFoundError, StorageQuotaError, ValidationError } from '@/lib/errors'
import { makeFullVisit, makePhotoInput, makePlanInput } from '@/test/fixtures'
import type { Visit } from '@/types/visit'

const newVisit = (title = 'Visite Lyon') =>
  createVisit({ kind: 'technical_visit', title, date: '2026-09-28', siteName: 'Entrepôt Lyon' })

/** Stores a fully populated visit directly (bypassing the factory). */
async function seedFullVisit(overrides: Partial<Visit> = {}): Promise<Visit> {
  const created = await newVisit()
  return updateVisit(created.id, () => ({ ...makeFullVisit(overrides), id: created.id }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('visitsRepo — create / get / update', () => {
  it('creates, reads and updates a visit (updatedAt changes)', async () => {
    const created = await newVisit()
    expect(created.schemaVersion).toBe(1)
    expect(created.site).toEqual({ name: 'Entrepôt Lyon' })
    expect(created.createdAt).toBe(created.updatedAt)

    expect(await getVisit(created.id)).toEqual(created)

    const updated = await updateVisit(created.id, (v) => ({ ...v, title: 'Visite Lyon — suite' }))
    expect(updated.title).toBe('Visite Lyon — suite')
    expect(updated.updatedAt > created.updatedAt).toBe(true)
    expect(updated.createdAt).toBe(created.createdAt)
    expect(await getVisit(created.id)).toEqual(updated)
  })

  it('protects id, schemaVersion and createdAt from the updater', async () => {
    const created = await newVisit()
    const updated = await updateVisit(created.id, (v) => ({
      ...v,
      id: 'other',
      createdAt: '2000-01-01T00:00:00.000Z',
    }))
    expect(updated.id).toBe(created.id)
    expect(updated.createdAt).toBe(created.createdAt)
    expect(await db.visits.count()).toBe(1)
  })

  it('rejects invalid creation input', async () => {
    await expect(newVisit('')).rejects.toBeInstanceOf(ValidationError)
    expect(await db.visits.count()).toBe(0)
  })

  it('throws NotFoundError for an unknown id', async () => {
    await expect(getVisit('missing')).rejects.toBeInstanceOf(NotFoundError)
    await expect(updateVisit('missing', (v) => v)).rejects.toBeInstanceOf(NotFoundError)
    await expect(deleteVisit('missing')).rejects.toBeInstanceOf(NotFoundError)
    await expect(duplicateVisit('missing')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws ValidationError on invalid update and leaves the database unchanged', async () => {
    const created = await newVisit()
    const error = await updateVisit(created.id, (v) => ({ ...v, title: '' })).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).issues[0]?.field).toBe('Titre')
    expect(await getVisit(created.id)).toEqual(created)
  })

  it('does not persist mutations made by an updater that then fails validation', async () => {
    const created = await newVisit()
    await expect(
      updateVisit(created.id, (v) => {
        v.site.name = 'Modifié'
        v.date = 'invalide'
        return v
      }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect((await getVisit(created.id)).site.name).toBe('Entrepôt Lyon')
  })

  it('maps a quota error during a write to StorageQuotaError', async () => {
    const created = await newVisit()
    vi.spyOn(db.visits, 'put').mockRejectedValue(new DOMException('full', 'QuotaExceededError'))
    await expect(updateVisit(created.id, (v) => v)).rejects.toBeInstanceOf(StorageQuotaError)
  })

  it('nextTimestamp is strictly increasing even within the same millisecond', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(nextTimestamp(future) > future).toBe(true)
  })
})

describe('visitsRepo — listVisitSummaries', () => {
  it('returns light summaries sorted by updatedAt desc with correct counts', async () => {
    const a = await newVisit('A')
    const b = await seedFullVisit()
    const c = await newVisit('C')
    await addPhoto(makePhotoInput(b.id))
    await addPhoto(makePhotoInput(b.id))
    await addPhoto(makePhotoInput(c.id))
    // Touch A last so it becomes the most recent.
    await updateVisit(a.id, (v) => ({ ...v, title: 'A bis' }))

    const summaries = await listVisitSummaries()
    expect(summaries.map((s) => s.id)).toEqual([a.id, c.id, b.id])
    expect(summaries[0]).toEqual({
      id: a.id,
      title: 'A bis',
      kind: 'technical_visit',
      date: '2026-09-28',
      siteName: 'Entrepôt Lyon',
      updatedAt: (await getVisit(a.id)).updatedAt,
      photoCount: 0,
      pinCount: 0,
    })
    expect(summaries.find((s) => s.id === b.id)).toMatchObject({
      photoCount: 2,
      pinCount: 1,
      siteName: 'Entrepôt Lyon Nord',
    })
    expect(summaries.find((s) => s.id === c.id)).toMatchObject({ photoCount: 1, pinCount: 0 })
  })

  it('returns an empty list when there is no visit', async () => {
    expect(await listVisitSummaries()).toEqual([])
  })
})

describe('visitsRepo — deleteVisit', () => {
  it('cascades to the visit photos and plans only', async () => {
    const target = await newVisit('À supprimer')
    const other = await newVisit('À garder')
    await addPhoto(makePhotoInput(target.id))
    await addPlan(makePlanInput(target.id))
    const keptPhoto = await addPhoto(makePhotoInput(other.id))
    const keptPlan = await addPlan(makePlanInput(other.id))

    await deleteVisit(target.id)

    await expect(getVisit(target.id)).rejects.toBeInstanceOf(NotFoundError)
    expect(await db.photos.where('visitId').equals(target.id).count()).toBe(0)
    expect(await db.plans.where('visitId').equals(target.id).count()).toBe(0)
    expect((await listPhotos(other.id)).map((p) => p.id)).toEqual([keptPhoto.id])
    expect((await listPlans(other.id)).map((p) => p.id)).toEqual([keptPlan.id])
    expect(await db.visits.count()).toBe(1)
  })
})

describe('visitsRepo — duplicateVisit', () => {
  it('keeps follow-up data, drops notes / photos / pins, copies plans with new ids', async () => {
    const source = await seedFullVisit()
    await addPhoto(makePhotoInput(source.id))
    const sourcePlan = await addPlan(makePlanInput(source.id, { name: 'Bâtiment A' }))
    await addPlan(makePlanInput(source.id, { name: 'Bâtiment B' }))
    const sourceAfter = await getVisit(source.id)

    const copy = await duplicateVisit(source.id)

    // Identity and header
    expect(copy.id).not.toBe(source.id)
    expect(copy.title).toBe('Copie — Visite entrepôt Lyon')
    expect(copy.date).toBe(todayIso())
    expect(copy.schemaVersion).toBe(1)
    expect(copy.site).toEqual(source.site)

    // Kept, with new ids
    expect(copy.participants.map((p) => p.name)).toEqual(['Jeanne Martin', 'Paul Durand'])
    expect(copy.participants.every((p) => !p.present)).toBe(true)
    expect(copy.attentionPoints.map((p) => p.text)).toEqual([
      'Reprendre l’étanchéité',
      'Vérifier les sprinklers',
    ])
    expect(copy.doClaims).toHaveLength(1)
    expect(copy.doClaims[0]).toMatchObject({
      reference: 'DO-2026-001',
      claimedAmountCents: 1_500_000,
    })
    expect(copy.doClaims[0]?.steps.map((s) => s.type)).toEqual(['declaration', 'expertise'])
    expect(copy.insurances.map((i) => i.insurer)).toEqual(['Assureur SA'])
    expect(copy.projects.map((p) => p.name)).toEqual(['Réfection toiture', 'Mise aux normes quais'])
    expect(copy.costs.map((c) => c.label)).toEqual(['Devis couvreur', 'Étude structure'])

    // Not kept
    expect(copy.noteSections).toEqual([])
    expect(copy.pins).toEqual([])
    expect(await listPhotos(copy.id)).toEqual([])

    // All ids are new
    const sourceIds = new Set([
      source.id,
      ...source.participants.map((x) => x.id),
      ...source.attentionPoints.map((x) => x.id),
      ...source.doClaims.flatMap((x) => [x.id, ...x.steps.map((s) => s.id)]),
      ...source.insurances.map((x) => x.id),
      ...source.projects.map((x) => x.id),
      ...source.costs.map((x) => x.id),
    ])
    const copyIds = [
      copy.id,
      ...copy.participants.map((x) => x.id),
      ...copy.attentionPoints.map((x) => x.id),
      ...copy.doClaims.flatMap((x) => [x.id, ...x.steps.map((s) => s.id)]),
      ...copy.insurances.map((x) => x.id),
      ...copy.projects.map((x) => x.id),
      ...copy.costs.map((x) => x.id),
    ]
    expect(copyIds.filter((id) => sourceIds.has(id))).toEqual([])
    expect(new Set(copyIds).size).toBe(copyIds.length)

    // cost.projectId remapped to the new project id
    const roofProject = copy.projects.find((p) => p.name === 'Réfection toiture')
    expect(copy.costs[0]?.projectId).toBe(roofProject?.id)
    expect(copy.costs[1]?.projectId).toBeUndefined()

    // Plans copied (new ids, same content)
    const copiedPlans = await listPlans(copy.id)
    expect(copiedPlans.map((p) => p.name)).toEqual(['Bâtiment A', 'Bâtiment B'])
    expect(copiedPlans.every((p) => p.id !== sourcePlan.id)).toBe(true)
    expect(await copiedPlans[0]?.blob.text()).toBe('plan')

    // Source untouched
    expect(await getVisit(source.id)).toEqual(sourceAfter)
    expect(await listPlans(source.id)).toHaveLength(2)
    expect(await listPhotos(source.id)).toHaveLength(1)
  })

  it('truncates the copy title to 200 characters', async () => {
    const created = await newVisit('x'.repeat(200))
    const copy = await duplicateVisit(created.id)
    expect(copy.title).toHaveLength(200)
    expect(copy.title.startsWith('Copie — ')).toBe(true)
  })
})
