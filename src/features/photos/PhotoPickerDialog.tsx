import { Check, ImageOff } from 'lucide-react'
import { memo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { pluralize } from '@/lib/notify'
import { useObjectUrl } from '@/lib/useObjectUrl'
import { cn } from '@/lib/utils'
import type { Photo } from '@/types/media'

export interface PhotoPickerDialogProps {
  open: boolean
  title: string
  description: string
  /** Photos of the visit, in display order. */
  photos: readonly Photo[]
  /** Ids selected when the dialog opens. */
  initialIds: readonly string[]
  /** `single`: one photo at most (clicking another replaces it). */
  mode: 'single' | 'multiple'
  onConfirm: (ids: string[]) => void
  onClose: () => void
}

/**
 * Chooses photos of the visit from their thumbnails (cover photo, photos of
 * an area of the notes). The selection keeps the photo order of the visit.
 */
export function PhotoPickerDialog(props: PhotoPickerDialogProps) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        {/* Rendered only while open: the selection restarts from `initialIds`. */}
        <PickerBody {...props} />
      </DialogContent>
    </Dialog>
  )
}

function PickerBody({
  title,
  description,
  photos,
  initialIds,
  mode,
  onConfirm,
  onClose,
}: PhotoPickerDialogProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(initialIds))

  const toggle = (id: string) => {
    setSelected((current) => {
      if (mode === 'single') return current.has(id) ? new Set() : new Set([id])
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {photos.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
          <ImageOff className="size-5" aria-hidden="true" />
          Aucune photo dans cette visite : importez-les d’abord dans l’onglet Photos.
        </p>
      ) : (
        <ul
          aria-label="Photos de la visite"
          className="grid max-h-[60vh] grid-cols-4 gap-2 overflow-y-auto p-1"
        >
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <PickerPhoto
                photo={photo}
                number={index + 1}
                selected={selected.has(photo.id)}
                onToggle={toggle}
              />
            </li>
          ))}
        </ul>
      )}
      <DialogFooter className="items-center">
        {mode === 'multiple' && (
          <p className="mr-auto text-sm text-muted-foreground">
            {pluralize(selected.size, 'photo sélectionnée', 'photos sélectionnées')}
          </p>
        )}
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button
          onClick={() => {
            onConfirm(photos.filter((p) => selected.has(p.id)).map((p) => p.id))
          }}
        >
          Valider
        </Button>
      </DialogFooter>
    </>
  )
}

const PickerPhoto = memo(function PickerPhoto({
  photo,
  number,
  selected,
  onToggle,
}: {
  photo: Photo
  number: number
  selected: boolean
  onToggle: (id: string) => void
}) {
  const url = useObjectUrl(photo.thumbnailBlob)
  const caption = photo.caption.trim()
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Photo n°${number}${caption ? ` : ${caption}` : ''}`}
      onClick={() => {
        onToggle(photo.id)
      }}
      className={cn(
        'group relative block w-full overflow-hidden rounded-lg border bg-muted text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selected && 'ring-[3px] ring-brand',
      )}
    >
      <span className="block aspect-[4/3]">
        {url && (
          <img
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="size-full object-cover"
          />
        )}
      </span>
      <span className="absolute top-1 left-1 rounded-full bg-foreground/80 px-1.5 text-[10px] font-semibold text-white">
        {number}
      </span>
      {selected && (
        <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-brand text-white">
          <Check className="size-3.5" aria-hidden="true" />
        </span>
      )}
      <span className="block truncate px-2 py-1 text-xs">
        {caption || <span className="text-muted-foreground italic">Sans légende</span>}
      </span>
    </button>
  )
})
