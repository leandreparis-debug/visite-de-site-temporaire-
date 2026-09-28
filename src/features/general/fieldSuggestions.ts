/** Pure computation of the `<datalist>` suggestions from existing visits. */
import type { Visit } from '@/types/visit'

/** Default report authors, always suggested. */
export const DEFAULT_AUTHORS = [
  'Arnaud Montigny',
  'Emre Akagunduz',
  'Jean-Christophe Bains',
] as const

export interface FieldSuggestions {
  authors: string[]
  siteNames: string[]
  cities: string[]
  participantNames: string[]
  roles: string[]
  companies: string[]
  /** Insurers of the contracts and DO claims. */
  insurers: string[]
  brokers: string[]
  /** Suppliers of the cost lines. */
  suppliers: string[]
}

const collator = new Intl.Collator('fr', { sensitivity: 'base' })

/** Counts values case-insensitively (edges trimmed); keeps the first spelling met. */
class Counter {
  private readonly entries = new Map<string, { label: string; count: number }>()

  add(value: string | undefined, weight = 1): void {
    const label = value?.trim()
    if (!label) return
    const key = label.toLocaleLowerCase('fr')
    const entry = this.entries.get(key)
    if (entry) entry.count += weight
    else this.entries.set(key, { label, count: weight })
  }

  /** Most used first, then alphabetical. */
  list(): string[] {
    return [...this.entries.values()]
      .sort((a, b) => b.count - a.count || collator.compare(a.label, b.label))
      .map((entry) => entry.label)
  }
}

/**
 * Builds the suggestion lists: deduplicated (case- and edge-space-insensitive),
 * sorted by frequency of use. Default authors are always included.
 *
 * @param excludeVisitId the visit being edited (its own values are not suggested).
 */
export function computeFieldSuggestions(
  visits: readonly Visit[],
  excludeVisitId?: string,
): FieldSuggestions {
  const counters = {
    authors: new Counter(),
    siteNames: new Counter(),
    cities: new Counter(),
    participantNames: new Counter(),
    roles: new Counter(),
    companies: new Counter(),
    insurers: new Counter(),
    brokers: new Counter(),
    suppliers: new Counter(),
  }
  for (const visit of visits) {
    if (visit.id === excludeVisitId) continue
    counters.authors.add(visit.author)
    counters.siteNames.add(visit.site.name)
    counters.cities.add(visit.site.city)
    for (const participant of visit.participants) {
      counters.participantNames.add(participant.name)
      counters.roles.add(participant.role)
      counters.companies.add(participant.company)
    }
    for (const insurance of visit.insurances) {
      counters.insurers.add(insurance.insurer)
      counters.brokers.add(insurance.broker)
    }
    for (const claim of visit.doClaims) counters.insurers.add(claim.insurer)
    for (const cost of visit.costs) counters.suppliers.add(cost.supplier)
  }
  for (const author of DEFAULT_AUTHORS) counters.authors.add(author, 0)
  return {
    authors: counters.authors.list(),
    siteNames: counters.siteNames.list(),
    cities: counters.cities.list(),
    participantNames: counters.participantNames.list(),
    roles: counters.roles.list(),
    companies: counters.companies.list(),
    insurers: counters.insurers.list(),
    brokers: counters.brokers.list(),
    suppliers: counters.suppliers.list(),
  }
}
