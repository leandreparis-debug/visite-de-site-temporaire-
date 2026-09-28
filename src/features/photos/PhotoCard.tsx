import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  FolderOpen,
  MoreHorizontal,
  RotateCcw,
  RotateCw,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { memo, useEffect, useRef, type DragEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toUserMessage } from '@/lib/errors'
import { useObjectUrl } from '@/lib/useObjectUrl'
import { cn } from '@/lib/utils'
import type { Photo } from '@/types/media'
import { CaptionField, CategorySelect } from './photoFields'
import { formatPinNumbers, formatTakenAt } from './photoFormat'
import type { PhotoMetaSaver } from './usePhotoMetaSaver'

export type PhotoCardAction =
  | 'open'
  | 'rotate-left'
  | 'rotate-right'
  | 'move-first'
  | 'move-last'
  | 'move-prev'
  | 'move-next'
  | 'delete'

export interface PhotoCardProps {
  photo: Photo
  /** 1-based position in the full order. */
  number: number
  pinNumbers: readonly number[]
  selected: boolean
  busy: boolean
  saver: PhotoMetaSaver
  /** Give the focus back to this card (after a keyboard reorder). */
  focusRequested: boolean
  dropIndicator: 'before' | 'after' | null
  onToggleSelect: (id: string, selected: boolean) => void
  onAction: (id: string, action: PhotoCardAction) => void
  onDragStartCard: (id: string) => void
  onDragOverCard: (id: string, side: 'before' | 'after') => void
  onDropCard: (id: string) => void
  onDragEndCard: () => void
}

const INTERNAL_TYPE = 'application/x-cp-photo'

const MENU: readonly [PhotoCardAction, string, LucideIcon][] = [
  ['open', 'Ouvrir', FolderOpen],
  ['rotate-left', 'Pivoter à gauche', RotateCcw],
  ['rotate-right', 'Pivoter à droite', RotateCw],
  ['move-first', 'Déplacer au début', ArrowLeft],
  ['move-last', 'Déplacer à la fin', ChevronRight],
  ['delete', 'Supprimer', Trash2],
]

function isEditable(target: EventTarget): boolean {
  return target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
}

/** Gallery card: thumbnail, number, pin badge, caption, category, actions. */
export const PhotoCard = memo(function PhotoCard({
  photo,
  number,
  pinNumbers,
  selected,
  busy,
  saver,
  focusRequested,
  dropIndicator,
  onToggleSelect,
  onAction,
  onDragStartCard,
  onDragOverCard,
  onDropCard,
  onDragEndCard,
}: PhotoCardProps) {
  const thumbnailUrl = useObjectUrl(photo.thumbnailBlob)
  const openRef = useRef<HTMLButtonElement>(null)
  const caption = saver.valueOf(photo, 'caption')
  const error = saver.errorOf(photo.id)
  const alt = caption.trim() || `Photo ${number}`

  useEffect(() => {
    if (focusRequested) openRef.current?.focus()
  }, [focusRequested, number])

  const onKeyDown = (event: KeyboardEvent) => {
    if (!event.altKey || isEditable(event.target)) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      onAction(photo.id, event.key === 'ArrowLeft' ? 'move-prev' : 'move-next')
    }
  }

  const onDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(INTERNAL_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const box = event.currentTarget.getBoundingClientRect()
    onDragOverCard(photo.id, event.clientX < box.left + box.width / 2 ? 'before' : 'after')
  }

  return (
    <article
      draggable={!busy}
      onKeyDown={onKeyDown}
      onDragStart={(event) => {
        if (isEditable(event.target)) return
        event.dataTransfer.setData(INTERNAL_TYPE, photo.id)
        event.dataTransfer.effectAllowed = 'move'
        onDragStartCard(photo.id)
      }}
      onDragOver={onDragOver}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes(INTERNAL_TYPE)) return
        event.preventDefault()
        event.stopPropagation()
        onDropCard(photo.id)
      }}
      onDragEnd={onDragEndCard}
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-card transition-shadow',
        selected && 'ring-2 ring-brand',
        error !== undefined && 'border-danger',
        dropIndicator === 'before' &&
          'before:absolute before:inset-y-2 before:-left-2 before:w-1 before:rounded before:bg-brand',
        dropIndicator === 'after' &&
          'after:absolute after:inset-y-2 after:-right-2 after:w-1 after:rounded after:bg-brand',
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <button
          ref={openRef}
          type="button"
          onClick={() => {
            onAction(photo.id, 'open')
          }}
          className="absolute inset-0 block outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:ring-inset"
          aria-label={`Ouvrir : ${alt}`}
          title="Ouvrir (Alt+← / Alt+→ pour déplacer)"
        >
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={alt}
              loading="lazy"
              decoding="async"
              draggable={false}
              className={cn('size-full object-cover', busy && 'opacity-40')}
            />
          )}
        </button>
        <span
          className="pointer-events-none absolute top-2 left-2 flex size-6 items-center justify-center rounded-full bg-foreground/80 text-xs font-semibold text-white"
          aria-hidden="true"
        >
          {number}
        </span>
        <input
          type="checkbox"
          checked={selected}
          aria-label={`Sélectionner la photo ${number}`}
          onChange={(event) => {
            onToggleSelect(photo.id, event.target.checked)
          }}
          className="absolute top-2 right-2 size-5 cursor-pointer accent-brand"
        />
        {pinNumbers.length > 0 && (
          <span className="absolute bottom-2 left-2 rounded-md bg-brand px-1.5 py-0.5 text-xs font-medium text-brand-foreground">
            {formatPinNumbers(pinNumbers)}
          </span>
        )}
      </div>
      <div className="grid gap-1.5 p-2">
        <CaptionField photo={photo} saver={saver} label={`Légende de la photo ${number}`} />
        <div className="flex items-center gap-1.5">
          <CategorySelect
            photo={photo}
            saver={saver}
            label={`Catégorie de la photo ${number}`}
            className="min-w-0 flex-1"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={`Actions pour la photo ${number}`}
                disabled={busy}
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {MENU.map(([action, label, Icon]) => (
                <DropdownMenuItem
                  key={action}
                  variant={action === 'delete' ? 'destructive' : 'default'}
                  onSelect={() => {
                    onAction(photo.id, action)
                  }}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {photo.takenAt && (
          <p className="px-2 text-xs text-muted-foreground">
            Prise le {formatTakenAt(photo.takenAt)}
          </p>
        )}
        {error !== undefined && (
          <div role="alert" className="flex items-center gap-2 px-2 text-xs text-danger">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="flex-1" title={toUserMessage(error)}>
              Erreur d’enregistrement
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs"
              onClick={() => void saver.flush(photo.id)}
            >
              Réessayer
            </Button>
          </div>
        )}
      </div>
    </article>
  )
})
