/**
 * shadcn/ui-compatible AlertDialog on the native `<dialog>` element (see
 * dialog.tsx). `role="alertdialog"`, no backdrop dismissal, no close icon.
 */
import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ModalContent,
  useDialogContext,
  type DialogProps,
} from '@/components/ui/dialog'

function AlertDialog(props: DialogProps) {
  return <Dialog {...props} />
}

function AlertDialogContent(props: Omit<React.ComponentProps<'dialog'>, 'open'>) {
  return (
    <ModalContent
      role="alertdialog"
      dismissOnBackdrop={false}
      component="AlertDialogContent"
      {...props}
    />
  )
}

/** Secondary button closing the dialog. */
function AlertDialogCancel({ onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { onOpenChange } = useDialogContext('AlertDialogCancel')
  return (
    <Button
      variant="outline"
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) onOpenChange(false)
      }}
      {...props}
    />
  )
}

/** Main button: runs `onClick`, then closes unless `event.preventDefault()` was called. */
function AlertDialogAction({ onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { onOpenChange } = useDialogContext('AlertDialogAction')
  return (
    <Button
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) onOpenChange(false)
      }}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  DialogDescription as AlertDialogDescription,
  DialogFooter as AlertDialogFooter,
  DialogHeader as AlertDialogHeader,
  DialogTitle as AlertDialogTitle,
}
