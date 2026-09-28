import { useLiveQuery } from 'dexie-react-hooks'
import { toAppError } from '@/lib/errors'

/** State returned by the reactive data hooks. */
export interface LiveResult<T> {
  /** Last loaded value; `undefined` while loading or on error. */
  data: T | undefined
  /** `true` until the first result for the current key is available. */
  isLoading: boolean
  /** Typed error (e.g. `NotFoundError`), or `undefined`. */
  error: unknown
}

type Outcome<T> = { key: string; ok: true; value: T } | { key: string; ok: false; error: unknown }

/**
 * Reactive IndexedDB query (re-runs automatically when the queried tables change).
 *
 * Unlike raw `useLiveQuery`, errors are returned instead of being thrown during
 * render, and results for a previous `key` are never returned for a new one.
 *
 * @param key identifies the query (e.g. the visit id); part of the deps.
 */
export function useLiveResult<T>(querier: () => Promise<T>, key: string): LiveResult<T> {
  const outcome = useLiveQuery<Outcome<T>>(
    async () => {
      try {
        return { key, ok: true, value: await querier() }
      } catch (error) {
        return { key, ok: false, error: toAppError(error) }
      }
    },
    // The querier is recreated on each render; `key` captures what it depends on.
    [key],
  )

  if (!outcome || outcome.key !== key) return { data: undefined, isLoading: true, error: undefined }
  return outcome.ok
    ? { data: outcome.value, isLoading: false, error: undefined }
    : { data: undefined, isLoading: false, error: outcome.error }
}
