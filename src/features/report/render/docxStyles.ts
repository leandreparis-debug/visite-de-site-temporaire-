/**
 * Visual identity of the Word report: colours, fonts, sizes, page geometry.
 * The single source for `renderReportDocx` (no hard-coded style elsewhere).
 *
 * Art direction: Carrefour Property plum (logo colour) as the only accent,
 * warm dark ink for text, generous white space, thin horizontal rules
 * instead of grids, tinted cards with a coloured accent bar.
 *
 * Units: sizes in half-points (Word `w:sz`), lengths in twips (1/1440 in),
 * image sizes in pixels at 96 dpi (converted by `docx`).
 */
import type { Tone } from '../model/reportModel'

/** Hex colours without "#", as Word expects. */
export const REPORT_COLORS = {
  /** Carrefour Property plum, from the logo. */
  brand: '8D2562',
  brandSoft: 'F7ECF2',
  ink: '1D1720',
  text: '2E2733',
  muted: '6F6775',
  line: 'E4DEE4',
  shade: 'F6F3F6',
  danger: 'D0021B',
  warning: 'B45309',
  success: '1A7F45',
  white: 'FFFFFF',
} as const

export const TONE_COLORS: Record<Tone, string> = {
  normal: REPORT_COLORS.text,
  danger: REPORT_COLORS.danger,
  warning: REPORT_COLORS.warning,
  success: REPORT_COLORS.success,
  muted: REPORT_COLORS.muted,
}

/** Accent bar colour of a card, by tone. */
export const TONE_ACCENTS: Record<Tone, string> = {
  normal: REPORT_COLORS.brand,
  danger: REPORT_COLORS.danger,
  warning: REPORT_COLORS.warning,
  success: REPORT_COLORS.success,
  muted: REPORT_COLORS.line,
}

/** Calibri is installed with every Office; Word substitutes Arial if it is missing. */
export const REPORT_FONT = 'Calibri'

/** Font sizes in half-points. */
export const FONT_SIZES = {
  body: 20,
  small: 17,
  label: 15,
  table: 18,
  heading1: 34,
  heading2: 24,
  kpi: 26,
  coverKind: 20,
  coverTitle: 56,
  coverValue: 24,
} as const

/** Letter spacing (twentieths of a point) of the small uppercase labels. */
export const LABEL_SPACING = 30

/** A4 portrait in twips, and margins (2 cm sides, room for header and footer). */
export const PAGE = {
  width: 11906,
  height: 16838,
  margin: { top: 1418, bottom: 1300, left: 1134, right: 1134, header: 567, footer: 567 },
} as const

const TWIPS_PER_PX = 15 // 1440 twips per inch / 96 px per inch

/** Usable width in twips (every page is portrait). */
export const CONTENT_WIDTH = PAGE.width - PAGE.margin.left - PAGE.margin.right

/** Usable width in pixels (96 dpi). */
const CONTENT_WIDTH_PX = Math.floor(CONTENT_WIDTH / TWIPS_PER_PX)

/** Boxes (px) of the images: plan under its title, photos 2, 4 or 6 per page, logos. */
export const IMAGE_BOXES = {
  /** Full width of the portrait page, room left for the plan title. */
  plan: { width: CONTENT_WIDTH_PX, height: 760 },
  /** 2 per page: one per row, full width. */
  photoLarge: { width: CONTENT_WIDTH_PX - 24, height: 330 },
  /** 4 per page: 2 rows of 2. */
  photoMedium: { width: Math.floor(CONTENT_WIDTH_PX / 2) - 24, height: 330 },
  /** 6 per page: 3 rows of 2. */
  photoSmall: { width: Math.floor(CONTENT_WIDTH_PX / 2) - 24, height: 200 },
  /** Photos under an area of the observations, 2 per row. */
  zonePhoto: { width: Math.floor(CONTENT_WIDTH_PX / 2) - 24, height: 230 },
  /** Site photo of the cover, full width. */
  coverPhoto: { width: CONTENT_WIDTH_PX, height: 400 },
  coverLogo: { width: 220, height: 96 },
  headerLogo: { width: 80, height: 26 },
} as const

/** Table cell padding (twips). */
export const CELL_MARGINS = { top: 70, bottom: 70, left: 60, right: 60 } as const

/** Fits `width × height` inside a box, keeping the ratio (never enlarged). */
export function fitImage(
  width: number,
  height: number,
  box: { width: number; height: number },
): { width: number; height: number } {
  const scale = Math.min(1, box.width / width, box.height / height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}
