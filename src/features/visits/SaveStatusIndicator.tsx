import { AlertCircle, Check, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SaveStatus } from './useVisitDraft'

const LABELS: Record<SaveStatus, string> = {
  idle: '',
  dirty: 'Modifications en cours…',
  saving: 'Enregistrement…',
  saved: 'Enregistré',
  error: 'Erreur d’enregistrement',
}

/** Discreet autosave status, announced to screen readers (`role="status"`). */
export function SaveStatusIndicator({
  status,
  onRetry,
  className,
}: {
  status: SaveStatus
  onRetry: () => void
  className?: string
}) {
  return (
    <div className={cn('flex h-8 items-center gap-2 text-sm', className)}>
      <span
        role="status"
        aria-live="polite"
        className={cn(
          'flex items-center gap-1.5 whitespace-nowrap',
          status === 'error' ? 'font-medium text-danger' : 'text-muted-foreground',
        )}
      >
        {status === 'dirty' && (
          <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
        )}
        {status === 'saving' && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {status === 'saved' && <Check className="size-4 text-success" aria-hidden="true" />}
        {status === 'error' && <AlertCircle className="size-4" aria-hidden="true" />}
        {LABELS[status]}
      </span>
      {status === 'error' && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCcw aria-hidden="true" />
          Réessayer
        </Button>
      )}
    </div>
  )
}
