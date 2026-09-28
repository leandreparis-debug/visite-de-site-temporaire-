import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Minus,
  Trash2,
} from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { DraftAmountInput } from '@/components/form/DraftAmountInput'
import { DraftInput, DraftTextarea } from '@/components/form/DraftFields'
import { IconButton } from '@/components/form/IconButton'
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
import type { VisitDraft } from '@/features/visits/useVisitDraft'
import { formatEuros } from '@/lib/money'
import { cn } from '@/lib/utils'
import { LONG_TEXT_MAX } from '@/types/common'
import { DO_STEP_TYPE_LABELS } from '@/types/labels'
import { getVisitWarnings, type DoClaim } from '@/types/visit'
import { removeDoClaim, updateDoClaim, type DoClaimFields } from './doClaimOps'
import { DoStepTimeline } from './DoStepTimeline'
import {
  computeDoDeadlines,
  describeDoDeadlines,
  DO_DEADLINE_DISCLAIMER,
  DO_NO_REFERENCE_MESSAGE,
  formatReferenceSource,
  getClaimProgress,
  getCurrentStep,
  isClaimClosed,
  type DoDeadlineState,
} from './doView'

const DEADLINE_STYLES: Record<DoDeadlineState, { icon: typeof Check; className: string }> = {
  overdue: { icon: AlertTriangle, className: 'font-medium text-danger' },
  due_soon: { icon: Clock, className: 'font-medium text-warning' },
  ok: { icon: CalendarClock, className: 'text-foreground' },
  done: { icon: Check, className: 'text-success' },
  not_applicable: { icon: Minus, className: 'text-muted-foreground' },
  closed: { icon: Minus, className: 'text-muted-foreground' },
}

const FIELD_INPUT = 'bg-surface'

/**
 * One DO claim: header (reference, current step, progress), editable fields,
 * indicative deadlines and step timeline. A closed claim starts collapsed.
 */
export function DoClaimCard({
  claim,
  today,
  insurersListId,
  update,
}: {
  claim: DoClaim
  today: string
  insurersListId: string
  update: VisitDraft['update']
}) {
  const closed = isClaimClosed(claim)
  const [expanded, setExpanded] = useState(!closed)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const titleId = useId()
  const bodyId = useId()
  const progress = getClaimProgress(claim)
  const current = getCurrentStep(claim)
  const title = claim.reference ?? 'Sans référence'
  const overdue = describeDoDeadlines(claim, today).some((d) => d.state === 'overdue')

  const edit = (fields: Partial<DoClaimFields>, key: string) => {
    update((v) => updateDoClaim(v, claim.id, fields), { coalesceKey: `do.${claim.id}.${key}` })
  }

  return (
    <article
      aria-labelledby={titleId}
      data-claim-id={claim.id}
      className={cn(
        'rounded-xl border bg-surface p-4',
        overdue && 'border-danger/40',
        closed && 'bg-muted/40',
      )}
    >
      <header className="flex items-start gap-3">
        <IconButton
          icon={expanded ? ChevronDown : ChevronRight}
          label={expanded ? `Replier le sinistre ${title}` : `Déplier le sinistre ${title}`}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => {
            setExpanded((open) => !open)
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 id={titleId} className="font-semibold">
              {title}
            </h4>
            {closed ? (
              <Badge className="bg-success text-success-foreground">Clôturé</Badge>
            ) : (
              current && (
                <Badge className="bg-accent text-accent-foreground">
                  En cours : {DO_STEP_TYPE_LABELS[current.type]}
                </Badge>
              )
            )}
            {overdue && (
              <Badge className="bg-danger text-danger-foreground">
                <AlertTriangle aria-hidden="true" />
                Délai dépassé
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm">{claim.description}</p>
          {claim.location && <p className="text-sm text-muted-foreground">{claim.location}</p>}
          {!expanded && (
            <p className="mt-1 text-sm text-muted-foreground">
              {[
                closed ? 'Clôturé' : current && `En cours : ${DO_STEP_TYPE_LABELS[current.type]}`,
                `${progress.done} / ${progress.total} étapes`,
                claim.insurer,
                claim.compensatedAmountCents !== undefined &&
                  `Indemnisé : ${formatEuros(claim.compensatedAmountCents)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="w-32 text-right">
            <p className="text-xs text-muted-foreground">
              {progress.done} / {progress.total} étapes
            </p>
            <div
              role="progressbar"
              aria-label={`Avancement du sinistre ${title}`}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              aria-valuetext={`${progress.done} étapes terminées sur ${progress.total}`}
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn('h-full rounded-full', closed ? 'bg-success' : 'bg-brand')}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
          <IconButton
            icon={Trash2}
            label={`Supprimer le sinistre ${title}`}
            className="hover:text-danger"
            onClick={() => {
              setConfirmDelete(true)
            }}
          />
        </div>
      </header>

      {expanded && (
        <div id={bodyId} className="mt-4 space-y-4 pl-11">
          <ClaimFields claim={claim} insurersListId={insurersListId} onEdit={edit} />
          <DeadlinesBox claim={claim} today={today} />
          <div>
            <h5 className="mb-2 text-sm font-semibold">Étapes</h5>
            <DoStepTimeline claim={claim} update={update} />
          </div>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le sinistre « {title} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le sinistre, ses étapes et ses montants seront supprimés de cette visite. Cette action
              est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                update((v) => removeDoClaim(v, claim.id).visit)
                setConfirmDelete(false)
                toast.success('Sinistre supprimé')
              }}
            >
              <Trash2 aria-hidden="true" />
              Supprimer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}

function ClaimFields({
  claim,
  insurersListId,
  onEdit,
}: {
  claim: DoClaim
  insurersListId: string
  onEdit: (fields: Partial<DoClaimFields>, key: string) => void
}) {
  const ids = {
    reference: useId(),
    insurer: useId(),
    location: useId(),
    declaredAt: useId(),
    description: useId(),
    claimed: useId(),
    compensated: useId(),
    comment: useId(),
  }
  const warnings = getVisitWarnings({ doClaims: [claim] })
  return (
    <div className="grid grid-cols-4 gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={ids.reference}>Référence</Label>
        <DraftInput
          id={ids.reference}
          autoComplete="off"
          maxLength={100}
          value={claim.reference ?? ''}
          onValueChange={(reference) => {
            onEdit({ reference }, 'reference')
          }}
          className={FIELD_INPUT}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={ids.insurer}>Assureur</Label>
        <DraftInput
          id={ids.insurer}
          list={insurersListId}
          autoComplete="off"
          maxLength={120}
          value={claim.insurer ?? ''}
          onValueChange={(insurer) => {
            onEdit({ insurer }, 'insurer')
          }}
          className={FIELD_INPUT}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={ids.location}>Localisation</Label>
        <DraftInput
          id={ids.location}
          autoComplete="off"
          maxLength={200}
          value={claim.location ?? ''}
          onValueChange={(location) => {
            onEdit({ location }, 'location')
          }}
          className={FIELD_INPUT}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={ids.declaredAt}>Date de déclaration</Label>
        <Input
          id={ids.declaredAt}
          type="date"
          value={claim.declaredAt ?? ''}
          onChange={(event) => {
            onEdit({ declaredAt: event.target.value }, 'declaredAt')
          }}
          className={FIELD_INPUT}
        />
      </div>
      <div className="col-span-4 grid gap-1.5">
        <Label htmlFor={ids.description}>Description</Label>
        <DraftInput
          id={ids.description}
          autoComplete="off"
          required
          requiredMessage="La description est obligatoire"
          maxLength={2000}
          value={claim.description}
          onValueChange={(description) => {
            onEdit({ description }, 'description')
          }}
          className={FIELD_INPUT}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={ids.claimed}>Montant réclamé</Label>
        <DraftAmountInput
          id={ids.claimed}
          cents={claim.claimedAmountCents}
          onValueChange={(claimedAmountCents) => {
            onEdit({ claimedAmountCents }, 'claimed')
          }}
          className={FIELD_INPUT}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={ids.compensated}>Montant indemnisé</Label>
        <DraftAmountInput
          id={ids.compensated}
          cents={claim.compensatedAmountCents}
          onValueChange={(compensatedAmountCents) => {
            onEdit({ compensatedAmountCents }, 'compensated')
          }}
          className={FIELD_INPUT}
        />
      </div>
      <div className="col-span-2 grid gap-1.5">
        <Label htmlFor={ids.comment}>Commentaire</Label>
        <DraftTextarea
          id={ids.comment}
          rows={1}
          maxLength={LONG_TEXT_MAX}
          value={claim.comment ?? ''}
          onValueChange={(comment) => {
            onEdit({ comment }, 'comment')
          }}
          className="min-h-9 py-1.5"
        />
      </div>
      {warnings.length > 0 && (
        <ul className="col-span-4 space-y-1 text-sm text-warning" aria-live="polite">
          {warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DeadlinesBox({ claim, today }: { claim: DoClaim; today: string }) {
  const deadlines = computeDoDeadlines(claim)
  const entries = describeDoDeadlines(claim, today)
  return (
    <section aria-label="Délais" className="rounded-lg border bg-muted/40 p-3 text-sm">
      <h5 className="font-semibold">Délais</h5>
      {deadlines ? (
        <>
          <p className="text-muted-foreground">Calculés {formatReferenceSource(deadlines)}.</p>
          <ul className="mt-2 space-y-1">
            {entries.map((entry) => {
              const { icon: Icon, className } = DEADLINE_STYLES[entry.state]
              return (
                <li
                  key={entry.kind}
                  data-deadline={entry.kind}
                  data-state={entry.state}
                  className={cn('flex items-start gap-1.5', className)}
                >
                  <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {entry.label}
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <p className="text-muted-foreground">{DO_NO_REFERENCE_MESSAGE}</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground italic">{DO_DEADLINE_DISCLAIMER}.</p>
    </section>
  )
}
