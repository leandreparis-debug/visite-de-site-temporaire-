import { Loader2, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatStorageSize } from '@/lib/db/storage'
import { pluralize } from '@/lib/notify'
import type { ImportReport } from './photoImport'
import type { StorageWarning } from './usePhotoImport'

/** Confirmation before deleting photos, naming the pins that will disappear. */
export function DeletePhotosDialog({
  count,
  pinNumbers,
  busy,
  onConfirm,
  onClose,
}: {
  /** Number of photos to delete; 0 = closed. */
  count: number
  pinNumbers: readonly number[]
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <AlertDialog
      open={count > 0}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Supprimer {count > 1 ? `${count} photos` : 'la photo'} ?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            {pinNumbers.length > 0 && (
              <span className="block font-medium text-foreground">
                {pinNumbers.length > 1
                  ? `${pinNumbers.length} repères seront retirés du plan`
                  : '1 repère sera retiré du plan'}{' '}
                ({pinNumbers.map((n) => `n°${n}`).join(', ')}).
              </span>
            )}
            <span className="block">
              Cette action est définitive.
              {pinNumbers.length > 0 &&
                ' Les numéros de repère ne sont jamais réattribués : les autres repères gardent leur numéro.'}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={onConfirm}>
            {busy ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 aria-hidden="true" />
            )}
            Supprimer
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** List of ignored files and their reasons ("Détails" of the import toast). */
export function ImportDetailsDialog({
  report,
  onClose,
}: {
  report: ImportReport | null
  onClose: () => void
}) {
  const open = report !== null && report.skipped.length > 0
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Fichiers ignorés</DialogTitle>
          <DialogDescription>
            {report && pluralize(report.skipped.length, 'fichier n’a', 'fichiers n’ont')} pas pu
            être importé{report && report.skipped.length > 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 space-y-3 overflow-y-auto text-sm">
          {report?.skipped.map((file, index) => (
            <li key={`${file.name}-${index}`} className="rounded-md border p-3">
              <p className="font-medium break-all">{file.name}</p>
              <p className="mt-1 text-muted-foreground">{file.reason}</p>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Asks whether to import anyway when the browser storage looks too small. */
export function StorageWarningDialog({
  warning,
  onContinue,
  onCancel,
}: {
  warning: StorageWarning | null
  onContinue: () => void
  onCancel: () => void
}) {
  return (
    <AlertDialog
      open={warning !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Espace de stockage peut-être insuffisant</AlertDialogTitle>
          <AlertDialogDescription>
            {warning &&
              `L’import de ${pluralize(warning.files.length, 'photo')} demande environ ${formatStorageSize(
                warning.neededBytes,
              )}, mais il ne reste qu’environ ${formatStorageSize(
                warning.availableBytes,
              )} dans ce navigateur. L’import s’arrêtera proprement si l’espace vient à manquer. Pensez à exporter puis supprimer d’anciennes visites.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler l’import</AlertDialogCancel>
          <Button onClick={onContinue}>Continuer quand même</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
