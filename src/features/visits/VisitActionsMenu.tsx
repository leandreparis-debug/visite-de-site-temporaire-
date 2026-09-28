import { Copy, FolderOpen, MoreHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface VisitActionsMenuProps {
  visitTitle: string
  /** When set, an "Ouvrir" entry is shown first. */
  onOpen?: () => void
  onDuplicate: () => void
  onDelete: () => void
  className?: string
}

/** "…" menu with the actions available on a visit. */
export function VisitActionsMenu({
  visitTitle,
  onOpen,
  onDuplicate,
  onDelete,
  className,
}: VisitActionsMenuProps) {
  return (
    // Non-modal: lets the dialogs opened from an item take the focus cleanly.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-8', className)}
          aria-label={`Actions pour « ${visitTitle} »`}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {onOpen && (
          <DropdownMenuItem onSelect={onOpen}>
            <FolderOpen aria-hidden="true" />
            Ouvrir
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onDuplicate}>
          <Copy aria-hidden="true" />
          Dupliquer
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 aria-hidden="true" />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
