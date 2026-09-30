/**
 * Types of the Word report model: a plain, serializable description of the
 * report (texts already formatted in French, tones for colours, ids of the
 * images to embed). Produced by `buildReportModel` (pure, all the logic) and
 * translated mechanically into a .docx by `renderReportDocx`.
 */

/** Sections of the report, in their order in the document. */
export const REPORT_SECTION_KEYS = [
  'summary',
  'general',
  'notes',
  'attention',
  'plans',
  'photos',
  'doInsurance',
  'projectsCosts',
] as const
export type ReportSectionKey = (typeof REPORT_SECTION_KEYS)[number]

/** Section titles (without their number, added according to the sections present). */
export const REPORT_SECTION_TITLES: Record<ReportSectionKey, string> = {
  summary: 'Synthèse',
  general: 'Informations générales',
  notes: 'Observations par zone',
  attention: 'Points d’attention et actions',
  plans: 'Plans annotés',
  photos: 'Planche photos',
  doInsurance: 'Dommages-Ouvrage et assurances',
  projectsCosts: 'Projets et coûts',
}

export type ReportQuality = 'standard' | 'light'
export type PhotosPerPage = 2 | 4 | 6

export interface ReportOptions {
  /** Sections to include (an empty section is omitted anyway). */
  sections: Record<ReportSectionKey, boolean>
  photosPerPage: PhotosPerPage
  /** Only the photos placed on a plan, in the photo sheet. */
  onlyPinnedPhotos: boolean
  quality: ReportQuality
}

export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  sections: {
    summary: true,
    general: true,
    notes: true,
    attention: true,
    plans: true,
    photos: true,
    doInsurance: true,
    projectsCosts: true,
  },
  photosPerPage: 6,
  onlyPinnedPhotos: false,
  quality: 'standard',
}

/** Colour intent of a text: rendered as a colour in Word. */
export type Tone = 'normal' | 'danger' | 'warning' | 'success' | 'muted'

/** A table cell: text and optional tone / emphasis. */
export interface Cell {
  text: string
  tone?: Tone
  bold?: boolean
  /** Grey background (group and total rows). */
  shaded?: boolean
}

export interface ReportTable {
  headers: string[]
  /** Relative column widths (sum free, scaled to the page width). */
  widths: number[]
  rows: Cell[][]
  /** Columns aligned to the right (amounts), header included. */
  rightAligned?: number[]
}

/** A block of a note section: paragraph (lines joined with line breaks) or bullet list. */
export type NoteBlock =
  { type: 'paragraph'; lines: string[] } | { type: 'bullets'; items: string[] }

export interface SummaryItem {
  label: string
  value: string
  tone: Tone
}

export interface SummarySection {
  key: 'summary'
  title: string
  items: SummaryItem[]
}

export interface GeneralSection {
  key: 'general'
  title: string
  purpose?: string
  /** Rows "Nom, Fonction, Société" of the present participants (table omitted when empty). */
  present: ReportTable | null
  absent: ReportTable | null
}

export interface ReportZone {
  title: string
  blocks: NoteBlock[]
  /** Photos linked to the area, shown under its text (2 per row). */
  photos: ReportPhoto[]
}

export interface NotesSection {
  key: 'notes'
  title: string
  zones: ReportZone[]
}

export interface AttentionSection {
  key: 'attention'
  title: string
  /** E.g. "3 ouverts dont 1 en retard". */
  summary: string
  table: ReportTable
}

export interface ReportPlan {
  planId: string
  name: string
  /** Pins table (N°, Légende de la photo, Catégorie, Étiquette), null when no pin. */
  pins: ReportTable | null
}

export interface PlansSection {
  key: 'plans'
  title: string
  plans: ReportPlan[]
}

export interface ReportPhoto {
  photoId: string
  /** "Photo n°12" (position in the visit's photo order). */
  numberLabel: string
  /** "Repère n°3", when the photo is placed on a plan. */
  pinLabel?: string
  /** Caption, or "Sans légende" (muted). */
  caption: string
  captionMissing: boolean
  /** "Désordre · Zone : Toiture · 15/09/2026 à 10h42". */
  details: string
}

export interface PhotosSection {
  key: 'photos'
  title: string
  perPage: PhotosPerPage
  photos: ReportPhoto[]
}

export interface ReportClaim {
  title: string
  closed: boolean
  /** "Description · Localisation · Assureur", lines of the header. */
  lines: string[]
  /** "Montant réclamé : …", "Montant indemnisé : …" (absent amounts omitted). */
  amounts: string[]
  /** "En cours : Expertise — 4 / 10 étapes" or "Clôturé — 10 / 10 étapes". */
  status: string
  /** Consistency warnings (orange), from `getVisitWarnings`. */
  warnings: string[]
  /** Applicable steps (null for a closed claim, shown compactly). */
  steps: ReportTable | null
  /** Deadlines box (null for a closed claim). */
  deadlines: {
    /** "Calculés à partir de …", or the "fill the declaration date" message. */
    intro: string
    entries: { text: string; tone: Tone }[]
    disclaimer: string
  } | null
}

export interface DoInsuranceSection {
  key: 'doInsurance'
  title: string
  insurances: ReportTable | null
  claims: ReportClaim[]
}

export interface ProjectsCostsSection {
  key: 'projectsCosts'
  title: string
  projects: ReportTable | null
  /** Costs grouped by project ("Non rattachés" last) with subtotals, stage totals and grand total. */
  costs: ReportTable | null
  /** Grand total in cents (same values as `summarizeCostsByStatus`). */
  totalCents: { ht: number; vat: number; ttc: number }
}

export type ReportSection =
  | SummarySection
  | GeneralSection
  | NotesSection
  | AttentionSection
  | PlansSection
  | PhotosSection
  | DoInsuranceSection
  | ProjectsCostsSection

export interface ReportModel {
  /** "CR - {site} - {AAAA-MM-JJ}.docx", without characters forbidden by Windows. */
  fileName: string
  cover: {
    /** "Compte rendu de visite technique" or "Compte rendu de réunion". */
    kindTitle: string
    title: string
    /** Site name, then code, address, city (when filled). */
    siteLines: string[]
    /** "28 septembre 2026 à 9h30". */
    dateLine: string
    author?: string
    /** Photo of the site shown on the cover (usually the building). */
    photoId?: string
    /** "Généré le 28 septembre 2026 à 14h05". */
    generatedLine: string
  }
  /** Header of every page but the cover: site name and visit date. */
  header: { siteName: string; date: string }
  footer: { text: string }
  /** Sections present, in order, titles numbered ("1. Synthèse"…). */
  sections: ReportSection[]
}

/**
 * Ids of the plans and photos a model shows (cover, notes, plans, photo
 * sheet), each once, in document order: the images to prepare.
 */
export function reportImageIds(model: ReportModel): { planIds: string[]; photoIds: string[] } {
  const planIds = new Set<string>()
  const photoIds = new Set<string>()
  if (model.cover.photoId !== undefined) photoIds.add(model.cover.photoId)
  for (const section of model.sections) {
    if (section.key === 'plans') for (const plan of section.plans) planIds.add(plan.planId)
    if (section.key === 'notes')
      for (const zone of section.zones) for (const photo of zone.photos) photoIds.add(photo.photoId)
    if (section.key === 'photos') for (const photo of section.photos) photoIds.add(photo.photoId)
  }
  return { planIds: [...planIds], photoIds: [...photoIds] }
}
