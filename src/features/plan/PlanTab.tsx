import { ChevronDown, Download, Map as MapIcon, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { navigate, useRoute } from '@/app/router'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { PhotoViewer } from '@/features/photos/PhotoViewer'
import { replacePhotoImage } from '@/features/photos/photosRepo'
import { rotateBlob90 } from '@/features/photos/processing/rotatePhoto'
import { usePhotoMetaSaver } from '@/features/photos/usePhotoMetaSaver'
import { usePhotos } from '@/features/photos/usePhotos'
import type { VisitTabProps } from '@/features/visits/editorTypes'
import { todayIso } from '@/lib/dates'
import { downloadBlob } from '@/lib/download'
import { createId } from '@/lib/id'
import { notifyError } from '@/lib/notify'
import type { Plan } from '@/types/media'
import { ImportPlanDialog } from './import/ImportPlanDialog'
import { PinBubble } from './PinBubble'
import { PlanCanvas, type PlanCanvasPin } from './PlanCanvas'
import { PlanPhotoPanel } from './PlanPhotoPanel'
import { movePin, nudgePin, placePhotoOnPlan, removePin, restorePin, setPinLabel } from './pinOps'
import { deletePlan, renamePlan } from './plansRepo'
import { annotatedPlanFileName, renderAnnotatedPlan } from './renderAnnotatedPlan'
import { usePlans } from './usePlans'
import type { Point } from './viewport'

/** "Plan" tab: plans of the visit, pins, photo placement. */
export function PlanTab({ visit, update }: VisitTabProps) {
  const route = useRoute()
  const { data: plans = [], isLoading } = usePlans(visit.id)
  const { data: photos = [] } = usePhotos(visit.id)
  const saver = usePhotoMetaSaver()

  const [importOpen, setImportOpen] = useState(false)
  const [droppedFile, setDroppedFile] = useState<File | null>(null)
  const [placingPhotoId, setPlacingPhotoId] = useState<string | null>(null)
  const [hoveredPhotoId, setHoveredPhotoId] = useState<string | null>(null)
  const [openPinId, setOpenPinId] = useState<string | null>(null)
  const [viewerPhotoId, setViewerPhotoId] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<Plan | null>(null)
  const [deleting, setDeleting] = useState<Plan | null>(null)
  const [rotatingId, setRotatingId] = useState<string | null>(null)

  const requestedPlanId = route.name === 'visit' ? route.planId : undefined
  const activePlan = plans.find((p) => p.id === requestedPlanId) ?? plans[0]
  const selectPlan = useCallback(
    (planId: string, replace = false) => {
      navigate({ name: 'visit', visitId: visit.id, tab: 'plan', planId }, { replace })
    },
    [visit.id],
  )
  // Put the active plan in the URL when none is requested. A requested plan
  // not (yet) in the list — e.g. just imported, before the live query
  // refreshes — is never overwritten. Only while the URL is on the plan tab:
  // when leaving it, this component may render once more with the new URL
  // (e.g. re-rendered by the save started on tab change) and must not bring
  // the user back to the plan.
  const onPlanTab = route.name === 'visit' && route.tab === 'plan'
  useEffect(() => {
    if (onPlanTab && activePlan && !requestedPlanId) selectPlan(activePlan.id, true)
  }, [onPlanTab, activePlan, requestedPlanId, selectPlan])

  const photosById = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos])
  const photoNumber = useCallback(
    (photoId: string) => photos.findIndex((p) => p.id === photoId) + 1,
    [photos],
  )
  const pinsByPhoto = useMemo(
    () => new Map(visit.pins.map((pin) => [pin.photoId, pin])),
    [visit.pins],
  )
  const planNames = useMemo(() => new Map(plans.map((p) => [p.id, p.name])), [plans])
  const canvasPins: PlanCanvasPin[] = useMemo(
    () =>
      visit.pins
        .filter((pin) => pin.planId === activePlan?.id)
        .sort((a, b) => a.number - b.number)
        .map((pin) => {
          const photo = photosById.get(pin.photoId)
          const number = photoNumber(pin.photoId)
          return {
            ...pin,
            category: photo?.category ?? 'general',
            description: [pin.label, photo?.caption.trim() || `photo ${number}`]
              .filter(Boolean)
              .join(' — '),
          }
        }),
    [visit.pins, activePlan?.id, photosById, photoNumber],
  )

  // Escape cancels the click placement mode.
  useEffect(() => {
    if (!placingPhotoId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPlacingPhotoId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [placingPhotoId])

  const place = useCallback(
    (photoId: string, point: Point) => {
      if (!activePlan) return
      // Id generated here; the pure operation is replayed by the autosave.
      const placement = {
        pinId: createId(),
        planId: activePlan.id,
        photoId,
        x: point.x,
        y: point.y,
      }
      const { pin, moved } = placePhotoOnPlan(visit, placement)
      update((v) => placePhotoOnPlan(v, placement).visit)
      setPlacingPhotoId(null)
      toast.success(moved ? `Repère n°${pin.number} déplacé` : `Repère n°${pin.number} ajouté`)
    },
    [activePlan, visit, update],
  )

  const remove = useCallback(
    (pinId: string) => {
      const { removed, index } = removePin(visit, pinId)
      if (!removed) return
      update((v) => removePin(v, pinId).visit)
      setOpenPinId(null)
      toast(`Repère n°${removed.number} retiré du plan`, {
        duration: 5000,
        action: {
          label: 'Annuler',
          onClick: () => {
            update((v) => restorePin(v, removed, index))
          },
        },
      })
    },
    [visit, update],
  )

  const openPin = visit.pins.find((pin) => pin.id === openPinId) ?? null
  const viewerIndex = viewerPhotoId ? photos.findIndex((p) => p.id === viewerPhotoId) : -1

  const download = async (plan: Plan) => {
    try {
      const blob = await renderAnnotatedPlan(
        plan.blob,
        visit.pins.filter((pin) => pin.planId === plan.id),
        photosById,
      )
      downloadBlob(blob, annotatedPlanFileName(visit.site.name, plan.name, todayIso()))
    } catch (error) {
      notifyError(error, 'Téléchargement impossible')
    }
  }

  const openImport = (file: File | null = null) => {
    setDroppedFile(file)
    setImportOpen(true)
  }

  const importDialog = (
    <ImportPlanDialog
      open={importOpen}
      onOpenChange={setImportOpen}
      visitId={visit.id}
      initialFile={droppedFile}
      onImported={(planId) => {
        selectPlan(planId)
      }}
    />
  )

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement des plans…</p>

  if (!activePlan) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            openImport()
          }}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes('Files')) event.preventDefault()
          }}
          onDrop={(event) => {
            event.preventDefault()
            const file = event.dataTransfer.files[0]
            if (file) openImport(file)
          }}
          className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed bg-card px-6 py-16 text-center outline-none hover:border-brand/50 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <MapIcon className="size-12 text-brand" aria-hidden="true" />
          <span className="text-lg font-semibold">
            Importez le plan de l’entrepôt (PDF ou image)
          </span>
          <span className="text-sm text-muted-foreground">
            Astuce : depuis AutoCAD, un export PDF ou PNG convient.
          </span>
        </button>
        {importDialog}
      </>
    )
  }

  const pinsOnPlan = (plan: Plan) =>
    visit.pins
      .filter((pin) => pin.planId === plan.id)
      .map((pin) => pin.number)
      .sort((a, b) => a - b)
  const placingNumber = placingPhotoId ? photoNumber(placingPhotoId) : 0

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Plans de la visite" className="flex flex-wrap gap-1">
          {plans.map((plan) => (
            <Button
              key={plan.id}
              size="sm"
              variant={plan.id === activePlan.id ? 'default' : 'outline'}
              aria-pressed={plan.id === activePlan.id}
              onClick={() => {
                selectPlan(plan.id)
              }}
            >
              {plan.name}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            openImport()
          }}
        >
          <Plus aria-hidden="true" />
          Ajouter un plan
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="ml-auto">
              Plan « {activePlan.name} »
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuItem onSelect={() => void download(activePlan)}>
              <Download aria-hidden="true" />
              Télécharger le plan annoté (PNG)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setRenaming(activePlan)
              }}
            >
              <Pencil aria-hidden="true" />
              Renommer
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                setDeleting(activePlan)
              }}
            >
              <Trash2 aria-hidden="true" />
              Supprimer le plan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {placingPhotoId && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border border-brand/30 bg-accent px-4 py-2 text-sm"
        >
          <span className="flex-1">
            Cliquez sur le plan pour placer la photo n°{placingNumber} — Échap pour annuler
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPlacingPhotoId(null)
            }}
          >
            <X aria-hidden="true" />
            Annuler
          </Button>
        </div>
      )}

      <div className="grid h-[calc(100dvh-18rem)] min-h-[480px] grid-cols-[1fr_300px] gap-3">
        <PlanCanvas
          plan={activePlan}
          pins={canvasPins}
          placingPhotoId={placingPhotoId}
          highlightedPhotoId={hoveredPhotoId}
          openPinId={openPinId}
          onHoverPhoto={setHoveredPhotoId}
          onPlace={place}
          onPinMove={(pinId, point) => {
            update((v) => movePin(v, pinId, point.x, point.y))
          }}
          onPinNudge={(pinId, dx, dy) => {
            update((v) => nudgePin(v, pinId, dx, dy))
          }}
          onPinOpen={setOpenPinId}
          onPinRemove={remove}
        />
        <PlanPhotoPanel
          visitId={visit.id}
          photos={photos}
          pinsByPhoto={pinsByPhoto}
          planNames={planNames}
          selectedPhotoId={placingPhotoId}
          highlightedPhotoId={hoveredPhotoId}
          onSelect={setPlacingPhotoId}
          onHover={setHoveredPhotoId}
        />
      </div>

      <PinBubble
        visitId={visit.id}
        pin={openPin}
        photo={openPin ? photosById.get(openPin.photoId) : undefined}
        photoNumber={openPin ? photoNumber(openPin.photoId) : 0}
        onClose={() => {
          setOpenPinId(null)
        }}
        onLabel={(pinId, label) => {
          update((v) => setPinLabel(v, pinId, label), { coalesceKey: `pin.${pinId}.label` })
        }}
        onViewPhoto={(photoId) => {
          setOpenPinId(null)
          setViewerPhotoId(photoId)
        }}
        onRemove={remove}
      />

      <PhotoViewer
        photos={photos}
        index={viewerIndex >= 0 ? viewerIndex : null}
        onIndexChange={(index) => {
          setViewerPhotoId(photos[index]?.id ?? null)
        }}
        onClose={() => {
          setViewerPhotoId(null)
        }}
        onRotate={(photoId, direction) => {
          const photo = photosById.get(photoId)
          if (!photo) return
          setRotatingId(photoId)
          rotateBlob90(photo.blob, direction)
            .then((image) => replacePhotoImage(photoId, image))
            .catch((error: unknown) => {
              notifyError(error, 'Rotation impossible')
            })
            .finally(() => {
              setRotatingId(null)
            })
        }}
        busyId={rotatingId}
        saver={saver}
        numberOf={photoNumber}
      />

      {importDialog}
      <RenamePlanDialog
        plan={renaming}
        onClose={() => {
          setRenaming(null)
        }}
      />
      <DeletePlanDialog
        plan={deleting}
        pinNumbers={deleting ? pinsOnPlan(deleting) : []}
        onClose={() => {
          setDeleting(null)
        }}
        onDeleted={(plan) => {
          const next = plans.find((p) => p.id !== plan.id)
          if (next) selectPlan(next.id, true)
          else navigate({ name: 'visit', visitId: visit.id, tab: 'plan' }, { replace: true })
        }}
      />
    </div>
  )
}

function RenamePlanDialog({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const [name, setName] = useState('')
  const [editedFor, setEditedFor] = useState<string | null>(null)
  if (plan && editedFor !== plan.id) {
    setEditedFor(plan.id)
    setName(plan.name)
  }
  const submit = async () => {
    if (!plan || !name.trim()) return
    try {
      await renamePlan(plan.id, name)
      onClose()
    } catch (error) {
      notifyError(error, 'Renommage impossible')
    }
  }
  return (
    <Dialog
      open={plan !== null}
      onOpenChange={(open) => {
        if (!open) {
          setEditedFor(null)
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>Renommer le plan</DialogTitle>
          </DialogHeader>
          <Input
            aria-label="Nom du plan"
            value={name}
            maxLength={120}
            onChange={(event) => {
              setName(event.target.value)
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Renommer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeletePlanDialog({
  plan,
  pinNumbers,
  onClose,
  onDeleted,
}: {
  plan: Plan | null
  pinNumbers: readonly number[]
  onClose: () => void
  onDeleted: (plan: Plan) => void
}) {
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    if (!plan) return
    setBusy(true)
    try {
      await deletePlan(plan.id)
      toast.success('Plan supprimé')
      onClose()
      onDeleted(plan)
    } catch (error) {
      notifyError(error, 'Suppression impossible')
    } finally {
      setBusy(false)
    }
  }
  return (
    <AlertDialog
      open={plan !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le plan « {plan?.name} » ?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              {pinNumbers.length === 0
                ? 'Aucun repère n’est placé sur ce plan.'
                : `${pinNumbers.length > 1 ? `${pinNumbers.length} repères seront retirés` : '1 repère sera retiré'} (${pinNumbers.map((n) => `n°${n}`).join(', ')}). Les photos sont conservées.`}
            </span>
            <span className="block">Cette action est définitive.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={() => void confirm()}>
            <Trash2 aria-hidden="true" />
            Supprimer
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
