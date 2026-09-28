/**
 * Generates a random RFC 4122 version 4 UUID.
 *
 * Uses `crypto.randomUUID()` when available, otherwise builds one from
 * `crypto.getRandomValues()` (e.g. non-secure contexts).
 */
export function createId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return uuidFromRandomValues()
}

/** Fallback UUID v4 built from `crypto.getRandomValues()`. Exported for tests. */
export function uuidFromRandomValues(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  // Per RFC 4122 §4.4: version 4 and variant 10xx.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
