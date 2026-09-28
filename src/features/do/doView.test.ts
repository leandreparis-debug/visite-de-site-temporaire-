import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  computeDoDeadlines,
  describeDoDeadlines,
  DO_STEP_SEQUENCE,
  formatReferenceSource,
  getClaimProgress,
  getCurrentStep,
  getDeadlineAlerts,
  isClaimClosed,
  sortDoClaimsForDisplay,
  summarizeDoClaims,
} from '@/features/do/doView'
import type { DoClaim, DoStep, DoStepStatus, DoStepType } from '@/types/visit'

/** A claim with the 10 standard steps; `statuses` / `dates` override some of them. */
function makeClaim(
  options: {
    id?: string
    statuses?: Partial<Record<DoStepType, DoStepStatus>>
    dates?: Partial<Record<DoStepType, string>>
    without?: DoStepType[]
  } & Partial<Omit<DoClaim, 'id' | 'steps'>> = {},
): DoClaim {
  const { id = 'c', statuses = {}, dates = {}, without = [], ...fields } = options
  const steps = DO_STEP_SEQUENCE.filter((type) => !without.includes(type)).map((type): DoStep => ({
    id: `s-${type}`,
    type,
    status: statuses[type] ?? 'todo',
    ...(dates[type] !== undefined && { date: dates[type] }),
  }))
  return { id, description: 'Infiltration', steps, ...fields }
}

describe('progress and current step', () => {
  it('counts done steps and finds the first step not done', () => {
    const claim = makeClaim({
      statuses: { declaration: 'done', acknowledgment: 'done', expertise: 'done' },
    })
    expect(getClaimProgress(claim)).toEqual({ done: 3, total: 10, percent: 30 })
    expect(getCurrentStep(claim)?.type).toBe('expert_appointed')
    expect(getClaimProgress({ steps: [] })).toEqual({ done: 0, total: 0, percent: 0 })
    expect(getCurrentStep({ steps: [] })).toBeNull()
  })

  it('ignores removed steps', () => {
    const claim = makeClaim({
      without: ['expert_appointed', 'expertise', 'preliminary_report'],
      statuses: { declaration: 'done', acknowledgment: 'done' },
    })
    expect(getClaimProgress(claim)).toEqual({ done: 2, total: 7, percent: 29 })
    expect(getCurrentStep(claim)?.type).toBe('coverage_decision')
  })

  it('returns null when every step is done', () => {
    const statuses = Object.fromEntries(DO_STEP_SEQUENCE.map((t) => [t, 'done']))
    expect(getCurrentStep(makeClaim({ statuses }))).toBeNull()
    expect(getClaimProgress(makeClaim({ statuses })).percent).toBe(100)
  })

  it('isClaimClosed needs a done "closed" step', () => {
    expect(isClaimClosed(makeClaim({ statuses: { closed: 'done' } }))).toBe(true)
    expect(isClaimClosed(makeClaim({ statuses: { closed: 'in_progress' } }))).toBe(false)
    expect(isClaimClosed(makeClaim({ without: ['closed'] }))).toBe(false)
  })
})

describe('computeDoDeadlines', () => {
  it('prefers the acknowledgment date over the declaration', () => {
    const claim = makeClaim({
      declaredAt: '2026-03-02',
      dates: { declaration: '2026-03-01', acknowledgment: '2026-03-12' },
    })
    expect(computeDoDeadlines(claim)).toEqual({
      referenceDate: '2026-03-12',
      referenceSource: 'acknowledgment',
      coverageDecisionDue: '2026-05-11',
      compensationOfferDue: '2026-06-10',
    })
  })

  it('falls back to declaredAt, then to the declaration step', () => {
    expect(
      computeDoDeadlines(
        makeClaim({ declaredAt: '2026-03-02', dates: { declaration: '2026-03-01' } }),
      ),
    ).toMatchObject({ referenceDate: '2026-03-02', referenceSource: 'declared_at' })
    expect(computeDoDeadlines(makeClaim({ dates: { declaration: '2026-03-01' } }))).toMatchObject({
      referenceDate: '2026-03-01',
      referenceSource: 'declaration_step',
    })
    // Acknowledgment step removed: no crash, fallback applies.
    expect(
      computeDoDeadlines(makeClaim({ without: ['acknowledgment'], declaredAt: '2026-03-02' })),
    ).toMatchObject({ referenceSource: 'declared_at' })
  })

  it('returns null without any date', () => {
    expect(computeDoDeadlines(makeClaim())).toBeNull()
    expect(describeDoDeadlines(makeClaim(), '2026-09-28')).toEqual([])
    expect(getDeadlineAlerts(makeClaim(), '2026-09-28')).toEqual([])
  })

  it('adds 60 / 90 days across end of February and leap years', () => {
    expect(computeDoDeadlines(makeClaim({ declaredAt: '2026-01-15' }))).toMatchObject({
      coverageDecisionDue: '2026-03-16',
      compensationOfferDue: '2026-04-15',
    })
    // 2028 is a leap year: February has 29 days.
    expect(computeDoDeadlines(makeClaim({ declaredAt: '2028-01-15' }))).toMatchObject({
      coverageDecisionDue: '2028-03-15',
      compensationOfferDue: '2028-04-14',
    })
    expect(computeDoDeadlines(makeClaim({ declaredAt: '2027-12-31' }))).toMatchObject({
      coverageDecisionDue: '2028-02-29',
      compensationOfferDue: '2028-03-30',
    })
  })

  describe('in a time zone with daylight saving (Europe/Paris)', () => {
    const previous = process.env.TZ
    beforeAll(() => {
      process.env.TZ = 'Europe/Paris'
    })
    afterAll(() => {
      process.env.TZ = previous
    })

    it('never shifts by one day across the DST changes', () => {
      // Summer time starts on 2026-03-29, ends on 2026-10-25.
      expect(computeDoDeadlines(makeClaim({ declaredAt: '2026-03-01' }))).toMatchObject({
        coverageDecisionDue: '2026-04-30',
        compensationOfferDue: '2026-05-30',
      })
      expect(computeDoDeadlines(makeClaim({ declaredAt: '2026-09-15' }))).toMatchObject({
        coverageDecisionDue: '2026-11-14',
        compensationOfferDue: '2026-12-14',
      })
      expect(
        getDeadlineAlerts(makeClaim({ declaredAt: '2026-03-01' }), '2026-04-30')[0]?.daysRemaining,
      ).toBe(0)
    })
  })

  it('formats the reference source in French', () => {
    const deadlines = computeDoDeadlines(makeClaim({ dates: { acknowledgment: '2026-03-12' } }))!
    expect(formatReferenceSource(deadlines)).toBe('à partir de l’accusé de réception du 12/03/2026')
    expect(
      formatReferenceSource(computeDoDeadlines(makeClaim({ declaredAt: '2026-03-02' }))!),
    ).toBe('à partir de la déclaration du 02/03/2026')
  })
})

describe('getDeadlineAlerts', () => {
  // Reference 2026-03-12 → position due 2026-05-11, offer due 2026-06-10.
  const claim = makeClaim({ dates: { acknowledgment: '2026-03-12' } })

  it('flags overdue, due soon (≤ 15 days) and ok deadlines', () => {
    expect(getDeadlineAlerts(claim, '2026-05-23')).toEqual([
      {
        kind: 'coverage_decision',
        dueDate: '2026-05-11',
        state: 'overdue',
        daysRemaining: -12,
        label: 'Position sur la garantie attendue avant le 11/05/2026 — dépassé de 12\u00a0j',
      },
      {
        kind: 'compensation_offer',
        dueDate: '2026-06-10',
        state: 'ok',
        daysRemaining: 18,
        label: 'Proposition d’indemnité attendue avant le 10/06/2026 — dans 18\u00a0j',
      },
    ])
    expect(getDeadlineAlerts(claim, '2026-05-26')[1]).toMatchObject({
      state: 'due_soon',
      daysRemaining: 15,
    })
    expect(getDeadlineAlerts(claim, '2026-05-11')[0]).toMatchObject({
      state: 'due_soon',
      daysRemaining: 0,
      label: 'Position sur la garantie attendue avant le 11/05/2026 — échéance aujourd’hui',
    })
    expect(getDeadlineAlerts(claim, '2026-05-12')[0]?.state).toBe('overdue')
  })

  it('gives no alert once the matching step is done, removed, or the claim closed', () => {
    const decided = makeClaim({
      dates: { acknowledgment: '2026-03-12' },
      statuses: { coverage_decision: 'done' },
    })
    expect(getDeadlineAlerts(decided, '2026-07-01').map((a) => a.kind)).toEqual([
      'compensation_offer',
    ])
    expect(describeDoDeadlines(decided, '2026-07-01')[0]).toMatchObject({
      state: 'done',
      label: 'Position sur la garantie attendue avant le 11/05/2026 — étape terminée',
    })

    const removed = makeClaim({
      dates: { acknowledgment: '2026-03-12' },
      without: ['compensation_offer'],
    })
    expect(describeDoDeadlines(removed, '2026-07-01')[1]?.state).toBe('not_applicable')
    expect(getDeadlineAlerts(removed, '2026-07-01')).toHaveLength(1)

    const closed = makeClaim({
      dates: { acknowledgment: '2026-03-12' },
      statuses: { closed: 'done' },
    })
    expect(getDeadlineAlerts(closed, '2026-07-01')).toEqual([])
  })
})

describe('summarizeDoClaims / sortDoClaimsForDisplay', () => {
  const overdue = makeClaim({
    id: 'overdue',
    declaredAt: '2026-01-01',
    claimedAmountCents: 1_250_050,
    compensatedAmountCents: 1_000_000,
  })
  const open = makeClaim({ id: 'open', claimedAmountCents: 50_000 })
  const soon = makeClaim({ id: 'soon', declaredAt: '2026-08-05' })
  const closed = makeClaim({
    id: 'closed',
    declaredAt: '2025-01-01',
    statuses: { closed: 'done' },
    claimedAmountCents: 99,
    compensatedAmountCents: 1,
  })

  it('sums counts, alerts and amounts', () => {
    // soon: position due 2026-10-04 (6 days), offer due 2026-11-03 (36 days).
    expect(summarizeDoClaims([overdue, open, soon, closed], '2026-09-28')).toEqual({
      open: 3,
      closed: 1,
      overdueAlerts: 2,
      dueSoonAlerts: 1,
      totalClaimedCents: 1_250_050 + 50_000 + 99,
      totalCompensatedCents: 1_000_001,
    })
    expect(summarizeDoClaims([], '2026-09-28')).toEqual({
      open: 0,
      closed: 0,
      overdueAlerts: 0,
      dueSoonAlerts: 0,
      totalClaimedCents: 0,
      totalCompensatedCents: 0,
    })
  })

  it('sorts overdue, then open, then closed', () => {
    expect(
      sortDoClaimsForDisplay([closed, open, overdue, soon], '2026-09-28').map((c) => c.id),
    ).toEqual(['overdue', 'open', 'soon', 'closed'])
  })
})
