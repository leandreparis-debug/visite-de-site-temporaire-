import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getStorageEstimate, notifyStorageChange } from '@/lib/db/storage'
import { notifyError } from '@/lib/notify'
import {
  ESTIMATED_BYTES_PER_PHOTO,
  formatImportReport,
  runPhotoImport,
  type ImportReport,
} from './photoImport'
import { addPhoto } from './photosRepo'
import { processPhoto } from './processing/processPhoto'

export interface ImportProgress {
  done: number
  total: number
  current: string
}

/** Import waiting for the user's decision because the storage looks too small. */
export interface StorageWarning {
  files: File[]
  neededBytes: number
  availableBytes: number
}

/**
 * Photo import for a visit (file picker, drag and drop, paste).
 *
 * - Files are processed one at a time (`processPhoto`) and saved with
 *   `addPhoto` (category "general", empty caption, appended at the end).
 * - Before starting, the needed space (~700 KB per photo) is compared with
 *   the browser quota: if too small, `storageWarning` is set and the import
 *   waits for `confirmStorageWarning()` / `dismissStorageWarning()`.
 * - `cancel()` stops after the photo in progress (imported photos stay).
 * - At the end, a French toast summarizes the import; its "Détails" button
 *   sets `details` (ignored files and their reasons) for the dialog.
 */
export function usePhotoImport(visitId: string) {
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [details, setDetails] = useState<ImportReport | null>(null)
  const [storageWarning, setStorageWarning] = useState<StorageWarning | null>(null)
  const cancelledRef = useRef(false)
  const runningRef = useRef(false)

  const run = useCallback(
    async (files: File[]) => {
      runningRef.current = true
      cancelledRef.current = false
      setProgress({ done: 0, total: files.length, current: '' })
      try {
        const result = await runPhotoImport(files, {
          process: (file) => processPhoto(file),
          save: (photo) => addPhoto({ ...photo, visitId, caption: '', category: 'general' }),
          isCancelled: () => cancelledRef.current,
          onProgress: (done, total, current) => {
            setProgress({ done, total, current })
          },
        })
        const text = formatImportReport(result)
        const details =
          result.skipped.length > 0
            ? {
                action: {
                  label: 'Détails',
                  onClick: () => {
                    setDetails(result)
                  },
                },
              }
            : {}
        if (result.stoppedBecause) {
          toast.error('Import interrompu', {
            description: `${result.stoppedBecause} ${text}.`,
            duration: 15_000,
            ...details,
          })
        } else if (result.skipped.length > 0) {
          toast.warning(text, { duration: 10_000, ...details })
        } else {
          toast.success(text)
        }
      } catch (error) {
        notifyError(error, 'Import impossible')
      } finally {
        runningRef.current = false
        setProgress(null)
        notifyStorageChange()
      }
    },
    [visitId],
  )

  /** Starts an import (ignored while another one is running). */
  const start = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0 || runningRef.current) return
      const list = [...files]
      const estimate = await getStorageEstimate()
      const neededBytes = list.length * ESTIMATED_BYTES_PER_PHOTO
      if (estimate && estimate.quotaBytes - estimate.usedBytes < neededBytes) {
        setStorageWarning({
          files: list,
          neededBytes,
          availableBytes: Math.max(0, estimate.quotaBytes - estimate.usedBytes),
        })
        return
      }
      await run(list)
    },
    [run],
  )

  return {
    start,
    progress,
    isImporting: progress !== null,
    /** Stops after the photo in progress. */
    cancel: useCallback(() => {
      cancelledRef.current = true
    }, []),
    /** Import report shown by the "Détails" dialog (opened from the toast). */
    details,
    closeDetails: useCallback(() => {
      setDetails(null)
    }, []),
    storageWarning,
    confirmStorageWarning: useCallback(() => {
      const warning = storageWarning
      setStorageWarning(null)
      if (warning) void run(warning.files)
    }, [storageWarning, run]),
    dismissStorageWarning: useCallback(() => {
      setStorageWarning(null)
    }, []),
  }
}
