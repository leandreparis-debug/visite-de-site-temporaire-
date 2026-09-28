import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '@/app/ErrorBoundary'

function Boom(): never {
  throw new Error('Explosion de test')
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React and the boundary log the caught error; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>Contenu normal</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Contenu normal')).toBeInTheDocument()
  })

  it('shows the French fallback with the error message and a reload button', async () => {
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ reload } as unknown as Location)

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument()
    expect(screen.getByText('Explosion de test')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Recharger l’outil' })
    expect(button).toBeInTheDocument()
    expect(console.error).toHaveBeenCalled()

    await userEvent.click(button)
    expect(reload).toHaveBeenCalledOnce()
  })
})
