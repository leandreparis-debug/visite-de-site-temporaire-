import { afterEach, describe, expect, it, vi } from 'vitest'
import { createId, uuidFromRandomValues } from '@/lib/id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('createId', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns unique v4 UUIDs', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createId()))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(UUID_V4)
  })

  it('falls back to getRandomValues when randomUUID is unavailable', () => {
    const original = crypto
    vi.stubGlobal('crypto', {
      getRandomValues: (array: Uint8Array<ArrayBuffer>) => original.getRandomValues(array),
    })
    expect(createId()).toMatch(UUID_V4)
    expect(uuidFromRandomValues()).toMatch(UUID_V4)
  })
})
