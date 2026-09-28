/** Browser storage persistence and quota helpers (StorageManager API). */

/** `navigator.storage` is missing in some contexts (old browsers, non-secure origins). */
function storageManager(): StorageManager | undefined {
  if (typeof navigator === 'undefined') return undefined
  const storage: StorageManager | undefined = navigator.storage
  return storage
}

/**
 * Asks the browser to keep this site's data even under storage pressure
 * (otherwise IndexedDB is "best effort" and may be evicted).
 *
 * @returns `true` if storage is (now) persistent; `false` if refused or if the
 * API is unavailable. Never throws.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const storage = storageManager()
    if (typeof storage?.persist !== 'function') return false
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return true
    return await storage.persist()
  } catch {
    return false
  }
}

/** Storage usage for this origin. */
export interface StorageEstimate {
  usedBytes: number
  quotaBytes: number
  /** Used share of the quota, 0–100 (rounded to one decimal). */
  percent: number
}

/**
 * Current storage usage and quota.
 * @returns `null` if the API is not supported or fails.
 */
export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  try {
    const storage = storageManager()
    if (typeof storage?.estimate !== 'function') return null
    const { usage = 0, quota = 0 } = await storage.estimate()
    const percent = quota > 0 ? Math.round((usage / quota) * 1000) / 10 : 0
    return { usedBytes: usage, quotaBytes: quota, percent }
  } catch {
    return null
  }
}
