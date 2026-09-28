/**
 * Text fields bound to the visit draft.
 *
 * While focused, they show a LOCAL copy of what the user types; the draft
 * receives each change through `onValueChange` (where operations trim, refuse
 * blank required values…). On blur, the field shows the draft value again.
 * So trimming or a refused value never moves the cursor or eats a space
 * being typed, and a required field left empty is restored on blur.
 */
import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type BufferedProps = {
  /** Value from the draft. */
  value: string
  /** Called on every change; for required fields, only with a non-blank value. */
  onValueChange: (value: string) => void
  /** Blank values are not sent; an error is shown until the field is left. */
  required?: boolean
  requiredMessage?: string
}

function useBuffer({ value, onValueChange, required }: BufferedProps) {
  const [local, setLocal] = useState<string | null>(null)
  return {
    shown: local ?? value,
    invalid: Boolean(required) && local !== null && local.trim() === '',
    onFocus: () => {
      setLocal(value)
    },
    onChange: (text: string) => {
      setLocal(text)
      if (!required || text.trim()) onValueChange(text)
    },
    onBlur: () => {
      setLocal(null)
    },
  }
}

function RequiredError({ id, show, message }: { id: string; show: boolean; message: string }) {
  if (!show) return null
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-danger">
      {message}
    </p>
  )
}

export type DraftInputProps = BufferedProps &
  Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'defaultValue'> & {
    /** Classes of the wrapping element (the input keeps `className`). */
    wrapperClassName?: string
  }

/** `<input>` bound to the draft (see module doc). */
export function DraftInput({
  value,
  onValueChange,
  required,
  requiredMessage = 'Ce champ est obligatoire',
  onFocus,
  onBlur,
  wrapperClassName,
  ...props
}: DraftInputProps) {
  const buffer = useBuffer({ value, onValueChange, required })
  const errorId = useId()
  return (
    <div className={wrapperClassName}>
      <Input
        {...props}
        value={buffer.shown}
        aria-required={required || undefined}
        aria-invalid={buffer.invalid || undefined}
        aria-describedby={buffer.invalid ? errorId : props['aria-describedby']}
        onFocus={(event) => {
          buffer.onFocus()
          onFocus?.(event)
        }}
        onChange={(event) => {
          buffer.onChange(event.target.value)
        }}
        onBlur={(event) => {
          buffer.onBlur()
          onBlur?.(event)
        }}
      />
      <RequiredError id={errorId} show={buffer.invalid} message={requiredMessage} />
    </div>
  )
}

export type DraftTextareaProps = Omit<BufferedProps, 'required' | 'requiredMessage'> &
  Omit<ComponentProps<'textarea'>, 'value' | 'onChange' | 'defaultValue'>

/**
 * `<textarea>` bound to the draft, growing with its content
 * (`field-sizing: content`, no inner scrollbar).
 */
export function DraftTextarea({
  value,
  onValueChange,
  onFocus,
  onBlur,
  className,
  ...props
}: DraftTextareaProps) {
  const buffer = useBuffer({ value, onValueChange })
  return (
    <Textarea
      {...props}
      value={buffer.shown}
      className={cn('resize-none overflow-hidden bg-surface', className)}
      onFocus={(event) => {
        buffer.onFocus()
        onFocus?.(event)
      }}
      onChange={(event) => {
        buffer.onChange(event.target.value)
      }}
      onBlur={(event) => {
        buffer.onBlur()
        onBlur?.(event)
      }}
    />
  )
}

/** `<datalist>` of suggestions for `<input list={id}>`. */
export function Suggestions({ id, values }: { id: string; values: readonly string[] }) {
  return (
    <datalist id={id}>
      {values.map((value) => (
        <option key={value} value={value} />
      ))}
    </datalist>
  )
}

/** Card section used by the editor tabs. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  headingId,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  headingId?: string
}) {
  return (
    <section
      aria-labelledby={headingId}
      className={cn('rounded-xl border bg-card p-5 shadow-card', className)}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={headingId} className="text-base font-semibold">
            {title}
          </h3>
          {description && <div className="mt-0.5 text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}
