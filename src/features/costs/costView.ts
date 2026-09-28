/**
 * Pure computations on the costs of a visit: line amounts, totals by stage,
 * groups with subtotals, summary banner and Excel export (TSV / CSV).
 * Shared by the "Projets & coûts" tab and the Word report.
 *
 * Rounding rule: VAT is computed and rounded to the cent ON EACH LINE
 * (`computeVatCents`), and every total is the SUM OF THE LINES (`sumCosts`).
 * So a total always equals the addition of the amounts displayed above it,
 * whatever the grouping.
 */
import {
  sortProjectsForDisplay,
  summarizeProjects,
  type CostCountTotals,
} from '@/features/projects/projectView'
import { computeVatCents, formatEuros, sumCosts } from '@/lib/money'
import { COST_CATEGORY_LABELS, COST_STATUS_LABELS } from '@/types/labels'
import type { Cost, CostCategory, CostStatus, Project, Visit } from '@/types/visit'

/** Stages of a cost, from the least to the most certain. */
export const COST_STAGE_ORDER: readonly CostStatus[] = [
  'estimate',
  'quote',
  'committed',
  'invoiced',
]

/** Labels of the total rows per stage ("Estimations", "Devis reçus"…). */
export const COST_STAGE_TOTAL_LABELS: Record<CostStatus, string> = {
  estimate: 'Estimations',
  quote: 'Devis reçus',
  committed: 'Engagé',
  invoiced: 'Facturé',
}

/** Key and label of the group of costs linked to no project. */
export const UNASSIGNED_GROUP_KEY = 'unassigned'
export const UNASSIGNED_GROUP_LABEL = 'Non rattachés'

/** VAT rates offered in the selects, in basis points (20 %, 10 %, 5,5 %, 2,1 %, 0 %). */
export const VAT_RATE_OPTIONS_BP: readonly number[] = [2000, 1000, 550, 210, 0]

export interface CostLineAmounts {
  htCents: number
  /** VAT of the line, rounded to the cent. */
  vatCents: number
  ttcCents: number
}

/** Amounts of one line: VAT rounded to the cent, TTC = HT + rounded VAT. */
export function getCostLineAmounts(
  cost: Pick<Cost, 'amountHtCents' | 'vatRateBp'>,
): CostLineAmounts {
  const vatCents = computeVatCents(cost.amountHtCents, cost.vatRateBp)
  return { htCents: cost.amountHtCents, vatCents, ttcCents: cost.amountHtCents + vatCents }
}

function totalsOf(costs: readonly Cost[]): CostCountTotals {
  return { count: costs.length, ...sumCosts(costs) }
}

export interface CostsByStatus {
  /** Totals of each stage (zero totals included), in `COST_STAGE_ORDER`. */
  byStatus: Record<CostStatus, CostCountTotals>
  /** Grand total: sum of all the lines. */
  total: CostCountTotals
}

/** HT, VAT and TTC totals of each stage, plus the grand total (sums of rounded lines). */
export function summarizeCostsByStatus(costs: readonly Cost[]): CostsByStatus {
  const byStatus = Object.fromEntries(
    COST_STAGE_ORDER.map((status) => [status, totalsOf(costs.filter((c) => c.status === status))]),
  ) as Record<CostStatus, CostCountTotals>
  return { byStatus, total: totalsOf(costs) }
}

export type CostGroupBy = 'project' | 'status' | 'category'

export interface CostGroup {
  /** Project id, `UNASSIGNED_GROUP_KEY`, status or category. */
  key: string
  label: string
  /** Lines of the group, in their stored order. */
  costs: Cost[]
  subtotal: CostCountTotals
}

/**
 * Groups the costs, in display order, each with its subtotal. Empty groups
 * are omitted.
 * - `project`: projects in the order of `sortProjectsForDisplay`, then
 *   "Non rattachés" last;
 * - `status`: in `COST_STAGE_ORDER`;
 * - `category`: in the order of the category labels.
 *
 * The subtotals add up exactly to the grand total (same rounded lines).
 */
export function groupCosts(
  costs: readonly Cost[],
  projects: readonly Project[],
  groupBy: CostGroupBy,
): CostGroup[] {
  let groups: { key: string; label: string; costs: Cost[] }[]
  switch (groupBy) {
    case 'project': {
      const known = new Set(projects.map((p) => p.id))
      groups = [
        ...sortProjectsForDisplay(projects).map((project) => ({
          key: project.id,
          label: project.name,
          costs: costs.filter((c) => c.projectId === project.id),
        })),
        {
          key: UNASSIGNED_GROUP_KEY,
          label: UNASSIGNED_GROUP_LABEL,
          costs: costs.filter((c) => c.projectId === undefined || !known.has(c.projectId)),
        },
      ]
      break
    }
    case 'status':
      groups = COST_STAGE_ORDER.map((status) => ({
        key: status,
        label: COST_STATUS_LABELS[status],
        costs: costs.filter((c) => c.status === status),
      }))
      break
    case 'category':
      groups = (Object.keys(COST_CATEGORY_LABELS) as CostCategory[]).map((category) => ({
        key: category,
        label: COST_CATEGORY_LABELS[category],
        costs: costs.filter((c) => c.category === category),
      }))
      break
  }
  return groups
    .filter((group) => group.costs.length > 0)
    .map((group) => ({ ...group, subtotal: totalsOf(group.costs) }))
}

export interface CostsOverviewItem {
  key: 'projects' | 'costs' | 'committed' | 'invoiced'
  /** French text, e.g. "Engagé : 45 000,00 € HT". */
  text: string
  /** Section the item refers to. */
  section: 'projects' | 'costs'
}

export interface CostsOverview {
  items: CostsOverviewItem[]
  /** The whole sentence, items joined with " · ". */
  text: string
  /** Projects not done (tab label). */
  activeProjects: number
  inProgressProjects: number
  costCount: number
  committedHtCents: number
  invoicedHtCents: number
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

/**
 * Summary banner of the tab, e.g. "2 projets en cours · 18 lignes de coûts ·
 * Engagé : 45 000,00 € HT · Facturé : 12 300,00 € HT". The "Engagé" and
 * "Facturé" items only appear when such lines exist.
 */
export function buildCostsOverview(visit: Pick<Visit, 'projects' | 'costs'>): CostsOverview {
  const projects = summarizeProjects(visit.projects)
  const { byStatus } = summarizeCostsByStatus(visit.costs)
  const items: CostsOverviewItem[] = [
    {
      key: 'projects',
      text:
        projects.total === 0
          ? 'Aucun projet'
          : projects.in_progress > 0
            ? plural(projects.in_progress, 'projet en cours', 'projets en cours')
            : plural(projects.total, 'projet', 'projets'),
      section: 'projects',
    },
    {
      key: 'costs',
      text:
        visit.costs.length === 0
          ? 'Aucun coût'
          : plural(visit.costs.length, 'ligne de coût', 'lignes de coûts'),
      section: 'costs',
    },
  ]
  if (byStatus.committed.count > 0) {
    items.push({
      key: 'committed',
      text: `Engagé : ${formatEuros(byStatus.committed.htCents)} HT`,
      section: 'costs',
    })
  }
  if (byStatus.invoiced.count > 0) {
    items.push({
      key: 'invoiced',
      text: `Facturé : ${formatEuros(byStatus.invoiced.htCents)} HT`,
      section: 'costs',
    })
  }
  return {
    items,
    text: items.map((item) => item.text).join(' · '),
    activeProjects: projects.active,
    inProgressProjects: projects.in_progress,
    costCount: visit.costs.length,
    committedHtCents: byStatus.committed.htCents,
    invoicedHtCents: byStatus.invoiced.htCents,
  }
}

// ─── Excel export ────────────────────────────────────────────────────────────

/** Columns of the export, in order. */
export const COST_EXPORT_HEADERS = [
  'Projet',
  'Libellé',
  'Catégorie',
  'Fournisseur',
  'Statut',
  'Montant HT',
  'Taux TVA',
  'TVA',
  'TTC',
  'Commentaire',
] as const

/**
 * Amount for Excel FR: no currency symbol, no thousands separator, comma as
 * decimal separator, so that Excel reads it as a number.
 * @example formatCentsForExcel(1250050) // "12500,50"
 */
export function formatCentsForExcel(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

/**
 * VAT rate for Excel FR, in percent without the "%" sign.
 * @example formatVatRateForExcel(2000) // "20" ; formatVatRateForExcel(550) // "5,5"
 */
export function formatVatRateForExcel(rateBp: number): string {
  return String(rateBp / 100).replace('.', ',')
}

/** Cells of the export (header row first), lines in "grouped by project" order. */
function exportRows(costs: readonly Cost[], projects: readonly Project[]): string[][] {
  const projectNames = new Map(projects.map((p) => [p.id, p.name]))
  const lines = groupCosts(costs, projects, 'project').flatMap((group) => group.costs)
  return [
    [...COST_EXPORT_HEADERS],
    ...lines.map((cost) => {
      const { htCents, vatCents, ttcCents } = getCostLineAmounts(cost)
      return [
        (cost.projectId !== undefined && projectNames.get(cost.projectId)) || '',
        cost.label,
        COST_CATEGORY_LABELS[cost.category],
        cost.supplier ?? '',
        COST_STATUS_LABELS[cost.status],
        formatCentsForExcel(htCents),
        formatVatRateForExcel(cost.vatRateBp),
        formatCentsForExcel(vatCents),
        formatCentsForExcel(ttcCents),
        cost.comment ?? '',
      ]
    }),
  ]
}

/** Quotes a cell when it contains a separator, a quote, a tab or a line break ("" doubles quotes). */
function escapeCell(value: string, separator: string): string {
  return value.includes(separator) || /["\t\r\n;]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value
}

function toDelimited(rows: string[][], separator: string): string {
  return rows
    .map((row) => row.map((cell) => escapeCell(cell, separator)).join(separator))
    .join('\r\n')
}

/**
 * Tab-separated export for the clipboard ("Copier pour Excel"): header row,
 * then every line (all groups, collapsed or not) in "grouped by project"
 * order. Amounts as `12500,50`, rates as `20` or `5,5`, so that Excel FR
 * reads numbers. Cells with a tab, quote or line break are quoted.
 */
export function costsToTsv(costs: readonly Cost[], projects: readonly Project[]): string {
  return toDelimited(exportRows(costs, projects), '\t')
}

/**
 * CSV export for Excel FR (fallback when the clipboard is unavailable): same
 * content as `costsToTsv`, separator `;`, CRLF line breaks and a UTF-8 BOM
 * so that Excel keeps the accents.
 */
export function costsToCsv(costs: readonly Cost[], projects: readonly Project[]): string {
  return `\uFEFF${toDelimited(exportRows(costs, projects), ';')}`
}
