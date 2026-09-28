import { useId, useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { formatEuros, parseEurosInput } from '@/lib/money'

const plainFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const AMOUNT_INPUT_ERROR = 'Montant invalide (ex. : 12 500,50)'

export type DraftAmountInputProps = Omit<
  ComponentProps<typeof Input>,
  'value' | 'onChange' | 'defaultValue' | 'type'
> & {
  /** Stored amount in cents (`undefined`: not filled in). */
  cents: number | undefined
  /** Called with each valid amount typed, or `undefined` when the field is emptied. */
  onValueChange: (cents: number | undefined) => void
  wrapperClassName?: string
}

/**
 * Euro amount bound to the draft. Shows "12 500,50 €" at rest; while focused,
 * the user types freely ("12 500,50", "12500.5"…). Each valid value is sent
 * (via `parseEurosInput`); an invalid one shows an inline error and is never
 * sent, so saving is never blocked. On blur after an invalid entry, the
 * amount it had when the field was focused is restored.
 */
export function DraftAmountInput({
  cents,
  onValueChange,
  wrapperClassName,
  onFocus,
  onBlur,
  ...props
}: DraftAmountInputProps) {
  /** Text being typed, and the amount when the field was focused. */
  const [editing, setEditing] = useState<{ text: string; initial: number | undefined } | null>(null)
  const errorId = useId()
  const invalid =
    editing !== null && editing.text.trim() !== '' && parseEurosInput(editing.text) === null
  const shown = editing?.text ?? (cents === undefined ? '' : formatEuros(cents))
  return (
    <div className={wrapperClassName}>
      <Input
        {...props}
        inputMode="decimal"
        autoComplete="off"
        value={shown}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : props['aria-describedby']}
        onFocus={(event) => {
          setEditing({
            text: cents === undefined ? '' : plainFormatter.format(cents / 100),
            initial: cents,
          })
          onFocus?.(event)
        }}
        onChange={(event) => {
          const text = event.target.value
          setEditing((current) => current && { ...current, text })
          if (!text.trim()) onValueChange(undefined)
          else {
            const parsed = parseEurosInput(text)
            if (parsed !== null) onValueChange(parsed)
          }
        }}
        onBlur={(event) => {
          if (invalid && editing.initial !== cents) onValueChange(editing.initial)
          setEditing(null)
          onBlur?.(event)
        }}
      />
      {invalid && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
          {AMOUNT_INPUT_ERROR}
        </p>
      )}
    </div>
  )
}
