import { describe, expect, it } from 'vitest'
import {
  buildCostsOverview,
  COST_EXPORT_HEADERS,
  costsToCsv,
  costsToTsv,
  formatCentsForExcel,
  formatVatRateForExcel,
  getCostLineAmounts,
  groupCosts,
  summarizeCostsByStatus,
  UNASSIGNED_GROUP_KEY,
  type CostGroupBy,
} from '@/features/costs/costView'
import { computeVatCents } from '@/lib/money'
import type { Cost, Project } from '@/types/visit'

const projects: Project[] = [
  { id: 'p-planned', name: 'Réfection toiture', status: 'planned', startDate: '2027-01-01' },
  { id: 'p-progress', name: 'Quais', status: 'in_progress' },
  { id: 'p-empty', name: 'Sans coût', status: 'identified' },
]

let n = 0
function cost(fields: Partial<Cost> & Pick<Cost, 'amountHtCents'>): Cost {
  n += 1
  return {
    id: `c${n}`,
    label: `Ligne ${n}`,
    category: 'works',
    vatRateBp: 2000,
    status: 'estimate',
    ...fields,
  }
}

const costs: Cost[] = [
  cost({ amountHtCents: 1_250_050, projectId: 'p-planned', status: 'quote' }),
  cost({ amountHtCents: 5, vatRateBp: 550, projectId: 'p-progress', category: 'study' }),
  cost({ amountHtCents: 5, vatRateBp: 550, status: 'committed', category: 'maintenance' }),
  cost({ amountHtCents: 5, vatRateBp: 550, projectId: 'p-planned', status: 'invoiced' }),
  cost({ amountHtCents: 4_500_000, vatRateBp: 1000, status: 'committed', projectId: 'p-progress' }),
  cost({ amountHtCents: 333, vatRateBp: 210, category: 'other', status: 'invoiced' }),
]

describe('line amounts and rounding', () => {
  it('rounds VAT line by line: 3 × 0,05 € at 5,5 % gives 3 rounded VATs', () => {
    const small = [5, 5, 5].map((amountHtCents) => cost({ amountHtCents, vatRateBp: 550 }))
    const { total } = summarizeCostsByStatus(small)
    // Each line: 5 × 5,5 % = 0,275 cent → 0. Rounding the sum (15 × 5,5 % = 0,825 → 1) would differ.
    expect(total.vatCents).toBe(
      small.reduce((sum, c) => sum + computeVatCents(c.amountHtCents, c.vatRateBp), 0),
    )
    expect(total.vatCents).toBe(0)
    expect(computeVatCents(15, 550)).toBe(1)
    expect(total).toEqual({ count: 3, htCents: 15, vatCents: 0, ttcCents: 15 })
    expect(getCostLineAmounts({ amountHtCents: 1_250_050, vatRateBp: 2000 })).toEqual({
      htCents: 1_250_050,
      vatCents: 250_010,
      ttcCents: 1_500_060,
    })
  })

  it('totals each stage and the grand total', () => {
    const { byStatus, total } = summarizeCostsByStatus(costs)
    expect(byStatus.estimate).toEqual({ count: 1, htCents: 5, vatCents: 0, ttcCents: 5 })
    expect(byStatus.quote).toEqual({
      count: 1,
      htCents: 1_250_050,
      vatCents: 250_010,
      ttcCents: 1_500_060,
    })
    expect(byStatus.committed).toEqual({
      count: 2,
      htCents: 4_500_005,
      vatCents: 450_000,
      ttcCents: 4_950_005,
    })
    // 333 × 2,1 % = 6,993 → 7.
    expect(byStatus.invoiced).toEqual({ count: 2, htCents: 338, vatCents: 7, ttcCents: 345 })
    expect(total).toEqual({
      count: 6,
      htCents: 5_750_398,
      vatCents: 700_017,
      ttcCents: 6_450_415,
    })
    expect(summarizeCostsByStatus([]).total).toEqual({
      count: 0,
      htCents: 0,
      vatCents: 0,
      ttcCents: 0,
    })
  })
})

describe('groupCosts', () => {
  it.each<CostGroupBy>(['project', 'status', 'category'])(
    'subtotals add up to the grand total (%s)',
    (groupBy) => {
      const groups = groupCosts(costs, projects, groupBy)
      const { total } = summarizeCostsByStatus(costs)
      const sum = (key: 'count' | 'htCents' | 'vatCents' | 'ttcCents') =>
        groups.reduce((acc, g) => acc + g.subtotal[key], 0)
      expect({
        count: sum('count'),
        htCents: sum('htCents'),
        vatCents: sum('vatCents'),
        ttcCents: sum('ttcCents'),
      }).toEqual(total)
      expect(groups.flatMap((g) => g.costs)).toHaveLength(costs.length)
    },
  )

  it('orders project groups, "Non rattachés" last, empty groups omitted', () => {
    const groups = groupCosts(costs, projects, 'project')
    expect(groups.map((g) => [g.key, g.label])).toEqual([
      ['p-progress', 'Quais'],
      ['p-planned', 'Réfection toiture'],
      [UNASSIGNED_GROUP_KEY, 'Non rattachés'],
    ])
    expect(groups[0]?.costs.map((c) => c.id)).toEqual(['c2', 'c5'])
    expect(groupCosts(costs.slice(0, 1), projects, 'project').map((g) => g.key)).toEqual([
      'p-planned',
    ])
  })

  it('orders status and category groups', () => {
    expect(groupCosts(costs, projects, 'status').map((g) => g.label)).toEqual([
      'Estimation',
      'Devis reçu',
      'Engagé',
      'Facturé',
    ])
    expect(groupCosts(costs, projects, 'category').map((g) => g.label)).toEqual([
      'Travaux',
      'Maintenance',
      'Étude',
      'Autre',
    ])
    expect(groupCosts([], projects, 'status')).toEqual([])
  })
})

describe('buildCostsOverview', () => {
  it('builds the plural sentence', () => {
    const overview = buildCostsOverview({
      projects: [...projects, { id: 'p4', name: 'X', status: 'in_progress' }],
      costs,
    })
    expect(overview.text).toBe(
      '2 projets en cours · 6 lignes de coûts · Engagé : 45 000,05 € HT · Facturé : 3,38 € HT'.replaceAll(
        ' :',
        ' :',
      ),
    )
    expect(overview).toMatchObject({ activeProjects: 4, inProgressProjects: 2, costCount: 6 })
    expect(overview.items.map((i) => i.section)).toEqual(['projects', 'costs', 'costs', 'costs'])
  })

  it('builds the singular sentence and the empty one', () => {
    expect(
      buildCostsOverview({
        projects: [projects[1]!],
        costs: [cost({ amountHtCents: 100, status: 'committed' })],
      }).text,
    ).toBe('1 projet en cours · 1 ligne de coût · Engagé : 1,00 € HT')
    // No project in progress: the total is shown.
    expect(buildCostsOverview({ projects: [projects[0]!], costs: [] }).text).toBe(
      '1 projet · Aucun coût',
    )
    expect(buildCostsOverview({ projects: [], costs: [] })).toMatchObject({
      text: 'Aucun projet · Aucun coût',
      activeProjects: 0,
    })
  })
})

describe('Excel export', () => {
  const tricky: Cost = {
    id: 't',
    label: 'Reprise ; "chéneau"\tnord\nquai 3',
    category: 'works',
    amountHtCents: 1_250_050,
    vatRateBp: 550,
    status: 'quote',
    supplier: 'Étanchéité SA',
    projectId: 'p-planned',
  }

  it('formats amounts and rates for Excel FR', () => {
    expect(formatCentsForExcel(1_250_050)).toBe('12500,50')
    expect(formatCentsForExcel(5)).toBe('0,05')
    expect(formatCentsForExcel(0)).toBe('0,00')
    expect(formatVatRateForExcel(2000)).toBe('20')
    expect(formatVatRateForExcel(550)).toBe('5,5')
    expect(formatVatRateForExcel(210)).toBe('2,1')
    expect(formatVatRateForExcel(0)).toBe('0')
  })

  it('builds a TSV with a header row and escaped cells', () => {
    const tsv = costsToTsv([tricky, costs[5]!], projects)
    const lines = tsv.split('\r\n')
    expect(lines[0]).toBe(COST_EXPORT_HEADERS.join('\t'))
    expect(tsv.startsWith('\uFEFF')).toBe(false)
    expect(tsv).toBe(
      [
        COST_EXPORT_HEADERS.join('\t'),
        [
          'Réfection toiture',
          '"Reprise ; ""chéneau""\tnord\nquai 3"',
          'Travaux',
          'Étanchéité SA',
          'Devis reçu',
          '12500,50',
          '5,5',
          '687,53',
          '13188,03',
          '',
        ].join('\t'),
        ['', 'Ligne 6', 'Autre', '', 'Facturé', '3,33', '2,1', '0,07', '3,40', ''].join('\t'),
      ].join('\r\n'),
    )
  })

  it('builds a CSV with BOM, ";" separator and escaped cells', () => {
    const csv = costsToCsv([tricky], projects)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const [header, row] = csv.slice(1).split('\r\n')
    expect(header).toBe(COST_EXPORT_HEADERS.join(';'))
    expect(row).toBe(
      'Réfection toiture;"Reprise ; ""chéneau""\tnord\nquai 3";Travaux;Étanchéité SA;Devis reçu;12500,50;5,5;687,53;13188,03;',
    )
  })
})
