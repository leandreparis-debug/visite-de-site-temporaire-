import {
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Link2,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { Fragment, useId, useRef, useState, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import { DraftAmountInput } from '@/components/form/DraftAmountInput'
import { DraftInput, DraftTextarea, SectionCard } from '@/components/form/DraftFields'
import { IconButton } from '@/components/form/IconButton'
import { NativeSelect } from '@/components/form/NativeSelect'
import { SegmentedControl } from '@/components/form/SegmentedControl'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sortProjectsForDisplay } from '@/features/projects/projectView'
import type { VisitTabProps } from '@/features/visits/editorTypes'
import { downloadBlob, safeFileName } from '@/lib/download'
import { createId } from '@/lib/id'
import { formatEuros, formatVatRate } from '@/lib/money'
import { cn } from '@/lib/utils'
import { LONG_TEXT_MAX } from '@/types/common'
import { COST_CATEGORY_LABELS, COST_STATUS_LABELS } from '@/types/labels'
import {
  COST_CATEGORIES,
  type Cost,
  type CostCategory,
  type CostStatus,
  type Project,
} from '@/types/visit'
import {
  addCost,
  insertCostAt,
  moveCostsToProject,
  removeCost,
  removeCosts,
  restoreCosts,
  updateCost,
  type CostFields,
} from './costOps'
import {
  COST_STAGE_ORDER,
  COST_STAGE_TOTAL_LABELS,
  costsToCsv,
  costsToTsv,
  getCostLineAmounts,
  groupCosts,
  summarizeCostsByStatus,
  VAT_RATE_OPTIONS_BP,
  type CostGroupBy,
} from './costView'

export const COSTS_SECTION_ID = 'projects-costs-costs'

/** Prefix of the id of a group's `<tbody>` (scroll target of "Voir les coûts"). */
export const COST_GROUP_ID_PREFIX = 'cost-group-'

export const COPY_SUCCESS_MESSAGE = 'Tableau copié — collez-le dans Excel (Ctrl+V)'

const GROUP_BY_OPTIONS = [
  { value: 'project', label: 'Projet' },
  { value: 'status', label: 'Statut' },
  { value: 'category', label: 'Catégorie' },
] as const satisfies readonly { value: CostGroupBy; label: string }[]

const GROUP_BY_NAMES: Record<CostGroupBy, string> = {
  project: 'projet',
  status: 'statut',
  category: 'catégorie',
}

/** Select value of "Non rattaché". */
const NO_PROJECT = ''

const CELL_INPUT =
  'h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:bg-surface'
const CELL_SELECT = 'h-8 border-transparent bg-transparent pr-7 pl-2 shadow-none hover:border-input'
const NUMBER_CELL = 'px-2 text-right tabular-nums whitespace-nowrap'

const EMPTY_ENTRY = {
  label: '',
  amountHtCents: undefined as number | undefined,
  vatRateBp: 2000,
  category: 'works' as CostCategory,
  status: 'estimate' as CostStatus,
  supplier: '',
}

function lines(count: number): string {
  return `${count} ${count > 1 ? 'lignes' : 'ligne'}`
}

/** VAT rate options, including a stored rate outside the usual list. */
function rateOptions(current?: number): number[] {
  return current === undefined || VAT_RATE_OPTIONS_BP.includes(current)
    ? [...VAT_RATE_OPTIONS_BP]
    : [...VAT_RATE_OPTIONS_BP, current].sort((a, b) => b - a)
}

export interface CostsSectionProps extends VisitTabProps {
  suppliersListId: string
  groupBy: CostGroupBy
  onGroupByChange: (groupBy: CostGroupBy) => void
  /** Keys of the collapsed groups (local state of the tab, not saved). */
  collapsed: ReadonlySet<string>
  onToggleGroup: (key: string) => void
  /** Project preselected in the quick entry (last project group opened). */
  preselectedProjectId: string | undefined
}

/** "Coûts": quick entry, grouped table with subtotals, stage totals, bulk actions, Excel copy. */
export function CostsSection({
  visit,
  update,
  suppliersListId,
  groupBy,
  onGroupByChange,
  collapsed,
  onToggleGroup,
  preselectedProjectId,
}: CostsSectionProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const projects = sortProjectsForDisplay(visit.projects)
  const groups = groupCosts(visit.costs, visit.projects, groupBy)
  const { byStatus, total } = summarizeCostsByStatus(visit.costs)
  const selectedIds = visit.costs.filter((c) => selected.has(c.id)).map((c) => c.id)
  const projectNames = new Map(visit.projects.map((p) => [p.id, p.name]))

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const edit = (id: string, fields: Partial<CostFields>, key?: string) => {
    update((v) => updateCost(v, id, fields), key ? { coalesceKey: `cost.${id}.${key}` } : undefined)
  }

  const remove = (cost: Cost) => {
    const { removed, index } = removeCost(visit, cost.id)
    if (!removed) return
    update((v) => removeCost(v, cost.id).visit)
    toast('Ligne de coût supprimée', {
      description: removed.label,
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => {
          update((v) => insertCostAt(v, removed, index))
        },
      },
    })
  }

  const removeSelected = () => {
    const ids = selectedIds
    const { removed } = removeCosts(visit, ids)
    if (removed.length === 0) return
    update((v) => removeCosts(v, ids).visit)
    setSelected(new Set())
    toast(`${lines(removed.length)} supprimée${removed.length > 1 ? 's' : ''}`, {
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => {
          update((v) => restoreCosts(v, removed))
        },
      },
    })
  }

  const moveSelected = (projectId: string | undefined) => {
    const ids = selectedIds
    update((v) => moveCostsToProject(v, ids, projectId))
    setSelected(new Set())
    toast.success(
      `${lines(ids.length)} ${projectId ? `rattachée${ids.length > 1 ? 's' : ''} à « ${projectNames.get(projectId) ?? ''} »` : `non rattachée${ids.length > 1 ? 's' : ''}`}`,
    )
  }

  const copyForExcel = async () => {
    try {
      const clipboard = navigator.clipboard as Clipboard | undefined
      if (!clipboard) throw new Error('Clipboard API unavailable')
      await clipboard.writeText(costsToTsv(visit.costs, visit.projects))
      toast.success(COPY_SUCCESS_MESSAGE)
    } catch (error) {
      console.warn('[costs] clipboard unavailable, downloading a CSV instead:', error)
      const fileName = safeFileName(`${visit.site.name} - coûts - ${visit.date}`, 'csv')
      downloadBlob(
        new Blob([costsToCsv(visit.costs, visit.projects)], { type: 'text/csv;charset=utf-8' }),
        fileName,
      )
      toast.info('Copie impossible : le tableau a été téléchargé au format CSV', {
        description: `${fileName} — ouvrez-le avec Excel.`,
      })
    }
  }

  return (
    <SectionCard
      title="Coûts"
      headingId={COSTS_SECTION_ID}
      actions={
        <>
          <SegmentedControl<CostGroupBy>
            label="Grouper par"
            options={GROUP_BY_OPTIONS}
            value={groupBy}
            onChange={onGroupByChange}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={visit.costs.length === 0}
            onClick={() => void copyForExcel()}
          >
            <ClipboardCopy aria-hidden="true" />
            Copier pour Excel
          </Button>
        </>
      }
    >
      <QuickCostEntry
        projects={projects}
        suppliersListId={suppliersListId}
        preselectedProjectId={groupBy === 'project' ? preselectedProjectId : undefined}
        onAdd={(fields) => {
          // Id generated here, never inside the updater (replayed by the autosave).
          const cost = { id: createId(), ...fields }
          update((v) => addCost(v, cost))
        }}
      />

      {selectedIds.length > 0 && (
        <div
          role="toolbar"
          aria-label="Actions sur la sélection"
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-accent px-3 py-2 text-sm"
        >
          <span className="font-medium">
            {lines(selectedIds.length)} sélectionnée{selectedIds.length > 1 ? 's' : ''}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="bg-surface">
                <Link2 aria-hidden="true" />
                Rattacher au projet…
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onSelect={() => {
                    moveSelected(project.id)
                  }}
                >
                  {project.name}
                </DropdownMenuItem>
              ))}
              {projects.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onSelect={() => {
                  moveSelected(undefined)
                }}
              >
                Non rattaché
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" className="bg-surface" onClick={removeSelected}>
            <Trash2 aria-hidden="true" />
            Supprimer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelected(new Set())
            }}
          >
            <X aria-hidden="true" />
            Tout désélectionner
          </Button>
        </div>
      )}

      {visit.costs.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Aucun coût renseigné.</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[66rem] text-sm">
            <caption className="sr-only">
              Coûts groupés par {GROUP_BY_NAMES[groupBy]}, avec sous-totaux et totaux par stade
            </caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="w-7 pb-2">
                  <span className="sr-only">Sélection</span>
                </th>
                <th scope="col" className="pb-2 pl-2 font-medium">
                  Libellé
                </th>
                <th scope="col" className="w-24 pb-2 pl-2 font-medium">
                  Fournisseur
                </th>
                <th scope="col" className="w-24 pb-2 pl-2 font-medium">
                  Catégorie
                </th>
                <th scope="col" className="w-24 pb-2 pl-2 font-medium">
                  Statut
                </th>
                <th scope="col" className="w-28 pb-2 pl-2 font-medium">
                  Projet
                </th>
                <th scope="col" className="w-26 pr-2 pb-2 text-right font-medium">
                  Montant HT
                </th>
                <th scope="col" className="w-20 pb-2 pl-2 font-medium">
                  Taux TVA
                </th>
                <th scope="col" className="w-20 pr-2 pb-2 text-right font-medium">
                  TVA
                </th>
                <th scope="col" className="w-24 pr-2 pb-2 text-right font-medium">
                  TTC
                </th>
                <th scope="col" className="w-16 pb-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            {groups.map((group) => {
              const open = !collapsed.has(group.key)
              return (
                <tbody
                  key={group.key}
                  id={`${COST_GROUP_ID_PREFIX}${group.key}`}
                  data-group={group.key}
                  className="scroll-mt-24"
                >
                  <tr data-group-header className="border-b bg-muted/60">
                    <th scope="rowgroup" colSpan={6} className="py-1.5 text-left font-normal">
                      <button
                        type="button"
                        aria-expanded={open}
                        className="flex items-center gap-1.5 rounded-sm px-1 font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        onClick={() => {
                          onToggleGroup(group.key)
                        }}
                      >
                        {open ? (
                          <ChevronDown className="size-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="size-4" aria-hidden="true" />
                        )}
                        {group.label}{' '}
                        <span className="font-normal text-muted-foreground">
                          · {lines(group.subtotal.count)}
                        </span>
                      </button>
                    </th>
                    <td className={cn(NUMBER_CELL, 'font-medium')}>
                      <span className="sr-only">Sous-total {group.label} HT : </span>
                      {formatEuros(group.subtotal.htCents)}
                    </td>
                    <td />
                    <td className={NUMBER_CELL}>
                      <span className="sr-only">TVA : </span>
                      {formatEuros(group.subtotal.vatCents)}
                    </td>
                    <td className={cn(NUMBER_CELL, 'font-medium')}>
                      <span className="sr-only">TTC : </span>
                      {formatEuros(group.subtotal.ttcCents)}
                    </td>
                    <td />
                  </tr>
                  {open &&
                    group.costs.map((cost) => (
                      <CostRow
                        key={cost.id}
                        cost={cost}
                        projects={projects}
                        suppliersListId={suppliersListId}
                        selected={selected.has(cost.id)}
                        onToggleSelected={() => {
                          toggleSelected(cost.id)
                        }}
                        onEdit={(fields, key) => {
                          edit(cost.id, fields, key)
                        }}
                        onRemove={() => {
                          remove(cost)
                        }}
                      />
                    ))}
                </tbody>
              )
            })}
            <tfoot className="border-t-2">
              {COST_STAGE_ORDER.filter((status) => byStatus[status].count > 0).map((status) => (
                <tr key={status} data-stage-total={status}>
                  <th scope="row" colSpan={6} className="py-1 pr-2 text-right font-medium">
                    {COST_STAGE_TOTAL_LABELS[status]}
                  </th>
                  <td className={NUMBER_CELL}>{formatEuros(byStatus[status].htCents)}</td>
                  <td />
                  <td className={NUMBER_CELL}>{formatEuros(byStatus[status].vatCents)}</td>
                  <td className={NUMBER_CELL}>{formatEuros(byStatus[status].ttcCents)}</td>
                  <td />
                </tr>
              ))}
              <tr data-grand-total className="border-t font-bold">
                <th scope="row" colSpan={6} className="py-2 pr-2 text-right">
                  Total général
                </th>
                <td className={NUMBER_CELL}>{formatEuros(total.htCents)}</td>
                <td />
                <td className={NUMBER_CELL}>{formatEuros(total.vatCents)}</td>
                <td className={NUMBER_CELL}>{formatEuros(total.ttcCents)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          <p className="sr-only" aria-live="polite">
            Total général : {formatEuros(total.htCents)} HT, {formatEuros(total.vatCents)} de TVA,{' '}
            {formatEuros(total.ttcCents)} TTC.
          </p>
        </div>
      )}
    </SectionCard>
  )
}

function QuickCostEntry({
  projects,
  suppliersListId,
  preselectedProjectId,
  onAdd,
}: {
  projects: readonly Project[]
  suppliersListId: string
  preselectedProjectId: string | undefined
  onAdd: (fields: Omit<CostFields, 'projectId'> & { projectId?: string }) => void
}) {
  const [entry, setEntry] = useState(EMPTY_ENTRY)
  const [projectId, setProjectId] = useState(preselectedProjectId ?? NO_PROJECT)
  const [preselectedFor, setPreselectedFor] = useState(preselectedProjectId)
  const [amountError, setAmountError] = useState<string | null>(null)
  const labelRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const ids = {
    label: useId(),
    amount: useId(),
    amountError: useId(),
    rate: useId(),
    category: useId(),
    project: useId(),
    status: useId(),
    supplier: useId(),
  }
  // Follow the preselected project (last project group opened in the table).
  if (preselectedFor !== preselectedProjectId) {
    setPreselectedFor(preselectedProjectId)
    if (preselectedProjectId) setProjectId(preselectedProjectId)
  }
  const validProjectId = projects.some((p) => p.id === projectId) ? projectId : NO_PROJECT

  const add = (event: SyntheticEvent) => {
    event.preventDefault()
    if (!entry.label.trim()) {
      labelRef.current?.focus()
      return
    }
    // An invalid amount being typed is never sent to `entry`: block the add.
    if (amountRef.current?.getAttribute('aria-invalid') === 'true') {
      amountRef.current.focus()
      return
    }
    if (entry.amountHtCents === undefined) {
      setAmountError('Saisissez le montant HT')
      amountRef.current?.focus()
      return
    }
    onAdd({
      label: entry.label,
      amountHtCents: entry.amountHtCents,
      vatRateBp: entry.vatRateBp,
      category: entry.category,
      status: entry.status,
      supplier: entry.supplier,
      ...(validProjectId !== NO_PROJECT && { projectId: validProjectId }),
    })
    setEntry(EMPTY_ENTRY)
    setAmountError(null)
    labelRef.current?.focus()
  }

  return (
    <form
      onSubmit={add}
      aria-label="Ajouter un coût"
      className="mb-4 grid grid-cols-[1fr_9rem_7rem_9.5rem] items-start gap-3 rounded-lg bg-muted/60 p-3"
    >
      <div className="grid gap-1.5">
        <Label htmlFor={ids.label}>Libellé</Label>
        <Input
          ref={labelRef}
          id={ids.label}
          autoComplete="off"
          maxLength={200}
          placeholder="Ex. : devis réfection étanchéité"
          value={entry.label}
          onChange={(event) => {
            setEntry((e) => ({ ...e, label: event.target.value }))
          }}
          className="bg-surface"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={ids.amount}>Montant HT</Label>
        <DraftAmountInput
          ref={amountRef}
          id={ids.amount}
          cents={entry.amountHtCents}
          aria-describedby={amountError ? ids.amountError : undefined}
          onValueChange={(amountHtCents) => {
            setAmountError(null)
            setEntry((e) => ({ ...e, amountHtCents }))
          }}
          className="bg-surface text-right"
        />
        {amountError && (
          <p id={ids.amountError} role="alert" className="text-xs text-danger">
            {amountError}
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={ids.rate}>TVA</Label>
        <NativeSelect
          id={ids.rate}
          value={entry.vatRateBp}
          onChange={(event) => {
            setEntry((e) => ({ ...e, vatRateBp: Number(event.target.value) }))
          }}
        >
          {rateOptions().map((rate) => (
            <option key={rate} value={rate}>
              {formatVatRate(rate)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={ids.category}>Catégorie</Label>
        <CategorySelect
          id={ids.category}
          value={entry.category}
          onChange={(category) => {
            setEntry((e) => ({ ...e, category }))
          }}
        />
      </div>
      <div className="col-span-4 grid grid-cols-[1fr_9rem_1fr_auto] items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={ids.project}>Projet</Label>
          <ProjectSelect
            id={ids.project}
            projects={projects}
            value={validProjectId}
            onChange={setProjectId}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.status}>Statut</Label>
          <StatusSelect
            id={ids.status}
            value={entry.status}
            onChange={(status) => {
              setEntry((e) => ({ ...e, status }))
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.supplier}>Fournisseur</Label>
          <Input
            id={ids.supplier}
            list={suppliersListId}
            autoComplete="off"
            maxLength={120}
            value={entry.supplier}
            onChange={(event) => {
              setEntry((e) => ({ ...e, supplier: event.target.value }))
            }}
            className="bg-surface"
          />
        </div>
        <Button type="submit" variant="outline" className="bg-surface">
          <Plus aria-hidden="true" />
          Ajouter
        </Button>
      </div>
    </form>
  )
}

function CategorySelect({
  value,
  onChange,
  ...props
}: {
  id?: string
  'aria-label'?: string
  selectClassName?: string
  value: CostCategory
  onChange: (category: CostCategory) => void
}) {
  return (
    <NativeSelect
      {...props}
      value={value}
      onChange={(event) => {
        onChange(event.target.value as CostCategory)
      }}
    >
      {COST_CATEGORIES.map((category) => (
        <option key={category} value={category}>
          {COST_CATEGORY_LABELS[category]}
        </option>
      ))}
    </NativeSelect>
  )
}

function StatusSelect({
  value,
  onChange,
  ...props
}: {
  id?: string
  'aria-label'?: string
  selectClassName?: string
  value: CostStatus
  onChange: (status: CostStatus) => void
}) {
  return (
    <NativeSelect
      {...props}
      value={value}
      onChange={(event) => {
        onChange(event.target.value as CostStatus)
      }}
    >
      {COST_STAGE_ORDER.map((status) => (
        <option key={status} value={status}>
          {COST_STATUS_LABELS[status]}
        </option>
      ))}
    </NativeSelect>
  )
}

function ProjectSelect({
  projects,
  value,
  onChange,
  ...props
}: {
  id?: string
  'aria-label'?: string
  selectClassName?: string
  projects: readonly Project[]
  value: string
  onChange: (projectId: string) => void
}) {
  return (
    <NativeSelect
      {...props}
      value={value}
      onChange={(event) => {
        onChange(event.target.value)
      }}
    >
      <option value={NO_PROJECT}>Non rattaché</option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </NativeSelect>
  )
}

function CostRow({
  cost,
  projects,
  suppliersListId,
  selected,
  onToggleSelected,
  onEdit,
  onRemove,
}: {
  cost: Cost
  projects: readonly Project[]
  suppliersListId: string
  selected: boolean
  onToggleSelected: () => void
  onEdit: (fields: Partial<CostFields>, key?: string) => void
  onRemove: () => void
}) {
  const [commentOpen, setCommentOpen] = useState(Boolean(cost.comment))
  const { vatCents, ttcCents } = getCostLineAmounts(cost)
  const name = cost.label
  return (
    <Fragment>
      <tr data-cost-id={cost.id} className={cn('border-b align-top', selected && 'bg-accent/50')}>
        <td className="py-1.5 pl-1">
          <input
            type="checkbox"
            aria-label={`Sélectionner : ${name}`}
            className="mt-2 size-4 accent-brand"
            checked={selected}
            onChange={onToggleSelected}
          />
        </td>
        <td className="py-1.5 pl-1">
          <DraftInput
            aria-label={`Libellé : ${name}`}
            autoComplete="off"
            required
            requiredMessage="Le libellé est obligatoire"
            maxLength={200}
            value={cost.label}
            onValueChange={(label) => {
              onEdit({ label }, 'label')
            }}
            className={CELL_INPUT}
          />
        </td>
        <td className="py-1.5 pl-1">
          <DraftInput
            aria-label={`Fournisseur : ${name}`}
            list={suppliersListId}
            autoComplete="off"
            maxLength={120}
            value={cost.supplier ?? ''}
            onValueChange={(supplier) => {
              onEdit({ supplier }, 'supplier')
            }}
            className={CELL_INPUT}
          />
        </td>
        <td className="py-1.5 pl-1">
          <CategorySelect
            aria-label={`Catégorie : ${name}`}
            selectClassName={CELL_SELECT}
            value={cost.category}
            onChange={(category) => {
              onEdit({ category })
            }}
          />
        </td>
        <td className="py-1.5 pl-1">
          <StatusSelect
            aria-label={`Statut : ${name}`}
            selectClassName={CELL_SELECT}
            value={cost.status}
            onChange={(status) => {
              onEdit({ status })
            }}
          />
        </td>
        <td className="py-1.5 pl-1">
          <ProjectSelect
            aria-label={`Projet : ${name}`}
            selectClassName={CELL_SELECT}
            projects={projects}
            value={cost.projectId ?? NO_PROJECT}
            onChange={(projectId) => {
              onEdit({ projectId: projectId === NO_PROJECT ? undefined : projectId })
            }}
          />
        </td>
        <td className="py-1.5 pl-1">
          <DraftAmountInput
            aria-label={`Montant HT : ${name}`}
            cents={cost.amountHtCents}
            onValueChange={(amountHtCents) => {
              // Emptying the field keeps the previous amount (an amount is required).
              if (amountHtCents !== undefined) onEdit({ amountHtCents }, 'amount')
            }}
            className={cn(CELL_INPUT, 'text-right tabular-nums')}
          />
        </td>
        <td className="py-1.5 pl-1">
          <NativeSelect
            aria-label={`Taux de TVA : ${name}`}
            selectClassName={CELL_SELECT}
            value={cost.vatRateBp}
            onChange={(event) => {
              onEdit({ vatRateBp: Number(event.target.value) })
            }}
          >
            {rateOptions(cost.vatRateBp).map((rate) => (
              <option key={rate} value={rate}>
                {formatVatRate(rate)}
              </option>
            ))}
          </NativeSelect>
        </td>
        <td className={cn(NUMBER_CELL, 'py-3 text-muted-foreground')} data-column="vat">
          {formatEuros(vatCents)}
        </td>
        <td className={cn(NUMBER_CELL, 'py-3')} data-column="ttc">
          {formatEuros(ttcCents)}
        </td>
        <td className="py-1.5 text-right whitespace-nowrap">
          <IconButton
            icon={MessageSquare}
            label={`Commentaire : ${name}`}
            aria-expanded={commentOpen}
            className={cn(cost.comment && 'text-brand')}
            onClick={() => {
              setCommentOpen((open) => !open)
            }}
          />
          <IconButton
            icon={Trash2}
            label={`Supprimer la ligne : ${name}`}
            className="hover:text-danger"
            onClick={onRemove}
          />
        </td>
      </tr>
      {commentOpen && (
        <tr className="border-b">
          <td />
          <td colSpan={10} className="pb-2 pl-1">
            <DraftTextarea
              aria-label={`Commentaire de la ligne : ${name}`}
              rows={1}
              maxLength={LONG_TEXT_MAX}
              placeholder="Commentaire"
              value={cost.comment ?? ''}
              onValueChange={(comment) => {
                onEdit({ comment }, 'comment')
              }}
              className="min-h-8 py-1"
            />
          </td>
        </tr>
      )}
    </Fragment>
  )
}
