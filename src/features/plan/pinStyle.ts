/**
 * Pin appearance shared by the screen (PlanCanvas) and the generated image
 * (renderAnnotatedPlan), so the downloaded plan looks like the app.
 */
import { PHOTO_CATEGORY_LABELS } from '@/types/labels'
import type { PhotoCategory } from '@/types/media'

/** Pin color by photo category (hex, usable in CSS and canvas). */
export const PIN_COLORS: Record<PhotoCategory, string> = {
  defect: '#e1000f', // accent-red
  safety: '#ea7a00', // orange
  equipment: '#004e9f', // blue
  works: '#7c3aed', // violet
  general: '#374151', // dark grey
  other: '#374151',
}

export const PIN_TEXT_COLOR = '#ffffff'
export const PIN_BORDER_COLOR = '#ffffff'
/** Diameter on screen (px). */
export const PIN_SCREEN_DIAMETER = 28
/** Border width relative to the diameter. */
export const PIN_BORDER_RATIO = 0.09
/** Shadow for readability on busy plans. */
export const PIN_SHADOW = { color: 'rgba(0, 0, 0, 0.45)', blurRatio: 0.18, offsetRatio: 0.05 }
export const PIN_FONT_FAMILY = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif'

/** Legend rows: one per color (general and other share the grey). */
export const PIN_LEGEND: readonly { color: string; label: string; categories: PhotoCategory[] }[] =
  [
    { color: PIN_COLORS.defect, label: PHOTO_CATEGORY_LABELS.defect, categories: ['defect'] },
    { color: PIN_COLORS.safety, label: PHOTO_CATEGORY_LABELS.safety, categories: ['safety'] },
    {
      color: PIN_COLORS.equipment,
      label: PHOTO_CATEGORY_LABELS.equipment,
      categories: ['equipment'],
    },
    { color: PIN_COLORS.works, label: PHOTO_CATEGORY_LABELS.works, categories: ['works'] },
    {
      color: PIN_COLORS.general,
      label: `${PHOTO_CATEGORY_LABELS.general} / ${PHOTO_CATEGORY_LABELS.other}`,
      categories: ['general', 'other'],
    },
  ]

/** Font size of the number for a given diameter (smaller for 3-digit numbers). */
export function pinFontSize(diameter: number, number: number): number {
  return Math.round(diameter * (number >= 100 ? 0.38 : 0.46))
}
