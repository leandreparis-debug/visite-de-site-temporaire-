import { ChevronLeft, ChevronRight, RotateCcw, RotateCw, X, type LucideIcon } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useObjectUrl } from '@/lib/useObjectUrl'
import type { Photo } from '@/types/media'
import { CaptionField, CategorySelect } from './photoFields'
import { formatTakenAt } from './photoFormat'
import type { PhotoMetaSaver } from './usePhotoMetaSaver'

const ROTATIONS: readonly ['left' | 'right', string, LucideIcon][] = [
  ['left', 'Pivoter à gauche', RotateCcw],
  ['right', 'Pivoter à droite', RotateCw],
]

export interface PhotoViewerProps {
  photos: readonly Photo[]
  /** Index in `photos`, or `null` when closed. */
  index: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
  onRotate: (photoId: string, direction: 'left' | 'right') => void
  busyId: string | null
  saver: PhotoMetaSaver
  /** 1-based position of a photo in the full order. */
  numberOf: (photoId: string) => number
}

/** Full-screen viewer: ← → to navigate, Escape to close, caption/category editable. */
export function PhotoViewer({
  photos,
  index,
  onIndexChange,
  onClose,
  onRotate,
  busyId,
  saver,
  numberOf,
}: PhotoViewerProps) {
  const photo = index === null ? undefined : photos[index]
  const next = index === null ? undefined : photos[index + 1]
  const imageUrl = useObjectUrl(photo?.blob)
  // Preloads the next photo so that "suivant" is instant.
  const nextUrl = useObjectUrl(next?.blob)

  const close = () => {
    void saver.flush()
    onClose()
  }
  const go = (delta: number) => {
    if (index === null) return
    const target = index + delta
    if (target >= 0 && target < photos.length) onIndexChange(target)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (
      event.target instanceof HTMLElement &&
      /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)
    )
      return
    if (event.key === 'ArrowLeft') go(-1)
    else if (event.key === 'ArrowRight') go(1)
  }

  const number = photo ? numberOf(photo.id) : 0
  return (
    <Dialog
      open={photo !== undefined}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="m-0 h-dvh max-h-none w-screen max-w-none rounded-none border-0 bg-neutral-950 text-white sm:max-w-none"
        bodyClassName="flex h-full flex-col gap-0 p-0"
        onKeyDown={onKeyDown}
      >
        {photo && (
          <>
            <header className="flex items-center gap-4 px-4 py-3 text-sm">
              <DialogTitle className="text-base font-medium">
                {index !== null && `${index + 1} / ${photos.length}`}
              </DialogTitle>
              <DialogDescription className="flex-1 truncate text-white/70">
                Photo {number}
                {photo.originalName && ` · ${photo.originalName}`} ·{' '}
                <span data-testid="viewer-dimensions">
                  {photo.width} × {photo.height} px
                </span>
                {photo.takenAt && ` · prise le ${formatTakenAt(photo.takenAt)}`}
              </DialogDescription>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fermer la visionneuse"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={close}
              >
                <X aria-hidden="true" />
              </Button>
            </header>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-16">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={photo.caption.trim() || `Photo ${number}`}
                  decoding="async"
                  className="max-h-full max-w-full object-contain"
                />
              )}
              {nextUrl && <img src={nextUrl} alt="" hidden />}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Photo précédente"
                disabled={index === 0}
                onClick={() => {
                  go(-1)
                }}
                className="absolute left-3 size-11 rounded-full text-white hover:bg-white/10 hover:text-white"
              >
                <ChevronLeft className="size-7" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Photo suivante"
                disabled={index === photos.length - 1}
                onClick={() => {
                  go(1)
                }}
                className="absolute right-3 size-11 rounded-full text-white hover:bg-white/10 hover:text-white"
              >
                <ChevronRight className="size-7" aria-hidden="true" />
              </Button>
            </div>
            <footer className="flex items-center gap-3 bg-neutral-900 px-4 py-3 text-foreground">
              <CaptionField
                key={photo.id}
                photo={photo}
                saver={saver}
                label="Légende"
                className="h-9 flex-1 border-white/20 bg-white/10 text-white placeholder:text-white/50 focus-visible:bg-white/15"
              />
              <CategorySelect photo={photo} saver={saver} label="Catégorie" className="w-44" />
              {ROTATIONS.map(([direction, label, Icon]) => (
                <Button
                  key={direction}
                  variant="secondary"
                  size="sm"
                  disabled={busyId === photo.id}
                  onClick={() => {
                    onRotate(photo.id, direction)
                  }}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </Button>
              ))}
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
