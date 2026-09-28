import { afterEach, describe, expect, it, vi } from 'vitest'
import { getStorageEstimate, requestPersistentStorage } from '@/lib/db/storage'

/** jsdom has no `navigator.storage`: define it per test. */
function stubStorage(storage: Partial<StorageManager> | undefined) {
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true })
}

describe('storage', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'storage')
  })

  it('returns false / null without error when the API is missing', async () => {
    stubStorage(undefined)
    await expect(requestPersistentStorage()).resolves.toBe(false)
    await expect(getStorageEstimate()).resolves.toBeNull()
  })

  it('requests persistence when not already persisted', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    stubStorage({ persisted: vi.fn().mockResolvedValue(false), persist })
    await expect(requestPersistentStorage()).resolves.toBe(true)
    expect(persist).toHaveBeenCalledOnce()
  })

  it('does not ask again when already persisted, and never throws', async () => {
    const persist = vi.fn()
    stubStorage({ persisted: vi.fn().mockResolvedValue(true), persist })
    await expect(requestPersistentStorage()).resolves.toBe(true)
    expect(persist).not.toHaveBeenCalled()

    stubStorage({ persist: vi.fn().mockRejectedValue(new Error('denied')) })
    await expect(requestPersistentStorage()).resolves.toBe(false)
  })

  it('computes the storage estimate', async () => {
    stubStorage({ estimate: vi.fn().mockResolvedValue({ usage: 25_000_000, quota: 100_000_000 }) })
    await expect(getStorageEstimate()).resolves.toEqual({
      usedBytes: 25_000_000,
      quotaBytes: 100_000_000,
      percent: 25,
    })
  })
})
