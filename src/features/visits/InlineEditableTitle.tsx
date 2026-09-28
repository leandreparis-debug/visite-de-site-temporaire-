import { Pencil } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'

const TITLE_MAX = 200

export interface InlineEditableTitleProps {
  value: string
  onCommit: (title: string) => void
}

/**
 * Title editable in place: click (or Enter/Space on the button) to edit,
 * Enter or blur to validate, Escape to cancel. An empty title is refused
 * (Enter shows an error; blur restores the previous title).
 */
export function InlineEditableTitle({ value, onCommit }: InlineEditableTitleProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()

  const start = () => {
    setText(value)
    setError(null)
    setEditing(true)
  }
  const cancel = () => {
    setEditing(false)
    setError(null)
  }
  /** @returns false when the title is refused. */
  const commit = (): boolean => {
    const title = text.trim()
    if (!title) {
      setError('Le titre est obligatoire')
      return false
    }
    if (title !== value) onCommit(title)
    setEditing(false)
    setError(null)
    return true
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }

  if (!editing) {
    return (
      <h2 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight">
        <button
          type="button"
          onClick={start}
          title="Cliquer pour modifier le titre"
          className="group -mx-1.5 flex max-w-full items-center gap-2 rounded-md px-1.5 text-left outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="truncate">{value}</span>
          <Pencil
            className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden="true"
          />
        </button>
      </h2>
    )
  }

  return (
    <div className="min-w-0 flex-1">
      <Input
        // Focus the field as soon as the user asked to edit it.
        autoFocus
        value={text}
        maxLength={TITLE_MAX}
        aria-label="Titre de la visite"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="h-10 max-w-2xl text-2xl font-semibold md:text-2xl"
        onFocus={(event) => {
          event.currentTarget.select()
        }}
        onChange={(event) => {
          setText(event.target.value)
          if (error) setError(null)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (!commit()) cancel()
        }}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
