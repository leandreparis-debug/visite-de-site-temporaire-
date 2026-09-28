/**
 * shadcn/ui-compatible Dialog built on the native `<dialog>` element.
 *
 * Why not Radix: the app ships as a single HTML file with a size budget, and
 * Chrome/Edge natively provide what Radix re-implements for dialogs (top
 * layer, inert background = focus containment, Escape, focus restoration).
 * Same API and styling as shadcn: Dialog, DialogContent, DialogHeader,
 * DialogFooter, DialogTitle, DialogDescription, DialogClose.
 */
import { XIcon } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

interface DialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleId: string
  descriptionId: string
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

export function useDialogContext(component: string): DialogContextValue {
  const context = React.useContext(DialogContext)
  if (!context) throw new Error(`<${component}> must be used inside <Dialog>`)
  return context
}

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children?: React.ReactNode
}

/** Controlled dialog root (state lives in the parent). */
function Dialog({ open, onOpenChange, children }: DialogProps) {
  const titleId = React.useId()
  const descriptionId = React.useId()
  const value = React.useMemo(
    () => ({ open, onOpenChange, titleId, descriptionId }),
    [open, onOpenChange, titleId, descriptionId],
  )
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
}

export interface ModalContentProps extends Omit<React.ComponentProps<'dialog'>, 'open'> {
  /** Close when clicking on the backdrop (not for alert dialogs). */
  dismissOnBackdrop?: boolean
  component?: string
}

/**
 * Native modal `<dialog>` synced with the context `open` state. Children are
 * only rendered while open (fresh state on each opening).
 */
export function ModalContent({
  className,
  children,
  dismissOnBackdrop = true,
  component = 'DialogContent',
  ...props
}: ModalContentProps) {
  const { open, onOpenChange, titleId, descriptionId } = useDialogContext(component)
  const ref = React.useRef<HTMLDialogElement>(null)

  React.useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-slot="dialog-content"
      data-state={open ? 'open' : 'closed'}
      // Escape: let React state decide (the parent may refuse while busy).
      onCancel={(event) => {
        event.preventDefault()
        onOpenChange(false)
      }}
      onClick={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) onOpenChange(false)
      }}
      className={cn(
        'm-auto w-full max-w-[calc(100%-2rem)] rounded-lg border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/50 sm:max-w-lg',
        'open:animate-in open:fade-in-0 open:zoom-in-95 backdrop:open:animate-in backdrop:open:fade-in-0',
        className,
      )}
      {...props}
    >
      {open && <div className="relative grid gap-4 p-6">{children}</div>}
    </dialog>
  )
}

function DialogContent({
  showCloseButton = true,
  children,
  ...props
}: Omit<ModalContentProps, 'component'> & { showCloseButton?: boolean }) {
  return (
    <ModalContent {...props}>
      {children}
      {showCloseButton && <DialogCloseButton />}
    </ModalContent>
  )
}

function DialogCloseButton() {
  const { onOpenChange } = useDialogContext('DialogContent')
  return (
    <button
      type="button"
      data-slot="dialog-close"
      onClick={() => {
        onOpenChange(false)
      }}
      className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
    >
      <XIcon aria-hidden="true" />
      <span className="sr-only">Fermer</span>
    </button>
  )
}

/** Button closing the dialog (e.g. "Annuler"). */
function DialogClose({ onClick, ...props }: React.ComponentProps<'button'>) {
  const { onOpenChange } = useDialogContext('DialogClose')
  return (
    <button
      type="button"
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) onOpenChange(false)
      }}
      {...props}
    />
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  const { titleId } = useDialogContext('DialogTitle')
  return (
    <h2
      id={titleId}
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<'div'>) {
  const { descriptionId } = useDialogContext('DialogDescription')
  return (
    <div
      id={descriptionId}
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
}
