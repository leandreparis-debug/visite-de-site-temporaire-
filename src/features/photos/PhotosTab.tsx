import { Camera, Loader2, Plus, Trash2, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import { toast } from 'sonner'
import { NativeSelect } from '@/components/form/NativeSelect'
import { Button } from '@/components/ui/button'
import type { VisitTabProps } from '@/features/visits/editorTypes'
import { formatStorageSize } from '@/lib/db/storage'
import { toUserMessage } from '@/lib/errors'
import { notifyError, pluralize } from '@/lib/notify'
import { PHOTO_CATEGORY_LABELS } from '@/types/labels'
import { PHOTO_CATEGORIES, type Photo, type PhotoCategory } from '@/types/media'
import { PhotoCard, type PhotoCardAction } from './PhotoCard'
import { DeletePhotosDialog, ImportDetailsDialog, StorageWarningDialog } from './PhotoDialogs'
import { moveIdByStep, moveIdNextTo, moveIdTo } from './photoOrder'
import { PhotoViewer } from './PhotoViewer'
import { deletePhotos, reorderPhotos, replacePhotoImage, setPhotosCategory } from './photosRepo'
import { rotateBlob90 } from './processing/rotatePhoto'
import { usePhotoImport } from './usePhotoImport'
import { usePhotoMetaSaver } from './usePhotoMetaSaver'
import { usePhotos } from './usePhotos'

const ACCEPT = 'image/*,.heic,.heif'
type Filter = PhotoCategory | 'all'

function imageFiles(list: FileList | null | undefined): File[] {
  return Array.from(list ?? [])
}

/** "Photos" tab: import, gallery, viewer, reorder, bulk actions. */
export function PhotosTab({ visit }: Pick<VisitTabProps, 'visit'>) {
  const { data: photos, isLoading, error } = usePhotos(visit.id)
  const importer = usePhotoImport(visit.id)
  const saver = usePhotoMetaSaver()
  const inputRef = useRef<HTMLInputElement>(null)

  const [filter, setFilter] = useState<Filter>('all')
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set())
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [toDelete, setToDelete] = useState<readonly string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [drag, setDrag] = useState<{
    id: string
    target?: { id: string; side: 'before' | 'after' }
  } | null>(null)
  const [bulkCategory, setBulkCategory] = useState('')

  const all = useMemo(() => photos ?? [], [photos])
  const ids = useMemo(() => all.map((p) => p.id), [all])
  const shown = useMemo(
    () => (filter === 'all' ? all : all.filter((p) => saver.valueOf(p, 'category') === filter)),
    [all, filter, saver],
  )
  const shownIds = useMemo(() => shown.map((p) => p.id), [shown])
  const numberOf = useCallback((id: string) => ids.indexOf(id) + 1, [ids])
  const pinsByPhoto = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const pin of [...visit.pins].sort((a, b) => a.number - b.number)) {
      map.set(pin.photoId, [...(map.get(pin.photoId) ?? []), pin.number])
    }
    return map
  }, [visit.pins])
  const counts = useMemo(() => {
    const result = new Map<Filter, number>([['all', all.length]])
    for (const photo of all) {
      const category = saver.valueOf(photo, 'category') as PhotoCategory
      result.set(category, (result.get(category) ?? 0) + 1)
    }
    return result
  }, [all, saver])
  const totalBytes = useMemo(
    () => all.reduce((sum, p) => sum + p.blob.size + p.thumbnailBlob.size, 0),
    [all],
  )

  // Paste (Ctrl+V) of images anywhere in the tab.
  const start = importer.start
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = imageFiles(event.clipboardData?.files).filter((f) =>
        f.type.startsWith('image/'),
      )
      if (files.length === 0) return
      event.preventDefault()
      void start(files)
    }
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('paste', onPaste)
    }
  }, [start])

  const reorder = useCallback(
    (next: readonly string[], focus?: string) => {
      if (next === ids) return
      if (focus) setFocusId(focus)
      reorderPhotos(visit.id, next).catch((e: unknown) => {
        notifyError(e, 'Réorganisation impossible')
      })
    },
    [ids, visit.id],
  )

  const rotate = useCallback(async (photo: Photo, direction: 'left' | 'right') => {
    setBusyId(photo.id)
    try {
      await replacePhotoImage(photo.id, await rotateBlob90(photo.blob, direction))
    } catch (e) {
      notifyError(e, 'Rotation impossible')
    } finally {
      setBusyId(null)
    }
  }, [])

  const onAction = useCallback(
    (id: string, action: PhotoCardAction) => {
      const photo = all.find((p) => p.id === id)
      if (!photo) return
      switch (action) {
        case 'open':
          setViewerIndex(Math.max(0, shownIds.indexOf(id)))
          break
        case 'rotate-left':
        case 'rotate-right':
          void rotate(photo, action === 'rotate-left' ? 'left' : 'right')
          break
        case 'move-first':
          reorder(moveIdTo(ids, id, 0))
          break
        case 'move-last':
          reorder(moveIdTo(ids, id, ids.length - 1))
          break
        case 'move-prev':
        case 'move-next':
          reorder(moveIdByStep(ids, shownIds, id, action === 'move-prev' ? -1 : 1), id)
          break
        case 'delete':
          setToDelete([id])
          break
      }
    },
    [all, ids, shownIds, reorder, rotate],
  )

  const onToggleSelect = useCallback((id: string, selected: boolean) => {
    setSelection((current) => {
      const next = new Set(current)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await deletePhotos(toDelete)
      toast.success(
        toDelete.length > 1 ? `${toDelete.length} photos supprimées` : 'Photo supprimée',
      )
      setSelection((current) => new Set([...current].filter((id) => !toDelete.includes(id))))
      setToDelete([])
      setViewerIndex(null)
    } catch (e) {
      notifyError(e, 'Suppression impossible')
    } finally {
      setDeleting(false)
    }
  }

  const applyBulkCategory = async (category: PhotoCategory) => {
    try {
      await setPhotosCategory([...selection], category)
      toast.success(`Catégorie « ${PHOTO_CATEGORY_LABELS[category]} » appliquée`)
    } catch (e) {
      notifyError(e, 'Modification impossible')
    }
    setBulkCategory('')
  }

  const onGridKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === 'a' &&
      !/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
    ) {
      event.preventDefault()
      setSelection(new Set(shownIds))
    }
  }

  // File drag and drop on the whole tab (internal card drags are ignored here).
  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files')
  const dropZone = {
    onDragEnter: (event: DragEvent) => {
      if (hasFiles(event)) setDragOver(true)
    },
    onDragOver: (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    },
    onDragLeave: (event: DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false)
    },
    onDrop: (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      setDragOver(false)
      void importer.start(imageFiles(event.dataTransfer.files))
    },
  }

  const pinNumbersToDelete = toDelete.flatMap((id) => pinsByPhoto.get(id) ?? [])
  const openPicker = () => inputRef.current?.click()

  return (
    <div className="relative grid gap-4" {...dropZone}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        data-testid="photo-input"
        onChange={(event) => {
          void importer.start(imageFiles(event.target.files))
          event.target.value = ''
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={openPicker} disabled={importer.isImporting}>
          <Plus aria-hidden="true" />
          Ajouter des photos
        </Button>
        {all.length > 0 && (
          <>
            <div role="group" aria-label="Filtrer par catégorie" className="flex flex-wrap gap-1">
              {(['all', ...PHOTO_CATEGORIES] as const).map((value) => {
                const count = counts.get(value) ?? 0
                if (value !== 'all' && count === 0 && filter !== value) return null
                return (
                  <Button
                    key={value}
                    size="sm"
                    variant={filter === value ? 'default' : 'ghost'}
                    aria-pressed={filter === value}
                    onClick={() => {
                      setFilter(value)
                    }}
                  >
                    {value === 'all' ? 'Toutes' : PHOTO_CATEGORY_LABELS[value]} ({count})
                  </Button>
                )
              })}
            </div>
            <p className="ml-auto text-sm text-muted-foreground">
              {pluralize(all.length, 'photo')} · {formatStorageSize(totalBytes)}
            </p>
          </>
        )}
      </div>

      {importer.progress && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm shadow-card"
        >
          <Loader2 className="size-4 animate-spin text-brand" aria-hidden="true" />
          <div className="grid flex-1 gap-1.5">
            <span>
              Import de {Math.min(importer.progress.done + 1, importer.progress.total)} /{' '}
              {importer.progress.total} photos…
              {importer.progress.current && (
                <span className="ml-2 text-muted-foreground">{importer.progress.current}</span>
              )}
            </span>
            <progress
              className="h-1.5 w-full accent-brand"
              max={importer.progress.total}
              value={importer.progress.done}
              aria-label="Progression de l’import"
            />
          </div>
          <Button size="sm" variant="outline" onClick={importer.cancel}>
            Annuler
          </Button>
        </div>
      )}

      {selection.size > 0 && (
        <div
          role="toolbar"
          aria-label="Actions sur la sélection"
          className="sticky top-16 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-brand/30 bg-accent p-2 pl-4 text-sm shadow-card"
        >
          <span className="font-medium">
            {pluralize(selection.size, 'sélectionnée', 'sélectionnées')}
          </span>
          <NativeSelect
            aria-label="Changer la catégorie de la sélection"
            value={bulkCategory}
            className="w-52"
            selectClassName="h-8"
            onChange={(event) => {
              if (event.target.value) void applyBulkCategory(event.target.value as PhotoCategory)
            }}
          >
            <option value="">Changer la catégorie…</option>
            {PHOTO_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {PHOTO_CATEGORY_LABELS[category]}
              </option>
            ))}
          </NativeSelect>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setToDelete([...selection])
            }}
          >
            <Trash2 aria-hidden="true" />
            Supprimer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              setSelection(new Set())
            }}
          >
            <X aria-hidden="true" />
            Tout désélectionner
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement des photos…</p>
      ) : error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
        >
          Impossible d’afficher les photos : {toUserMessage(error)}
        </p>
      ) : all.length === 0 ? (
        <button
          type="button"
          onClick={openPicker}
          className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed bg-card px-6 py-16 text-center transition-colors outline-none hover:border-brand/50 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Camera className="size-12 text-brand" aria-hidden="true" />
          <span className="text-lg font-semibold">
            Glissez vos photos ici ou cliquez sur Ajouter
          </span>
          <span className="text-sm text-muted-foreground">
            JPEG, PNG, WebP — les photos sont automatiquement allégées
          </span>
        </button>
      ) : shown.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucune photo dans cette catégorie.{' '}
          <button
            type="button"
            className="font-medium text-brand underline-offset-4 hover:underline"
            onClick={() => {
              setFilter('all')
            }}
          >
            Voir toutes les photos
          </button>
        </p>
      ) : (
        <ul
          aria-label="Photos"
          onKeyDown={onGridKeyDown}
          className="grid grid-cols-3 gap-4 lg:grid-cols-4 2xl:grid-cols-5"
        >
          {shown.map((photo) => (
            <li
              key={photo.id}
              className="[contain-intrinsic-size:auto_320px] [content-visibility:auto]"
            >
              <PhotoCard
                photo={photo}
                number={numberOf(photo.id)}
                pinNumbers={pinsByPhoto.get(photo.id) ?? []}
                selected={selection.has(photo.id)}
                busy={busyId === photo.id}
                saver={saver}
                focusRequested={focusId === photo.id}
                dropIndicator={drag?.target?.id === photo.id ? drag.target.side : null}
                onToggleSelect={onToggleSelect}
                onAction={onAction}
                onDragStartCard={(id) => {
                  setDrag({ id })
                }}
                onDragOverCard={(id, side) => {
                  setDrag((current) =>
                    current && (current.target?.id !== id || current.target.side !== side)
                      ? { ...current, target: { id, side } }
                      : current,
                  )
                }}
                onDropCard={(targetId) => {
                  if (drag) {
                    reorder(moveIdNextTo(ids, drag.id, targetId, drag.target?.side ?? 'before'))
                  }
                  setDrag(null)
                }}
                onDragEndCard={() => {
                  setDrag(null)
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {all.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Réorganiser : glisser-déposer une photo, ou Alt+← / Alt+→ sur une photo sélectionnée au
          clavier. Ctrl+A sélectionne toutes les photos affichées. Ctrl+V colle une capture d’écran.
        </p>
      )}

      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-brand bg-accent/90 text-brand">
          <Camera className="size-10" aria-hidden="true" />
          <span className="text-lg font-semibold">Déposez vos photos ici</span>
        </div>
      )}

      <PhotoViewer
        photos={shown}
        index={viewerIndex !== null && viewerIndex < shown.length ? viewerIndex : null}
        onIndexChange={setViewerIndex}
        onClose={() => {
          setViewerIndex(null)
        }}
        onRotate={(id, direction) => {
          const photo = all.find((p) => p.id === id)
          if (photo) void rotate(photo, direction)
        }}
        busyId={busyId}
        saver={saver}
        numberOf={numberOf}
      />
      <DeletePhotosDialog
        count={toDelete.length}
        pinNumbers={pinNumbersToDelete}
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          setToDelete([])
        }}
      />
      <ImportDetailsDialog report={importer.details} onClose={importer.closeDetails} />
      <StorageWarningDialog
        warning={importer.storageWarning}
        onContinue={importer.confirmStorageWarning}
        onCancel={importer.dismissStorageWarning}
      />
    </div>
  )
}
