import { describe, expect, it } from 'vitest'
import {
  formatInsuranceValidity,
  getInsuranceValidity,
  sortInsurancesForDisplay,
  summarizeInsurances,
} from '@/features/insurance/insuranceView'
import type { Insurance } from '@/types/visit'

const TODAY = '2026-09-28'

const contract = (id: string, dates: Partial<Insurance> = {}): Insurance => ({
  id,
  type: 'multirisque',
  insurer: `Assureur ${id}`,
  ...dates,
})

describe('getInsuranceValidity', () => {
  it('returns each status', () => {
    expect(getInsuranceValidity({ endDate: '2027-06-30' }, TODAY)).toEqual({
      status: 'valid',
      daysRemaining: 275,
    })
    expect(getInsuranceValidity({ endDate: '2026-10-21' }, TODAY)).toEqual({
      status: 'expiring_soon',
      daysRemaining: 23,
    })
    expect(getInsuranceValidity({ endDate: '2026-09-01' }, TODAY)).toEqual({
      status: 'expired',
      daysRemaining: -27,
    })
    expect(getInsuranceValidity({ startDate: '2027-01-01', endDate: '2028-01-01' }, TODAY)).toEqual(
      { status: 'not_started', daysRemaining: 460 },
    )
    expect(getInsuranceValidity({ startDate: '2020-01-01' }, TODAY)).toEqual({
      status: 'unknown',
    })
  })

  it('handles the bounds', () => {
    // Exactly 90 days: still "expiring soon"; 91 days: valid.
    expect(getInsuranceValidity({ endDate: '2026-12-27' }, TODAY)).toEqual({
      status: 'expiring_soon',
      daysRemaining: 90,
    })
    expect(getInsuranceValidity({ endDate: '2026-12-28' }, TODAY).status).toBe('valid')
    // End date today: last day of cover, not expired yet.
    expect(getInsuranceValidity({ endDate: TODAY }, TODAY)).toEqual({
      status: 'expiring_soon',
      daysRemaining: 0,
    })
    expect(getInsuranceValidity({ endDate: '2026-09-27' }, TODAY).status).toBe('expired')
    // Starts tomorrow: not started; starts today: in force.
    expect(getInsuranceValidity({ startDate: '2026-09-29' }, TODAY).status).toBe('not_started')
    expect(getInsuranceValidity({ startDate: TODAY, endDate: '2030-01-01' }, TODAY).status).toBe(
      'valid',
    )
  })

  it('formats the badge text', () => {
    expect(formatInsuranceValidity({ status: 'expiring_soon', daysRemaining: 23 })).toBe(
      'Expire dans 23\u00a0j',
    )
    expect(formatInsuranceValidity({ status: 'expiring_soon', daysRemaining: 0 })).toBe(
      'Expire aujourd’hui',
    )
    expect(formatInsuranceValidity({ status: 'valid' })).toBe('Valide')
    expect(formatInsuranceValidity({ status: 'expired' })).toBe('Expiré')
    expect(formatInsuranceValidity({ status: 'not_started' })).toBe('Pas encore en vigueur')
    expect(formatInsuranceValidity({ status: 'unknown' })).toBe('Échéance non renseignée')
  })
})

describe('summarizeInsurances / sortInsurancesForDisplay', () => {
  const list = [
    contract('valid', { endDate: '2030-01-01' }),
    contract('unknown'),
    contract('soon', { endDate: '2026-11-01' }),
    contract('expired', { endDate: '2025-01-01' }),
    contract('later', { endDate: '2029-01-01' }),
    contract('future', { startDate: '2027-01-01', endDate: '2028-01-01' }),
  ]

  it('counts contracts per status', () => {
    expect(summarizeInsurances(list, TODAY)).toEqual({
      total: 6,
      valid: 2,
      expiring_soon: 1,
      expired: 1,
      not_started: 1,
      unknown: 1,
    })
    expect(summarizeInsurances([], TODAY).total).toBe(0)
  })

  it('sorts expired / expiring first, then by end date, no end date last', () => {
    expect(sortInsurancesForDisplay(list, TODAY).map((i) => i.id)).toEqual([
      'expired',
      'soon',
      'future',
      'later',
      'valid',
      'unknown',
    ])
    expect(list[0]?.id).toBe('valid')
  })
})
