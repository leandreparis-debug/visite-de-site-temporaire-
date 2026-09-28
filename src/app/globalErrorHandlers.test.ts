import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { installGlobalErrorHandlers } from '@/app/globalErrorHandlers'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

describe('installGlobalErrorHandlers', () => {
  let uninstall: (() => void) | undefined

  afterEach(() => {
    uninstall?.()
    vi.restoreAllMocks()
    vi.mocked(toast.error).mockClear()
  })

  it('shows a French toast on uncaught errors and unhandled rejections', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    uninstall = installGlobalErrorHandlers(window)

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('boum'), message: 'boum' }))
    expect(toast.error).toHaveBeenCalledWith('Une erreur inattendue est survenue', {
      description: 'boum',
    })

    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent
    Object.defineProperty(rejection, 'reason', { value: new Error('refus') })
    window.dispatchEvent(rejection)
    expect(toast.error).toHaveBeenCalledWith('Une opération a échoué', { description: 'refus' })
  })

  it('removes its listeners on cleanup', () => {
    installGlobalErrorHandlers(window)()
    window.dispatchEvent(new ErrorEvent('error', { message: 'ignored' }))
    expect(toast.error).not.toHaveBeenCalled()
  })
})
