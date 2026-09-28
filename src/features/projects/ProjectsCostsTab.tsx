import { useId, useMemo, useState } from 'react'
import { Suggestions } from '@/components/form/DraftFields'
import { buildCostsOverview, type CostGroupBy } from '@/features/costs/costView'
import { COST_GROUP_ID_PREFIX, COSTS_SECTION_ID, CostsSection } from '@/features/costs/CostsSection'
import { useFieldSuggestions } from '@/features/general/useFieldSuggestions'
import type { VisitTabProps } from '@/features/visits/editorTypes'
import { PROJECTS_SECTION_ID, ProjectsSection } from './ProjectsSection'

const SECTION_IDS = { projects: PROJECTS_SECTION_ID, costs: COSTS_SECTION_ID }

function scrollToElement(id: string) {
  // After React has rendered the requested state (expanded group…).
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

/** Case-insensitive deduplication, first spelling kept, blanks dropped. */
function unique(values: readonly string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.trim().toLocaleLowerCase('fr')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** "Projets & coûts" tab: summary banner, known projects, cost table. */
export function ProjectsCostsTab({ visit, update }: VisitTabProps) {
  const suggestions = useFieldSuggestions(visit.id)
  const ownersListId = useId()
  const suppliersListId = useId()
  // View state (not saved): grouping, collapsed groups, project preselected in the quick entry.
  const [groupBy, setGroupBy] = useState<CostGroupBy>('project')
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [preselectedProjectId, setPreselectedProjectId] = useState<string>()
  const overview = buildCostsOverview(visit)

  const owners = useMemo(
    () =>
      unique([
        ...visit.participants.map((p) => p.name),
        visit.author ?? '',
        ...suggestions.authors,
      ]),
    [visit.participants, visit.author, suggestions.authors],
  )
  const suppliers = useMemo(
    () => unique([...visit.costs.map((c) => c.supplier ?? ''), ...suggestions.suppliers]),
    [visit.costs, suggestions.suppliers],
  )
  const isProject = (key: string) => visit.projects.some((p) => p.id === key)

  const toggleGroup = (key: string) => {
    const opening = collapsed.has(key)
    setCollapsed((current) => {
      const next = new Set(current)
      if (opening) next.delete(key)
      else next.add(key)
      return next
    })
    if (groupBy === 'project' && isProject(key)) {
      if (opening) setPreselectedProjectId(key)
      else if (preselectedProjectId === key) setPreselectedProjectId(undefined)
    }
  }

  /** "Voir les coûts" on a project card: group by project, open its group, scroll to it. */
  const showProjectCosts = (projectId: string) => {
    setGroupBy('project')
    setCollapsed((current) => {
      const next = new Set(current)
      next.delete(projectId)
      return next
    })
    setPreselectedProjectId(projectId)
    scrollToElement(`${COST_GROUP_ID_PREFIX}${projectId}`)
  }

  return (
    <div className="space-y-6">
      <nav
        aria-label="Synthèse projets et coûts"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border bg-card px-5 py-3 text-sm shadow-card"
      >
        {overview.items.map((item, index) => (
          <span key={item.key} className="flex items-center gap-2">
            {index > 0 && (
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
            )}
            <button
              type="button"
              className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onClick={() => {
                scrollToElement(SECTION_IDS[item.section])
              }}
            >
              {item.text}
            </button>
          </span>
        ))}
      </nav>
      <ProjectsSection
        visit={visit}
        update={update}
        ownersListId={ownersListId}
        onShowCosts={showProjectCosts}
      />
      <CostsSection
        visit={visit}
        update={update}
        suppliersListId={suppliersListId}
        groupBy={groupBy}
        onGroupByChange={(value) => {
          setGroupBy(value)
          setCollapsed(new Set())
        }}
        collapsed={collapsed}
        onToggleGroup={toggleGroup}
        preselectedProjectId={preselectedProjectId}
      />
      <Suggestions id={ownersListId} values={owners} />
      <Suggestions id={suppliersListId} values={suppliers} />
    </div>
  )
}
