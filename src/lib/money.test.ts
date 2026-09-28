import { describe, expect, it } from 'vitest'
import {
  computeTtcCents,
  computeVatCents,
  formatEuros,
  formatVatRate,
  parseEurosInput,
  sumCosts,
} from '@/lib/money'

/** Intl uses (narrow) non-breaking spaces; normalize them for assertions. */
const normalize = (value: string) => value.replace(/[\u00a0\u202f]/g, ' ')

describe('formatEuros', () => {
  it('formats cents in French', () => {
    expect(normalize(formatEuros(123456))).toBe('1 234,56 €')
    expect(normalize(formatEuros(0))).toBe('0,00 €')
    expect(normalize(formatEuros(5))).toBe('0,05 €')
    expect(normalize(formatEuros(100_000_000))).toBe('1 000 000,00 €')
  })

  it('formats VAT rates', () => {
    expect(normalize(formatVatRate(2000))).toBe('20 %')
    expect(normalize(formatVatRate(550))).toBe('5,5 %')
  })
})

describe('parseEurosInput', () => {
  it.each([
    ['1234,56', 123456],
    ['1 234.56', 123456],
    ['1234', 123400],
    ['1 234,5 €', 123450],
    ['1\u00a0234,56\u00a0€', 123456],
    ['1\u202f234,56 €', 123456],
    ['0,05', 5],
    ['  42  ', 4200],
    ['12.3', 1230],
    ['€ 12', 1200],
    ['1 234 567,89', 123456789],
  ])('parses %j as %i cents', (input, expected) => {
    expect(parseEurosInput(input)).toBe(expected)
  })

  it.each([
    'abc',
    '-5',
    '1,234',
    '',
    '   ',
    '12,',
    '1.234,56',
    '1,2,3',
    '12 €50',
    '1e3',
    '12 50',
    '€€12',
    '1234 ,5',
  ])('rejects %j', (input) => {
    expect(parseEurosInput(input)).toBeNull()
  })
})

describe('VAT', () => {
  it('rounds to the nearest cent', () => {
    expect(computeVatCents(1001, 2000)).toBe(200) // 200.2
    expect(computeVatCents(1003, 2000)).toBe(201) // 200.6
    expect(computeVatCents(1, 550)).toBe(0) // 0.055
    expect(computeVatCents(10, 550)).toBe(1) // 0.55 → 1 (half up)
    expect(computeVatCents(12345, 0)).toBe(0)
  })

  it('computes incl.-tax amounts', () => {
    expect(computeTtcCents(1001, 2000)).toBe(1201)
    expect(computeTtcCents(10000, 1000)).toBe(11000)
  })
})

describe('sumCosts', () => {
  const costs = [
    { amountHtCents: 1001, vatRateBp: 2000, status: 'quote' },
    { amountHtCents: 1001, vatRateBp: 2000, status: 'committed' },
    { amountHtCents: 10000, vatRateBp: 550, status: 'committed' },
  ]

  it('returns zeros for an empty list', () => {
    expect(sumCosts([])).toEqual({ htCents: 0, vatCents: 0, ttcCents: 0 })
  })

  it('sums with VAT rounded per line', () => {
    expect(sumCosts(costs)).toEqual({ htCents: 12002, vatCents: 950, ttcCents: 12952 })
  })

  it('applies the optional filter', () => {
    expect(sumCosts(costs, (c) => c.status === 'committed')).toEqual({
      htCents: 11001,
      vatCents: 750,
      ttcCents: 11751,
    })
  })
})
