import { act, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { getVisit } from '@/features/visits/visitsRepo'
import { makeFullVisit } from '@/test/fixtures'
import { renderEditor } from '@/test/renderEditor'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
  Toaster: () => null,
}))

const nameInputs = () =>
  screen
    .getAllByRole('combobox', { name: /^Nom du participant/ })
    .map((input) => (input as HTMLInputElement).value)

describe('GeneralTab', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '#/')
    vi.mocked(toast).mockClear()
  })

  it('adds participants with Enter, clears the entry row and focuses Nom again', async () => {
    const { visit, user } = await renderEditor('general')
    expect(
      screen.getByText('Aucun participant. Ajoutez les personnes présentes à la visite.'),
    ).toBeInTheDocument()
    const name = screen.getByLabelText('Nom', { exact: true })

    await user.type(name, '   {Enter}')
    expect(screen.queryAllByRole('combobox', { name: /^Nom du participant/ })).toHaveLength(0)

    await user.clear(name)
    await user.type(name, 'Jean Dupont')
    await user.tab()
    await user.keyboard('Couvreur')
    await user.tab()
    await user.keyboard('Toitures SA{Enter}')

    expect(nameInputs()).toEqual(['Jean Dupont'])
    expect(screen.getByRole('combobox', { name: 'Fonction de Jean Dupont' })).toHaveValue(
      'Couvreur',
    )
    expect(name).toHaveValue('')
    expect(screen.getByLabelText('Fonction', { exact: true })).toHaveValue('')
    expect(name).toHaveFocus()

    await user.keyboard('Marie Curie{Enter}')
    expect(nameInputs()).toEqual(['Jean Dupont', 'Marie Curie'])
    expect(screen.getByRole('checkbox', { name: 'Présent : Marie Curie' })).toBeChecked()

    await vi.waitFor(
      async () => {
        expect((await getVisit(visit.id)).participants.map((p) => p.name)).toEqual([
          'Jean Dupont',
          'Marie Curie',
        ])
      },
      { timeout: 3000 },
    )
  })

  it('updates the presence counter with the checkbox', async () => {
    const { participants } = makeFullVisit()
    const { user } = await renderEditor('general', { participants })
    expect(screen.getByText('1 présent · 1 absent')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Présent : Paul Durand' }))
    expect(screen.getByText('2 présents · 0 absent')).toBeInTheDocument()
  })

  it('moves participants and restores a deleted one at the same position with "Annuler"', async () => {
    const { participants } = makeFullVisit()
    const { user } = await renderEditor('general', { participants })
    expect(screen.getByRole('button', { name: 'Monter Jeanne Martin' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Descendre Jeanne Martin' }))
    expect(nameInputs()).toEqual(['Paul Durand', 'Jeanne Martin'])
    await user.click(screen.getByRole('button', { name: 'Monter Jeanne Martin' }))
    expect(nameInputs()).toEqual(['Jeanne Martin', 'Paul Durand'])

    await user.click(screen.getByRole('button', { name: 'Supprimer Jeanne Martin' }))
    expect(nameInputs()).toEqual(['Paul Durand'])
    expect(toast).toHaveBeenCalledWith(
      'Participant supprimé',
      expect.objectContaining({
        duration: 5000,
        action: expect.objectContaining({ label: 'Annuler' }) as unknown,
      }),
    )
    const options = vi.mocked(toast).mock.calls[0]?.[1] as unknown as {
      action: { onClick: () => void }
    }
    act(() => {
      options.action.onClick()
    })
    expect(nameInputs()).toEqual(['Jeanne Martin', 'Paul Durand'])
  })

  it('shows an error when the site name is emptied and restores it on blur', async () => {
    const { visit, user } = await renderEditor('general')
    const siteCard = screen.getByRole('region', { name: 'Site' })
    const siteName = within(siteCard).getByLabelText(/^Nom du site/)
    await user.clear(siteName)
    expect(within(siteCard).getByRole('alert')).toHaveTextContent('Le nom du site est obligatoire')
    expect(siteName).toHaveAttribute('aria-invalid', 'true')

    // Other fields keep saving meanwhile.
    await user.click(within(siteCard).getByLabelText('Ville'))
    expect(siteName).toHaveValue('Entrepôt Lyon')
    expect(within(siteCard).queryByRole('alert')).not.toBeInTheDocument()
    await user.keyboard('Lyon')
    await vi.waitFor(
      async () => {
        expect((await getVisit(visit.id)).site).toEqual({ name: 'Entrepôt Lyon', city: 'Lyon' })
      },
      { timeout: 3000 },
    )
  })

  it('keeps a trailing space while typing (no cursor jump) and saves trimmed values', async () => {
    const { visit, user } = await renderEditor('general')
    const author = screen.getByLabelText('Rédacteur')
    await user.type(author, 'Arnaud ')
    expect(author).toHaveValue('Arnaud ')
    await user.type(author, 'Montigny ')
    await user.tab()
    expect(author).toHaveValue('Arnaud Montigny')
    await vi.waitFor(
      async () => {
        expect((await getVisit(visit.id)).author).toBe('Arnaud Montigny')
      },
      { timeout: 3000 },
    )
  })

  it('edits type, date, time and purpose', async () => {
    const { visit, user } = await renderEditor('general')
    await user.click(screen.getByRole('radio', { name: 'Réunion' }))
    await user.type(screen.getByLabelText('Heure de début'), '09:30')
    await user.type(screen.getByLabelText('Objet'), 'Suivi des infiltrations')
    await vi.waitFor(
      async () => {
        expect(await getVisit(visit.id)).toMatchObject({
          kind: 'meeting',
          startTime: '09:30',
          purpose: 'Suivi des infiltrations',
        })
      },
      { timeout: 3000 },
    )
  })
})
