/**
 * Pure display helpers for insurance contracts: validity status, summary and
 * sort order. "Today" is always passed in by the caller (computed at render
 * time), never read here, so the same functions serve the screen and the
 * Word report.
 */
import { daysBetweenIso, isValidIsoDate } from '@/lib/dates'
import type { Insurance } from '@/types/visit'

/** A contract ends "soon" when its end date is at most this many days away. */
export const EXPIRING_SOON_DAYS = 90

export type InsuranceValidityStatus =
  'valid' | 'expiring_soon' | 'expired' | 'not_started' | 'unknown'

export interface InsuranceValidity {
  status: InsuranceValidityStatus
  /**
   * Days from today to the end date (0 on the last day, negative once
   * expired). Absent when the end date is not filled in.
   */
  daysRemaining?: number
}

/**
 * Validity of a contract on `todayIso`:
 * - `not_started`: the start date is in the future (checked first);
 * - `unknown`: no end date;
 * - `expired`: the end date is before today;
 * - `expiring_soon`: the end date is today or within {@link EXPIRING_SOON_DAYS} days;
 * - `valid`: otherwise.
 *
 * The end date is the last day of cover: a contract ending today is still in force.
 *
 * @param todayIso today's local date (`YYYY-MM-DD`), computed by the caller.
 */
export function getInsuranceValidity(
  insurance: Pick<Insurance, 'startDate' | 'endDate'>,
  todayIso: string,
): InsuranceValidity {
  const { startDate, endDate } = insurance
  const hasEnd = endDate !== undefined && isValidIsoDate(endDate)
  const daysRemaining = hasEnd ? daysBetweenIso(todayIso, endDate) : undefined
  const withDays = (status: InsuranceValidityStatus): InsuranceValidity =>
    daysRemaining === undefined ? { status } : { status, daysRemaining }

  if (startDate !== undefined && isValidIsoDate(startDate) && startDate > todayIso) {
    return withDays('not_started')
  }
  if (daysRemaining === undefined) return { status: 'unknown' }
  if (daysRemaining < 0) return withDays('expired')
  if (daysRemaining <= EXPIRING_SOON_DAYS) return withDays('expiring_soon')
  return withDays('valid')
}

/**
 * French badge text of a validity status.
 * @example formatInsuranceValidity({ status: 'expiring_soon', daysRemaining: 23 }) // "Expire dans 23 j"
 */
export function formatInsuranceValidity(validity: InsuranceValidity): string {
  switch (validity.status) {
    case 'valid':
      return 'Valide'
    case 'expiring_soon':
      return validity.daysRemaining === 0
        ? 'Expire aujourd’hui'
        : `Expire dans ${validity.daysRemaining ?? 0}\u00a0j`
    case 'expired':
      return 'Expiré'
    case 'not_started':
      return 'Pas encore en vigueur'
    case 'unknown':
      return 'Échéance non renseignée'
  }
}

export type InsuranceSummary = Record<InsuranceValidityStatus, number> & { total: number }

/** Number of contracts per validity status (for the summary banner and the report). */
export function summarizeInsurances(
  insurances: readonly Insurance[],
  todayIso: string,
): InsuranceSummary {
  const summary: InsuranceSummary = {
    total: insurances.length,
    valid: 0,
    expiring_soon: 0,
    expired: 0,
    not_started: 0,
    unknown: 0,
  }
  for (const insurance of insurances) summary[getInsuranceValidity(insurance, todayIso).status]++
  return summary
}

/**
 * Display order: expired and expiring-soon contracts first, then by end date
 * (earliest first, no end date last). Stable; returns a new array — the
 * stored order is never changed.
 */
export function sortInsurancesForDisplay(
  insurances: readonly Insurance[],
  todayIso: string,
): Insurance[] {
  const rank = (insurance: Insurance) => {
    const { status } = getInsuranceValidity(insurance, todayIso)
    return status === 'expired' || status === 'expiring_soon' ? 0 : 1
  }
  return insurances
    .map((insurance, index) => ({ insurance, index, rank: rank(insurance) }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (a.insurance.endDate ?? '9999-99-99').localeCompare(b.insurance.endDate ?? '9999-99-99') ||
        a.index - b.index,
    )
    .map(({ insurance }) => insurance)
}
