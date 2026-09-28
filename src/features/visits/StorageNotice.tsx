import { HardDrive, X } from 'lucide-react'
import { IconButton } from '@/components/form/IconButton'
import { getMeta, setMeta } from '@/lib/db/meta'
import { useLiveResult } from '@/lib/db/useLiveResult'
import { nowIso } from '@/lib/dates'
import { notifyError } from '@/lib/notify'

export const STORAGE_NOTICE_TEXT =
  'Vos visites sont enregistrées dans ce navigateur, sur ce poste uniquement. Utilisez toujours le même navigateur, et générez le rapport Word pour conserver une trace durable.'

/**
 * Information banner of the visit list about where the data lives (no
 * export in V1: the Word report is the lasting archive). Closing it is
 * remembered in `meta` (per browser).
 */
export function StorageNotice() {
  const { data, isLoading } = useLiveResult(
    async () => (await getMeta('storageNoticeDismissedAt')) ?? null,
    'storage-notice',
  )
  if (isLoading || data) return null
  return (
    <div
      role="note"
      aria-label="Où sont enregistrées les visites"
      className="flex items-start gap-3 rounded-xl border border-brand/30 bg-accent px-4 py-3 text-sm"
    >
      <HardDrive className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
      <p className="flex-1">{STORAGE_NOTICE_TEXT}</p>
      <IconButton
        icon={X}
        label="Fermer ce message"
        className="-my-1"
        onClick={() => {
          setMeta('storageNoticeDismissedAt', nowIso()).catch((error: unknown) => {
            notifyError(error, 'Impossible de fermer le message')
          })
        }}
      />
    </div>
  )
}
