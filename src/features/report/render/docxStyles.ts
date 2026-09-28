/**
 * Visual constants of the Word report: colours, fonts, sizes, page geometry.
 * The single source for `renderReportDocx` (no hard-coded style elsewhere).
 *
 * Units: sizes in half-points (Word `w:sz`), lengths in twips (1/1440 in),
 * image sizes in pixels at 96 dpi (converted by `docx`).
 */
import type { Tone } from '../model/reportModel'

/** Hex colours without "#", as Word expects. */
export const REPORT_COLORS = {
  brand: '004E9F',
  brandSoft: 'E8F0FA',
  text: '1F2937',
  muted: '6B7280',
  danger: 'E1000F',
  warning: 'B45309',
  success: '1A7F45',
  border: 'D1D5DB',
  shade: 'F3F4F6',
  white: 'FFFFFF',
} as const

export const TONE_COLORS: Record<Tone, string> = {
  normal: REPORT_COLORS.text,
  danger: REPORT_COLORS.danger,
  warning: REPORT_COLORS.warning,
  success: REPORT_COLORS.success,
  muted: REPORT_COLORS.muted,
}

/** Calibri is installed with every Office; Word substitutes Arial if it is missing. */
export const REPORT_FONT = 'Calibri'

/** Font sizes in half-points. */
export const FONT_SIZES = {
  body: 21,
  small: 18,
  table: 18,
  heading1: 32,
  heading2: 25,
  coverKind: 28,
  coverTitle: 52,
  coverSite: 30,
  cover: 24,
} as const

/** A4 in twips, and margins (2 cm sides, room for header and footer). */
export const PAGE = {
  width: 11906,
  height: 16838,
  margin: { top: 1418, bottom: 1134, left: 1134, right: 1134, header: 567, footer: 567 },
} as const

const TWIPS_PER_PX = 15 // 1440 twips per inch / 96 px per inch

/** Usable width in twips, portrait or landscape. */
export function contentWidthTwips(landscape: boolean): number {
  const width = landscape ? PAGE.height : PAGE.width
  return width - PAGE.margin.left - PAGE.margin.right
}

/** Usable width / height in pixels (96 dpi) of a page. */
export function contentBoxPx(landscape: boolean): { width: number; height: number } {
  const width = contentWidthTwips(landscape)
  const height = (landscape ? PAGE.width : PAGE.height) - PAGE.margin.top - PAGE.margin.bottom
  return { width: Math.floor(width / TWIPS_PER_PX), height: Math.floor(height / TWIPS_PER_PX) }
}

/** Boxes (px) of the images: plan under its title, photos 2 or 6 per page, logos. */
export const IMAGE_BOXES = {
  /** Landscape page minus the plan title (and the section title on the first plan). */
  plan: { width: contentBoxPx(true).width, height: contentBoxPx(true).height - 110 },
  /** 2 per page: one per row, full width. */
  photoLarge: { width: contentBoxPx(false).width - 20, height: 330 },
  /** 6 per page: 3 rows of 2. */
  photoSmall: { width: Math.floor(contentBoxPx(false).width / 2) - 20, height: 200 },
  coverLogoHeight: 64,
  headerLogoHeight: 22,
} as const

/** Table cell padding (twips). */
export const CELL_MARGINS = { top: 50, bottom: 50, left: 90, right: 90 } as const

/** Fits `width × height` inside a box, keeping the ratio (never enlarged). */
export function fitImage(
  width: number,
  height: number,
  box: { width: number; height: number },
): { width: number; height: number } {
  const scale = Math.min(1, box.width / width, box.height / height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}
