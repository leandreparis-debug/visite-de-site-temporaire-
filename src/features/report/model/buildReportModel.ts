/**
 * Pure construction of the Word report model. ALL the report logic lives
 * here (what to show, order, French texts, totals, alerts); the renderer only
 * translates the model into Word objects.
 *
 * Every computation reuses the existing view modules (attention points, DO,
 * insurances, projects, costs, money, dates): the report always shows the
 * same figures as the screens. No clock is read: "today" and the generation
 * time are passed in.
 */
import {
  buildCostsOverview,
  COST_STAGE_ORDER,
  COST_STAGE_TOTAL_LABELS,
  getCostLineAmounts,
  groupCosts,
  summarizeCostsByStatus,
} from '@/features/costs/costView'
import { getDoInsuranceOverview, getOverviewItems } from '@/features/do/doInsuranceOverview'
import {
  computeDoDeadlines,
  describeDoDeadlines,
  DO_DEADLINE_DISCLAIMER,
  DO_NO_REFERENCE_MESSAGE,
  formatReferenceSource,
  getClaimProgress,
  getCurrentStep,
  isClaimClosed,
  sortDoClaimsForDisplay,
  type DoDeadlineState,
} from '@/features/do/doView'
import {
  formatInsuranceValidity,
  getInsuranceValidity,
  sortInsurancesForDisplay,
  type InsuranceValidityStatus,
} from '@/features/insurance/insuranceView'
import {
  formatAttentionSummary,
  isOverdue,
  sortAttentionPointsForDisplay,
  summarizeAttentionPoints,
} from '@/features/notes/attentionPointView'
import { formatTakenAt } from '@/features/photos/photoFormat'
import {
  getProjectCostTotals,
  sortProjectsForDisplay,
  summarizeProjects,
} from '@/features/projects/projectView'
import { formatDateFr, formatDateShortFr } from '@/lib/dates'
import { safeFileName } from '@/lib/download'
import { formatEuros, formatVatRate } from '@/lib/money'
import {
  ATTENTION_STATUS_LABELS,
  COST_CATEGORY_LABELS,
  COST_STATUS_LABELS,
  DO_STEP_STATUS_LABELS,
  DO_STEP_TYPE_LABELS,
  INSURANCE_TYPE_LABELS,
  PHOTO_CATEGORY_LABELS,
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
} from '@/types/labels'
import type { PhotoCategory } from '@/types/media'
import { getVisitWarnings, type DoClaim, type Participant, type Visit } from '@/types/visit'
import { parseNoteContent } from './parseNoteContent'
import {
  REPORT_SECTION_KEYS,
  REPORT_SECTION_TITLES,
  type Cell,
  type ReportClaim,
  type ReportModel,
  type ReportOptions,
  type ReportPhoto,
  type ReportSection,
  type ReportSectionKey,
  type ReportTable,
  type SummaryItem,
  type Tone,
} from './reportModel'

/** Photo metadata needed by the report (the image itself is an asset). */
export interface ReportPhotoInput {
  id: string
  caption: string
  category: PhotoCategory
  order: number
  takenAt?: string
}

/** Plan metadata needed by the report (the annotated image is an asset). */
export interface ReportPlanInput {
  id: string
  name: string
  order: number
}

export interface BuildReportInput {
  visit: Visit
  photos: readonly ReportPhotoInput[]
  plans: readonly ReportPlanInput[]
  options: ReportOptions
  /** Today's local date (`YYYY-MM-DD`): overdue points, deadlines, validity. */
  todayIso: string
  /** Local generation time (`YYYY-MM-DDTHH:mm`), for "Généré le …". */
  generatedAt: string
}

export const REPORT_FOOTER_TEXT = 'Document interne — Carrefour Property'
export const NO_CAPTION = 'Sans légende'

const VALIDITY_TONES: Record<InsuranceValidityStatus, Tone> = {
  valid: 'success',
  expiring_soon: 'warning',
  expired: 'danger',
  not_started: 'muted',
  unknown: 'muted',
}

const DEADLINE_TONES: Record<DoDeadlineState, Tone> = {
  overdue: 'danger',
  due_soon: 'warning',
  ok: 'normal',
  done: 'success',
  not_applicable: 'muted',
  closed: 'muted',
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

function shortDate(iso: string | undefined): string {
  return iso ? formatDateShortFr(iso) : ''
}

/** Photos in display order (stored `order`). */
function byOrder<T extends { order: number }>(photos: readonly T[]): T[] {
  return [...photos].sort((a, b) => a.order - b.order)
}

/*
 * Table column widths are in centimetres (17 cm usable on a portrait A4 page);
 * amounts need about 2.5 cm to never wrap ("1 250 000,00 €").
 */

/** Pin number of each photo placed on a plan. */
function pinNumbersByPhoto(visit: Visit): Map<string, number> {
  return new Map(visit.pins.map((pin) => [pin.photoId, pin.number]))
}

// ─── Sections ────────────────────────────────────────────────────────────────

function buildSummary(visit: Visit, todayIso: string): SummaryItem[] {
  const items: SummaryItem[] = []
  if (visit.attentionPoints.length > 0) {
    const summary = summarizeAttentionPoints(visit.attentionPoints, todayIso)
    items.push({
      label: 'Points d’attention',
      value: formatAttentionSummary(summary),
      tone: summary.overdue > 0 ? 'danger' : 'normal',
    })
  }
  const doOverview = getDoInsuranceOverview(visit, todayIso)
  const labels = {
    claims: 'Sinistres DO',
    overdue: 'Délais DO',
    'due-soon': 'Délais DO',
    contracts: 'Contrats d’assurance',
  } as const
  for (const item of getOverviewItems(doOverview)) {
    const relevant =
      item.key === 'contracts' ? visit.insurances.length > 0 : visit.doClaims.length > 0
    if (!relevant) continue
    items.push({
      label: labels[item.key],
      value: item.text,
      tone: item.tone === 'neutral' ? 'normal' : item.tone,
    })
  }
  if (visit.projects.length > 0) {
    const projects = summarizeProjects(visit.projects)
    items.push({
      label: 'Projets',
      value: `${plural(projects.in_progress, 'en cours', 'en cours')} sur ${plural(projects.total, 'projet', 'projets')}`,
      tone: 'normal',
    })
  }
  if (visit.costs.length > 0) {
    const costs = buildCostsOverview(visit)
    items.push({
      label: 'Coûts engagés',
      value: `${formatEuros(costs.committedHtCents)} HT`,
      tone: 'normal',
    })
    items.push({
      label: 'Coûts facturés',
      value: `${formatEuros(costs.invoicedHtCents)} HT`,
      tone: 'normal',
    })
  }
  return items
}

function participantsTable(participants: readonly Participant[]): ReportTable | null {
  if (participants.length === 0) return null
  return {
    headers: ['Nom', 'Fonction', 'Société'],
    widths: [4, 3, 3],
    rows: participants.map((p) => [
      { text: p.name },
      { text: p.role ?? '' },
      { text: p.company ?? '' },
    ]),
  }
}

function attentionTable(visit: Visit, todayIso: string): ReportTable {
  return {
    headers: ['Statut', 'Point', 'Priorité', 'Responsable', 'Échéance'],
    widths: [2, 6, 1.6, 2.4, 2],
    rows: sortAttentionPointsForDisplay(visit.attentionPoints).map((point) => {
      const done = point.status === 'done'
      const overdue = isOverdue(point, todayIso)
      const tone: Tone = done ? 'muted' : 'normal'
      return [
        overdue
          ? {
              text: `${ATTENTION_STATUS_LABELS[point.status]} — En retard`,
              tone: 'danger',
              bold: true,
            }
          : { text: ATTENTION_STATUS_LABELS[point.status], tone },
        { text: point.text, tone: overdue ? 'danger' : tone },
        { text: PRIORITY_LABELS[point.priority], tone },
        { text: point.owner ?? '', tone },
        { text: shortDate(point.dueDate), tone: overdue ? 'danger' : tone },
      ]
    }),
  }
}

/**
 * Every photo of the visit as shown in the report, by id: number (position
 * in the photo order), pin, caption, category, areas it illustrates, date.
 */
function reportPhotosById(
  visit: Visit,
  photos: readonly ReportPhotoInput[],
): Map<string, ReportPhoto> {
  const pins = pinNumbersByPhoto(visit)
  const zonesByPhoto = new Map<string, string[]>()
  for (const section of [...visit.noteSections].sort((a, b) => a.order - b.order)) {
    for (const photoId of section.photoIds ?? []) {
      zonesByPhoto.set(photoId, [...(zonesByPhoto.get(photoId) ?? []), section.title])
    }
  }
  return new Map(
    byOrder(photos).map((photo, index): [string, ReportPhoto] => {
      const pin = pins.get(photo.id)
      const caption = photo.caption.trim()
      const zones = zonesByPhoto.get(photo.id)
      return [
        photo.id,
        {
          photoId: photo.id,
          numberLabel: `Photo n°${index + 1}`,
          ...(pin !== undefined && { pinLabel: `Repère n°${pin}` }),
          caption: caption || NO_CAPTION,
          captionMissing: !caption,
          details: [
            PHOTO_CATEGORY_LABELS[photo.category],
            zones && `Zone : ${zones.join(', ')}`,
            photo.takenAt && formatTakenAt(photo.takenAt),
          ]
            .filter(Boolean)
            .join(' · '),
        },
      ]
    }),
  )
}

function buildPhotos(
  visit: Visit,
  photos: readonly ReportPhotoInput[],
  onlyPinned: boolean,
): ReportPhoto[] {
  const pinned = new Set(visit.pins.map((pin) => pin.photoId))
  return [...reportPhotosById(visit, photos).values()].filter(
    (photo) => !onlyPinned || pinned.has(photo.photoId),
  )
}

function insurancesTable(visit: Visit, todayIso: string): ReportTable | null {
  if (visit.insurances.length === 0) return null
  return {
    headers: ['Type', 'Assureur', 'N° de police', 'Courtier', 'Début', 'Fin', 'Validité'],
    widths: [2.6, 2.8, 2.3, 2.1, 2.2, 2.2, 2.6],
    rows: sortInsurancesForDisplay(visit.insurances, todayIso).map((insurance) => {
      const validity = getInsuranceValidity(insurance, todayIso)
      return [
        { text: INSURANCE_TYPE_LABELS[insurance.type] },
        { text: insurance.insurer },
        { text: insurance.policyNumber ?? '' },
        { text: insurance.broker ?? '' },
        { text: shortDate(insurance.startDate) },
        { text: shortDate(insurance.endDate) },
        {
          text: formatInsuranceValidity(validity),
          tone: VALIDITY_TONES[validity.status],
          bold: true,
        },
      ]
    }),
  }
}

function buildClaim(claim: DoClaim, todayIso: string): ReportClaim {
  const closed = isClaimClosed(claim)
  const progress = getClaimProgress(claim)
  const current = getCurrentStep(claim)
  const progressText = `${progress.done} / ${progress.total} étapes`
  const deadlines = computeDoDeadlines(claim)
  return {
    title: claim.reference ?? 'Sans référence',
    closed,
    lines: [
      claim.description,
      claim.location && `Localisation : ${claim.location}`,
      claim.insurer && `Assureur : ${claim.insurer}`,
      claim.declaredAt && `Déclaré le ${formatDateShortFr(claim.declaredAt)}`,
    ].filter((line): line is string => Boolean(line)),
    amounts: [
      claim.claimedAmountCents !== undefined &&
        `Montant réclamé : ${formatEuros(claim.claimedAmountCents)}`,
      claim.compensatedAmountCents !== undefined &&
        `Montant indemnisé : ${formatEuros(claim.compensatedAmountCents)}`,
    ].filter((line): line is string => Boolean(line)),
    status: closed
      ? `Clôturé — ${progressText}`
      : current
        ? `En cours : ${DO_STEP_TYPE_LABELS[current.type]} — ${progressText}`
        : `Toutes les étapes sont terminées — ${progressText}`,
    warnings: getVisitWarnings({ doClaims: [claim] }),
    steps:
      closed || claim.steps.length === 0
        ? null
        : {
            headers: ['Étape', 'Statut', 'Date', 'Commentaire'],
            widths: [4, 1.8, 1.8, 4.4],
            rows: claim.steps.map((step) => {
              const tone: Tone =
                step.status === 'done'
                  ? 'success'
                  : step.status === 'in_progress'
                    ? 'warning'
                    : 'normal'
              return [
                { text: DO_STEP_TYPE_LABELS[step.type], bold: step.id === current?.id },
                { text: DO_STEP_STATUS_LABELS[step.status], tone },
                { text: shortDate(step.date) },
                { text: step.comment ?? '' },
              ]
            }),
          },
    deadlines: closed
      ? null
      : {
          intro: deadlines
            ? `Délais calculés ${formatReferenceSource(deadlines)}.`
            : DO_NO_REFERENCE_MESSAGE,
          entries: describeDoDeadlines(claim, todayIso).map((entry) => ({
            text: entry.label,
            tone: DEADLINE_TONES[entry.state],
          })),
          disclaimer: `${DO_DEADLINE_DISCLAIMER}.`,
        },
  }
}

function period(start: string | undefined, end: string | undefined): string {
  if (start && end) return `du ${shortDate(start)} au ${shortDate(end)}`
  if (start) return `à partir du ${shortDate(start)}`
  if (end) return `jusqu’au ${shortDate(end)}`
  return ''
}

function projectsTable(visit: Visit): ReportTable | null {
  if (visit.projects.length === 0) return null
  return {
    headers: ['Projet', 'Statut', 'Responsable', 'Période', 'Lignes', 'Total HT', 'Total TTC'],
    widths: [3.4, 1.8, 2.7, 2.4, 1.5, 2.5, 2.5],
    rightAligned: [4, 5, 6],
    rows: sortProjectsForDisplay(visit.projects).map((project) => {
      const totals = getProjectCostTotals(project, visit.costs)
      return [
        { text: project.name, bold: true },
        { text: PROJECT_STATUS_LABELS[project.status] },
        { text: project.owner ?? '' },
        { text: period(project.startDate, project.endDate) },
        { text: String(totals.count) },
        { text: formatEuros(totals.htCents) },
        { text: formatEuros(totals.ttcCents) },
      ]
    }),
  }
}

function costsTable(visit: Visit): ReportTable | null {
  if (visit.costs.length === 0) return null
  const rows: Cell[][] = []
  for (const group of groupCosts(visit.costs, visit.projects, 'project')) {
    rows.push([
      {
        text: `${group.label} — ${plural(group.subtotal.count, 'ligne', 'lignes')}`,
        bold: true,
        shaded: true,
      },
      { text: '', shaded: true },
      { text: '', shaded: true },
      { text: '', shaded: true },
      { text: formatEuros(group.subtotal.htCents), bold: true, shaded: true },
      { text: '', shaded: true },
      { text: formatEuros(group.subtotal.vatCents), bold: true, shaded: true },
      { text: formatEuros(group.subtotal.ttcCents), bold: true, shaded: true },
    ])
    for (const cost of group.costs) {
      const amounts = getCostLineAmounts(cost)
      rows.push([
        { text: cost.label },
        { text: cost.supplier ?? '' },
        { text: COST_CATEGORY_LABELS[cost.category] },
        { text: COST_STATUS_LABELS[cost.status] },
        { text: formatEuros(amounts.htCents) },
        { text: formatVatRate(cost.vatRateBp) },
        { text: formatEuros(amounts.vatCents) },
        { text: formatEuros(amounts.ttcCents) },
      ])
    }
  }
  const { byStatus, total } = summarizeCostsByStatus(visit.costs)
  for (const status of COST_STAGE_ORDER) {
    const totals = byStatus[status]
    if (totals.count === 0) continue
    rows.push([
      { text: COST_STAGE_TOTAL_LABELS[status], bold: true },
      { text: '' },
      { text: '' },
      { text: '' },
      { text: formatEuros(totals.htCents), bold: true },
      { text: '' },
      { text: formatEuros(totals.vatCents), bold: true },
      { text: formatEuros(totals.ttcCents), bold: true },
    ])
  }
  rows.push([
    { text: 'Total général', bold: true, shaded: true },
    { text: '', shaded: true },
    { text: '', shaded: true },
    { text: '', shaded: true },
    { text: formatEuros(total.htCents), bold: true, shaded: true },
    { text: '', shaded: true },
    { text: formatEuros(total.vatCents), bold: true, shaded: true },
    { text: formatEuros(total.ttcCents), bold: true, shaded: true },
  ])
  return {
    headers: ['Libellé', 'Fournisseur', 'Catégorie', 'Statut', 'Montant HT', 'TVA %', 'TVA', 'TTC'],
    widths: [2.3, 2.5, 2.1, 1.6, 2.4, 1.4, 2.1, 2.4],
    rightAligned: [4, 5, 6, 7],
    rows,
  }
}

/** Builds one section, or `null` when it has no content (omitted from the report). */
function buildSection(
  key: ReportSectionKey,
  input: BuildReportInput,
  title: string,
): ReportSection | null {
  const { visit, todayIso, options } = input
  switch (key) {
    case 'summary': {
      const items = buildSummary(visit, todayIso)
      return items.length ? { key, title, items } : null
    }
    case 'general': {
      const purpose = visit.purpose?.trim()
      if (!purpose && visit.participants.length === 0) return null
      return {
        key,
        title,
        ...(purpose && { purpose }),
        present: participantsTable(visit.participants.filter((p) => p.present)),
        absent: participantsTable(visit.participants.filter((p) => !p.present)),
      }
    }
    case 'notes': {
      const photos = reportPhotosById(visit, input.photos)
      const zones = [...visit.noteSections]
        .sort((a, b) => a.order - b.order)
        .map((section) => ({
          title: section.title,
          blocks: parseNoteContent(section.content),
          // Deleted photos are ignored; order of the links kept.
          photos: (section.photoIds ?? []).flatMap((id) => photos.get(id) ?? []),
        }))
        .filter((zone) => zone.blocks.length > 0 || zone.photos.length > 0)
      return zones.length ? { key, title, zones } : null
    }
    case 'attention':
      if (visit.attentionPoints.length === 0) return null
      return {
        key,
        title,
        summary: formatAttentionSummary(summarizeAttentionPoints(visit.attentionPoints, todayIso)),
        table: attentionTable(visit, todayIso),
      }
    case 'plans': {
      if (input.plans.length === 0) return null
      const photos = new Map(input.photos.map((p) => [p.id, p]))
      return {
        key,
        title,
        plans: byOrder(input.plans).map((plan) => {
          const pins = visit.pins
            .filter((pin) => pin.planId === plan.id)
            .sort((a, b) => a.number - b.number)
          return {
            planId: plan.id,
            name: plan.name,
            pins: pins.length
              ? {
                  headers: ['N°', 'Légende de la photo', 'Catégorie', 'Étiquette'],
                  widths: [0.8, 6, 2, 3.2],
                  rows: pins.map((pin) => {
                    const photo = photos.get(pin.photoId)
                    const caption = photo?.caption.trim()
                    return [
                      { text: String(pin.number), bold: true },
                      caption ? { text: caption } : { text: NO_CAPTION, tone: 'muted' },
                      { text: photo ? PHOTO_CATEGORY_LABELS[photo.category] : '' },
                      { text: pin.label ?? '' },
                    ]
                  }),
                }
              : null,
          }
        }),
      }
    }
    case 'photos': {
      const photos = buildPhotos(visit, input.photos, options.onlyPinnedPhotos)
      return photos.length ? { key, title, perPage: options.photosPerPage, photos } : null
    }
    case 'doInsurance': {
      if (visit.insurances.length === 0 && visit.doClaims.length === 0) return null
      return {
        key,
        title,
        insurances: insurancesTable(visit, todayIso),
        claims: sortDoClaimsForDisplay(visit.doClaims, todayIso).map((claim) =>
          buildClaim(claim, todayIso),
        ),
      }
    }
    case 'projectsCosts': {
      if (visit.projects.length === 0 && visit.costs.length === 0) return null
      const { total } = summarizeCostsByStatus(visit.costs)
      return {
        key,
        title,
        projects: projectsTable(visit),
        costs: costsTable(visit),
        totalCents: { ht: total.htCents, vat: total.vatCents, ttc: total.ttcCents },
      }
    }
  }
}

/** "Généré le 28 septembre 2026 à 14h05" from a local `YYYY-MM-DDTHH:mm`. */
function generatedLine(generatedAt: string): string {
  const [date = '', time = ''] = generatedAt.split('T')
  return `Généré le ${formatDateFr(date)} à ${time.slice(0, 5).replace(':', 'h')}`
}

/**
 * Builds the whole report model. Pure and deterministic: same input, same
 * model; the input is never modified.
 *
 * Sections come in a fixed order (summary, general information, observations,
 * attention points, plans, photos, DO & insurances, projects & costs), are
 * numbered according to those present, and are omitted when unchecked in
 * `options.sections` or when they have no content.
 */
export function buildReportModel(input: BuildReportInput): ReportModel {
  const { visit } = input
  const sections: ReportSection[] = []
  for (const key of REPORT_SECTION_KEYS) {
    if (!input.options.sections[key]) continue
    const section = buildSection(
      key,
      input,
      `${sections.length + 1}. ${REPORT_SECTION_TITLES[key]}`,
    )
    if (section) sections.push(section)
  }
  const { site } = visit
  return {
    fileName: safeFileName(`CR - ${site.name} - ${visit.date}`, 'docx'),
    cover: {
      kindTitle:
        visit.kind === 'meeting' ? 'Compte rendu de réunion' : 'Compte rendu de visite technique',
      title: visit.title,
      siteLines: [
        site.name,
        site.code && `Code site : ${site.code}`,
        site.address,
        site.city,
      ].filter((line): line is string => Boolean(line)),
      dateLine:
        formatDateFr(visit.date) +
        (visit.startTime ? ` à ${visit.startTime.replace(':', 'h')}` : ''),
      ...(visit.author && { author: visit.author }),
      ...(visit.coverPhotoId !== undefined &&
        input.photos.some((p) => p.id === visit.coverPhotoId) && {
          photoId: visit.coverPhotoId,
        }),
      generatedLine: generatedLine(input.generatedAt),
    },
    header: { siteName: site.name, date: formatDateShortFr(visit.date) },
    footer: { text: REPORT_FOOTER_TEXT },
    sections,
  }
}
