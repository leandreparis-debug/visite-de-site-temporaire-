import { describe, expect, it } from 'vitest'
import { setCoverPhoto, withoutPhotoRefs } from '@/features/photos/photoRefsOps'
import { deepFreeze } from '@/test/deepFreeze'
import { makeFullVisit } from '@/test/fixtures'
import type { Visit } from '@/types/visit'

function visitWithRefs(): Visit {
  const visit = makeFullVisit()
  return {
    ...visit,
    coverPhotoId: 'ph-1',
    noteSections: [
      { id: 's1', title: 'Toiture', content: '', order: 0, photoIds: ['ph-1', 'ph-2'] },
      { id: 's2', title: 'Quais', content: 'RAS', order: 1 },
    ],
    pins: [{ id: 'pin-1', planId: 'plan-1', photoId: 'ph-1', x: 0.1, y: 0.1, number: 1 }],
  }
}

describe('photoRefsOps', () => {
  it('removes every reference to deleted photos', () => {
    const visit = deepFreeze(visitWithRefs())
    const next = withoutPhotoRefs(visit, new Set(['ph-1']))
    expect(next.coverPhotoId).toBeUndefined()
    expect(next.pins).toEqual([])
    expect(next.noteSections[0]?.photoIds).toEqual(['ph-2'])
    // Untouched section: same object.
    expect(next.noteSections[1]).toBe(visit.noteSections[1])
    // Other photos: the cover stays.
    expect(withoutPhotoRefs(visit, new Set(['ph-9'])).coverPhotoId).toBe('ph-1')
  })

  it('sets and clears the cover photo', () => {
    const visit = deepFreeze(visitWithRefs())
    expect(setCoverPhoto(visit, 'ph-1')).toBe(visit)
    expect(setCoverPhoto(visit, 'ph-2').coverPhotoId).toBe('ph-2')
    expect(setCoverPhoto(visit, null)).not.toHaveProperty('coverPhotoId')
  })
})
