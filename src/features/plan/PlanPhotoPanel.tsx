import { Camera } from 'lucide-react'
import { memo, useState } from 'react'
import { Link } from '@/app/Link'
import { SegmentedControl } from '@/components/form/SegmentedControl'
import { useObjectUrl } from '@/lib/useObjectUrl'
import { cn } from '@/lib/utils'
import type { Pin, Photo } from '@/types/media'
import { PLACE_PHOTO_TYPE } from './PlanCanvas'

type PanelFilter = 'all' | 'unplaced' | 'placed'
const FILTERS = [
  { value: 'all' as const, label: 'Toutes' },
  { value: 'unplaced' as const, label: 'Non placées' },
  { value: 'placed' as const, label: 'Placées' },
]

export interface PlanPhotoPanelProps {
  visitId: string
  /** Photos in gallery order. */
  photos: readonly Photo[]
  pinsByPhoto: ReadonlyMap<string, Pin>
  planNames: ReadonlyMap<string, string>
  selectedPhotoId: string | null
  highlightedPhotoId: string | null
  onSelect: (photoId: string | null) => void
  onHover: (photoId: string | null) => void
}

/** Right panel: photos to place (drag onto the plan, or click then click on the plan). */
export function PlanPhotoPanel({
  visitId,
  photos,
  pinsByPhoto,
  planNames,
  selectedPhotoId,
  highlightedPhotoId,
  onSelect,
  onHover,
}: PlanPhotoPanelProps) {
  const [filter, setFilter] = useState<PanelFilter>('unplaced')
  const numbered = photos.map((photo, index) => ({ photo, number: index + 1 }))
  const shown = numbered.filter(({ photo }) =>
    filter === 'all'
      ? true
      : filter === 'placed'
        ? pinsByPhoto.has(photo.id)
        : !pinsByPhoto.has(photo.id),
  )

  return (
    <aside
      aria-label="Photos à placer"
      className="flex h-full min-h-0 flex-col rounded-xl border bg-card shadow-card"
    >
      <div className="grid gap-2 border-b p-3">
        <h3 className="text-sm font-semibold">Photos de la visite</h3>
        {photos.length > 0 && (
          <SegmentedControl<PanelFilter>
            label="Filtrer les photos"
            options={FILTERS}
            value={filter}
            onChange={setFilter}
            className="w-full [&>label]:flex-1 [&>label]:justify-center [&>label]:px-1 [&>label]:text-xs"
          />
        )}
      </div>
      {photos.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
          <Camera className="size-8 text-brand" aria-hidden="true" />
          <p>Aucune photo dans cette visite.</p>
          <Link
            to={{ name: 'visit', visitId, tab: 'photos' }}
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            Ajouter des photos dans l’onglet Photos
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <p className="p-4 text-center text-sm text-muted-foreground">
          {filter === 'unplaced' ? 'Toutes les photos sont placées.' : 'Aucune photo placée.'}
        </p>
      ) : (
        <>
          <p className="px-3 pt-2 text-xs text-muted-foreground">
            Glissez une photo sur le plan, ou cliquez dessus puis sur le plan.
          </p>
          <ul
            aria-label="Photos à placer"
            className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-3"
          >
            {shown.map(({ photo, number }) => (
              <li key={photo.id}>
                <PanelPhoto
                  photo={photo}
                  number={number}
                  pin={pinsByPhoto.get(photo.id)}
                  planName={planNames.get(pinsByPhoto.get(photo.id)?.planId ?? '')}
                  selected={selectedPhotoId === photo.id}
                  highlighted={highlightedPhotoId === photo.id}
                  onSelect={onSelect}
                  onHover={onHover}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  )
}

const PanelPhoto = memo(function PanelPhoto({
  photo,
  number,
  pin,
  planName,
  selected,
  highlighted,
  onSelect,
  onHover,
}: {
  photo: Photo
  number: number
  pin: Pin | undefined
  planName: string | undefined
  selected: boolean
  highlighted: boolean
  onSelect: (photoId: string | null) => void
  onHover: (photoId: string | null) => void
}) {
  const url = useObjectUrl(photo.thumbnailBlob)
  const label = photo.caption.trim() || `Photo ${number}`
  return (
    <button
      type="button"
      draggable
      aria-pressed={selected}
      aria-label={`${label}${pin ? ` — repère n°${pin.number}` : ' — non placée'}. Entrée pour choisir, puis Entrée sur le plan.`}
      onDragStart={(event) => {
        event.dataTransfer.setData(PLACE_PHOTO_TYPE, photo.id)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => {
        onSelect(selected ? null : photo.id)
      }}
      onMouseEnter={() => {
        onHover(photo.id)
      }}
      onMouseLeave={() => {
        onHover(null)
      }}
      className={cn(
        'group relative block w-full overflow-hidden rounded-lg border bg-muted text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        selected && 'ring-[3px] ring-brand',
        highlighted && 'ring-[3px] ring-accent-red/60',
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
      {pin && (
        <span className="absolute inset-x-0 bottom-0 truncate bg-brand/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
          n°{pin.number}
          {planName && ` · ${planName}`}
        </span>
      )}
    </button>
  )
})
