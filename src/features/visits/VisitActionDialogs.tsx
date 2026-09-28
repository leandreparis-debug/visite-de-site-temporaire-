import { Check, Loader2, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { navigate } from '@/app/router'
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
import { useLiveResult } from '@/lib/db/useLiveResult'
import { notifyError, pluralize } from '@/lib/notify'
import { deleteVisit, duplicateVisit, getVisitMediaCounts } from './visitsRepo'

/** Visit targeted by an action dialog. */
export interface VisitActionTarget {
  id: string
  title: string
}

export type VisitAction = { type: 'duplicate' | 'delete'; visit: VisitActionTarget }

export interface VisitActionDialogsProps {
  action: VisitAction | null
  onClose: () => void
  /**
   * Runs before the action (the editor saves its draft before duplicating and
   * drops it before deleting). Returning `false` cancels the action.
   */
  beforeAction?: (type: VisitAction['type']) => Promise<boolean> | boolean
  /** Called after a successful deletion (the editor goes back to the list). */
  onDeleted?: () => void
}

const KEPT_ON_DUPLICATE = [
  'Site',
  'Participants (marqués absents)',
  'Sinistres DO et assurances',
  'Projets et coûts',
  'Points d’attention non terminés',
  'Plans',
]
const DROPPED_ON_DUPLICATE = ['Notes', 'Photos', 'Repères sur les plans']

/** Confirmation dialogs for "Dupliquer" and "Supprimer". */
export function VisitActionDialogs({
  action,
  onClose,
  beforeAction,
  onDeleted,
}: VisitActionDialogsProps) {
  return (
    <>
      <DuplicateVisitDialog
        visit={action?.type === 'duplicate' ? action.visit : null}
        onClose={onClose}
        beforeAction={beforeAction}
      />
      <DeleteVisitDialog
        visit={action?.type === 'delete' ? action.visit : null}
        onClose={onClose}
        beforeAction={beforeAction}
        onDeleted={onDeleted}
      />
    </>
  )
}

interface DialogProps {
  visit: VisitActionTarget | null
  onClose: () => void
  beforeAction?: VisitActionDialogsProps['beforeAction']
}

function DuplicateVisitDialog({ visit, onClose, beforeAction }: DialogProps) {
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    if (!visit) return
    setBusy(true)
    try {
      if (beforeAction && !(await beforeAction('duplicate'))) return
      const copy = await duplicateVisit(visit.id)
      onClose()
      toast.success('Visite dupliquée')
      navigate({ name: 'visit', visitId: copy.id, tab: 'general' })
    } catch (error) {
      notifyError(error, 'Duplication impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={visit !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dupliquer la visite</DialogTitle>
          <DialogDescription>
            Une nouvelle visite datée d’aujourd’hui sera créée à partir de{' '}
            {`«\u00a0${visit?.title ?? ''}\u00a0»`}, pour reprendre le suivi.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <section aria-labelledby="duplicate-kept">
            <h3 id="duplicate-kept" className="mb-2 font-medium text-success">
              Repris
            </h3>
            <ul className="space-y-1.5">
              {KEPT_ON_DUPLICATE.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="duplicate-dropped">
            <h3 id="duplicate-dropped" className="mb-2 font-medium text-muted-foreground">
              Non repris
            </h3>
            <ul className="space-y-1.5 text-muted-foreground">
              {DROPPED_ON_DUPLICATE.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={() => void confirm()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            Dupliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteVisitDialog({
  visit,
  onClose,
  beforeAction,
  onDeleted,
}: DialogProps & { onDeleted?: () => void }) {
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    if (!visit) return
    setBusy(true)
    try {
      if (beforeAction && !(await beforeAction('delete'))) return
      await deleteVisit(visit.id)
      onClose()
      toast.success('Visite supprimée')
      onDeleted?.()
    } catch (error) {
      notifyError(error, 'Suppression impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open={visit !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer la visite ?</AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-2">
              <p>
                {'«\u00a0'}
                <span className="font-medium text-foreground">{visit?.title}</span>
                {'\u00a0» sera supprimée'}
                {visit && <MediaCounts visitId={visit.id} />}.
              </p>
              <p className="font-medium text-danger">
                Cette action est définitive. Pensez à exporter la visite avant.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
          {/* Plain button: the dialog must stay open until the deletion is done. */}
          <Button variant="destructive" onClick={() => void confirm()} disabled={busy}>
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

/** ", ainsi que 3 photos et 1 plan" (nothing when there is no media). */
function MediaCounts({ visitId }: { visitId: string }) {
  const { data, error } = useLiveResult(() => getVisitMediaCounts(visitId), visitId)
  if (error) return <>, ainsi que ses photos et plans</>
  if (!data || (data.photoCount === 0 && data.planCount === 0)) return null
  const parts = [
    data.photoCount > 0 && pluralize(data.photoCount, 'photo'),
    data.planCount > 0 && pluralize(data.planCount, 'plan'),
  ].filter(Boolean)
  return <>, ainsi que {parts.join(' et ')}</>
}
