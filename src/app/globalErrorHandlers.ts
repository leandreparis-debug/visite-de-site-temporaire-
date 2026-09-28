import { toast } from 'sonner'
import { AppError, toAppError } from '@/lib/errors'

function describe(reason: unknown): string {
  const appError = toAppError(reason)
  if (appError instanceof AppError) return appError.userMessage
  if (reason instanceof Error) return reason.message
  if (typeof reason === 'string') return reason
  return 'Détail indisponible.'
}

/**
 * Listens to uncaught errors (`window.onerror`) and unhandled promise
 * rejections, logs them, and shows a French error toast.
 * Returns a cleanup function removing the listeners.
 */
export function installGlobalErrorHandlers(target: Window = window): () => void {
  const onError = (event: ErrorEvent): void => {
    console.error('[global] Uncaught error:', event.error ?? event.message)
    toast.error('Une erreur inattendue est survenue', {
      description: describe(event.error ?? event.message),
    })
  }
  const onRejection = (event: PromiseRejectionEvent): void => {
    console.error('[global] Unhandled promise rejection:', event.reason)
    toast.error('Une opération a échoué', { description: describe(event.reason) })
  }

  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
  }
}
