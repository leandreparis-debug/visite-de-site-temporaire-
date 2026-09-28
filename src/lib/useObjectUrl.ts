import { useEffect, useState } from 'react'

/** Delay before revoking an object URL nobody uses anymore. */
export const REVOKE_DELAY_MS = 1000

interface CachedUrl {
  url: string
  users: number
  revokeTimer?: ReturnType<typeof setTimeout>
}

/** One object URL per Blob, shared by every component displaying it. */
const cache = new Map<Blob, CachedUrl>()

function acquire(blob: Blob): string {
  let entry = cache.get(blob)
  if (!entry) {
    entry = { url: URL.createObjectURL(blob), users: 0 }
    cache.set(blob, entry)
  }
  if (entry.revokeTimer !== undefined) clearTimeout(entry.revokeTimer)
  entry.revokeTimer = undefined
  entry.users++
  return entry.url
}

function release(blob: Blob): void {
  const entry = cache.get(blob)
  if (!entry) return
  entry.users--
  if (entry.users > 0) return
  // Deferred: when the same blob moves from one component to another (e.g.
  // the preloaded "next" photo becoming the current one), the URL is reused
  // instead of being revoked while an <img> may still be loading it.
  entry.revokeTimer = setTimeout(() => {
    URL.revokeObjectURL(entry.url)
    cache.delete(blob)
  }, REVOKE_DELAY_MS)
}

/**
 * Object URL (`blob:`) for a Blob, revoked once no component uses it anymore
 * (unmount or blob change, after a short delay). This is the ONLY place where
 * object URLs should be created for display, to avoid memory leaks.
 *
 * @returns the URL, or `null` while none is available (no blob, first render).
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [entry, setEntry] = useState<{ blob: Blob; url: string } | null>(null)

  useEffect(() => {
    if (!blob) return
    const url = acquire(blob)
    // Syncing with an external resource (object URL lifetime) is exactly what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntry({ blob, url })
    return () => {
      release(blob)
    }
  }, [blob])

  // Never return a URL created for a previous blob (it may already be revoked).
  return blob && entry?.blob === blob ? entry.url : null
}
