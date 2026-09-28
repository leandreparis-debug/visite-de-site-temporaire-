import type { LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Small ghost icon button; `label` is its accessible name (and tooltip). */
export function IconButton({
  icon: Icon,
  label,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, 'children'> & { icon: LucideIcon; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      className={cn('size-8 text-muted-foreground hover:text-foreground', className)}
      {...props}
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}
