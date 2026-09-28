import { Plus, Trash2 } from 'lucide-react'
import { useId, useRef, useState, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import { DraftInput, DraftTextarea, SectionCard } from '@/components/form/DraftFields'
import { IconButton } from '@/components/form/IconButton'
import { NativeSelect } from '@/components/form/NativeSelect'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { VisitTabProps } from '@/features/visits/editorTypes'
import { createId } from '@/lib/id'
import { cn } from '@/lib/utils'
import { LONG_TEXT_MAX } from '@/types/common'
import { INSURANCE_TYPE_LABELS } from '@/types/labels'
import { INSURANCE_TYPES, type Insurance, type InsuranceType } from '@/types/visit'
import {
  addInsurance,
  insertInsuranceAt,
  removeInsurance,
  updateInsurance,
  type InsuranceFields,
} from './insuranceOps'
import {
  formatInsuranceValidity,
  getInsuranceValidity,
  sortInsurancesForDisplay,
  type InsuranceValidityStatus,
} from './insuranceView'

export const INSURANCES_SECTION_ID = 'do-insurance-contracts'

const VALIDITY_CLASSES: Record<InsuranceValidityStatus, string> = {
  valid: 'bg-success/10 text-success',
  expiring_soon: 'bg-warning/10 text-warning',
  expired: 'bg-danger text-danger-foreground',
  not_started: 'bg-accent text-accent-foreground',
  unknown: 'bg-muted text-muted-foreground',
}

const EMPTY_ENTRY = {
  type: 'dommages_ouvrage' as InsuranceType,
  insurer: '',
  policyNumber: '',
  endDate: '',
}

const CELL_INPUT =
  'h-8 border-transparent bg-transparent shadow-none hover:border-input focus-visible:bg-surface'

/** "Contrats d'assurance": quick entry and editable table with validity badges. */
export function InsurancesSection({
  visit,
  update,
  today,
  insurersListId,
  brokersListId,
}: VisitTabProps & { today: string; insurersListId: string; brokersListId: string }) {
  const [entry, setEntry] = useState(EMPTY_ENTRY)
  const insurerRef = useRef<HTMLInputElement>(null)
  const ids = { type: useId(), insurer: useId(), policy: useId(), end: useId() }
  const insurances = sortInsurancesForDisplay(visit.insurances, today)

  const add = (event: SyntheticEvent) => {
    event.preventDefault()
    if (!entry.insurer.trim()) {
      insurerRef.current?.focus()
      return
    }
    // Id generated here, never inside the updater (replayed by the autosave).
    const insurance = { id: createId(), ...entry }
    update((v) => addInsurance(v, insurance))
    setEntry(EMPTY_ENTRY)
    insurerRef.current?.focus()
  }

  const edit = (id: string, fields: Partial<InsuranceFields>, key?: string) => {
    update(
      (v) => updateInsurance(v, id, fields),
      key ? { coalesceKey: `insurance.${id}.${key}` } : undefined,
    )
  }

  const remove = (insurance: Insurance) => {
    const { removed, index } = removeInsurance(visit, insurance.id)
    if (!removed) return
    update((v) => removeInsurance(v, insurance.id).visit)
    toast('Contrat supprimé', {
      description: `${INSURANCE_TYPE_LABELS[removed.type]} — ${removed.insurer}`,
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => {
          update((v) => insertInsuranceAt(v, removed, index))
        },
      },
    })
  }

  return (
    <SectionCard title="Contrats d’assurance" headingId={INSURANCES_SECTION_ID}>
      <form
        onSubmit={add}
        aria-label="Ajouter un contrat"
        className="mb-4 grid grid-cols-[13rem_1fr_11rem_10rem_auto] items-end gap-3 rounded-lg bg-muted/60 p-3"
      >
        <div className="grid gap-1.5">
          <Label htmlFor={ids.type}>Type</Label>
          <NativeSelect
            id={ids.type}
            value={entry.type}
            onChange={(event) => {
              setEntry((e) => ({ ...e, type: event.target.value as InsuranceType }))
            }}
          >
            {INSURANCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {INSURANCE_TYPE_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.insurer}>Assureur</Label>
          <Input
            ref={insurerRef}
            id={ids.insurer}
            list={insurersListId}
            autoComplete="off"
            maxLength={120}
            placeholder="Obligatoire"
            value={entry.insurer}
            onChange={(event) => {
              setEntry((e) => ({ ...e, insurer: event.target.value }))
            }}
            className="bg-surface"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.policy}>N° de police</Label>
          <Input
            id={ids.policy}
            autoComplete="off"
            maxLength={100}
            value={entry.policyNumber}
            onChange={(event) => {
              setEntry((e) => ({ ...e, policyNumber: event.target.value }))
            }}
            className="bg-surface"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.end}>Date de fin</Label>
          <Input
            id={ids.end}
            type="date"
            value={entry.endDate}
            onChange={(event) => {
              setEntry((e) => ({ ...e, endDate: event.target.value }))
            }}
            className="bg-surface"
          />
        </div>
        <Button type="submit" variant="outline" className="bg-surface">
          <Plus aria-hidden="true" />
          Ajouter
        </Button>
      </form>

      {insurances.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Aucun contrat renseigné.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="w-44 pb-2 font-medium">Type</th>
                <th className="pb-2 pl-2 font-medium">Assureur</th>
                <th className="w-30 pb-2 pl-2 font-medium">N° de police</th>
                <th className="w-32 pb-2 pl-2 font-medium">Courtier</th>
                <th className="w-44 pb-2 pl-2 font-medium">Période</th>
                <th className="w-36 pb-2 pl-2 font-medium">Validité</th>
                <th className="pb-2 pl-2 font-medium">Commentaire</th>
                <th className="w-10 pb-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {insurances.map((insurance) => (
                <InsuranceRow
                  key={insurance.id}
                  insurance={insurance}
                  today={today}
                  insurersListId={insurersListId}
                  brokersListId={brokersListId}
                  onEdit={(fields, key) => {
                    edit(insurance.id, fields, key)
                  }}
                  onRemove={() => {
                    remove(insurance)
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

function InsuranceRow({
  insurance,
  today,
  insurersListId,
  brokersListId,
  onEdit,
  onRemove,
}: {
  insurance: Insurance
  today: string
  insurersListId: string
  brokersListId: string
  onEdit: (fields: Partial<InsuranceFields>, key?: string) => void
  onRemove: () => void
}) {
  const [dateError, setDateError] = useState(false)
  const errorId = useId()
  const validity = getInsuranceValidity(insurance, today)
  const name = `${INSURANCE_TYPE_LABELS[insurance.type]} ${insurance.insurer}`

  /** Refuses (with a message) an end date before the start date. */
  const editDate = (key: 'startDate' | 'endDate', value: string) => {
    const start = key === 'startDate' ? value : insurance.startDate
    const end = key === 'endDate' ? value : insurance.endDate
    const inverted = Boolean(start && end && end < start)
    setDateError(inverted)
    if (!inverted) onEdit({ [key]: value }, key)
  }

  return (
    <tr className="border-b align-top last:border-0">
      <td className="py-1.5">
        <NativeSelect
          aria-label={`Type : ${insurance.insurer}`}
          value={insurance.type}
          selectClassName="h-8"
          onChange={(event) => {
            onEdit({ type: event.target.value as InsuranceType })
          }}
        >
          {INSURANCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {INSURANCE_TYPE_LABELS[type]}
            </option>
          ))}
        </NativeSelect>
      </td>
      <td className="py-1.5 pl-2">
        <DraftInput
          aria-label={`Assureur : ${name}`}
          list={insurersListId}
          autoComplete="off"
          required
          requiredMessage="L’assureur est obligatoire"
          maxLength={120}
          value={insurance.insurer}
          onValueChange={(insurer) => {
            onEdit({ insurer }, 'insurer')
          }}
          className={CELL_INPUT}
        />
      </td>
      <td className="py-1.5 pl-2">
        <DraftInput
          aria-label={`N° de police : ${name}`}
          autoComplete="off"
          maxLength={100}
          value={insurance.policyNumber ?? ''}
          onValueChange={(policyNumber) => {
            onEdit({ policyNumber }, 'policyNumber')
          }}
          className={CELL_INPUT}
        />
      </td>
      <td className="py-1.5 pl-2">
        <DraftInput
          aria-label={`Courtier : ${name}`}
          list={brokersListId}
          autoComplete="off"
          maxLength={120}
          value={insurance.broker ?? ''}
          onValueChange={(broker) => {
            onEdit({ broker }, 'broker')
          }}
          className={CELL_INPUT}
        />
      </td>
      <td className="py-1.5 pl-2">
        <div className="grid grid-cols-[1.5rem_1fr] items-center gap-x-1 gap-y-1 text-xs text-muted-foreground">
          <span aria-hidden="true">du</span>
          <Input
            type="date"
            aria-label={`Date de début : ${name}`}
            value={insurance.startDate ?? ''}
            onChange={(event) => {
              editDate('startDate', event.target.value)
            }}
            className="h-8 bg-transparent text-foreground"
          />
          <span aria-hidden="true">au</span>
          <Input
            type="date"
            aria-label={`Date de fin : ${name}`}
            aria-invalid={dateError || undefined}
            aria-describedby={dateError ? errorId : undefined}
            value={insurance.endDate ?? ''}
            onChange={(event) => {
              editDate('endDate', event.target.value)
            }}
            className={cn(
              'h-8 bg-transparent text-foreground',
              validity.status === 'expired' && 'border-danger/40 text-danger',
            )}
          />
        </div>
        {dateError && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
            La fin doit suivre le début
          </p>
        )}
      </td>
      <td className="py-1.5 pl-2">
        <Badge className={cn('mt-1.5', VALIDITY_CLASSES[validity.status])}>
          {formatInsuranceValidity(validity)}
        </Badge>
      </td>
      <td className="py-1.5 pl-2">
        <DraftTextarea
          aria-label={`Commentaire : ${name}`}
          rows={1}
          maxLength={LONG_TEXT_MAX}
          value={insurance.comment ?? ''}
          onValueChange={(comment) => {
            onEdit({ comment }, 'comment')
          }}
          className="min-h-8 border-transparent bg-transparent py-1 shadow-none hover:border-input focus-visible:bg-surface"
        />
      </td>
      <td className="py-1.5 text-right">
        <IconButton
          icon={Trash2}
          label={`Supprimer le contrat : ${name}`}
          className="hover:text-danger"
          onClick={onRemove}
        />
      </td>
    </tr>
  )
}
