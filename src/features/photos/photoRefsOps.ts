/**
 * Pure operations on the references a visit holds to its photos: pins,
 * photos linked to note sections, cover photo. Photos live in their own
 * table; these references must follow when photos are deleted.
 */
import type { Visit } from '@/types/visit'

/** Removes every reference to the given photos (pins, note sections, cover). */
export function withoutPhotoRefs(visit: Visit, photoIds: ReadonlySet<string>): Visit {
  const { coverPhotoId, ...rest } = visit
  return {
    ...rest,
    ...(coverPhotoId !== undefined && !photoIds.has(coverPhotoId) && { coverPhotoId }),
    pins: visit.pins.filter((pin) => !photoIds.has(pin.photoId)),
    noteSections: visit.noteSections.map((section) =>
      section.photoIds?.some((id) => photoIds.has(id))
        ? { ...section, photoIds: section.photoIds.filter((id) => !photoIds.has(id)) }
        : section,
    ),
  }
}

/** Sets (or clears, with `null`) the photo shown on the report cover. */
export function setCoverPhoto(visit: Visit, photoId: string | null): Visit {
  const { coverPhotoId, ...rest } = visit
  if ((coverPhotoId ?? null) === photoId) return visit
  return photoId === null ? rest : { ...rest, coverPhotoId: photoId }
}
