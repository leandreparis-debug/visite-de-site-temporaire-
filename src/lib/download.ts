/** Delay before revoking the object URL of a download. */
const REVOKE_AFTER_MS = 60_000

/**
 * Saves a Blob as a file with the given name (`<a download>` on a `blob:` URL).
 * Works in `file://` in Chrome/Edge, accented names included.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, REVOKE_AFTER_MS)
}
