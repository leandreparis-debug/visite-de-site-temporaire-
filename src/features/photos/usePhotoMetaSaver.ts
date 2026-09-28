import { useCallback, useEffect, useRef, useState } from 'react'
import { toAppError } from '@/lib/errors'
import type { Photo, PhotoCategory } from '@/types/media'
import { updatePhotoMeta } from './photosRepo'

/** Delay between the last keystroke and the save of a caption. */
export const PHOTO_META_DELAY_MS = 600

type Field = 'caption' | 'category'
type Status = 'pending' | 'saving' | 'saved' | 'error'

interface Entry {
  value: string
  status: Status
  error?: unknown
}

const keyOf = (photoId: string, field: Field) => `${photoId}:${field}`

/**
 * Saves photo metadata (caption, category) directly through `photosRepo`
 * (photos live in their own table, not in the visit draft).
 *
 * - `set` keeps the typed value and saves it 600 ms after the last change,
 *   per photo and per field (`immediate: true` for selects).
 * - `flush` saves right away (called on blur, when closing the viewer, on
 *   `pagehide` and on unmount).
 * - A failed save keeps the value, marks the photo in error (`errorOf`) and
 *   is retried by `flush(photoId)` ("Réessayer").
 * - `valueOf` returns what to display: the value being saved, or the stored one.
 */
export function usePhotoMetaSaver() {
  const [entries, setEntries] = useState<Readonly<Record<string, Entry>>>({})
  const valuesRef = useRef(new Map<string, string>())
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const setEntry = useCallback((key: string, entry: Entry) => {
    setEntries((current) => ({ ...current, [key]: entry }))
  }, [])

  const saveKey = useCallback(
    async (key: string) => {
      const timer = timersRef.current.get(key)
      if (timer !== undefined) clearTimeout(timer)
      timersRef.current.delete(key)
      const value = valuesRef.current.get(key)
      if (value === undefined) return
      const [photoId, field] = key.split(':') as [string, Field]
      setEntry(key, { value, status: 'saving' })
      try {
        await updatePhotoMeta(
          photoId,
          field === 'caption' ? { caption: value } : { category: value as PhotoCategory },
        )
        // A newer value typed during the save stays pending.
        if (valuesRef.current.get(key) === value) {
          valuesRef.current.delete(key)
          setEntry(key, { value, status: 'saved' })
        }
      } catch (caught) {
        console.error('[photos] Metadata save failed:', caught)
        setEntry(key, { value, status: 'error', error: toAppError(caught) })
      }
    },
    [setEntry],
  )

  const flush = useCallback(
    async (photoId?: string) => {
      const keys = [...valuesRef.current.keys()].filter(
        (key) => photoId === undefined || key.startsWith(`${photoId}:`),
      )
      await Promise.all(keys.map(saveKey))
    },
    [saveKey],
  )

  const set = useCallback(
    (photoId: string, field: Field, value: string, options: { immediate?: boolean } = {}) => {
      const key = keyOf(photoId, field)
      valuesRef.current.set(key, value)
      setEntry(key, { value, status: 'pending' })
      const timer = timersRef.current.get(key)
      if (timer !== undefined) clearTimeout(timer)
      if (options.immediate) {
        void saveKey(key)
      } else {
        timersRef.current.set(
          key,
          setTimeout(() => void saveKey(key), PHOTO_META_DELAY_MS),
        )
      }
    },
    [saveKey, setEntry],
  )

  // Save on page hide and unmount.
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  }, [flush])
  useEffect(() => {
    const onHide = () => void flushRef.current()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      onHide()
    }
  }, [])

  const valueOf = useCallback(
    (photo: Photo, field: Field): string => {
      const entry = entries[keyOf(photo.id, field)]
      const stored = photo[field]
      // Keep showing the saved value until the live query brings it back.
      if (!entry || (entry.status === 'saved' && entry.value === stored)) return stored
      return entry.value
    },
    [entries],
  )

  const errorOf = useCallback(
    (photoId: string): unknown =>
      entries[keyOf(photoId, 'caption')]?.error ?? entries[keyOf(photoId, 'category')]?.error,
    [entries],
  )

  return { set, flush, valueOf, errorOf }
}

export type PhotoMetaSaver = ReturnType<typeof usePhotoMetaSaver>
