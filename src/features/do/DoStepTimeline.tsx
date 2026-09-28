import { Ban, Check, ChevronDown, CircleDashed, Clock, MessageSquare, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { DraftTextarea } from '@/components/form/DraftFields'
import { IconButton } from '@/components/form/IconButton'
import { NativeSelect } from '@/components/form/NativeSelect'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import type { VisitDraft } from '@/features/visits/useVisitDraft'
import { todayIso } from '@/lib/dates'
import { createId } from '@/lib/id'
import { cn } from '@/lib/utils'
import { DO_STEP_STATUS_LABELS, DO_STEP_TYPE_LABELS } from '@/types/labels'
import { DO_STEP_STATUSES, type DoClaim, type DoStep, type DoStepStatus } from '@/types/visit'
import {
  getMissingStepTypes,
  removeStep,
  restoreStep,
  setStepStatus,
  updateStep,
} from './doClaimOps'
import { getCurrentStep } from './doView'

const STATUS_ICONS = {
  done: { icon: Check, className: 'border-success bg-success text-success-foreground' },
  in_progress: { icon: Clock, className: 'border-warning bg-warning/10 text-warning' },
  todo: { icon: CircleDashed, className: 'border-border bg-surface text-muted-foreground' },
} satisfies Record<DoStepStatus, { icon: typeof Check; className: string }>

/**
 * Vertical timeline of the steps of a claim. Every control is native (select,
 * date, buttons), so the whole timeline works with the keyboard; the status
 * is given by text, not only by the icon colour.
 */
export function DoStepTimeline({
  claim,
  update,
}: {
  claim: DoClaim
  update: VisitDraft['update']
}) {
  const current = getCurrentStep(claim)
  const missing = getMissingStepTypes(claim)

  const markNotApplicable = (step: DoStep) => {
    update((v) => removeStep(v, claim.id, step.id).visit)
    toast('Étape retirée', {
      description: DO_STEP_TYPE_LABELS[step.type],
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => {
          const { id, ...rest } = step
          update((v) => restoreStep(v, claim.id, { ...rest, stepId: id }))
        },
      },
    })
  }

  return (
    <div>
      <ol aria-label="Étapes du sinistre" className="space-y-0">
        {claim.steps.map((step, index) => (
          <StepItem
            key={step.id}
            step={step}
            isCurrent={step.id === current?.id}
            isLast={index === claim.steps.length - 1}
            onStatus={(status) => {
              // Today's date computed here, never inside the updater.
              const today = todayIso()
              update((v) => setStepStatus(v, claim.id, step.id, status, today))
            }}
            onDate={(date) => {
              update((v) => updateStep(v, claim.id, step.id, { date }), {
                coalesceKey: `do.${claim.id}.${step.id}.date`,
              })
            }}
            onComment={(comment) => {
              update((v) => updateStep(v, claim.id, step.id, { comment }), {
                coalesceKey: `do.${claim.id}.${step.id}.comment`,
              })
            }}
            onNotApplicable={() => {
              markNotApplicable(step)
            }}
          />
        ))}
      </ol>
      {claim.steps.length === 0 && (
        <p className="py-2 text-sm text-muted-foreground">Toutes les étapes ont été retirées.</p>
      )}
      {missing.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="mt-2 text-muted-foreground">
              <Undo2 aria-hidden="true" />
              Rétablir une étape ({missing.length})
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            {missing.map((type) => (
              <DropdownMenuItem
                key={type}
                onSelect={() => {
                  const stepId = createId()
                  update((v) => restoreStep(v, claim.id, { stepId, type }))
                }}
              >
                {DO_STEP_TYPE_LABELS[type]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function StepItem({
  step,
  isCurrent,
  isLast,
  onStatus,
  onDate,
  onComment,
  onNotApplicable,
}: {
  step: DoStep
  isCurrent: boolean
  isLast: boolean
  onStatus: (status: DoStepStatus) => void
  onDate: (date: string) => void
  onComment: (comment: string) => void
  onNotApplicable: () => void
}) {
  const [commentOpen, setCommentOpen] = useState(Boolean(step.comment))
  const label = DO_STEP_TYPE_LABELS[step.type]
  const { icon: Icon, className: iconClass } = STATUS_ICONS[step.status]
  const done = step.status === 'done'

  return (
    <li
      aria-current={isCurrent ? 'step' : undefined}
      data-step-type={step.type}
      className="relative flex gap-3 pb-2"
    >
      {!isLast && (
        <span aria-hidden="true" className="absolute top-8 bottom-0 left-3 w-px bg-border" />
      )}
      <span
        className={cn(
          'relative mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2',
          iconClass,
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        <span className="sr-only">{DO_STEP_STATUS_LABELS[step.status]} :</span>
      </span>
      <div
        className={cn(
          'min-w-0 flex-1 rounded-lg px-3 py-1.5',
          isCurrent && 'bg-accent/70 ring-1 ring-brand/30',
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className={cn('min-w-56 flex-1 text-sm font-medium', done && 'text-muted-foreground')}
          >
            {label}
            {isCurrent && (
              <span className="ml-2 text-xs font-semibold text-brand">Étape en cours</span>
            )}
          </span>
          <NativeSelect
            aria-label={`Statut : ${label}`}
            className="w-32"
            selectClassName={cn(
              'h-8',
              done && 'border-success/30 text-success',
              step.status === 'in_progress' && 'border-warning/30 text-warning',
            )}
            value={step.status}
            onChange={(event) => {
              onStatus(event.target.value as DoStepStatus)
            }}
          >
            {DO_STEP_STATUSES.map((status) => (
              <option key={status} value={status}>
                {DO_STEP_STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
          <Input
            type="date"
            aria-label={`Date : ${label}`}
            value={step.date ?? ''}
            onChange={(event) => {
              onDate(event.target.value)
            }}
            className="h-8 w-40 bg-surface"
          />
          <IconButton
            icon={MessageSquare}
            label={`Commentaire : ${label}`}
            aria-expanded={commentOpen}
            className={cn(step.comment && 'text-brand')}
            onClick={() => {
              setCommentOpen((open) => !open)
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Non applicable : ${label}`}
            className="h-8 text-muted-foreground"
            onClick={onNotApplicable}
          >
            <Ban aria-hidden="true" />
            Non applicable
          </Button>
        </div>
        {commentOpen && (
          <DraftTextarea
            aria-label={`Commentaire de l’étape : ${label}`}
            rows={1}
            maxLength={2000}
            placeholder="Commentaire"
            value={step.comment ?? ''}
            onValueChange={onComment}
            className="mt-1.5 min-h-8 py-1"
          />
        )}
      </div>
    </li>
  )
}
