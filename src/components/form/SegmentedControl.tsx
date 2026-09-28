import { useId } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group. */
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/**
 * Single choice among a few options, rendered as native radio buttons styled
 * as a segmented control (arrow keys, Tab and screen readers work natively).
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const name = useId()
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex h-9 items-center rounded-lg bg-muted p-[3px]', className)}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            'relative flex h-full cursor-pointer items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors',
            'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
            option.value === value && 'bg-surface text-foreground shadow-sm',
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => {
              onChange(option.value)
            }}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}
