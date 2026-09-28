import { ArrowDownRight, Plus, Trash2 } from 'lucide-react'
import { useId, useRef, useState, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import { DraftInput, DraftTextarea, SectionCard } from '@/components/form/DraftFields'
import { IconButton } from '@/components/form/IconButton'
import { NativeSelect } from '@/components/form/NativeSelect'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { VisitTabProps } from '@/features/visits/editorTypes'
import { createId } from '@/lib/id'
import { formatEuros } from '@/lib/money'
import { cn } from '@/lib/utils'
import { LONG_TEXT_MAX } from '@/types/common'
import { PROJECT_STATUS_LABELS } from '@/types/labels'
import type { Project, ProjectStatus, Visit } from '@/types/visit'
import {
  addProject,
  removeProject,
  restoreProject,
  updateProject,
  type ProjectFields,
  type ProjectRemovalMode,
} from './projectOps'
import {
  getProjectCostTotals,
  PROJECT_STATUS_ORDER,
  sortProjectsForDisplay,
  type CostCountTotals,
} from './projectView'

export const PROJECTS_SECTION_ID = 'projects-costs-projects'

const STATUS_CLASSES: Record<ProjectStatus, string> = {
  in_progress: 'bg-brand text-white',
  planned: 'bg-accent text-accent-foreground',
  identified: 'bg-muted text-muted-foreground',
  on_hold: 'bg-warning/10 text-warning',
  done: 'bg-success/10 text-success',
}

const EMPTY_ENTRY = { name: '', status: 'identified' as ProjectStatus, owner: '' }

/** "4 lignes" / "1 ligne". */
function lines(count: number): string {
  return `${count} ${count > 1 ? 'lignes' : 'ligne'}`
}

/** "Projets connus": quick entry and one card per project. */
export function ProjectsSection({
  visit,
  update,
  ownersListId,
  onShowCosts,
}: VisitTabProps & {
  ownersListId: string
  /** "Voir les coûts": reveal the project's group in the costs table. */
  onShowCosts: (projectId: string) => void
}) {
  const [entry, setEntry] = useState(EMPTY_ENTRY)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const ids = { name: useId(), status: useId(), owner: useId() }
  const projects = sortProjectsForDisplay(visit.projects)

  const add = (event: SyntheticEvent) => {
    event.preventDefault()
    if (!entry.name.trim()) {
      nameRef.current?.focus()
      return
    }
    // Id generated here, never inside the updater (replayed by the autosave).
    const project = { id: createId(), ...entry }
    update((v) => addProject(v, project))
    setEntry(EMPTY_ENTRY)
    nameRef.current?.focus()
  }

  /** Removes the project (and handles its costs), with an "Annuler" toast restoring everything. */
  const remove = (project: Project, mode: ProjectRemovalMode) => {
    const { removed } = removeProject(visit, project.id, mode)
    if (!removed) return
    update((v) => removeProject(v, project.id, mode).visit)
    toast('Projet supprimé', {
      description:
        removed.costs.length === 0
          ? project.name
          : `${project.name} — ${lines(removed.costs.length)} de coûts ${mode === 'delete_costs' ? 'supprimées' : 'non rattachées'}`,
      duration: 8000,
      action: {
        label: 'Annuler',
        onClick: () => {
          update((v) => restoreProject(v, removed))
        },
      },
    })
  }

  return (
    <SectionCard title="Projets connus" headingId={PROJECTS_SECTION_ID}>
      <form
        onSubmit={add}
        aria-label="Ajouter un projet"
        className="mb-4 grid grid-cols-[1fr_11rem_14rem_auto] items-end gap-3 rounded-lg bg-muted/60 p-3"
      >
        <div className="grid gap-1.5">
          <Label htmlFor={ids.name}>Nom du projet</Label>
          <Input
            ref={nameRef}
            id={ids.name}
            autoComplete="off"
            maxLength={200}
            placeholder="Ex. : réfection de la toiture cellule 3"
            value={entry.name}
            onChange={(event) => {
              setEntry((e) => ({ ...e, name: event.target.value }))
            }}
            className="bg-surface"
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
          <Label htmlFor={ids.owner}>Responsable</Label>
          <Input
            id={ids.owner}
            list={ownersListId}
            autoComplete="off"
            maxLength={120}
            value={entry.owner}
            onChange={(event) => {
              setEntry((e) => ({ ...e, owner: event.target.value }))
            }}
            className="bg-surface"
          />
        </div>
        <Button type="submit" variant="outline" className="bg-surface">
          <Plus aria-hidden="true" />
          Ajouter
        </Button>
      </form>

      {projects.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Aucun projet connu sur ce site.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              totals={getProjectCostTotals(project, visit.costs)}
              ownersListId={ownersListId}
              onEdit={(fields, key) => {
                update(
                  (v) => updateProject(v, project.id, fields),
                  key ? { coalesceKey: `project.${project.id}.${key}` } : undefined,
                )
              }}
              onDelete={() => {
                if (visit.costs.some((c) => c.projectId === project.id)) setDeleting(project)
                else remove(project, 'detach_costs')
              }}
              onShowCosts={() => {
                onShowCosts(project.id)
              }}
            />
          ))}
        </div>
      )}

      <DeleteProjectDialog
        visit={visit}
        project={deleting}
        onClose={() => {
          setDeleting(null)
        }}
        onConfirm={(project, mode) => {
          setDeleting(null)
          remove(project, mode)
        }}
      />
    </SectionCard>
  )
}

function StatusSelect({
  value,
  onChange,
  ...props
}: {
  id?: string
  'aria-label'?: string
  value: ProjectStatus
  onChange: (status: ProjectStatus) => void
  selectClassName?: string
}) {
  return (
    <NativeSelect
      {...props}
      value={value}
      onChange={(event) => {
        onChange(event.target.value as ProjectStatus)
      }}
    >
      {PROJECT_STATUS_ORDER.map((status) => (
        <option key={status} value={status}>
          {PROJECT_STATUS_LABELS[status]}
        </option>
      ))}
    </NativeSelect>
  )
}

function ProjectCard({
  project,
  totals,
  ownersListId,
  onEdit,
  onDelete,
  onShowCosts,
}: {
  project: Project
  totals: CostCountTotals
  ownersListId: string
  onEdit: (fields: Partial<ProjectFields>, key?: string) => void
  onDelete: () => void
  onShowCosts: () => void
}) {
  const [dateError, setDateError] = useState(false)
  const titleId = useId()
  const errorId = useId()
  const ids = { owner: useId(), description: useId(), comment: useId(), status: useId() }

  /** Refuses (with a message) an end date before the start date. */
  const editDate = (key: 'startDate' | 'endDate', value: string) => {
    const start = key === 'startDate' ? value : project.startDate
    const end = key === 'endDate' ? value : project.endDate
    const inverted = Boolean(start && end && end < start)
    setDateError(inverted)
    if (!inverted) onEdit({ [key]: value }, key)
  }

  return (
    <article
      aria-labelledby={titleId}
      data-project-id={project.id}
      className={cn('rounded-xl border bg-surface p-4', project.status === 'done' && 'bg-muted/40')}
    >
      <header className="flex items-start gap-2">
        <h4 id={titleId} className="sr-only">
          {project.name}
        </h4>
        <DraftInput
          wrapperClassName="flex-1"
          aria-label="Nom du projet"
          autoComplete="off"
          required
          requiredMessage="Le nom du projet est obligatoire"
          maxLength={200}
          value={project.name}
          onValueChange={(name) => {
            onEdit({ name }, 'name')
          }}
          className="h-9 border-transparent bg-transparent px-2 text-base font-semibold shadow-none hover:border-input focus-visible:bg-surface"
        />
        <Badge className={cn('mt-2', STATUS_CLASSES[project.status])}>
          {PROJECT_STATUS_LABELS[project.status]}
        </Badge>
        <IconButton
          icon={Trash2}
          label={`Supprimer le projet ${project.name}`}
          className="hover:text-danger"
          onClick={onDelete}
        />
      </header>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={ids.status}>Statut</Label>
          <StatusSelect
            id={ids.status}
            value={project.status}
            onChange={(status) => {
              onEdit({ status })
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.owner}>Responsable</Label>
          <DraftInput
            id={ids.owner}
            list={ownersListId}
            autoComplete="off"
            maxLength={120}
            value={project.owner ?? ''}
            onValueChange={(owner) => {
              onEdit({ owner }, 'owner')
            }}
            className="bg-surface"
          />
        </div>
        <fieldset className="col-span-2 grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Période</legend>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span aria-hidden="true">du</span>
            <Input
              type="date"
              aria-label={`Date de début : ${project.name}`}
              value={project.startDate ?? ''}
              onChange={(event) => {
                editDate('startDate', event.target.value)
              }}
              className="w-40 bg-surface text-foreground"
            />
            <span aria-hidden="true">au</span>
            <Input
              type="date"
              aria-label={`Date de fin : ${project.name}`}
              aria-invalid={dateError || undefined}
              aria-describedby={dateError ? errorId : undefined}
              value={project.endDate ?? ''}
              onChange={(event) => {
                editDate('endDate', event.target.value)
              }}
              className="w-40 bg-surface text-foreground"
            />
          </div>
          {dateError && (
            <p id={errorId} role="alert" className="text-xs text-danger">
              La date de fin doit suivre la date de début
            </p>
          )}
        </fieldset>
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor={ids.description}>Description</Label>
          <DraftTextarea
            id={ids.description}
            rows={1}
            maxLength={LONG_TEXT_MAX}
            value={project.description ?? ''}
            onValueChange={(description) => {
              onEdit({ description }, 'description')
            }}
            className="min-h-9 py-1.5"
          />
        </div>
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor={ids.comment}>Commentaire</Label>
          <DraftTextarea
            id={ids.comment}
            rows={1}
            maxLength={LONG_TEXT_MAX}
            value={project.comment ?? ''}
            onValueChange={(comment) => {
              onEdit({ comment }, 'comment')
            }}
            className="min-h-9 py-1.5"
          />
        </div>
      </div>

      <section
        aria-label={`Coûts liés : ${project.name}`}
        className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm"
      >
        {totals.count === 0 ? (
          <span className="text-muted-foreground">Aucun coût lié</span>
        ) : (
          <>
            <span>
              <span className="font-medium">Coûts liés</span> : {lines(totals.count)} ·{' '}
              <span className="tabular-nums">{formatEuros(totals.htCents)} HT</span> ·{' '}
              <span className="tabular-nums">{formatEuros(totals.ttcCents)} TTC</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="link"
              className="h-auto p-0"
              onClick={onShowCosts}
            >
              <ArrowDownRight aria-hidden="true" />
              Voir les coûts
            </Button>
          </>
        )}
      </section>
    </article>
  )
}

/** Deletion of a project that has cost lines: keep them (unassigned), delete them, or cancel. */
function DeleteProjectDialog({
  visit,
  project,
  onClose,
  onConfirm,
}: {
  visit: Visit
  project: Project | null
  onClose: () => void
  onConfirm: (project: Project, mode: ProjectRemovalMode) => void
}) {
  const totals = project ? getProjectCostTotals(project, visit.costs) : null
  return (
    <AlertDialog
      open={project !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent className="sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le projet « {project?.name} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            {totals &&
              `Ce projet a ${lines(totals.count)} de coûts (${formatEuros(totals.htCents)} HT).`}{' '}
            Que faire de ces coûts ?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-wrap">
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => {
              if (project) onConfirm(project, 'detach_costs')
            }}
          >
            Conserver les coûts (non rattachés)
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (project) onConfirm(project, 'delete_costs')
            }}
          >
            <Trash2 aria-hidden="true" />
            Supprimer aussi les coûts
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
