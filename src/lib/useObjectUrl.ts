import { useEffect, useState } from 'react'

/**
 * Creates an object URL (`blob:`) for a Blob and revokes it when the blob
 * changes or the component unmounts. This is the ONLY place where object
 * URLs should be created for display, to avoid memory leaks.
 *
 * @returns the URL, or `null` while none is available (no blob, first render).
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [entry, setEntry] = useState<{ blob: Blob; url: string } | null>(null)

  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    // Syncing with an external resource (object URL lifetime) is exactly what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntry({ blob, url })
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [blob])

  // Never return a URL created for a previous blob (it may already be revoked).
  return blob && entry?.blob === blob ? entry.url : null
}
