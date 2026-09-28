import { computeTargetSize } from '@/features/photos/processing/imageSize'
import type { Pin, PhotoCategory } from '@/types/media'
import {
  PIN_BORDER_COLOR,
  PIN_BORDER_RATIO,
  PIN_COLORS,
  PIN_FONT_FAMILY,
  PIN_LEGEND,
  PIN_SHADOW,
  PIN_TEXT_COLOR,
  pinFontSize,
} from './pinStyle'

/** Default long side of the annotated plan (for the Word report). */
export const ANNOTATED_MAX_LONG_SIDE = 3000

/** Pin diameter on the generated image: ~1.4 % of the long side, 24 px minimum. */
export function annotatedPinDiameter(longSide: number): number {
  return Math.max(24, Math.round(longSide * 0.014))
}

/** Legend rows for the categories actually present (order of `PIN_LEGEND`). */
export function legendRowsFor(categories: Iterable<PhotoCategory>) {
  const present = new Set(categories)
  return PIN_LEGEND.filter((row) => row.categories.some((c) => present.has(c)))
}

/** Draws one pin exactly like on screen: colored disc, white border, shadow, white number. */
export function drawPin(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  diameter: number,
  color: string,
  number: number,
): void {
  const radius = diameter / 2
  context.save()
  context.shadowColor = PIN_SHADOW.color
  context.shadowBlur = diameter * PIN_SHADOW.blurRatio
  context.shadowOffsetY = diameter * PIN_SHADOW.offsetRatio
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fillStyle = PIN_BORDER_COLOR
  context.fill()
  context.restore()
  context.beginPath()
  context.arc(x, y, radius * (1 - PIN_BORDER_RATIO * 2), 0, Math.PI * 2)
  context.fillStyle = color
  context.fill()
  context.fillStyle = PIN_TEXT_COLOR
  context.font = `700 ${pinFontSize(diameter, number)}px ${PIN_FONT_FAMILY}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(String(number), x, y + diameter * 0.03)
}

function drawLegend(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  diameter: number,
  rows: ReturnType<typeof legendRowsFor>,
): void {
  if (rows.length === 0) return
  const fontSize = Math.round(diameter * 0.55)
  const swatch = Math.round(diameter * 0.6)
  const padding = Math.round(diameter * 0.5)
  const lineHeight = Math.round(diameter * 0.9)
  context.font = `600 ${fontSize}px ${PIN_FONT_FAMILY}`
  const textWidth = Math.max(...rows.map((row) => context.measureText(row.label).width))
  const boxWidth = padding * 2 + swatch + padding / 2 + textWidth
  const boxHeight = padding * 2 + lineHeight * rows.length - (lineHeight - swatch)
  const left = width - boxWidth - padding
  const top = height - boxHeight - padding
  context.fillStyle = 'rgba(255, 255, 255, 0.88)'
  context.strokeStyle = 'rgba(0, 0, 0, 0.2)'
  context.lineWidth = Math.max(1, diameter / 24)
  context.beginPath()
  context.roundRect(left, top, boxWidth, boxHeight, padding / 2)
  context.fill()
  context.stroke()
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  rows.forEach((row, index) => {
    const y = top + padding + index * lineHeight + swatch / 2
    context.beginPath()
    context.arc(left + padding + swatch / 2, y, swatch / 2, 0, Math.PI * 2)
    context.fillStyle = row.color
    context.fill()
    context.fillStyle = '#111827'
    context.fillText(row.label, left + padding + swatch + padding / 2, y)
  })
}

/**
 * Renders the plan with its pins (same style as on screen) and a legend of
 * the categories present, as a PNG — used for download and by the Word report.
 *
 * @param pins pins of THIS plan.
 * @param photosById category of each pinned photo (default: general).
 * @param options.maxLongSide output long side, 3000 px by default (never enlarged).
 */
export async function renderAnnotatedPlan(
  planBlob: Blob,
  pins: readonly Pin[],
  photosById: ReadonlyMap<string, { category: PhotoCategory }>,
  options: { maxLongSide?: number } = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(planBlob)
  try {
    const { width, height } = computeTargetSize(
      bitmap.width,
      bitmap.height,
      options.maxLongSide ?? ANNOTATED_MAX_LONG_SIDE,
    )
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('2D context unavailable')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)

    const diameter = annotatedPinDiameter(Math.max(width, height))
    const categoryOf = (pin: Pin) => photosById.get(pin.photoId)?.category ?? 'general'
    for (const pin of [...pins].sort((a, b) => a.number - b.number)) {
      drawPin(
        context,
        pin.x * width,
        pin.y * height,
        diameter,
        PIN_COLORS[categoryOf(pin)],
        pin.number,
      )
    }
    drawLegend(context, width, height, diameter, legendRowsFor(pins.map(categoryOf)))

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('PNG encoding failed'))
      }, 'image/png')
    })
  } finally {
    bitmap.close()
  }
}

/** File name "{site} - {plan} - {date}.png" without characters forbidden by Windows. */
export function annotatedPlanFileName(siteName: string, planName: string, date: string): string {
  const clean = (text: string) =>
    text
      .replace(/[<>:"/\\|?*]/g, ' ')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  return `${clean(`${siteName} - ${planName} - ${date}`).replace(/[. ]+$/, '')}.png`
}
