import { describe, expect, it, vi } from 'vitest'
import { initStorage } from '@/app/initStorage'
import { db } from '@/lib/db/db'
import { getMeta, recordAppOpened, setMeta } from '@/lib/db/meta'
import { StorageUnavailableError, ValidationError } from '@/lib/errors'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

describe('meta', () => {
  it('stores and reads validated values', async () => {
    expect(await getMeta('lastExportAt')).toBeUndefined()
    await setMeta('lastExportAt', '2026-09-28T10:00:00.000Z')
    expect(await getMeta('lastExportAt')).toBe('2026-09-28T10:00:00.000Z')
    await expect(setMeta('lastExportAt', 'hier')).rejects.toBeInstanceOf(ValidationError)
  })

  it('recordAppOpened writes lastOpenedAt', async () => {
    await recordAppOpened()
    expect(await getMeta('lastOpenedAt')).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('initStorage reports an unavailable IndexedDB with a French toast', async () => {
    const { toast } = await import('sonner')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(db.meta, 'put').mockRejectedValueOnce(
      Object.assign(new Error('no idb'), { name: 'MissingAPIError' }),
    )
    await initStorage()
    expect(toast.error).toHaveBeenCalledWith('Stockage indisponible', {
      description: new StorageUnavailableError().userMessage,
      duration: Infinity,
    })
    vi.restoreAllMocks()
  })
})
