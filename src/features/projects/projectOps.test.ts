import { describe, expect, it } from 'vitest'
import {
  addProject,
  insertProjectAt,
  removeProject,
  restoreProject,
  updateProject,
} from '@/features/projects/projectOps'
import { deepFreeze } from '@/test/deepFreeze'
import { makeFullVisit } from '@/test/fixtures'
import { visitSchema, type Visit } from '@/types/visit'

/** Fixture + a third line linked to proj-1, a line on proj-2, frozen. */
function frozen(): Visit {
  const base = makeFullVisit()
  return deepFreeze({
    ...base,
    costs: [
      ...base.costs,
      {
        id: 'cost-3',
        label: 'Reprise chéneau',
        category: 'works',
        projectId: 'proj-1',
        amountHtCents: 800_000,
        vatRateBp: 1000,
        status: 'committed',
        supplier: 'Couverture SA',
      },
      {
        id: 'cost-4',
        label: 'Étude quais',
        category: 'study',
        projectId: 'proj-2',
        amountHtCents: 100_000,
        vatRateBp: 2000,
        status: 'estimate',
      },
    ],
  })
}

const expectValid = (visit: Visit) => {
  expect(visitSchema.safeParse(visit).success).toBe(true)
}

describe('projectOps', () => {
  it('never mutates and is deterministic', () => {
    const visit = frozen()
    const ops = [
      () => addProject(visit, { id: 'n', name: ' Sprinklage ', owner: ' ' }),
      () => updateProject(visit, 'proj-1', { status: 'in_progress', comment: 'ok' }),
      () => insertProjectAt(visit, { id: 'z', name: 'Z', status: 'done' }, 0),
      () => removeProject(visit, 'proj-1', 'detach_costs'),
      () => removeProject(visit, 'proj-1', 'delete_costs'),
    ]
    for (const op of ops) {
      expect(op).not.toThrow()
      expect(op()).toEqual(op())
    }
  })

  it('adds a cleaned project, "Identifié" by default, and refuses a blank name', () => {
    const visit = frozen()
    const next = addProject(visit, {
      id: 'n',
      name: '  Mise en conformité sprinklage ',
      owner: '  ',
      description: ' Remplacer les têtes ',
    })
    expect(next.projects.at(-1)).toEqual({
      id: 'n',
      name: 'Mise en conformité sprinklage',
      status: 'identified',
      description: 'Remplacer les têtes',
    })
    expectValid(next)
    expect(addProject(visit, { id: 'm', name: '  ' })).toBe(visit)
    expect(addProject(next, { id: 'n', name: 'Doublon' }).projects).toHaveLength(3)
  })

  it('updates fields and refuses blank names and inverted dates', () => {
    const visit = frozen()
    const next = updateProject(visit, 'proj-1', { owner: ' Jeanne ', endDate: '', status: 'done' })
    expect(next.projects[0]).toEqual({
      id: 'proj-1',
      name: 'Réfection toiture',
      status: 'done',
      owner: 'Jeanne',
      startDate: '2026-11-01',
    })
    expect(updateProject(visit, 'proj-1', { name: ' ' })).toBe(visit)
    expect(updateProject(visit, 'proj-1', { endDate: '2026-10-31' })).toBe(visit)
    expect(updateProject(visit, 'proj-1', { startDate: '2027-03-01' })).toBe(visit)
    expect(updateProject(visit, 'unknown', { name: 'X' })).toBe(visit)
  })

  it('detach_costs: the lines become unassigned, restoreProject restores everything', () => {
    const visit = frozen()
    const { visit: removed, removed: snapshot } = removeProject(visit, 'proj-1', 'detach_costs')
    expect(removed.projects.map((p) => p.id)).toEqual(['proj-2'])
    expect(removed.costs.map((c) => [c.id, c.projectId])).toEqual([
      ['cost-1', undefined],
      ['cost-2', undefined],
      ['cost-3', undefined],
      ['cost-4', 'proj-2'],
    ])
    expect(removed.costs[0]).not.toHaveProperty('projectId')
    expectValid(removed)
    expect(snapshot).toMatchObject({
      mode: 'detach_costs',
      index: 0,
      costs: [
        { index: 0, cost: { id: 'cost-1', projectId: 'proj-1' } },
        { index: 2, cost: { id: 'cost-3', projectId: 'proj-1' } },
      ],
    })
    const restored = restoreProject(removed, snapshot!)
    expect(restored).toEqual(visit)
    expectValid(restored)
  })

  it('delete_costs: the lines are deleted, restoreProject puts them back in place', () => {
    const visit = frozen()
    const { visit: removed, removed: snapshot } = removeProject(visit, 'proj-1', 'delete_costs')
    expect(removed.costs.map((c) => c.id)).toEqual(['cost-2', 'cost-4'])
    expectValid(removed)
    const restored = restoreProject(removed, snapshot!)
    expect(restored).toEqual(visit)
    expectValid(restored)
    // Replaying the restore does not duplicate anything.
    expect(restoreProject(restored, snapshot!)).toEqual(visit)
  })

  it('removing an unknown project changes nothing', () => {
    const visit = frozen()
    expect(removeProject(visit, 'nope', 'delete_costs')).toEqual({ visit, removed: null })
  })

  it('never leaves an orphan projectId', () => {
    let visit: Visit = frozen()
    const steps: ((v: Visit) => Visit)[] = [
      (v) => addProject(v, { id: 'p3', name: 'Nouveau' }),
      (v) => removeProject(v, 'proj-2', 'detach_costs').visit,
      (v) => removeProject(v, 'p3', 'delete_costs').visit,
      (v) => updateProject(v, 'proj-1', { status: 'in_progress' }),
      (v) => removeProject(v, 'proj-1', 'delete_costs').visit,
    ]
    for (const step of steps) {
      visit = step(visit)
      expectValid(visit)
    }
    expect(visit.projects).toEqual([])
  })
})
