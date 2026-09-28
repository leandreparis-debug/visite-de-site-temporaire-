import { Plus, Trash2 } from 'lucide-react'
import { useId, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import { DraftInput, SectionCard, Suggestions } from '@/components/form/DraftFields'
import { IconButton } from '@/components/form/IconButton'
import { NativeSelect } from '@/components/form/NativeSelect'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFieldSuggestions } from '@/features/general/useFieldSuggestions'
import type { VisitTabProps } from '@/features/visits/editorTypes'
import { createId } from '@/lib/id'
import { cn } from '@/lib/utils'
import { useToday } from '@/lib/useToday'
import { ATTENTION_STATUS_LABELS, PRIORITY_LABELS } from '@/types/labels'
import {
  ATTENTION_STATUSES,
  PRIORITIES,
  type AttentionPoint,
  type AttentionStatus,
  type Priority,
} from '@/types/visit'
import {
  addAttentionPoint,
  insertAttentionPointAt,
  removeAttentionPoint,
  updateAttentionPoint,
  type AttentionPointFields,
} from './attentionPointOps'
import {
  formatAttentionSummary,
  isOverdue,
  sortAttentionPointsForDisplay,
  summarizeAttentionPoints,
} from './attentionPointView'

const PRIORITY_CLASSES: Record<Priority, string> = {
  high: 'border-accent-red/30 bg-accent-red/10 font-medium text-accent-red',
  medium: 'border-warning/30 bg-warning/10 font-medium text-warning',
  low: 'border-transparent bg-muted text-muted-foreground',
}

/** Priorities from high to low for the selects. */
const PRIORITY_OPTIONS = [...PRIORITIES].reverse()

const EMPTY_ENTRY = { text: '', priority: 'medium' as Priority, owner: '', dueDate: '' }

/** "Points d'attention et actions": quick entry and sorted table. */
export function AttentionPointsPanel({ visit, update }: VisitTabProps) {
  const today = useToday()
  const suggestions = useFieldSuggestions(visit.id)
  const [entry, setEntry] = useState(EMPTY_ENTRY)
  const [hideDone, setHideDone] = useState(false)
  const textRef = useRef<HTMLInputElement>(null)
  const ids = {
    owners: useId(),
    text: useId(),
    priority: useId(),
    owner: useId(),
    due: useId(),
    hide: useId(),
  }

  const owners = useMemo(() => {
    const seen = new Set<string>()
    return [
      ...visit.participants.map((p) => p.name),
      visit.author ?? '',
      ...suggestions.authors,
    ].filter((name) => {
      const key = name.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [visit.participants, visit.author, suggestions.authors])

  const points = sortAttentionPointsForDisplay(visit.attentionPoints)
  const shown = hideDone ? points.filter((p) => p.status !== 'done') : points
  const summary = summarizeAttentionPoints(visit.attentionPoints, today)

  const add = (event: SyntheticEvent) => {
    event.preventDefault()
    if (!entry.text.trim()) {
      textRef.current?.focus()
      return
    }
    // Id generated here, never inside the updater (replayed by the autosave).
    const point = { id: createId(), ...entry }
    update((v) => addAttentionPoint(v, point))
    setEntry(EMPTY_ENTRY)
    textRef.current?.focus()
  }

  const edit = (id: string, fields: Partial<AttentionPointFields>, key?: string) => {
    update(
      (v) => updateAttentionPoint(v, id, fields),
      key ? { coalesceKey: `attention.${id}.${key}` } : undefined,
    )
  }

  const remove = (point: AttentionPoint) => {
    const { removed, index } = removeAttentionPoint(visit, point.id)
    if (!removed) return
    update((v) => removeAttentionPoint(v, point.id).visit)
    toast('Point d’attention supprimé', {
      description: removed.text,
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => {
          update((v) => insertAttentionPointAt(v, removed, index))
        },
      },
    })
  }

  return (
    <SectionCard
      title="Points d’attention et actions"
      headingId="notes-attention"
      description={
        <span aria-live="polite" className={cn(summary.overdue > 0 && 'font-medium text-danger')}>
          {formatAttentionSummary(summary)}
        </span>
      }
      actions={
        <label htmlFor={ids.hide} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            id={ids.hide}
            type="checkbox"
            className="size-4 accent-brand"
            checked={hideDone}
            onChange={(event) => {
              setHideDone(event.target.checked)
            }}
          />
          Masquer les points terminés
        </label>
      }
    >
      <form
        onSubmit={add}
        aria-label="Ajouter un point d’attention"
        className="mb-4 grid grid-cols-[1fr_9rem_12rem_10rem_auto] items-end gap-3 rounded-lg bg-muted/60 p-3"
      >
        <div className="grid gap-1.5">
          <Label htmlFor={ids.text}>Point d’attention ou action</Label>
          <Input
            ref={textRef}
            id={ids.text}
            autoComplete="off"
            maxLength={1000}
            placeholder="Ex. : reprendre l’étanchéité du chéneau nord"
            value={entry.text}
            onChange={(event) => {
              setEntry((e) => ({ ...e, text: event.target.value }))
            }}
            className="bg-surface"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.priority}>Priorité</Label>
          <NativeSelect
            id={ids.priority}
            value={entry.priority}
            onChange={(event) => {
              setEntry((e) => ({ ...e, priority: event.target.value as Priority }))
            }}
          >
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.owner}>Responsable</Label>
          <Input
            id={ids.owner}
            list={ids.owners}
            autoComplete="off"
            maxLength={120}
            value={entry.owner}
            onChange={(event) => {
              setEntry((e) => ({ ...e, owner: event.target.value }))
            }}
            className="bg-surface"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.due}>Échéance</Label>
          <Input
            id={ids.due}
            type="date"
            value={entry.dueDate}
            onChange={(event) => {
              setEntry((e) => ({ ...e, dueDate: event.target.value }))
            }}
            className="bg-surface"
          />
        </div>
        <Button type="submit" variant="outline" className="bg-surface">
          <Plus aria-hidden="true" />
          Ajouter
        </Button>
      </form>
      <Suggestions id={ids.owners} values={owners} />

      {visit.attentionPoints.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Aucun point d’attention. Notez ici les désordres à suivre et les actions à mener.
        </p>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Tous les points sont terminés (masqués).
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="w-36 pb-2 font-medium">Statut</th>
              <th className="pb-2 pl-2 font-medium">Point</th>
              <th className="w-32 pb-2 pl-2 font-medium">Priorité</th>
              <th className="w-44 pb-2 pl-2 font-medium">Responsable</th>
              <th className="w-40 pb-2 pl-2 font-medium">Échéance</th>
              <th className="w-10 pb-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((point) => {
              const overdue = isOverdue(point, today)
              const done = point.status === 'done'
              return (
                <tr
                  key={point.id}
                  className={cn('border-b last:border-0', done && 'text-muted-foreground')}
                >
                  <td className="py-1.5 align-top">
                    <NativeSelect
                      aria-label={`Statut : ${point.text}`}
                      value={point.status}
                      selectClassName="h-8"
                      onChange={(event) => {
                        edit(point.id, { status: event.target.value as AttentionStatus })
                      }}
                    >
                      {ATTENTION_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {ATTENTION_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                  <td className="py-1.5 pl-2 align-top">
                    <div className="flex items-start gap-2">
                      <DraftInput
                        wrapperClassName="flex-1"
                        aria-label="Texte du point d’attention"
                        autoComplete="off"
                        required
                        requiredMessage="Le texte est obligatoire"
                        maxLength={1000}
                        value={point.text}
                        onValueChange={(text) => {
                          edit(point.id, { text }, 'text')
                        }}
                        className={cn(
                          'h-8 border-transparent bg-transparent shadow-none hover:border-input focus-visible:bg-surface',
                          done && 'line-through',
                        )}
                      />
                      {overdue && (
                        <Badge className="mt-1.5 shrink-0 bg-danger text-danger-foreground">
                          En retard
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 pl-2 align-top">
                    <NativeSelect
                      aria-label={`Priorité : ${point.text}`}
                      value={point.priority}
                      selectClassName={cn('h-8', PRIORITY_CLASSES[point.priority])}
                      onChange={(event) => {
                        edit(point.id, { priority: event.target.value as Priority })
                      }}
                    >
                      {PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority} value={priority}>
                          {PRIORITY_LABELS[priority]}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                  <td className="py-1.5 pl-2 align-top">
                    <DraftInput
                      aria-label={`Responsable : ${point.text}`}
                      list={ids.owners}
                      autoComplete="off"
                      maxLength={120}
                      value={point.owner ?? ''}
                      onValueChange={(owner) => {
                        edit(point.id, { owner }, 'owner')
                      }}
                      className="h-8 border-transparent bg-transparent shadow-none hover:border-input focus-visible:bg-surface"
                    />
                  </td>
                  <td className="py-1.5 pl-2 align-top">
                    <Input
                      type="date"
                      aria-label={`Échéance : ${point.text}`}
                      value={point.dueDate ?? ''}
                      onChange={(event) => {
                        edit(point.id, { dueDate: event.target.value }, 'dueDate')
                      }}
                      className={cn(
                        'h-8 bg-transparent',
                        overdue && 'border-danger/40 text-danger',
                      )}
                    />
                  </td>
                  <td className="py-1.5 text-right align-top">
                    <IconButton
                      icon={Trash2}
                      label={`Supprimer le point : ${point.text}`}
                      className="hover:text-danger"
                      onClick={() => {
                        remove(point)
                      }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </SectionCard>
  )
}
