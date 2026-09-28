import { Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { SectionCard } from '@/components/form/DraftFields'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { VisitTabProps } from '@/features/visits/editorTypes'
import { createId } from '@/lib/id'
import { createDoClaim } from './doClaimOps'
import { DoClaimCard } from './DoClaimCard'
import { DO_STEP_SEQUENCE, sortDoClaimsForDisplay } from './doView'

export const DO_CLAIMS_SECTION_ID = 'do-insurance-claims'

/** "Sinistres Dommages-Ouvrage": declaration dialog and one card per claim. */
export function DoClaimsSection({
  visit,
  update,
  today,
  insurersListId,
  doInsurers,
  knownInsurers,
}: VisitTabProps & {
  today: string
  insurersListId: string
  /** Insurers of the visit's DO contracts (suggested first when declaring). */
  doInsurers: readonly string[]
  knownInsurers: readonly string[]
}) {
  const [declaring, setDeclaring] = useState(false)
  const claims = sortDoClaimsForDisplay(visit.doClaims, today)

  return (
    <SectionCard
      title="Sinistres Dommages-Ouvrage"
      headingId={DO_CLAIMS_SECTION_ID}
      actions={
        <Button
          size="sm"
          onClick={() => {
            setDeclaring(true)
          }}
        >
          <Plus aria-hidden="true" />
          Déclarer un sinistre
        </Button>
      }
    >
      {claims.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Aucun sinistre DO suivi sur ce site.
        </p>
      ) : (
        <div className="space-y-4">
          {claims.map((claim) => (
            <DoClaimCard
              key={claim.id}
              claim={claim}
              today={today}
              insurersListId={insurersListId}
              update={update}
            />
          ))}
        </div>
      )}

      <Dialog open={declaring} onOpenChange={setDeclaring}>
        <DialogContent className="sm:max-w-xl">
          <DeclareClaimForm
            doInsurers={doInsurers}
            knownInsurers={knownInsurers}
            onCancel={() => {
              setDeclaring(false)
            }}
            onSubmit={(fields) => {
              // Ids generated here, never inside the updater (replayed by the autosave).
              const claimId = createId()
              const stepIds = DO_STEP_SEQUENCE.map(() => createId())
              update((v) => createDoClaim(v, { claimId, stepIds, ...fields }))
              setDeclaring(false)
              toast.success('Sinistre déclaré')
            }}
          />
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}

interface DeclareFields {
  description: string
  location: string
  reference: string
  insurer: string
  declaredAt: string
}

function DeclareClaimForm({
  doInsurers,
  knownInsurers,
  onCancel,
  onSubmit,
}: {
  doInsurers: readonly string[]
  knownInsurers: readonly string[]
  onCancel: () => void
  onSubmit: (fields: DeclareFields) => void
}) {
  const [fields, setFields] = useState<DeclareFields>({
    description: '',
    location: '',
    reference: '',
    // A single DO contract: its insurer is the obvious choice.
    insurer: doInsurers.length === 1 ? (doInsurers[0] ?? '') : '',
    declaredAt: '',
  })
  const [showError, setShowError] = useState(false)
  const ids = {
    description: useId(),
    location: useId(),
    reference: useId(),
    insurer: useId(),
    insurers: useId(),
    declaredAt: useId(),
    error: useId(),
  }
  const set = (key: keyof DeclareFields) => (value: string) => {
    setFields((f) => ({ ...f, [key]: value }))
  }
  const missingDescription = !fields.description.trim()
  // DO contract insurers first, then every insurer known in the other visits.
  const insurers = [...new Set([...doInsurers, ...knownInsurers])]

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (missingDescription) {
          setShowError(true)
          document.getElementById(ids.description)?.focus()
          return
        }
        onSubmit(fields)
      }}
    >
      <DialogHeader>
        <DialogTitle>Déclarer un sinistre DO</DialogTitle>
        <DialogDescription>
          Les 10 étapes standard sont créées « À faire ». Les étapes non applicables pourront être
          retirées.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor={ids.description}>Description du sinistre</Label>
        <Textarea
          id={ids.description}
          autoFocus
          required
          aria-invalid={(showError && missingDescription) || undefined}
          aria-describedby={showError && missingDescription ? ids.error : undefined}
          maxLength={2000}
          placeholder="Ex. : infiltrations en toiture, cellule 3"
          value={fields.description}
          onChange={(event) => {
            set('description')(event.target.value)
          }}
          className="min-h-20"
        />
        {showError && missingDescription && (
          <p id={ids.error} role="alert" className="text-xs text-danger">
            La description est obligatoire
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          id={ids.location}
          label="Localisation"
          max={200}
          value={fields.location}
          onChange={set('location')}
        />
        <TextField
          id={ids.reference}
          label="Référence"
          max={100}
          value={fields.reference}
          onChange={set('reference')}
        />
        <TextField
          id={ids.insurer}
          label="Assureur"
          max={120}
          list={ids.insurers}
          value={fields.insurer}
          onChange={set('insurer')}
        />
        <div className="grid gap-1.5">
          <Label htmlFor={ids.declaredAt}>Date de déclaration</Label>
          <Input
            id={ids.declaredAt}
            type="date"
            value={fields.declaredAt}
            onChange={(event) => {
              set('declaredAt')(event.target.value)
            }}
          />
        </div>
      </div>
      <datalist id={ids.insurers}>
        {insurers.map((insurer) => (
          <option key={insurer} value={insurer} />
        ))}
      </datalist>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit">Déclarer</Button>
      </DialogFooter>
    </form>
  )
}

function TextField({
  id,
  label,
  max,
  list,
  value,
  onChange,
}: {
  id: string
  label: string
  max: number
  list?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        list={list}
        autoComplete="off"
        maxLength={max}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    </div>
  )
}
