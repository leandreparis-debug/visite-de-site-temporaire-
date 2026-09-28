import { Loader2 } from 'lucide-react'
import { useId, useState, type ReactNode, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import * as z from 'zod/mini'
import { navigate } from '@/app/router'
import { SegmentedControl } from '@/components/form/SegmentedControl'
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
import { todayIso } from '@/lib/dates'
import { notifyError } from '@/lib/notify'
import { VISIT_KIND_LABELS } from '@/types/labels'
import { VISIT_KINDS, type VisitKind } from '@/types/visit'
import { newVisitInputSchema, type NewVisitInput } from './visitFactory'
import { createVisit } from './visitsRepo'

type FieldErrors = Partial<Record<keyof NewVisitInput, string>>

const KIND_OPTIONS = VISIT_KINDS.map((kind) => ({ value: kind, label: VISIT_KIND_LABELS[kind] }))

function emptyForm(): NewVisitInput {
  return { kind: 'technical_visit', title: '', date: todayIso(), siteName: '' }
}

function validate(form: NewVisitInput): FieldErrors {
  const result = z.safeParse(newVisitInputSchema, form)
  const errors: FieldErrors = {}
  if (result.success) return errors
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof NewVisitInput
    errors[field] ??= issue.message
  }
  if (form.date === '') errors.date = 'La date est obligatoire'
  return errors
}

export interface CreateVisitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** "Nouvelle visite" dialog: type, title, date, site. Opens the new visit on success. */
export function CreateVisitDialog({ open, onOpenChange }: CreateVisitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remounted on each opening: the form starts empty. */}
        {open && (
          <CreateVisitForm
            onCreated={() => {
              onOpenChange(false)
            }}
            onCancel={() => {
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CreateVisitForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<NewVisitInput>(emptyForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const ids = { title: useId(), date: useId(), siteName: useId() }

  const set = <K extends keyof NewVisitInput>(field: K, value: NewVisitInput[K]) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault()
    if (submitting) return
    const fieldErrors = validate(form)
    setErrors(fieldErrors)
    if (Object.values(fieldErrors).some(Boolean)) {
      const firstInvalid = (['title', 'date', 'siteName'] as const).find((f) => fieldErrors[f])
      if (firstInvalid) document.getElementById(ids[firstInvalid])?.focus()
      return
    }
    setSubmitting(true)
    try {
      const visit = await createVisit(form)
      onCreated()
      toast.success('Visite créée')
      navigate({ name: 'visit', visitId: visit.id, tab: 'general' })
    } catch (error) {
      notifyError(error, 'Création impossible')
      setSubmitting(false)
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Nouvelle visite</DialogTitle>
        <DialogDescription>
          Les autres informations se complètent ensuite dans la visite.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Type</span>
        <SegmentedControl<VisitKind>
          label="Type"
          options={KIND_OPTIONS}
          value={form.kind}
          onChange={(kind) => {
            set('kind', kind)
          }}
          className="w-fit"
        />
      </div>

      <Field id={ids.title} label="Titre" error={errors.title}>
        <Input
          id={ids.title}
          value={form.title}
          maxLength={200}
          placeholder="Ex. : Visite annuelle entrepôt"
          autoComplete="off"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? `${ids.title}-error` : undefined}
          onChange={(event) => {
            set('title', event.target.value)
          }}
        />
      </Field>

      <Field id={ids.date} label="Date" error={errors.date}>
        <Input
          id={ids.date}
          type="date"
          value={form.date}
          className="w-44"
          aria-invalid={Boolean(errors.date)}
          aria-describedby={errors.date ? `${ids.date}-error` : undefined}
          onChange={(event) => {
            set('date', event.target.value)
          }}
        />
      </Field>

      <Field id={ids.siteName} label="Nom du site" error={errors.siteName}>
        <Input
          id={ids.siteName}
          value={form.siteName}
          maxLength={200}
          placeholder="Ex. : Entrepôt de Lyon Nord"
          autoComplete="off"
          aria-invalid={Boolean(errors.siteName)}
          aria-describedby={errors.siteName ? `${ids.siteName}-error` : undefined}
          onChange={(event) => {
            set('siteName', event.target.value)
          }}
        />
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Annuler
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          Créer la visite
        </Button>
      </DialogFooter>
    </form>
  )
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error: string | undefined
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}
        <span className="text-danger" aria-hidden="true">
          *
        </span>
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
