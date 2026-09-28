/**
 * Pure helpers of the Report tab: preview of each section (counts, emptiness)
 * and the non-blocking "points à vérifier" before generating.
 */
import type { VisitTab } from '@/app/router'
import {
  formatAttentionSummary,
  summarizeAttentionPoints,
} from '@/features/notes/attentionPointView'
import { getVisitWarnings, type Visit } from '@/types/visit'
import { buildReportModel, type BuildReportInput } from './buildReportModel'
import { DEFAULT_REPORT_OPTIONS, REPORT_SECTION_KEYS, type ReportSectionKey } from './reportModel'

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

export interface SectionContent {
  /** "42 photos (3 sans légende)", "2 plans, 18 repères"… */
  preview: string
  /** No content: the section would be omitted (checkbox disabled). */
  empty: boolean
}

/**
 * Preview and emptiness of every section, with the current photo options
 * (a section is empty exactly when `buildReportModel` would omit it).
 */
export function getReportContents(
  input: Omit<BuildReportInput, 'generatedAt'>,
): Record<ReportSectionKey, SectionContent> {
  const { visit, photos, plans, todayIso } = input
  const model = buildReportModel({
    ...input,
    options: { ...input.options, sections: DEFAULT_REPORT_OPTIONS.sections },
    generatedAt: `${todayIso}T00:00`,
  })
  const present = new Set(model.sections.map((s) => s.key))
  const pinned = new Set(visit.pins.map((p) => p.photoId))
  const shownPhotos = input.options.onlyPinnedPhotos
    ? photos.filter((p) => pinned.has(p.id))
    : photos
  const withoutCaption = shownPhotos.filter((p) => !p.caption.trim()).length
  const presentCount = visit.participants.filter((p) => p.present).length
  const filledNotes = visit.noteSections.filter((s) => s.content.trim()).length
  const previews: Record<ReportSectionKey, string> = {
    summary: 'Points d’attention, sinistres, contrats, projets et coûts',
    general: [
      visit.participants.length &&
        `${plural(visit.participants.length, 'participant', 'participants')} (${plural(presentCount, 'présent', 'présents')})`,
      visit.purpose?.trim() && 'objet renseigné',
    ]
      .filter(Boolean)
      .join(' · '),
    notes: plural(filledNotes, 'section', 'sections'),
    attention: visit.attentionPoints.length
      ? `${plural(visit.attentionPoints.length, 'point', 'points')} (${formatAttentionSummary(summarizeAttentionPoints(visit.attentionPoints, todayIso))})`
      : '',
    plans: `${plural(plans.length, 'plan', 'plans')}, ${plural(visit.pins.length, 'repère', 'repères')}`,
    photos:
      plural(shownPhotos.length, 'photo', 'photos') +
      (withoutCaption ? ` (${withoutCaption} sans légende)` : ''),
    doInsurance: `${plural(visit.insurances.length, 'contrat', 'contrats')} · ${plural(visit.doClaims.length, 'sinistre', 'sinistres')}`,
    projectsCosts: `${plural(visit.projects.length, 'projet', 'projets')} · ${plural(visit.costs.length, 'ligne de coût', 'lignes de coûts')}`,
  }
  return Object.fromEntries(
    REPORT_SECTION_KEYS.map((key) => [
      key,
      { preview: present.has(key) ? previews[key] : 'vide', empty: !present.has(key) },
    ]),
  ) as Record<ReportSectionKey, SectionContent>
}

export interface ReportCheck {
  id: string
  text: string
  /** Tab where the point can be fixed. */
  tab: VisitTab
}

/**
 * Non-blocking points to check before generating: consistency warnings,
 * photos without caption, DO claims without declaration date, missing
 * author, empty note sections.
 */
export function getReportChecks(
  visit: Visit,
  photos: readonly { caption: string }[],
): ReportCheck[] {
  const checks: ReportCheck[] = getVisitWarnings(visit).map((text, index) => ({
    id: `warning-${index}`,
    text,
    tab: 'do-insurance',
  }))
  const withoutCaption = photos.filter((p) => !p.caption.trim()).length
  if (withoutCaption) {
    checks.push({
      id: 'captions',
      text: `${plural(withoutCaption, 'photo', 'photos')} sans légende`,
      tab: 'photos',
    })
  }
  for (const claim of visit.doClaims) {
    if (claim.declaredAt) continue
    checks.push({
      id: `declared-${claim.id}`,
      text: `Sinistre « ${claim.reference ?? claim.description} » : date de déclaration non renseignée`,
      tab: 'do-insurance',
    })
  }
  if (!visit.author?.trim()) {
    checks.push({ id: 'author', text: 'Rédacteur non renseigné', tab: 'general' })
  }
  for (const section of visit.noteSections) {
    if (section.content.trim()) continue
    checks.push({
      id: `note-${section.id}`,
      text: `Section de notes « ${section.title} » vide (omise du rapport)`,
      tab: 'notes',
    })
  }
  return checks
}
