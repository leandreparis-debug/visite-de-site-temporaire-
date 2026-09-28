import { AlertTriangle, ClipboardList, Plus, Search, SearchX, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { NativeSelect } from '@/components/form/NativeSelect'
import { SegmentedControl } from '@/components/form/SegmentedControl'
import { EmptyState } from '@/components/layout/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toUserMessage } from '@/lib/errors'
import { pluralize } from '@/lib/notify'
import { useNow } from '@/lib/useNow'
import { VISIT_KIND_LABELS } from '@/types/labels'
import { VISIT_KINDS, type VisitKind } from '@/types/visit'
import { CreateVisitDialog } from './CreateVisitDialog'
import { useVisitSummaries } from './useVisits'
import { VisitActionDialogs, type VisitAction } from './VisitActionDialogs'
import { useReportDates } from '@/features/report/reportMeta'
import { StorageNotice } from './StorageNotice'
import { VisitCard } from './VisitCard'
import {
  DEFAULT_VISIT_FILTERS,
  filterAndSortVisits,
  hasActiveFilters,
  VISIT_SORT_LABELS,
  VISIT_SORTS,
  type VisitListFilters,
  type VisitSort,
} from './visitListFilters'

const KIND_FILTER_OPTIONS = [
  { value: 'all' as const, label: 'Tous' },
  ...VISIT_KINDS.map((kind) => ({ value: kind, label: VISIT_KIND_LABELS[kind] })),
]

function isVisitSort(value: string): value is VisitSort {
  return (VISIT_SORTS as readonly string[]).includes(value)
}

/** Home page: searchable, filterable list of visits and meetings. */
export function VisitListPage() {
  const { data: visits, isLoading, error } = useVisitSummaries()
  const [filters, setFilters] = useState<VisitListFilters>(DEFAULT_VISIT_FILTERS)
  const [createOpen, setCreateOpen] = useState(false)
  const [action, setAction] = useState<VisitAction | null>(null)
  // Reference time for "Modifiée il y a …".
  const now = useNow()
  const reportDates = useReportDates()

  const shown = useMemo(
    () => (visits ? filterAndSortVisits(visits, filters) : []),
    [visits, filters],
  )
  const setFilter = <K extends keyof VisitListFilters>(key: K, value: VisitListFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }
  const clearFilters = () => {
    setFilters((current) => ({ ...DEFAULT_VISIT_FILTERS, sort: current.sort }))
  }
  const hasVisits = (visits?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Visites et réunions</h2>
          {hasVisits && (
            <p className="mt-1 text-sm text-muted-foreground">
              {pluralize(visits?.length ?? 0, 'compte rendu', 'comptes rendus')} sur ce poste
            </p>
          )}
        </div>
        <Button
          onClick={() => {
            setCreateOpen(true)
          }}
        >
          <Plus aria-hidden="true" />
          Nouvelle visite
        </Button>
      </div>

      <StorageNotice />

      {hasVisits && (
        <div className="flex flex-wrap items-center gap-3" role="search">
          <div className="relative min-w-64 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={filters.query}
              onChange={(event) => {
                setFilter('query', event.target.value)
              }}
              placeholder="Rechercher par titre ou site…"
              aria-label="Rechercher une visite par titre ou site"
              className="bg-surface pl-9"
            />
          </div>
          <SegmentedControl<VisitKind | 'all'>
            label="Filtrer par type"
            options={KIND_FILTER_OPTIONS}
            value={filters.kind}
            onChange={(kind) => {
              setFilter('kind', kind)
            }}
          />
          <NativeSelect
            className="w-64"
            aria-label="Trier les visites"
            value={filters.sort}
            onChange={(event) => {
              const sort = event.target.value
              if (isVisitSort(sort)) setFilter('sort', sort)
            }}
          >
            {VISIT_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {VISIT_SORT_LABELS[sort]}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      {isLoading ? (
        <div
          className="grid grid-cols-2 gap-4 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Chargement des visites"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-44 rounded-xl bg-muted" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Impossible d’afficher les visites"
          description={toUserMessage(error)}
          className="[&>div:first-child]:bg-danger/10 [&>div:first-child]:text-danger"
        />
      ) : !hasVisits ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucune visite pour le moment"
          description="Créez votre première visite technique ou réunion pour préparer son compte rendu."
          action={
            <Button
              onClick={() => {
                setCreateOpen(true)
              }}
            >
              <Plus aria-hidden="true" />
              Créer ma première visite
            </Button>
          }
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Aucune visite ne correspond à votre recherche"
          description="Modifiez la recherche ou le filtre de type."
          action={
            <Button variant="outline" onClick={clearFilters}>
              <X aria-hidden="true" />
              Effacer les filtres
            </Button>
          }
        />
      ) : (
        <>
          {hasActiveFilters(filters) && (
            <p className="text-sm text-muted-foreground" role="status">
              {pluralize(shown.length, 'résultat')}
            </p>
          )}
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3" aria-label="Visites">
            {shown.map((visit) => (
              <li key={visit.id} className="flex">
                <div className="w-full [&>article]:h-full">
                  <VisitCard
                    visit={visit}
                    now={now}
                    onAction={setAction}
                    reportGeneratedAt={reportDates[visit.id]}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <CreateVisitDialog open={createOpen} onOpenChange={setCreateOpen} />
      <VisitActionDialogs
        action={action}
        onClose={() => {
          setAction(null)
        }}
      />
    </div>
  )
}
