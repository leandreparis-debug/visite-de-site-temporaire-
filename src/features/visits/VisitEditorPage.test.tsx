import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/app/App'
import { getVisit } from '@/features/visits/visitsRepo'
import { seedVisit } from '@/test/seed'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() }, Toaster: () => null }))

async function openEditor(tab = 'general') {
  const visit = await seedVisit({
    title: 'Visite Lyon',
    siteName: 'Entrepôt Lyon',
    updatedAt: '2026-09-20T10:00:00.000Z',
  })
  window.history.replaceState(null, '', `#/visits/${visit.id}/${tab}`)
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { level: 2, name: 'Visite Lyon' })
  return { visit, user }
}

describe('VisitEditorPage', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '#/')
  })

  it('shows the visit header', async () => {
    await openEditor()
    expect(screen.getByRole('link', { name: 'Visites' })).toHaveAttribute('href', '#/')
    const header = screen.getByRole('heading', { level: 2, name: 'Visite Lyon' }).closest('header')!
    expect(within(header).getByText('Entrepôt Lyon')).toBeInTheDocument()
    expect(within(header).getByText('28 septembre 2026')).toBeInTheDocument()
    expect(within(header).getByText('Visite technique')).toBeInTheDocument()
  })

  it('edits the title inline and saves it', async () => {
    const { visit, user } = await openEditor()
    await user.click(screen.getByRole('button', { name: 'Visite Lyon' }))
    const input = screen.getByRole('textbox', { name: 'Titre de la visite' })
    expect(input).toHaveFocus()
    await user.clear(input)
    await user.type(input, 'Visite Lyon — bilan{Enter}')

    expect(
      screen.getByRole('heading', { level: 2, name: 'Visite Lyon — bilan' }),
    ).toBeInTheDocument()
    await vi.waitFor(
      async () => {
        expect((await getVisit(visit.id)).title).toBe('Visite Lyon — bilan')
      },
      { timeout: 3000 },
    )
    expect(await screen.findByText('Enregistré')).toBeInTheDocument()
  })

  it('commits the title on blur', async () => {
    const { user } = await openEditor()
    await user.click(screen.getByRole('button', { name: 'Visite Lyon' }))
    await user.type(screen.getByRole('textbox', { name: 'Titre de la visite' }), ' bis')
    await user.tab()
    expect(screen.getByRole('heading', { level: 2, name: 'Visite Lyon bis' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      /Modifications en cours|Enregistrement|Enregistré/,
    )
  })

  it('Escape cancels the edit', async () => {
    const { visit, user } = await openEditor()
    await user.click(screen.getByRole('button', { name: 'Visite Lyon' }))
    await user.type(screen.getByRole('textbox', { name: 'Titre de la visite' }), ' modifié{Escape}')
    expect(screen.getByRole('heading', { level: 2, name: 'Visite Lyon' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Titre de la visite' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('')
    expect((await getVisit(visit.id)).title).toBe('Visite Lyon')
  })

  it('refuses an empty title', async () => {
    const { visit, user } = await openEditor()
    await user.click(screen.getByRole('button', { name: 'Visite Lyon' }))
    const input = screen.getByRole('textbox', { name: 'Titre de la visite' })
    await user.clear(input)
    await user.type(input, '   {Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('Le titre est obligatoire')
    expect(input).toBeInTheDocument()

    // Leaving the field restores the previous title.
    await user.tab()
    expect(screen.getByRole('heading', { level: 2, name: 'Visite Lyon' })).toBeInTheDocument()
    expect((await getVisit(visit.id)).title).toBe('Visite Lyon')
  })

  it('shows "Visite introuvable" for an unknown id, with a way back', async () => {
    window.history.replaceState(null, '', '#/visits/does-not-exist/general')
    render(<App />)
    expect(await screen.findByText('Visite introuvable')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour à la liste des visites' })).toHaveAttribute(
      'href',
      '#/',
    )
  })

  it('keeps the tabs in sync with the hash', async () => {
    const { visit, user } = await openEditor('photos')
    const tablist = screen.getByRole('tablist')
    expect(within(tablist).getByRole('tab', { name: /^Photos/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      await within(screen.getByRole('tabpanel', { name: /^Photos/ })).findByText(
        'Glissez vos photos ici ou cliquez sur Ajouter',
      ),
    ).toBeInTheDocument()

    await user.click(within(tablist).getByRole('tab', { name: 'DO & assurances' }))
    expect(window.location.hash).toBe(`#/visits/${visit.id}/do-insurance`)
    await vi.waitFor(() => {
      expect(within(tablist).getByRole('tab', { name: 'DO & assurances' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
    })

    // Keyboard: → moves to the next tab.
    await user.keyboard('{ArrowRight}')
    expect(window.location.hash).toBe(`#/visits/${visit.id}/projects-costs`)

    // Hash changed from outside (back button, link…).
    window.location.hash = `#/visits/${visit.id}/report`
    await vi.waitFor(() => {
      expect(within(tablist).getByRole('tab', { name: 'Rapport' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
    })
  })

  it('redirects an unknown tab to "general"', async () => {
    const { visit } = await openEditor('nope')
    await vi.waitFor(() => {
      expect(window.location.hash).toBe(`#/visits/${visit.id}/general`)
    })
    expect(screen.getByRole('tab', { name: 'Informations générales' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('deletes the visit from the editor and goes back to the list', async () => {
    const { visit, user } = await openEditor()
    await user.click(screen.getByRole('button', { name: 'Actions pour « Visite Lyon »' }))
    await user.click(screen.getByRole('menuitem', { name: 'Supprimer' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }),
    )
    await vi.waitFor(() => {
      expect(window.location.hash).toBe('#/')
    })
    await expect(getVisit(visit.id)).rejects.toThrow()
    expect(await screen.findByText('Aucune visite pour le moment')).toBeInTheDocument()
  })
})
