import { Eye, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from '@/app/Link'
import { DraftInput } from '@/components/form/DraftFields'
import { Button } from '@/components/ui/button'
import { useObjectUrl } from '@/lib/useObjectUrl'
import type { Pin, Photo } from '@/types/media'

export interface PinBubbleProps {
  visitId: string
  pin: Pin | null
  photo: Photo | undefined
  photoNumber: number
  onClose: () => void
  onLabel: (pinId: string, label: string) => void
  onViewPhoto: (photoId: string) => void
  onRemove: (pinId: string) => void
}

/** Bubble anchored to a pin (native popover + CSS anchor positioning). */
export function PinBubble({
  visitId,
  pin,
  photo,
  photoNumber,
  onClose,
  onLabel,
  onViewPhoto,
  onRemove,
}: PinBubbleProps) {
  const ref = useRef<HTMLDivElement>(null)
  const thumbnail = useObjectUrl(photo?.thumbnailBlob)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (pin) element.showPopover()
    else element.hidePopover()
  }, [pin])

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const onToggle = (event: Event) => {
      if ((event as ToggleEvent).newState === 'closed') onClose()
    }
    element.addEventListener('toggle', onToggle)
    return () => {
      element.removeEventListener('toggle', onToggle)
    }
  }, [onClose])

  const caption = photo?.caption.trim()
  return (
    <div
      ref={ref}
      popover="auto"
      role="dialog"
      aria-label={pin ? `Repère n°${pin.number}` : undefined}
      className="w-80 overflow-visible rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
      style={
        pin
          ? {
              positionAnchor: `--pin-${pin.id}`,
              inset: 'auto',
              top: 'anchor(bottom)',
              left: 'anchor(center)',
              translate: '-50% 0',
              margin: '10px 0 0 0',
              positionTryFallbacks: 'flip-block',
            }
          : undefined
      }
    >
      {pin && (
        <div className="grid gap-2">
          <div className="flex items-start gap-3">
            <div className="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
              {thumbnail && <img src={thumbnail} alt="" className="size-full object-cover" />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold">Repère n°{pin.number}</p>
              <p className="text-xs text-muted-foreground">Photo {photoNumber}</p>
              <p className="mt-1 line-clamp-2 text-xs">
                {caption || <em className="text-muted-foreground">Sans légende</em>}
              </p>
              <Link
                to={{ name: 'visit', visitId, tab: 'photos' }}
                className="text-xs font-medium text-brand underline-offset-4 hover:underline"
              >
                Modifier dans Photos
              </Link>
            </div>
          </div>
          <label className="grid gap-1 text-xs font-medium">
            Étiquette du repère
            <DraftInput
              key={pin.id}
              value={pin.label ?? ''}
              maxLength={200}
              placeholder="Ex. : fuite en toiture"
              onValueChange={(label) => {
                onLabel(pin.id, label)
              }}
              className="h-8 bg-surface"
            />
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                onViewPhoto(pin.photoId)
              }}
            >
              <Eye aria-hidden="true" />
              Voir la photo
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-danger hover:text-danger"
              onClick={() => {
                onRemove(pin.id)
              }}
            >
              <Trash2 aria-hidden="true" />
              Retirer du plan
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
