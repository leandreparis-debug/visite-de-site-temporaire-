import { Images, X } from 'lucide-react'
import { memo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PhotoPickerDialog } from '@/features/photos/PhotoPickerDialog'
import { useObjectUrl } from '@/lib/useObjectUrl'
import type { Photo } from '@/types/media'

export interface SectionPhotosProps {
  sectionTitle: string
  /** Photos of the visit, in display order. */
  photos: readonly Photo[]
  /** Ids linked to the section (deleted photos are ignored). */
  linkedIds: readonly string[]
  onChange: (photoIds: string[]) => void
}

/** Photos illustrating an area of the notes: thumbnails, link / unlink. */
export function SectionPhotos({ sectionTitle, photos, linkedIds, onChange }: SectionPhotosProps) {
  const [picking, setPicking] = useState(false)
  const numbers = new Map(photos.map((photo, index) => [photo.id, index + 1]))
  const byId = new Map(photos.map((photo) => [photo.id, photo]))
  const linked = linkedIds.flatMap((id) => byId.get(id) ?? [])

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {linked.length > 0 && (
        <ul aria-label={`Photos liées : ${sectionTitle}`} className="flex flex-wrap gap-2">
          {linked.map((photo) => (
            <li key={photo.id}>
              <LinkedPhoto
                photo={photo}
                number={numbers.get(photo.id) ?? 0}
                onRemove={() => {
                  onChange(linked.filter((p) => p.id !== photo.id).map((p) => p.id))
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => {
          setPicking(true)
        }}
      >
        <Images aria-hidden="true" />
        {linked.length ? 'Modifier les photos' : 'Lier des photos'}
        <span className="sr-only"> : {sectionTitle}</span>
      </Button>
      <PhotoPickerDialog
        open={picking}
        mode="multiple"
        title={`Photos de la zone « ${sectionTitle} »`}
        description="Elles apparaîtront sous les observations de cette zone dans le rapport."
        photos={photos}
        initialIds={linked.map((p) => p.id)}
        onConfirm={(ids) => {
          onChange(ids)
          setPicking(false)
        }}
        onClose={() => {
          setPicking(false)
        }}
      />
    </div>
  )
}

const LinkedPhoto = memo(function LinkedPhoto({
  photo,
  number,
  onRemove,
}: {
  photo: Photo
  number: number
  onRemove: () => void
}) {
  const url = useObjectUrl(photo.thumbnailBlob)
  const name = `photo n°${number}${photo.caption.trim() ? ` (${photo.caption.trim()})` : ''}`
  return (
    <span className="group relative block h-16 w-20 overflow-hidden rounded-md border bg-muted">
      {url && <img src={url} alt={`Photo n°${number}`} className="size-full object-cover" />}
      <span className="absolute bottom-0.5 left-0.5 rounded-full bg-foreground/80 px-1.5 text-[10px] font-semibold text-white">
        {number}
      </span>
      <button
        type="button"
        aria-label={`Retirer la ${name}`}
        onClick={onRemove}
        className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-surface/90 text-foreground shadow outline-none hover:text-danger focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </span>
  )
})
