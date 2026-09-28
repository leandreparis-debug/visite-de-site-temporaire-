import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateVisitDialog } from '@/features/visits/CreateVisitDialog'
import { getVisit } from '@/features/visits/visitsRepo'
import { todayIso } from '@/lib/dates'
import { db } from '@/lib/db/db'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

function renderDialog() {
  const onOpenChange = vi.fn()
  render(<CreateVisitDialog open onOpenChange={onOpenChange} />)
  const dialog = screen.getByRole('dialog', { name: 'Nouvelle visite' })
  return { dialog, onOpenChange }
}

describe('CreateVisitDialog', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '#/')
  })

  it('has defaults: technical visit, today', () => {
    const { dialog } = renderDialog()
    expect(within(dialog).getByRole('radio', { name: 'Visite technique' })).toBeChecked()
    expect(within(dialog).getByLabelText(/^Date/)).toHaveValue(todayIso())
  })

  it('shows French errors under the required fields and does not create anything', async () => {
    const user = userEvent.setup()
    const { dialog, onOpenChange } = renderDialog()
    await user.click(within(dialog).getByRole('button', { name: 'Créer la visite' }))

    expect(within(dialog).getByText('Le titre est obligatoire')).toBeInTheDocument()
    expect(within(dialog).getByText('Le nom du site est obligatoire')).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^Titre/)).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialog).getByLabelText(/^Titre/)).toHaveFocus()
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(await db.visits.count()).toBe(0)

    await user.clear(within(dialog).getByLabelText(/^Date/))
    await user.type(within(dialog).getByLabelText(/^Titre/), '   ')
    await user.click(within(dialog).getByRole('button', { name: 'Créer la visite' }))
    expect(within(dialog).getByText('La date est obligatoire')).toBeInTheDocument()
    expect(within(dialog).getByText('Le titre est obligatoire')).toBeInTheDocument()
  })

  it('creates the visit on Enter, closes, navigates to it and confirms', async () => {
    const user = userEvent.setup()
    const { dialog, onOpenChange } = renderDialog()
    await user.click(within(dialog).getByRole('radio', { name: 'Réunion' }))
    await user.type(within(dialog).getByLabelText(/^Titre/), 'Réunion de chantier')
    await user.type(within(dialog).getByLabelText(/^Nom du site/), 'Entrepôt Lyon{Enter}')

    await vi.waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
    const match = /^#\/visits\/([\w-]+)\/general$/.exec(window.location.hash)
    expect(match).not.toBeNull()
    const visit = await getVisit(match?.[1] ?? '')
    expect(visit).toMatchObject({
      kind: 'meeting',
      title: 'Réunion de chantier',
      date: todayIso(),
      site: { name: 'Entrepôt Lyon' },
    })
    const { toast } = await import('sonner')
    expect(toast.success).toHaveBeenCalledWith('Visite créée')
  })
})
