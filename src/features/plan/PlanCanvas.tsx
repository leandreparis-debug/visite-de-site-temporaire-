import { Maximize, Minus, Plus } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { Button } from '@/components/ui/button'
import { useObjectUrl } from '@/lib/useObjectUrl'
import { cn } from '@/lib/utils'
import type { Pin, Plan, PhotoCategory } from '@/types/media'
import { PIN_COLORS, PIN_LEGEND, PIN_SCREEN_DIAMETER, pinFontSize } from './pinStyle'
import {
  clampPan,
  fitToContainer,
  normalizedToScreen,
  screenToNormalized,
  zoomAroundPoint,
  zoomBounds,
  type Point,
  type Size,
  type View,
} from './viewport'

/** dataTransfer type used to drag a photo from the panel onto the plan. */
export const PLACE_PHOTO_TYPE = 'application/x-cp-place-photo'

const ZOOM_STEP = 1.25
const PAN_STEP = 80
/** Pointer movement (px) under which a press is a click, not a drag. */
const CLICK_TOLERANCE = 4

export interface PlanCanvasPin extends Pin {
  category: PhotoCategory
  /** Accessible description (caption or "Photo n°…"). */
  description: string
}

export interface PlanCanvasProps {
  plan: Plan
  pins: readonly PlanCanvasPin[]
  /** Photo waiting to be placed (click mode), or null. */
  placingPhotoId: string | null
  highlightedPhotoId: string | null
  openPinId: string | null
  onHoverPhoto: (photoId: string | null) => void
  onPlace: (photoId: string, point: Point) => void
  /** Called ONCE when a pin drag ends (never during the drag). */
  onPinMove: (pinId: string, point: Point) => void
  onPinNudge: (pinId: string, dx: number, dy: number) => void
  onPinOpen: (pinId: string) => void
  onPinRemove: (pinId: string) => void
  /** Exposes the zoom level (for tests / e2e measurements). */
  onViewChange?: (view: View) => void
}

type Gesture =
  | { kind: 'pan'; start: Point; origin: View; moved: boolean }
  | { kind: 'pin'; pinId: string; start: Point; moved: boolean }

/**
 * Zoomable / pannable plan with a pin layer. Pins are positioned with
 * `normalizedToScreen` (NOT scaled), so they keep a constant size on screen.
 * All state during gestures (pan, zoom, pin drag) is local: the visit is only
 * updated once, at the end of an action.
 */
export function PlanCanvas({
  plan,
  pins,
  placingPhotoId,
  highlightedPhotoId,
  openPinId,
  onHoverPhoto,
  onPlace,
  onPinMove,
  onPinNudge,
  onPinOpen,
  onPinRemove,
  onViewChange,
}: PlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageUrl = useObjectUrl(plan.blob)
  const image: Size = { width: plan.width, height: plan.height }
  const [container, setContainer] = useState<Size | null>(null)
  const [view, setView] = useState<View | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  // Local position of the pin being dragged (not saved until release).
  const [dragPin, setDragPin] = useState<{ pinId: string; point: Point } | null>(null)
  const [legendOpen, setLegendOpen] = useState(true)

  // Container size (and fit on first measure / plan change).
  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    const measure = () => {
      const box = element.getBoundingClientRect()
      if (box.width > 0 && box.height > 0) setContainer({ width: box.width, height: box.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])

  const planKey = `${plan.id}:${plan.width}x${plan.height}`
  const [fittedFor, setFittedFor] = useState('')
  if (container && fittedFor !== planKey) {
    // Fit when the plan changes (adjusting state during render, React-documented pattern).
    setFittedFor(planKey)
    setView(fitToContainer(image, container))
  }

  useEffect(() => {
    if (view) onViewChange?.(view)
  }, [view, onViewChange])

  const bounds = container ? zoomBounds(image, container) : { min: 1, max: 1 }
  const zoomPercent = view && container ? Math.round((view.scale / bounds.min) * 100) : 100

  const applyView = useCallback(
    (next: View) => {
      if (container) setView(clampPan(next, image, container))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [container, image.width, image.height],
  )

  const zoomBy = (factor: number, point?: Point) => {
    if (!view || !container) return
    const center = point ?? { x: container.width / 2, y: container.height / 2 }
    applyView(zoomAroundPoint(view, factor, center, bounds))
  }
  const fit = () => {
    if (container) setView(fitToContainer(image, container))
  }

  // Wheel zoom around the cursor (non-passive listener to prevent page scroll).
  const viewRef = useRef(view)
  const zoomRef = useRef(zoomBy)
  useEffect(() => {
    viewRef.current = view
    zoomRef.current = zoomBy
  })
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const box = element.getBoundingClientRect()
      const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0015))
      zoomRef.current(factor, { x: event.clientX - box.left, y: event.clientY - box.top })
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', onWheel)
    }
  }, [])

  const localPoint = (event: { clientX: number; clientY: number }): Point => {
    const box = containerRef.current?.getBoundingClientRect()
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) }
  }
  const toNormalized = (point: Point) => (view ? screenToNormalized(point, view, image) : point)
  const inPlan = (normalized: Point) =>
    normalized.x >= 0 && normalized.x <= 1 && normalized.y >= 0 && normalized.y <= 1

  // ─── Background: pan, or place in click mode ───────────────────────────────
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !view) return
    event.currentTarget.setPointerCapture(event.pointerId)
    gestureRef.current = { kind: 'pan', start: localPoint(event), origin: view, moved: false }
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture) return
    const point = localPoint(event)
    const dx = point.x - gesture.start.x
    const dy = point.y - gesture.start.y
    if (!gesture.moved && Math.hypot(dx, dy) < CLICK_TOLERANCE) return
    gesture.moved = true
    if (gesture.kind === 'pan') {
      applyView({ ...gesture.origin, tx: gesture.origin.tx + dx, ty: gesture.origin.ty + dy })
    } else {
      setDragPin({ pinId: gesture.pinId, point })
    }
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    gestureRef.current = null
    if (!gesture) return
    const point = localPoint(event)
    if (gesture.kind === 'pin') {
      setDragPin(null)
      const normalized = toNormalized(point)
      // ONE update at release.
      if (gesture.moved) onPinMove(gesture.pinId, normalized)
      else onPinOpen(gesture.pinId)
      return
    }
    if (!gesture.moved && placingPhotoId) {
      const normalized = toNormalized(point)
      if (inPlan(normalized)) onPlace(placingPhotoId, normalized)
    }
  }

  // ─── Drop of a photo from the panel ──────────────────────────────────────
  const onDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(PLACE_PHOTO_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }
  const onDrop = (event: DragEvent) => {
    const photoId = event.dataTransfer.getData(PLACE_PHOTO_TYPE)
    if (!photoId) return
    event.preventDefault()
    const normalized = toNormalized(localPoint(event))
    if (inPlan(normalized)) onPlace(photoId, normalized)
  }

  // ─── Keyboard on the plan area ───────────────────────────────────────────
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !view || !container) return
    const pan = (dx: number, dy: number) => {
      applyView({ ...view, tx: view.tx + dx, ty: view.ty + dy })
    }
    const actions: Record<string, () => void> = {
      '+': () => {
        zoomBy(ZOOM_STEP)
      },
      '=': () => {
        zoomBy(ZOOM_STEP)
      },
      '-': () => {
        zoomBy(1 / ZOOM_STEP)
      },
      '0': fit,
      ArrowLeft: () => {
        pan(PAN_STEP, 0)
      },
      ArrowRight: () => {
        pan(-PAN_STEP, 0)
      },
      ArrowUp: () => {
        pan(0, PAN_STEP)
      },
      ArrowDown: () => {
        pan(0, -PAN_STEP)
      },
      Enter: () => {
        // Keyboard placement: center of the visible area.
        if (!placingPhotoId) return
        const center = toNormalized({ x: container.width / 2, y: container.height / 2 })
        onPlace(placingPhotoId, {
          x: Math.min(1, Math.max(0, center.x)),
          y: Math.min(1, Math.max(0, center.y)),
        })
      },
    }
    const action = actions[event.key]
    if (action) {
      event.preventDefault()
      action()
    }
  }

  const onPinKeyDown = (event: KeyboardEvent<HTMLButtonElement>, pin: PlanCanvasPin) => {
    const step = event.shiftKey ? 0.05 : 0.005
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      event.stopPropagation()
      onPinNudge(pin.id, move[0], move[1])
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      event.stopPropagation()
      onPinRemove(pin.id)
    }
  }

  const categories = new Set(pins.map((pin) => pin.category))
  const legend = PIN_LEGEND.filter((row) => row.categories.some((c) => categories.has(c)))

  return (
    <div className="relative h-full overflow-hidden rounded-xl border bg-muted/40">
      <div
        ref={containerRef}
        role="application"
        aria-roledescription="plan zoomable"
        aria-label={`Plan « ${plan.name} » : molette ou + / − pour zoomer, flèches pour se déplacer, 0 pour ajuster${placingPhotoId ? ', Entrée pour placer la photo au centre' : ''}`}
        tabIndex={0}
        data-testid="plan-canvas"
        data-zoom={zoomPercent}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          gestureRef.current = null
          setDragPin(null)
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onKeyDown={onKeyDown}
        className={cn(
          'absolute inset-0 touch-none outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
          placingPhotoId ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing',
        )}
      >
        {imageUrl && view && (
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            data-testid="plan-image"
            className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left bg-white shadow-sm"
            style={{
              width: plan.width,
              height: plan.height,
              transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            }}
          />
        )}
        {view &&
          pins.map((pin) => {
            const dragged = dragPin?.pinId === pin.id ? dragPin.point : null
            const position = dragged ?? normalizedToScreen(pin, view, image)
            const highlighted = highlightedPhotoId === pin.photoId || openPinId === pin.id
            return (
              <button
                key={pin.id}
                type="button"
                data-pin-number={pin.number}
                aria-label={`Repère n°${pin.number} : ${pin.description}. Flèches pour déplacer, Entrée pour ouvrir, Suppr pour retirer.`}
                aria-expanded={openPinId === pin.id}
                onPointerDown={(event) => {
                  if (event.button !== 0) return
                  event.stopPropagation()
                  containerRef.current?.setPointerCapture(event.pointerId)
                  gestureRef.current = {
                    kind: 'pin',
                    pinId: pin.id,
                    start: localPoint(event),
                    moved: false,
                  }
                }}
                onClick={(event) => {
                  // Keyboard activation (Enter/Space); pointer clicks are handled on release.
                  if (event.detail === 0) onPinOpen(pin.id)
                }}
                onKeyDown={(event) => {
                  onPinKeyDown(event, pin)
                }}
                onMouseEnter={() => {
                  onHoverPhoto(pin.photoId)
                }}
                onMouseLeave={() => {
                  onHoverPhoto(null)
                }}
                onFocus={() => {
                  onHoverPhoto(pin.photoId)
                }}
                onBlur={() => {
                  onHoverPhoto(null)
                }}
                className={cn(
                  'absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-[2.5px] border-white font-bold text-white shadow-[0_1px_5px_rgba(0,0,0,0.45)] transition-[box-shadow,scale] outline-none focus-visible:ring-4 focus-visible:ring-ring',
                  highlighted && 'z-10 scale-125 ring-4 ring-brand/40',
                  dragged && 'z-20 cursor-grabbing',
                )}
                style={{
                  left: position.x,
                  top: position.y,
                  width: PIN_SCREEN_DIAMETER,
                  height: PIN_SCREEN_DIAMETER,
                  fontSize: pinFontSize(PIN_SCREEN_DIAMETER, pin.number),
                  backgroundColor: PIN_COLORS[pin.category],
                  anchorName: `--pin-${pin.id}`,
                }}
              >
                {pin.number}
              </button>
            )
          })}
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-1 rounded-lg border bg-surface/95 p-1 shadow-card">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Zoom avant"
          onClick={() => {
            zoomBy(ZOOM_STEP)
          }}
        >
          <Plus aria-hidden="true" />
        </Button>
        <span
          className="w-12 text-center text-xs tabular-nums"
          aria-live="polite"
          data-testid="zoom-level"
        >
          {zoomPercent} %
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Zoom arrière"
          onClick={() => {
            zoomBy(1 / ZOOM_STEP)
          }}
        >
          <Minus aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={fit}>
          <Maximize aria-hidden="true" />
          Ajuster
        </Button>
      </div>

      {legend.length > 0 && (
        <div className="absolute bottom-3 left-3 rounded-lg border bg-surface/95 text-xs shadow-card">
          <button
            type="button"
            aria-expanded={legendOpen}
            className="w-full px-3 py-1.5 text-left font-medium"
            onClick={() => {
              setLegendOpen((open) => !open)
            }}
          >
            Légende {legendOpen ? '▾' : '▸'}
          </button>
          {legendOpen && (
            <ul className="grid gap-1 px-3 pb-2">
              {legend.map((row) => (
                <li key={row.label} className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full border border-white shadow"
                    style={{ backgroundColor: row.color }}
                  />
                  {row.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
