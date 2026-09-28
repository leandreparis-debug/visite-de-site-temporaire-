/** Technical key/value metadata stored in the `meta` table. */
import * as z from 'zod/mini'
import { db } from '@/lib/db/db'
import { nowIso } from '@/lib/dates'
import { withStorageErrors } from '@/lib/errors'
import { parseOrThrow } from '@/lib/validation'
import { timestampSchema } from '@/types/common'

/** Known metadata keys and the schema of their value. */
export const metaSchemas = {
  /** Last time the tool was opened on this computer. */
  lastOpenedAt: timestampSchema,
  /** Last export of a visit file (step 9). */
  lastExportAt: timestampSchema,
} as const

export type MetaKey = keyof typeof metaSchemas
export type MetaValue<K extends MetaKey> = z.output<(typeof metaSchemas)[K]>

const metaEntrySchema = z.object({ key: z.string().check(z.minLength(1)), value: z.unknown() })

/**
 * Reads a metadata value.
 * @returns the value, or `undefined` if absent or no longer valid.
 */
export function getMeta<K extends MetaKey>(key: K): Promise<MetaValue<K> | undefined> {
  return withStorageErrors(async () => {
    const entry = await db.meta.get(key)
    const parsed = z.safeParse(metaSchemas[key], entry?.value)
    return parsed.success ? parsed.data : undefined
  })
}

/**
 * Writes a metadata value (validated).
 * @throws {ValidationError} if the value does not match the key's schema.
 */
export function setMeta<K extends MetaKey>(key: K, value: MetaValue<K>): Promise<void> {
  return withStorageErrors(async () => {
    const entry = parseOrThrow(metaEntrySchema, {
      key,
      value: parseOrThrow(metaSchemas[key], value),
    })
    await db.meta.put(entry)
  })
}

/**
 * Startup storage check: opens IndexedDB and records `lastOpenedAt`.
 * @throws {StorageUnavailableError} if IndexedDB cannot be used (private browsing…).
 */
export async function recordAppOpened(): Promise<void> {
  await setMeta('lastOpenedAt', nowIso())
}
