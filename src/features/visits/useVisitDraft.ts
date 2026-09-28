import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AppError,
  StorageQuotaError,
  StorageUnavailableError,
  toAppError,
  toUserMessage,
} from '@/lib/errors'
import type { Visit } from '@/types/visit'
import { useVisit } from './useVisits'
import { updateVisit } from './visitsRepo'

/** Autosave state, shown by `SaveStatusIndicator`. */
export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

/** A change to apply to the visit. Must be pure: it may be re-applied on fresher data. */
export type VisitUpdater = (draft: Visit) => Visit

export interface UpdateOptions {
  /**
   * Coalescing key for "set this field to this value" updates (e.g.
   * `site.code`). When the previous pending update has the same key, it is
   * replaced instead of queued: typing 200 characters keeps one pending
   * update instead of 200. Only use it when the new updater fully supersedes
   * the previous one.
   */
  coalesceKey?: string
}

interface PendingUpdate {
  run: VisitUpdater
  key?: string
}

/** Delay between the last change and the automatic save. */
export const AUTOSAVE_DELAY_MS = 800

export interface VisitDraft {
  /** Visit to display and edit (`undefined` while loading or not found). */
  draft: Visit | undefined
  /** `true` until the visit is first loaded. */
  isLoading: boolean
  /** Applies a change locally right away; saved 800 ms after the last change. */
  update: (updater: VisitUpdater, options?: UpdateOptions) => void
  status: SaveStatus
  /** Load error (`NotFoundError`…) or last save error. */
  error: unknown
  /**
   * Saves pending changes immediately. Never rejects (errors go to `status`).
   * Resolves to `true` when nothing is left unsaved.
   */
  flush: () => Promise<boolean>
  /** Drops pending changes without saving (e.g. right before deleting the visit). */
  discard: () => void
}

/** Keeps the most recent of two versions of the same visit. */
function newest(a: Visit | undefined, b: Visit | undefined): Visit | undefined {
  if (!a) return b
  if (!b) return a
  return b.updatedAt > a.updatedAt ? b : a
}

function applyAll(base: Visit, updates: readonly PendingUpdate[]): Visit {
  return updates.reduce((visit, update) => update.run(visit), structuredClone(base))
}

/**
 * Local draft of a visit with debounced autosave. The building block of every
 * editing screen.
 *
 * **Strategy: the local draft wins while it has unsaved changes.**
 * - Changes are kept as a queue of pending `updater` functions. The draft shown
 *   is `pending updaters` applied to the latest known version of the visit.
 * - Saving (800 ms after the last `update`, or on `flush`) replays the pending
 *   updaters inside `visitsRepo.updateVisit`, on the version currently in the
 *   database. Changes made meanwhile by other actions (e.g. a deleted photo
 *   removing its pins) are therefore kept, and a field being typed never
 *   jumps back: its updater is re-applied on top of any fresher data.
 * - When nothing is pending, the draft simply follows the database (live query).
 * - `flush` is called automatically on unmount, `pagehide` and when the page
 *   becomes hidden; callers also flush on tab change and before navigating.
 *   `beforeunload` warns while changes are pending.
 * - On error (validation, storage), the status becomes `error`, a French toast
 *   is shown, pending changes are kept, and nothing is retried until the next
 *   `update` or an explicit `flush` ("Réessayer").
 * - `updatedAt` is handled by the repository.
 *
 * Saves are serialized: at most one `updateVisit` runs at a time.
 * Use one hook instance per visit id (render the editor with `key={id}`).
 */
export function useVisitDraft(id: string): VisitDraft {
  const live = useVisit(id)
  const [lastSaved, setLastSaved] = useState<Visit | undefined>(undefined)
  const [pending, setPending] = useState<readonly PendingUpdate[]>([])
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<unknown>(undefined)

  // Mirrors for callbacks / event listeners (never read during render).
  const pendingRef = useRef<readonly PendingUpdate[]>([])
  const savingRef = useRef(false)
  /** Number of pending updates currently being written (never coalesced). */
  const inFlightRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const chainRef = useRef<Promise<unknown>>(Promise.resolve())

  const base = newest(live.data, lastSaved)
  const draft = useMemo(
    () => (base && pending.length > 0 ? applyAll(base, pending) : base),
    [base, pending],
  )

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) clearTimeout(timerRef.current)
    timerRef.current = undefined
  }, [])

  /** One save attempt of everything pending at the time it runs. */
  const saveNow = useCallback(async (): Promise<boolean> => {
    clearTimer()
    const batch = pendingRef.current
    if (batch.length === 0) return true
    savingRef.current = true
    inFlightRef.current = batch.length
    setStatus('saving')
    try {
      const saved = await updateVisit(id, (current) =>
        batch.reduce((v, update) => update.run(v), current),
      )
      // Updaters added while saving stay pending.
      pendingRef.current = pendingRef.current.slice(batch.length)
      setPending(pendingRef.current)
      setLastSaved(saved)
      setSaveError(undefined)
      setStatus(pendingRef.current.length > 0 ? 'dirty' : 'saved')
      return pendingRef.current.length === 0
    } catch (caught) {
      const error = toAppError(caught)
      console.error('[autosave] Save failed:', caught)
      setSaveError(error)
      setStatus('error')
      const isStorageError =
        error instanceof StorageQuotaError || error instanceof StorageUnavailableError
      toast.error('Erreur d’enregistrement', {
        description: isStorageError
          ? `${toUserMessage(error)} Générez dès que possible le rapport Word de cette visite : c’est sa seule copie durable.`
          : toUserMessage(error),
        duration: error instanceof AppError ? 10_000 : undefined,
      })
      return false
    } finally {
      savingRef.current = false
      inFlightRef.current = 0
    }
  }, [id, clearTimer])

  const flush = useCallback((): Promise<boolean> => {
    clearTimer()
    if (pendingRef.current.length > 0) setStatus('saving')
    // Serialize: wait for the running save, then save what is still pending.
    const next = chainRef.current.then(saveNow)
    chainRef.current = next.then(() => undefined)
    return next
  }, [clearTimer, saveNow])

  const discard = useCallback(() => {
    clearTimer()
    pendingRef.current = []
    setPending([])
    setSaveError(undefined)
    setStatus('idle')
  }, [clearTimer])

  // After a successful save, changes queued meanwhile are saved on schedule.
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  const update = useCallback(
    (updater: VisitUpdater, options: UpdateOptions = {}) => {
      const queue = pendingRef.current
      const last = queue[queue.length - 1]
      const entry: PendingUpdate = { run: updater, key: options.coalesceKey }
      pendingRef.current =
        options.coalesceKey !== undefined &&
        last?.key === options.coalesceKey &&
        queue.length > inFlightRef.current
          ? [...queue.slice(0, -1), entry]
          : [...queue, entry]
      setPending(pendingRef.current)
      setStatus('dirty')
      clearTimer()
      timerRef.current = setTimeout(() => {
        timerRef.current = undefined
        void flushRef.current()
      }, AUTOSAVE_DELAY_MS)
    },
    [clearTimer],
  )

  // Changes queued during a save: schedule them like a regular update.
  useEffect(() => {
    if (status === 'dirty' && timerRef.current === undefined && !savingRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = undefined
        void flushRef.current()
      }, AUTOSAVE_DELAY_MS)
    }
  }, [status])

  // Save when leaving: unmount, page hidden / closed.
  useEffect(() => {
    const onHide = () => {
      void flushRef.current()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') onHide()
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (pendingRef.current.length > 0 || savingRef.current) {
        void flushRef.current()
        // Shows the browser's native "leave site?" prompt (Chrome/Edge ≥ 119).
        event.preventDefault()
      }
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
      void flushRef.current()
    }
  }, [])

  return {
    draft,
    isLoading: live.isLoading && !lastSaved,
    update,
    status,
    error: saveError ?? (draft ? undefined : live.error),
    flush,
    discard,
  }
}
