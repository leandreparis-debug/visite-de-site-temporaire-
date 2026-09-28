/**
 * Pure overview of the "DO & assurances" tab: counts and alerts shared by the
 * summary banner, the tab indicator of the editor and (later) the report.
 */
import { summarizeInsurances, type InsuranceSummary } from '@/features/insurance/insuranceView'
import type { Visit } from '@/types/visit'
import { summarizeDoClaims, type DoClaimsSummary } from './doView'

export interface DoInsuranceOverview {
  claims: DoClaimsSummary
  insurances: InsuranceSummary
  /** Number shown in the tab label: claims still open. */
  tabCount: number
  /** Red dot on the tab: an overdue deadline or an expired contract. */
  hasAlert: boolean
}

/** @param todayIso today's local date (`YYYY-MM-DD`), computed by the caller. */
export function getDoInsuranceOverview(
  visit: Pick<Visit, 'doClaims' | 'insurances'>,
  todayIso: string,
): DoInsuranceOverview {
  const claims = summarizeDoClaims(visit.doClaims, todayIso)
  const insurances = summarizeInsurances(visit.insurances, todayIso)
  return {
    claims,
    insurances,
    tabCount: claims.open,
    hasAlert: claims.overdueAlerts > 0 || insurances.expired > 0,
  }
}

export type OverviewTone = 'danger' | 'warning' | 'neutral'

export interface OverviewItem {
  key: 'claims' | 'overdue' | 'due-soon' | 'contracts'
  /** French text, e.g. "3 contrats dont 1 expire bientôt". */
  text: string
  tone: OverviewTone
  /** Section the item refers to. */
  section: 'claims' | 'insurances'
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

/**
 * Items of the summary banner, e.g. "2 sinistres en cours", "1 délai dépassé"
 * (danger), "3 contrats dont 1 expire bientôt" (warning). Alert items only
 * appear when their count is not zero.
 */
export function getOverviewItems(overview: DoInsuranceOverview): OverviewItem[] {
  const { claims, insurances } = overview
  const items: OverviewItem[] = [
    {
      key: 'claims',
      text:
        claims.open === 0
          ? 'Aucun sinistre en cours'
          : plural(claims.open, 'sinistre en cours', 'sinistres en cours'),
      tone: 'neutral',
      section: 'claims',
    },
  ]
  if (claims.overdueAlerts > 0) {
    items.push({
      key: 'overdue',
      text: plural(claims.overdueAlerts, 'délai dépassé', 'délais dépassés'),
      tone: 'danger',
      section: 'claims',
    })
  }
  if (claims.dueSoonAlerts > 0) {
    items.push({
      key: 'due-soon',
      text: plural(claims.dueSoonAlerts, 'délai proche', 'délais proches'),
      tone: 'warning',
      section: 'claims',
    })
  }
  const details = [
    insurances.expired > 0 && plural(insurances.expired, 'expiré', 'expirés'),
    insurances.expiring_soon > 0 &&
      plural(insurances.expiring_soon, 'expire bientôt', 'expirent bientôt'),
  ].filter(Boolean)
  items.push({
    key: 'contracts',
    text:
      insurances.total === 0
        ? 'Aucun contrat'
        : plural(insurances.total, 'contrat', 'contrats') +
          (details.length ? ` dont ${details.join(' et ')}` : ''),
    tone: insurances.expired > 0 ? 'danger' : insurances.expiring_soon > 0 ? 'warning' : 'neutral',
    section: 'insurances',
  })
  return items
}
