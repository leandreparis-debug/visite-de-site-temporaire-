/**
 * Pure display helpers for the projects of a visit (order, linked cost
 * totals, counts). Shared by the "Projets & coûts" tab and the Word report.
 */
import { sumCosts, type CostTotals } from '@/lib/money'
import { PROJECT_STATUSES, type Cost, type Project, type ProjectStatus } from '@/types/visit'

/** Display order of the statuses: the most "alive" projects first. */
export const PROJECT_STATUS_ORDER: readonly ProjectStatus[] = [
  'in_progress',
  'planned',
  'identified',
  'on_hold',
  'done',
]

/**
 * Display order: by status (in progress, planned, identified, on hold, done),
 * then by start date (earliest first, projects without a start date last).
 * Stable; returns a new array — the stored order is never changed.
 */
export function sortProjectsForDisplay(projects: readonly Project[]): Project[] {
  return projects
    .map((project, index) => ({ project, index }))
    .sort(
      (a, b) =>
        PROJECT_STATUS_ORDER.indexOf(a.project.status) -
          PROJECT_STATUS_ORDER.indexOf(b.project.status) ||
        (a.project.startDate ?? '9999-99-99').localeCompare(b.project.startDate ?? '9999-99-99') ||
        a.index - b.index,
    )
    .map(({ project }) => project)
}

export interface CostCountTotals extends CostTotals {
  /** Number of cost lines. */
  count: number
}

/**
 * Totals of the costs linked to a project. VAT is rounded line by line, then
 * summed (see `sumCosts`): the total always equals the sum of the lines shown.
 */
export function getProjectCostTotals(
  project: Pick<Project, 'id'>,
  costs: readonly Cost[],
): CostCountTotals {
  const linked = costs.filter((cost) => cost.projectId === project.id)
  return { count: linked.length, ...sumCosts(linked) }
}

export type ProjectsSummary = Record<ProjectStatus, number> & {
  total: number
  /** Projects not done (shown in the tab label). */
  active: number
}

/** Number of projects per status, plus the total and the projects not done. */
export function summarizeProjects(projects: readonly Project[]): ProjectsSummary {
  const summary = Object.fromEntries(PROJECT_STATUSES.map((status) => [status, 0])) as Record<
    ProjectStatus,
    number
  >
  for (const project of projects) summary[project.status]++
  return { ...summary, total: projects.length, active: projects.length - summary.done }
}
