/** Import logic, independent of React (tested with injected dependencies). */
import { StorageQuotaError, toAppError, toUserMessage } from '@/lib/errors'
import { EXIF_READ_BYTES, readDateTimeOriginal } from './processing/exif'
import type { ProcessedPhoto } from './processing/processPhoto'

/** Rough stored size of one photo (main image + thumbnail), for the space check. */
export const ESTIMATED_BYTES_PER_PHOTO = 700 * 1024

const naturalCollator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' })

export interface ImportCandidate {
  file: File
  takenAt: string | null
}

/**
 * Import order: by EXIF date (oldest first) when known, otherwise by file name
 * in natural order ("IMG_2" before "IMG_10"). Dated photos come first.
 */
export function sortForImport(candidates: readonly ImportCandidate[]): ImportCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.takenAt && b.takenAt && a.takenAt !== b.takenAt) return a.takenAt < b.takenAt ? -1 : 1
    if (a.takenAt && !b.takenAt) return -1
    if (!a.takenAt && b.takenAt) return 1
    return naturalCollator.compare(a.file.name, b.file.name)
  })
}

/** Reads the EXIF date of each file (first 128 KB only). */
export async function readCandidates(files: readonly File[]): Promise<ImportCandidate[]> {
  return Promise.all(
    files.map(async (file) => ({
      file,
      takenAt: readDateTimeOriginal(await file.slice(0, EXIF_READ_BYTES).arrayBuffer()),
    })),
  )
}

export interface SkippedFile {
  name: string
  reason: string
}

export interface ImportReport {
  imported: number
  skipped: SkippedFile[]
  /** Files not processed because of a cancellation or a full storage. */
  notProcessed: number
  cancelled: boolean
  /** French message when the import stopped on a storage error. */
  stoppedBecause?: string
}

export interface ImportDependencies {
  process: (file: File) => Promise<ProcessedPhoto>
  save: (photo: ProcessedPhoto) => Promise<unknown>
  /** Checked before each photo: `true` stops after the photo in progress. */
  isCancelled: () => boolean
  onProgress?: (done: number, total: number, current: string) => void
}

/**
 * Imports files one at a time (bounded memory). A failing file is skipped
 * with its French reason and never stops the others; a full storage
 * (`StorageQuotaError`) stops the import cleanly (photos already saved stay).
 */
export async function runPhotoImport(
  files: readonly File[],
  { process, save, isCancelled, onProgress }: ImportDependencies,
): Promise<ImportReport> {
  const ordered = sortForImport(await readCandidates(files))
  const report: ImportReport = { imported: 0, skipped: [], notProcessed: 0, cancelled: false }
  for (const [index, { file }] of ordered.entries()) {
    if (isCancelled()) {
      report.cancelled = true
      report.notProcessed = ordered.length - index
      break
    }
    onProgress?.(index, ordered.length, file.name)
    try {
      await save(await process(file))
      report.imported++
    } catch (caught) {
      const error = toAppError(caught)
      if (error instanceof StorageQuotaError) {
        report.stoppedBecause = toUserMessage(error)
        report.notProcessed = ordered.length - index
        break
      }
      console.error(`[photos] Import failed for ${file.name}:`, caught)
      report.skipped.push({ name: file.name, reason: toUserMessage(error) })
    }
  }
  onProgress?.(ordered.length - report.notProcessed, ordered.length, '')
  return report
}

/** Toast text: "12 photos importées" / "10 photos importées, 2 ignorées". */
export function formatImportReport(report: ImportReport): string {
  const plural = (n: number, one: string, many: string) => `${n}\u00a0${n > 1 ? many : one}`
  let text = plural(report.imported, 'photo importée', 'photos importées')
  if (report.skipped.length > 0) {
    text += `, ${plural(report.skipped.length, 'ignorée', 'ignorées')}`
  }
  if (report.cancelled) text += ' (import annulé)'
  return text
}
