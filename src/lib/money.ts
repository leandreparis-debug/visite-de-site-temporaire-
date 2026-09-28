/**
 * Money helpers. Amounts are ALWAYS integer cents; VAT rates are basis
 * points (2000 = 20 %). Never use floating-point numbers for stored amounts.
 */

const eurosFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

/**
 * "1234", "1 234", "1234,5", "1 234.56": spaces only as thousands separators,
 * "," or "." as decimal separator, at most 2 decimals.
 */
const EUROS_INPUT = /^(\d{1,3}(?: \d{3})+|\d+)(?:[.,](\d{1,2}))?$/

/** Default French VAT rate in basis points (20 %). */
export const DEFAULT_VAT_RATE_BP = 2000

/**
 * Formats cents as French euros.
 * @example formatEuros(123456) // "1 234,56 €" (with non-breaking spaces)
 */
export function formatEuros(cents: number): string {
  return eurosFormatter.format(cents / 100)
}

/**
 * Formats a VAT rate in basis points as a French percentage.
 * @example formatVatRate(2000) // "20 %" ; formatVatRate(550) // "5,5 %"
 */
export function formatVatRate(rateBp: number): string {
  return `${(rateBp / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`
}

/**
 * Parses a user-typed euro amount into integer cents.
 *
 * Accepted: "1234,56", "1 234.56", "1234", "1 234,5 €" (spaces or non-breaking
 * spaces as thousands separators, optional leading/trailing "€", "," or "." as
 * decimal separator).
 *
 * @returns cents, or `null` if the input is empty, invalid, negative, or has
 * more than two decimals (e.g. "1,234" is rejected rather than guessed).
 */
export function parseEurosInput(input: string): number | null {
  const normalized = input
    .replace(/[\s\u00a0\u202f]+/g, ' ')
    .trim()
    .replace(/^€ ?|\s?€$/g, '')
  const match = EUROS_INPUT.exec(normalized)
  if (!match) return null
  const euros = Number((match[1] ?? '').replace(/ /g, ''))
  const fraction = Number((match[2] ?? '').padEnd(2, '0'))
  const cents = euros * 100 + fraction
  return Number.isSafeInteger(cents) ? cents : null
}

/**
 * VAT amount for an excl.-tax amount, rounded to the nearest cent
 * (half away from zero).
 * @example computeVatCents(1001, 2000) // 200
 */
export function computeVatCents(htCents: number, vatRateBp: number): number {
  const raw = (htCents * vatRateBp) / 10_000
  return Math.sign(raw) * Math.round(Math.abs(raw))
}

/** Incl.-tax amount: excl.-tax amount + rounded VAT. */
export function computeTtcCents(htCents: number, vatRateBp: number): number {
  return htCents + computeVatCents(htCents, vatRateBp)
}

/** Minimal shape needed to total a cost line. */
export interface CostAmounts {
  amountHtCents: number
  vatRateBp: number
}

/** Totals of a list of costs, in cents. */
export interface CostTotals {
  htCents: number
  vatCents: number
  ttcCents: number
}

/**
 * Sums cost lines. VAT is rounded per line (as on an invoice), then summed.
 *
 * @param filter optional predicate, e.g. `(c) => c.status === 'committed'`.
 * @returns zeros for an empty list.
 */
export function sumCosts<T extends CostAmounts>(
  costs: readonly T[],
  filter?: (cost: T) => boolean,
): CostTotals {
  let htCents = 0
  let vatCents = 0
  for (const cost of costs) {
    if (filter && !filter(cost)) continue
    htCents += cost.amountHtCents
    vatCents += computeVatCents(cost.amountHtCents, cost.vatRateBp)
  }
  return { htCents, vatCents, ttcCents: htCents + vatCents }
}
