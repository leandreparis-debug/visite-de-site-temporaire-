/**
 * Pure display helpers for Dommages-Ouvrage (DO) claims: progress, current
 * step, legal deadlines, alerts and summary. "Today" is always passed in by
 * the caller, never read here, so the same functions serve the screen and the
 * Word report.
 *
 * The deadlines are INDICATIVE: they follow the usual reading of article
 * L242-1 of the French insurance code (60 days for the insurer's position on
 * cover, 90 days for the compensation offer) but the contract may differ.
 * Always display them with {@link DO_DEADLINE_DISCLAIMER}.
 */
import { addDaysIso, daysBetweenIso, formatDateShortFr, isValidIsoDate } from '@/lib/dates'
import { DO_STEP_TYPES, type DoClaim, type DoStep, type DoStepType } from '@/types/visit'

/** Canonical order of the 10 steps of a DO claim (declaration → closing). */
export const DO_STEP_SEQUENCE: readonly DoStepType[] = DO_STEP_TYPES

/** Days after the reference date for the insurer's position on cover. */
export const COVERAGE_DECISION_DAYS = 60
/** Days after the reference date for the compensation offer. */
export const COMPENSATION_OFFER_DAYS = 90
/** A deadline is "due soon" when it is at most this many days away. */
export const DEADLINE_DUE_SOON_DAYS = 15

/** Mandatory mention next to any displayed deadline. */
export const DO_DEADLINE_DISCLAIMER =
  'Délai indicatif (art. L242-1 du Code des assurances), à vérifier selon le contrat'

/** Message shown when no reference date can be found. */
export const DO_NO_REFERENCE_MESSAGE = 'Renseignez la date de déclaration pour calculer les délais.'

export interface ClaimProgress {
  done: number
  total: number
  /** 0–100, rounded; 0 when the claim has no step. */
  percent: number
}

/** Done steps out of the steps still present (removed steps do not count). */
export function getClaimProgress(claim: Pick<DoClaim, 'steps'>): ClaimProgress {
  const total = claim.steps.length
  const done = claim.steps.filter((step) => step.status === 'done').length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

/** First step not done, in the order of the list; `null` when every step is done. */
export function getCurrentStep(claim: Pick<DoClaim, 'steps'>): DoStep | null {
  return claim.steps.find((step) => step.status !== 'done') ?? null
}

/** `true` when a "Clôture du dossier" step exists and is done. */
export function isClaimClosed(claim: Pick<DoClaim, 'steps'>): boolean {
  return claim.steps.some((step) => step.type === 'closed' && step.status === 'done')
}

/** Where the reference date of the deadlines comes from. */
export type DoReferenceSource = 'acknowledgment' | 'declared_at' | 'declaration_step'

export interface DoDeadlines {
  referenceDate: string
  referenceSource: DoReferenceSource
  /** Reference date + {@link COVERAGE_DECISION_DAYS}. */
  coverageDecisionDue: string
  /** Reference date + {@link COMPENSATION_OFFER_DAYS}. */
  compensationOfferDue: string
}

function stepDate(claim: Pick<DoClaim, 'steps'>, type: DoStepType): string | undefined {
  const date = claim.steps.find((step) => step.type === type)?.date
  return date !== undefined && isValidIsoDate(date) ? date : undefined
}

/**
 * Indicative legal deadlines of a claim.
 *
 * Reference date, by priority:
 * 1. date of the "Accusé de réception de l’assureur" step (the insurer's
 *    deadlines run from the receipt of a complete declaration);
 * 2. otherwise the claim's declaration date (`declaredAt`);
 * 3. otherwise the date of the "Déclaration du sinistre" step.
 *
 * Days are added on pure calendar dates (UTC): no one-day shift around
 * daylight-saving changes.
 *
 * @returns `null` when none of these dates is filled in (no deadline).
 */
export function computeDoDeadlines(
  claim: Pick<DoClaim, 'steps' | 'declaredAt'>,
): DoDeadlines | null {
  const acknowledgment = stepDate(claim, 'acknowledgment')
  const declaredAt =
    claim.declaredAt !== undefined && isValidIsoDate(claim.declaredAt)
      ? claim.declaredAt
      : undefined
  const declaration = stepDate(claim, 'declaration')
  const [referenceDate, referenceSource]: [string | undefined, DoReferenceSource] = acknowledgment
    ? [acknowledgment, 'acknowledgment']
    : declaredAt
      ? [declaredAt, 'declared_at']
      : [declaration, 'declaration_step']
  if (referenceDate === undefined) return null
  return {
    referenceDate,
    referenceSource,
    coverageDecisionDue: addDaysIso(referenceDate, COVERAGE_DECISION_DAYS),
    compensationOfferDue: addDaysIso(referenceDate, COMPENSATION_OFFER_DAYS),
  }
}

/**
 * French wording of the reference date.
 * @example formatReferenceSource(deadlines) // "à partir de l’accusé de réception du 12/03/2026"
 */
export function formatReferenceSource(deadlines: DoDeadlines): string {
  const date = formatDateShortFr(deadlines.referenceDate)
  switch (deadlines.referenceSource) {
    case 'acknowledgment':
      return `à partir de l’accusé de réception du ${date}`
    case 'declared_at':
      return `à partir de la déclaration du ${date}`
    case 'declaration_step':
      return `à partir de l’étape « Déclaration du sinistre » du ${date}`
  }
}

/** Steps that carry a legal deadline. */
export type DoDeadlineKind = 'coverage_decision' | 'compensation_offer'

export type DoDeadlineStatus = 'overdue' | 'due_soon' | 'ok'

/**
 * State of one deadline: an alert status, or why there is no alert
 * (`done`: step done; `not_applicable`: step removed; `closed`: claim closed).
 */
export type DoDeadlineState = DoDeadlineStatus | 'done' | 'not_applicable' | 'closed'

export interface DoDeadlineEntry {
  kind: DoDeadlineKind
  dueDate: string
  state: DoDeadlineState
  /** Days from today to the due date (0 on the day, negative once overdue). */
  daysRemaining: number
  /** French sentence, e.g. "Position sur la garantie attendue avant le 11/05/2026 — dépassé de 12 j". */
  label: string
}

export interface DoDeadlineAlert extends DoDeadlineEntry {
  state: DoDeadlineStatus
}

const DEADLINE_TITLES: Record<DoDeadlineKind, string> = {
  coverage_decision: 'Position sur la garantie',
  compensation_offer: 'Proposition d’indemnité',
}

function formatDays(days: number): string {
  return `${days}\u00a0j`
}

function deadlineSuffix(state: DoDeadlineState, daysRemaining: number): string {
  switch (state) {
    case 'overdue':
      return `dépassé de ${formatDays(-daysRemaining)}`
    case 'due_soon':
    case 'ok':
      return daysRemaining === 0 ? 'échéance aujourd’hui' : `dans ${formatDays(daysRemaining)}`
    case 'done':
      return 'étape terminée'
    case 'not_applicable':
      return 'étape non applicable'
    case 'closed':
      return 'dossier clôturé'
  }
}

/**
 * Both deadlines of a claim with their state on `todayIso`, in the order
 * "position on cover", "compensation offer". Empty when there is no
 * reference date.
 *
 * - `overdue`: the due date is before today; `due_soon`: today or within
 *   {@link DEADLINE_DUE_SOON_DAYS} days; `ok`: later;
 * - no alert (`done`, `not_applicable`, `closed`) when the matching step is
 *   done, removed, or the claim is closed.
 *
 * @param todayIso today's local date (`YYYY-MM-DD`), computed by the caller.
 */
export function describeDoDeadlines(
  claim: Pick<DoClaim, 'steps' | 'declaredAt'>,
  todayIso: string,
): DoDeadlineEntry[] {
  const deadlines = computeDoDeadlines(claim)
  if (!deadlines) return []
  const closed = isClaimClosed(claim)
  const entries: [DoDeadlineKind, string][] = [
    ['coverage_decision', deadlines.coverageDecisionDue],
    ['compensation_offer', deadlines.compensationOfferDue],
  ]
  return entries.map(([kind, dueDate]) => {
    const step = claim.steps.find((s) => s.type === kind)
    const daysRemaining = daysBetweenIso(todayIso, dueDate)
    const state: DoDeadlineState = !step
      ? 'not_applicable'
      : step.status === 'done'
        ? 'done'
        : closed
          ? 'closed'
          : daysRemaining < 0
            ? 'overdue'
            : daysRemaining <= DEADLINE_DUE_SOON_DAYS
              ? 'due_soon'
              : 'ok'
    const label =
      `${DEADLINE_TITLES[kind]} attendue avant le ${formatDateShortFr(dueDate)}` +
      ` — ${deadlineSuffix(state, daysRemaining)}`
    return { kind, dueDate, state, daysRemaining, label }
  })
}

/**
 * Deadlines still running (matching step present and not done, claim not
 * closed), each with its status `overdue`, `due_soon` or `ok`, its French
 * label and the number of days.
 *
 * @param todayIso today's local date (`YYYY-MM-DD`), computed by the caller.
 */
export function getDeadlineAlerts(
  claim: Pick<DoClaim, 'steps' | 'declaredAt'>,
  todayIso: string,
): DoDeadlineAlert[] {
  return describeDoDeadlines(claim, todayIso).filter(
    (entry): entry is DoDeadlineAlert =>
      entry.state === 'overdue' || entry.state === 'due_soon' || entry.state === 'ok',
  )
}

export interface DoClaimsSummary {
  open: number
  closed: number
  /** Number of overdue deadlines, all claims together. */
  overdueAlerts: number
  /** Number of deadlines due within {@link DEADLINE_DUE_SOON_DAYS} days. */
  dueSoonAlerts: number
  totalClaimedCents: number
  totalCompensatedCents: number
}

/** Counts and amount totals of the claims of a visit (missing amounts count as 0). */
export function summarizeDoClaims(claims: readonly DoClaim[], todayIso: string): DoClaimsSummary {
  const summary: DoClaimsSummary = {
    open: 0,
    closed: 0,
    overdueAlerts: 0,
    dueSoonAlerts: 0,
    totalClaimedCents: 0,
    totalCompensatedCents: 0,
  }
  for (const claim of claims) {
    if (isClaimClosed(claim)) summary.closed++
    else summary.open++
    for (const alert of getDeadlineAlerts(claim, todayIso)) {
      if (alert.state === 'overdue') summary.overdueAlerts++
      else if (alert.state === 'due_soon') summary.dueSoonAlerts++
    }
    summary.totalClaimedCents += claim.claimedAmountCents ?? 0
    summary.totalCompensatedCents += claim.compensatedAmountCents ?? 0
  }
  return summary
}

/**
 * Display order: claims with an overdue deadline, then open claims, then
 * closed claims. Stable; returns a new array.
 */
export function sortDoClaimsForDisplay(claims: readonly DoClaim[], todayIso: string): DoClaim[] {
  const rank = (claim: DoClaim) =>
    isClaimClosed(claim)
      ? 2
      : getDeadlineAlerts(claim, todayIso).some((alert) => alert.state === 'overdue')
        ? 0
        : 1
  return claims
    .map((claim, index) => ({ claim, index, rank: rank(claim) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ claim }) => claim)
}
