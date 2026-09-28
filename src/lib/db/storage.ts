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

type StorageListener = () => void
const storageListeners = new Set<StorageListener>()

/**
 * Subscribes to "stored data was freed" notifications (deletions), e.g. to
 * refresh the storage usage display.
 * @returns an unsubscribe function.
 */
export function onStorageChange(listener: StorageListener): () => void {
  storageListeners.add(listener)
  return () => {
    storageListeners.delete(listener)
  }
}

/** Notifies `onStorageChange` subscribers. Called by repositories after deletions. */
export function notifyStorageChange(): void {
  for (const listener of storageListeners) listener()
}

const sizeFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

/**
 * Formats a byte count in French units (base 1024).
 * @example formatStorageSize(13_002_342) // "12,4 Mo"
 */
export function formatStorageSize(bytes: number): string {
  const units = ['octets', 'Ko', 'Mo', 'Go', 'To']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${sizeFormatter.format(unit === 0 ? Math.round(value) : value)}\u00a0${units[unit] ?? ''}`
}
