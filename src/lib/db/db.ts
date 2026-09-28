/**
 * IndexedDB database (Dexie). Single shared instance: `db`.
 *
 * Binary data (photos, plans) lives in dedicated tables so that listing
 * visits never loads blobs.
 *
 * Schema changes: never edit version 1 once shipped — add `db.version(2)`
 * with an upgrade function (see docs/DATA_MODEL.md).
 */
import { Dexie, type EntityTable } from 'dexie'
import type { Photo, Plan } from '@/types/media'
import type { StoredVisit } from '@/types/visit'

export const DB_NAME = 'cp-compte-rendu'

/** Key/value store for technical metadata (e.g. last export date, step 9). */
export interface MetaEntry {
  key: string
  value: unknown
}

export type CpDatabase = Dexie & {
  /** Raw rows: read them through `normalizeVisit` (see visitsRepo). */
  visits: EntityTable<StoredVisit, 'id'>
  photos: EntityTable<Photo, 'id'>
  plans: EntityTable<Plan, 'id'>
  meta: EntityTable<MetaEntry, 'key'>
}

/** Creates a database instance (a single one is exported below). */
export function createDatabase(name = DB_NAME): CpDatabase {
  // Live-query results are frozen, not deep-cloned: cheaper with many photos
  // (Blobs are never copied) and any accidental mutation of read data throws.
  const database = new Dexie(name, { cache: 'immutable' }) as CpDatabase
  database.version(1).stores({
    visits: 'id, updatedAt, date, kind',
    photos: 'id, visitId, [visitId+order]',
    plans: 'id, visitId, [visitId+order]',
    meta: 'key',
  })
  return database
}

/** The application's database. */
export const db = createDatabase()

/** Empties every table. For tests only. */
export async function resetDbForTests(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))
  })
}
