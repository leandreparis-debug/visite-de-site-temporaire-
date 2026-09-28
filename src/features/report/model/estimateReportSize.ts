/**
 * Pure estimate of the size of the generated .docx, shown as "environ …" in
 * the Report tab and refreshed when the options change.
 *
 * Photos are stored as ~2000 px JPEG (quality 0.82); the report re-encodes
 * them at 1600 px / 0.8 ("Standard") or 1000 px / 0.75 ("Allégée"): the size
 * scales with the pixel count and the quality. Annotated plans are PNG
 * (3000 or 2000 px), estimated per output pixel. The .docx zip barely
 * compresses JPEG/PNG, so the file is about the sum of its images.
 */
import type { ReportQuality } from './reportModel'

/** Image settings of each quality level (also used by prepareReportAssets). */
export const REPORT_IMAGE_SETTINGS: Record<
  ReportQuality,
  { photoMaxSide: number; photoJpegQuality: number; planMaxSide: number }
> = {
  standard: { photoMaxSide: 1600, photoJpegQuality: 0.8, planMaxSide: 3000 },
  light: { photoMaxSide: 1000, photoJpegQuality: 0.75, planMaxSide: 2000 },
}

/**
 * Size factor of a JPEG re-encoded at each quality, relative to the stored
 * 0.82 (beyond the pixel ratio). Calibrated on the load test (60 photos of
 * 12 Mpx): the size drops faster than the quality.
 */
const JPEG_QUALITY_FACTOR: Record<ReportQuality, number> = { standard: 0.72, light: 0.45 }
/** Average bytes per pixel of an annotated plan in PNG (line drawings compress well). */
const PLAN_PNG_BYTES_PER_PIXEL = 0.15
/** XML, styles, logo, headers: fixed part of the file. */
const BASE_BYTES = 60_000

export interface SizeEstimateInput {
  photos: readonly { bytes: number; width: number; height: number }[]
  plans: readonly { width: number; height: number }[]
  quality: ReportQuality
}

/** Ratio of pixels kept when fitting `width × height` into `maxSide` (never enlarged). */
function pixelRatio(width: number, height: number, maxSide: number): number {
  const scale = Math.min(1, maxSide / Math.max(width, height, 1))
  return scale * scale
}

/**
 * Estimated size of the report in bytes (photos and plans actually included).
 * @example estimateReportSize({ photos: [], plans: [], quality: 'standard' }) // 60000
 */
export function estimateReportSize({ photos, plans, quality }: SizeEstimateInput): number {
  const settings = REPORT_IMAGE_SETTINGS[quality]
  let bytes = BASE_BYTES
  for (const photo of photos) {
    bytes +=
      photo.bytes *
      pixelRatio(photo.width, photo.height, settings.photoMaxSide) *
      JPEG_QUALITY_FACTOR[quality]
  }
  for (const plan of plans) {
    bytes +=
      plan.width *
      plan.height *
      pixelRatio(plan.width, plan.height, settings.planMaxSide) *
      PLAN_PNG_BYTES_PER_PIXEL
  }
  return Math.round(bytes)
}

/**
 * French size, rounded: "850 Ko", "4,2 Mo".
 * @example formatFileSize(4_400_000) // "4,2 Mo"
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}
