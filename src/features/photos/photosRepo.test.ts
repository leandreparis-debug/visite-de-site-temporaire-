import { describe, expect, it } from 'vitest'
import {
  addPhoto,
  deletePhoto,
  listPhotos,
  reorderPhotos,
  updatePhotoMeta,
} from '@/features/photos/photosRepo'
import { addPlan } from '@/features/plan/plansRepo'
import { createVisit, getVisit, updateVisit } from '@/features/visits/visitsRepo'
import { db } from '@/lib/db/db'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { makePhotoInput, makePlanInput } from '@/test/fixtures'

const newVisit = () =>
  createVisit({ kind: 'meeting', title: 'Réunion', date: '2026-09-28', siteName: 'Site' })

describe('photosRepo', () => {
  it('adds photos at the end, lists them by order and keeps blobs', async () => {
    const visit = await newVisit()
    const first = await addPhoto(makePhotoInput(visit.id, { caption: 'Première' }))
    const second = await addPhoto(makePhotoInput(visit.id, { caption: 'Deuxième' }))
    expect([first.order, second.order]).toEqual([0, 1])

    const photos = await listPhotos(visit.id)
    expect(photos.map((p) => p.caption)).toEqual(['Première', 'Deuxième'])
    expect(await photos[0]?.blob.text()).toBe('photo')
    expect(await photos[0]?.thumbnailBlob.text()).toBe('thumb')
    // The blob is never stored in the visit itself.
    expect(JSON.stringify(await getVisit(visit.id))).not.toContain('photo')
  })

  it('validates input and requires an existing visit', async () => {
    const visit = await newVisit()
    await expect(addPhoto(makePhotoInput('missing'))).rejects.toBeInstanceOf(NotFoundError)
    await expect(addPhoto(makePhotoInput(visit.id, { width: 0 }))).rejects.toBeInstanceOf(
      ValidationError,
    )
    await expect(
      addPhoto({ ...makePhotoInput(visit.id), blob: 'not a blob' as unknown as Blob }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(await db.photos.count()).toBe(0)
  })

  it('updates metadata', async () => {
    const visit = await newVisit()
    const photo = await addPhoto(makePhotoInput(visit.id))
    const updated = await updatePhotoMeta(photo.id, { caption: 'Fissure', category: 'defect' })
    expect(updated).toMatchObject({ caption: 'Fissure', category: 'defect', order: 0 })
    expect((await listPhotos(visit.id))[0]).toMatchObject({
      caption: 'Fissure',
      category: 'defect',
    })
    await expect(updatePhotoMeta(photo.id, { order: -1 })).rejects.toBeInstanceOf(ValidationError)
    await expect(updatePhotoMeta('missing', { caption: 'x' })).rejects.toBeInstanceOf(NotFoundError)
  })

  it('reorders photos', async () => {
    const visit = await newVisit()
    const a = await addPhoto(makePhotoInput(visit.id, { caption: 'A' }))
    const b = await addPhoto(makePhotoInput(visit.id, { caption: 'B' }))
    const c = await addPhoto(makePhotoInput(visit.id, { caption: 'C' }))
    await reorderPhotos(visit.id, [c.id, a.id, b.id])
    expect((await listPhotos(visit.id)).map((p) => p.caption)).toEqual(['C', 'A', 'B'])

    await expect(reorderPhotos(visit.id, [a.id, b.id])).rejects.toBeInstanceOf(ValidationError)
    await expect(reorderPhotos(visit.id, [a.id, a.id, b.id])).rejects.toBeInstanceOf(
      ValidationError,
    )
  })

  it('deletePhoto removes the pins linked to it and keeps the other pins unchanged', async () => {
    const visit = await newVisit()
    const other = await newVisit()
    const plan = await addPlan(makePlanInput(visit.id))
    const kept = await addPhoto(makePhotoInput(visit.id))
    const removed = await addPhoto(makePhotoInput(visit.id))
    const pin = (id: string, photoId: string, number: number) => ({
      id,
      planId: plan.id,
      photoId,
      x: 0.1,
      y: 0.2,
      number,
    })
    await updateVisit(visit.id, (v) => ({
      ...v,
      pins: [pin('p1', removed.id, 1), pin('p2', kept.id, 2), pin('p3', removed.id, 3)],
    }))
    await updateVisit(other.id, (v) => ({ ...v, pins: [pin('o1', removed.id, 1)] }))

    await deletePhoto(removed.id)

    expect((await listPhotos(visit.id)).map((p) => p.id)).toEqual([kept.id])
    // Remaining pin keeps its number (no renumbering).
    expect((await getVisit(visit.id)).pins).toEqual([pin('p2', kept.id, 2)])
    // Another visit is not touched.
    expect((await getVisit(other.id)).pins).toHaveLength(1)
    await expect(deletePhoto(removed.id)).rejects.toBeInstanceOf(NotFoundError)
  })
})
