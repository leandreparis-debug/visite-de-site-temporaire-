/**
 * Photos repository. Blobs are stored in the `photos` table, never in the visit.
 * Image processing (resize, thumbnail) is done by the caller (step 5).
 */
import { Dexie } from 'dexie'
import * as z from 'zod/mini'
import { touchVisit } from '@/features/visits/visitsRepo'
import { db } from '@/lib/db/db'
import { nowIso } from '@/lib/dates'
import { NotFoundError, ValidationError, withStorageErrors } from '@/lib/errors'
import { createId } from '@/lib/id'
import { parseOrThrow } from '@/lib/validation'
import { photoSchema, type Photo } from '@/types/media'

/** Data required to add a photo; `order` defaults to the end of the list. */
export type NewPhotoInput = Omit<Photo, 'id' | 'createdAt' | 'order'> & { order?: number }

/** Editable photo metadata. */
export type PhotoMetaPatch = Partial<Pick<Photo, 'caption' | 'category' | 'order'>>

const photoMetaPatchSchema = z.partial(
  z.pick(photoSchema, { caption: true, category: true, order: true }),
)

function photosOfVisit(visitId: string) {
  return db.photos
    .where('[visitId+order]')
    .between([visitId, Dexie.minKey], [visitId, Dexie.maxKey])
}

/**
 * Adds an already-processed photo to a visit.
 * @throws {NotFoundError} if the visit does not exist.
 * @throws {ValidationError} if the data is invalid.
 */
export function addPhoto(input: NewPhotoInput): Promise<Photo> {
  return withStorageErrors(() =>
    db.transaction('rw', db.photos, db.visits, async () => {
      await touchVisit(input.visitId)
      const last = await photosOfVisit(input.visitId).last()
      const photo = parseOrThrow(photoSchema, {
        ...input,
        id: createId(),
        order: input.order ?? (last ? last.order + 1 : 0),
        createdAt: nowIso(),
      })
      await db.photos.add(photo)
      return photo
    }),
  )
}

/** Photos of a visit, sorted by `order`. */
export function listPhotos(visitId: string): Promise<Photo[]> {
  return withStorageErrors(() => photosOfVisit(visitId).toArray())
}

/**
 * Updates a photo's caption, category and/or order.
 * @throws {NotFoundError} if the photo does not exist.
 * @throws {ValidationError} if the patch is invalid.
 */
export function updatePhotoMeta(id: string, patch: PhotoMetaPatch): Promise<Photo> {
  return withStorageErrors(() =>
    db.transaction('rw', db.photos, db.visits, async () => {
      const photo = await db.photos.get(id)
      if (!photo) throw new NotFoundError('photo', id)
      const changes = parseOrThrow(photoMetaPatchSchema, patch)
      const next = { ...photo, ...changes }
      await db.photos.put(next)
      await touchVisit(photo.visitId)
      return next
    }),
  )
}

/**
 * Deletes a photo and, in the same transaction, the visit's pins that
 * reference it. Other pin numbers are left unchanged.
 * @throws {NotFoundError} if the photo does not exist.
 */
export function deletePhoto(id: string): Promise<void> {
  return withStorageErrors(() =>
    db.transaction('rw', db.photos, db.visits, async () => {
      const photo = await db.photos.get(id)
      if (!photo) throw new NotFoundError('photo', id)
      await db.photos.delete(id)
      const visit = await touchVisit(photo.visitId)
      await db.visits.put({ ...visit, pins: visit.pins.filter((pin) => pin.photoId !== id) })
    }),
  )
}

/**
 * Sets the photo order of a visit. `orderedIds` must contain exactly the ids
 * of the visit's photos.
 * @throws {ValidationError} if the list does not match the visit's photos.
 */
export function reorderPhotos(visitId: string, orderedIds: readonly string[]): Promise<void> {
  return withStorageErrors(() =>
    db.transaction('rw', db.photos, db.visits, async () => {
      const photos = await db.photos.where('visitId').equals(visitId).toArray()
      const expected = new Set(photos.map((p) => p.id))
      const given = new Set(orderedIds)
      if (
        given.size !== orderedIds.length ||
        given.size !== expected.size ||
        orderedIds.some((photoId) => !expected.has(photoId))
      ) {
        throw new ValidationError([
          {
            path: 'orderedIds',
            field: 'Ordre des photos',
            message: 'La liste ne correspond pas aux photos de la visite',
          },
        ])
      }
      await Promise.all(orderedIds.map((photoId, order) => db.photos.update(photoId, { order })))
      await touchVisit(visitId)
    }),
  )
}
