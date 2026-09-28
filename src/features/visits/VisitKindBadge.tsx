import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { VISIT_KIND_LABELS } from '@/types/labels'
import type { VisitKind } from '@/types/visit'

/** Colored badge for the visit type. */
export function VisitKindBadge({ kind, className }: { kind: VisitKind; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-transparent',
        kind === 'technical_visit'
          ? 'bg-accent text-accent-foreground'
          : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {VISIT_KIND_LABELS[kind]}
    </Badge>
  )
}
