import { toast } from 'sonner'
import { recordAppOpened } from '@/lib/db/meta'
import { requestPersistentStorage } from '@/lib/db/storage'
import { toUserMessage } from '@/lib/errors'

/**
 * Non-blocking storage initialization, run once at startup:
 * asks for persistent storage, then checks that IndexedDB works.
 * On failure, logs the error and shows a French toast (never throws).
 */
export async function initStorage(): Promise<void> {
  await requestPersistentStorage()
  try {
    await recordAppOpened()
  } catch (error) {
    console.error('[storage] IndexedDB check failed:', error)
    toast.error('Stockage indisponible', { description: toUserMessage(error), duration: Infinity })
  }
}
