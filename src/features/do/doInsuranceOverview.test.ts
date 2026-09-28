import { describe, expect, it } from 'vitest'
import { getDoInsuranceOverview, getOverviewItems } from '@/features/do/doInsuranceOverview'
import type { DoClaim, Insurance } from '@/types/visit'

const TODAY = '2026-09-28'

const claim = (id: string, declaredAt?: string): DoClaim => ({
  id,
  description: id,
  steps: [
    { id: `${id}-1`, type: 'coverage_decision', status: 'todo' },
    { id: `${id}-2`, type: 'compensation_offer', status: 'todo' },
  ],
  ...(declaredAt !== undefined && { declaredAt }),
})
const contract = (id: string, endDate?: string): Insurance => ({
  id,
  type: 'multirisque',
  insurer: id,
  ...(endDate !== undefined && { endDate }),
})

describe('getDoInsuranceOverview / getOverviewItems', () => {
  it('builds the banner items and the tab indicator', () => {
    const overview = getDoInsuranceOverview(
      {
        // Declared 70 days ago: 1 overdue deadline, the other within 20 days (ok).
        doClaims: [claim('a', '2026-07-20'), claim('b')],
        insurances: [contract('x', '2026-10-28'), contract('y', '2030-01-01'), contract('z')],
      },
      TODAY,
    )
    expect(overview.tabCount).toBe(2)
    expect(overview.hasAlert).toBe(true)
    expect(getOverviewItems(overview)).toEqual([
      { key: 'claims', text: '2 sinistres en cours', tone: 'neutral', section: 'claims' },
      { key: 'overdue', text: '1 délai dépassé', tone: 'danger', section: 'claims' },
      {
        key: 'contracts',
        text: '3 contrats dont 1 expire bientôt',
        tone: 'warning',
        section: 'insurances',
      },
    ])
  })

  it('reports expired contracts in red and handles empty lists', () => {
    const expired = getDoInsuranceOverview(
      { doClaims: [], insurances: [contract('x', '2025-01-01'), contract('y', '2026-10-01')] },
      TODAY,
    )
    expect(expired.hasAlert).toBe(true)
    expect(getOverviewItems(expired)).toEqual([
      { key: 'claims', text: 'Aucun sinistre en cours', tone: 'neutral', section: 'claims' },
      {
        key: 'contracts',
        text: '2 contrats dont 1 expiré et 1 expire bientôt',
        tone: 'danger',
        section: 'insurances',
      },
    ])
    const empty = getDoInsuranceOverview({ doClaims: [], insurances: [] }, TODAY)
    expect(empty).toMatchObject({ tabCount: 0, hasAlert: false })
    expect(getOverviewItems(empty).map((item) => item.text)).toEqual([
      'Aucun sinistre en cours',
      'Aucun contrat',
    ])
  })
})
