import { describe, expect, it } from 'vitest'
import {
  getProjectCostTotals,
  sortProjectsForDisplay,
  summarizeProjects,
} from '@/features/projects/projectView'
import type { Cost, Project, ProjectStatus } from '@/types/visit'

const project = (id: string, status: ProjectStatus, startDate?: string): Project => ({
  id,
  name: id,
  status,
  ...(startDate !== undefined && { startDate }),
})
const cost = (id: string, amountHtCents: number, vatRateBp: number, projectId?: string): Cost => ({
  id,
  label: id,
  category: 'works',
  amountHtCents,
  vatRateBp,
  status: 'estimate',
  ...(projectId !== undefined && { projectId }),
})

describe('projectView', () => {
  it('sorts by status, then start date, projects without date last', () => {
    const projects = [
      project('done', 'done', '2020-01-01'),
      project('identified-nodate', 'identified'),
      project('planned-late', 'planned', '2027-06-01'),
      project('on-hold', 'on_hold', '2026-01-01'),
      project('identified-early', 'identified', '2026-02-01'),
      project('in-progress-nodate', 'in_progress'),
      project('planned-early', 'planned', '2026-12-01'),
      project('in-progress', 'in_progress', '2026-03-01'),
    ]
    expect(sortProjectsForDisplay(projects).map((p) => p.id)).toEqual([
      'in-progress',
      'in-progress-nodate',
      'planned-early',
      'planned-late',
      'identified-early',
      'identified-nodate',
      'on-hold',
      'done',
    ])
    expect(projects[0]?.id).toBe('done')
    // Stable when nothing distinguishes two projects.
    expect(
      sortProjectsForDisplay([project('a', 'planned'), project('b', 'planned')]).map((p) => p.id),
    ).toEqual(['a', 'b'])
  })

  it('totals the linked costs, VAT rounded per line', () => {
    const costs = [
      cost('c1', 1_000_000, 2000, 'p'),
      // 0,05 € at 5,5 %: VAT 0,00275 € → rounded to 0 per line.
      cost('c2', 5, 550, 'p'),
      cost('c3', 5, 550, 'p'),
      cost('other', 999, 2000, 'q'),
      cost('none', 999, 2000),
    ]
    expect(getProjectCostTotals({ id: 'p' }, costs)).toEqual({
      count: 3,
      htCents: 1_000_010,
      vatCents: 200_000,
      ttcCents: 1_200_010,
    })
    expect(getProjectCostTotals({ id: 'empty' }, costs)).toEqual({
      count: 0,
      htCents: 0,
      vatCents: 0,
      ttcCents: 0,
    })
  })

  it('counts projects per status', () => {
    expect(
      summarizeProjects([
        project('a', 'in_progress'),
        project('b', 'in_progress'),
        project('c', 'done'),
        project('d', 'identified'),
      ]),
    ).toEqual({
      identified: 1,
      planned: 0,
      in_progress: 2,
      on_hold: 0,
      done: 1,
      total: 4,
      active: 3,
    })
  })
})
