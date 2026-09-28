import { describe, expect, it } from 'vitest'
import {
  addCost,
  insertCostAt,
  moveCostsToProject,
  removeCost,
  removeCosts,
  restoreCosts,
  updateCost,
} from '@/features/costs/costOps'
import { removeProject } from '@/features/projects/projectOps'
import { deepFreeze } from '@/test/deepFreeze'
import { makeFullVisit } from '@/test/fixtures'
import { visitSchema, type Visit } from '@/types/visit'

const frozen = () => deepFreeze(makeFullVisit())
const expectValid = (visit: Visit) => {
  expect(visitSchema.safeParse(visit).success).toBe(true)
}

describe('costOps', () => {
  it('never mutates and is deterministic', () => {
    const visit = frozen()
    const ops = [
      () => addCost(visit, { id: 'n', label: ' Devis ', amountHtCents: 100 }),
      () => updateCost(visit, 'cost-1', { vatRateBp: 550, supplier: '' }),
      () => removeCost(visit, 'cost-1'),
      () => removeCosts(visit, ['cost-1', 'cost-2']),
      () => insertCostAt(visit, { ...visit.costs[0]!, id: 'z' }, 0),
      () => moveCostsToProject(visit, ['cost-2'], 'proj-2'),
    ]
    for (const op of ops) {
      expect(op).not.toThrow()
      expect(op()).toEqual(op())
    }
  })

  it('adds a line with defaults, cleaned, and refuses invalid input', () => {
    const visit = frozen()
    const next = addCost(visit, {
      id: 'n',
      label: '  Remplacement exutoires ',
      amountHtCents: 1_250_050,
      supplier: '  ',
      projectId: 'proj-2',
    })
    expect(next.costs.at(-1)).toEqual({
      id: 'n',
      label: 'Remplacement exutoires',
      category: 'works',
      amountHtCents: 1_250_050,
      vatRateBp: 2000,
      status: 'estimate',
      projectId: 'proj-2',
    })
    expectValid(next)
    expect(addCost(visit, { id: 'm', label: ' ', amountHtCents: 1 })).toBe(visit)
    expect(addCost(visit, { id: 'm', label: 'X', amountHtCents: -1 })).toBe(visit)
    expect(addCost(visit, { id: 'm', label: 'X', amountHtCents: 1.5 })).toBe(visit)
    expect(addCost(visit, { id: 'm', label: 'X', amountHtCents: 1, vatRateBp: 20_000 })).toBe(visit)
    expect(addCost(visit, { id: 'm', label: 'X', amountHtCents: 1, projectId: 'nope' })).toBe(visit)
    expect(addCost(next, { id: 'n', label: 'Doublon', amountHtCents: 1 }).costs).toHaveLength(3)
  })

  it('updates a line, detaches it, refuses an unknown project', () => {
    const visit = frozen()
    const next = updateCost(visit, 'cost-1', {
      status: 'committed',
      supplier: ' Couverture SA ',
      projectId: undefined,
    })
    expect(next.costs[0]).toEqual({
      id: 'cost-1',
      label: 'Devis couvreur',
      category: 'works',
      amountHtCents: 4_500_000,
      vatRateBp: 2000,
      status: 'committed',
      supplier: 'Couverture SA',
    })
    expectValid(next)
    expect(updateCost(visit, 'cost-1', { projectId: 'nope' })).toBe(visit)
    expect(updateCost(visit, 'cost-1', { label: '' })).toBe(visit)
    expect(updateCost(visit, 'unknown', { label: 'X' })).toBe(visit)
  })

  it('removes then re-inserts a line identically', () => {
    const visit = frozen()
    const { visit: without, removed, index } = removeCost(visit, 'cost-1')
    expect(without.costs.map((c) => c.id)).toEqual(['cost-2'])
    expect(insertCostAt(without, removed!, index)).toEqual(visit)
    expect(insertCostAt(visit, removed!, 1)).toBe(visit)
    expect(removeCost(visit, 'nope')).toEqual({ visit, removed: null, index: -1 })
  })

  it('re-inserts a line unassigned when its project was deleted meanwhile', () => {
    const visit = frozen()
    const { visit: without, removed, index } = removeCost(visit, 'cost-1')
    const noProject = removeProject(without, 'proj-1', 'delete_costs').visit
    const back = insertCostAt(noProject, removed!, index)
    expect(back.costs[0]).not.toHaveProperty('projectId')
    expectValid(back)
  })

  it('bulk removal and restore', () => {
    const visit = frozen()
    const { visit: without, removed } = removeCosts(visit, ['cost-2', 'cost-1', 'nope'])
    expect(without.costs).toEqual([])
    expect(removed.map((r) => r.index)).toEqual([0, 1])
    expect(restoreCosts(without, removed)).toEqual(visit)
    expect(removeCosts(visit, ['nope']).visit).toBe(visit)
  })

  it('moves lines to a project or detaches them; an unknown project is refused', () => {
    const visit = frozen()
    const moved = moveCostsToProject(visit, ['cost-1', 'cost-2'], 'proj-2')
    expect(moved.costs.map((c) => c.projectId)).toEqual(['proj-2', 'proj-2'])
    expectValid(moved)
    const detached = moveCostsToProject(moved, ['cost-1'], undefined)
    expect(detached.costs[0]).not.toHaveProperty('projectId')
    expectValid(detached)
    expect(moveCostsToProject(visit, ['cost-1'], 'nope')).toBe(visit)
    expect(moveCostsToProject(visit, ['cost-1'], 'proj-1')).toBe(visit)
  })
})
