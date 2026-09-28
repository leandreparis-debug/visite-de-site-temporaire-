import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { WAREHOUSE_ZONES } from '@/features/notes/templates'
import { getVisit } from '@/features/visits/visitsRepo'
import { renderEditor } from '@/test/renderEditor'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
  Toaster: () => null,
}))

const sectionTitles = () =>
  screen
    .getAllByRole('combobox', { name: /^Titre de la section/ })
    .map((input) => (input as HTMLInputElement).value)

const sections = [
  { id: 's1', title: 'Toiture', content: 'Fuite au-dessus du quai 3\n- chéneau bouché', order: 0 },
  { id: 's2', title: 'Quais', content: '', order: 1 },
]

describe('NotesTab — sections', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '#/')
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('inserts the technical visit template, then reports it as already present', async () => {
    const { user } = await renderEditor('notes')
    await user.click(screen.getByRole('button', { name: 'Insérer la trame visite technique' }))
    expect(sectionTitles()).toEqual([...WAREHOUSE_ZONES])
    expect(toast.success).toHaveBeenCalledWith(`${WAREHOUSE_ZONES.length}\u00a0sections ajoutées`)

    await user.click(screen.getByRole('button', { name: /Insérer une trame/ }))
    const items = screen.getAllByRole('menuitem').map((item) => item.textContent)
    expect(items).toEqual(['Trame visite technique', 'Trame réunion'])
    await user.click(screen.getByRole('menuitem', { name: 'Trame visite technique' }))
    expect(toast.info).toHaveBeenCalledWith('Toutes les sections de la trame sont déjà présentes')
    expect(sectionTitles()).toHaveLength(WAREHOUSE_ZONES.length)

    await user.click(screen.getByRole('button', { name: /Insérer une trame/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Trame réunion' }))
    expect(sectionTitles().slice(-4)).toEqual([
      'Ordre du jour',
      'Points abordés',
      'Décisions',
      'Divers',
    ])
  })

  it('adds a section and focuses its title', async () => {
    const { user } = await renderEditor('notes', { kind: 'meeting' })
    expect(screen.getByRole('button', { name: 'Insérer la trame réunion' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ajouter une section' }))
    const title = screen.getByRole('combobox', { name: 'Titre de la section 1' })
    expect(title).toHaveFocus()
    await user.keyboard('Sprinklage et RIA')
    await user.tab()
    await user.keyboard('- tête cassée cellule 2')
    expect(screen.getByRole('textbox', { name: 'Notes : Sprinklage et RIA' })).toHaveValue(
      '- tête cassée cellule 2',
    )
  })

  it('asks for confirmation before deleting a non-empty section, not for an empty one', async () => {
    const { visit, user } = await renderEditor('notes', { noteSections: sections })
    await user.click(screen.getByRole('button', { name: 'Supprimer Quais' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(sectionTitles()).toEqual(['Toiture'])

    await user.click(screen.getByRole('button', { name: 'Supprimer Toiture' }))
    const dialog = screen.getByRole('alertdialog', {
      name: 'Supprimer la section “Toiture” et son contenu ?',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(sectionTitles()).toEqual(['Toiture'])

    await user.click(screen.getByRole('button', { name: 'Supprimer Toiture' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }),
    )
    expect(screen.queryByRole('combobox', { name: /^Titre de la section/ })).not.toBeInTheDocument()
    await vi.waitFor(
      async () => {
        expect((await getVisit(visit.id)).noteSections).toEqual([])
      },
      { timeout: 3000 },
    )
  })

  it('collapses and expands all sections, with a preview', async () => {
    const { user } = await renderEditor('notes', { noteSections: sections })
    expect(screen.getAllByRole('textbox', { name: /^Notes :/ })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Tout replier' }))
    expect(screen.queryAllByRole('textbox', { name: /^Notes :/ })).toHaveLength(0)
    expect(screen.getByText('Fuite au-dessus du quai 3')).toBeInTheDocument()
    expect(screen.getByText('· 42 caractères')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Déplier Toiture' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )

    await user.click(screen.getByRole('button', { name: 'Déplier Toiture' }))
    expect(screen.getAllByRole('textbox', { name: /^Notes :/ })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Tout déplier' }))
    expect(screen.getAllByRole('textbox', { name: /^Notes :/ })).toHaveLength(2)
  })

  it('moves sections', async () => {
    const { user } = await renderEditor('notes', { noteSections: sections })
    await user.click(screen.getByRole('button', { name: 'Descendre Toiture' }))
    expect(sectionTitles()).toEqual(['Quais', 'Toiture'])
  })
})

describe('NotesTab — attention points', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '#/')
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('adds a point with the quick entry row (Enter)', async () => {
    const { visit, user } = await renderEditor('notes')
    const text = screen.getByLabelText('Point d’attention ou action')
    await user.type(text, 'Reprendre le chéneau')
    await user.selectOptions(screen.getByLabelText('Priorité', { exact: true }), 'high')
    await user.type(screen.getByLabelText('Responsable', { exact: true }), 'Couvreur')
    await user.click(text)
    await user.keyboard('{Enter}')

    const row = screen.getByRole('textbox', { name: 'Texte du point d’attention' }).closest('tr')!
    expect(within(row).getByRole('textbox', { name: 'Texte du point d’attention' })).toHaveValue(
      'Reprendre le chéneau',
    )
    expect(within(row).getByRole('combobox', { name: /^Priorité/ })).toHaveValue('high')
    expect(text).toHaveValue('')
    expect(text).toHaveFocus()
    expect(screen.getByLabelText('Priorité', { exact: true })).toHaveValue('medium')
    expect(screen.getByText('1 ouvert')).toBeInTheDocument()
    await vi.waitFor(
      async () => {
        expect((await getVisit(visit.id)).attentionPoints).toEqual([
          expect.objectContaining({
            text: 'Reprendre le chéneau',
            priority: 'high',
            owner: 'Couvreur',
            status: 'open',
          }),
        ])
      },
      { timeout: 3000 },
    )
  })

  it('shows "En retard" against a fixed today, sorted, and hides done points', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 28, 12))
    const { user } = await renderEditor('notes', {
      attentionPoints: [
        { id: 'a', text: 'Terminé', priority: 'high', status: 'done', dueDate: '2026-01-01' },
        { id: 'b', text: 'Échu hier', priority: 'low', status: 'open', dueDate: '2026-09-27' },
        {
          id: 'c',
          text: 'Échu aujourd’hui',
          priority: 'high',
          status: 'in_progress',
          dueDate: '2026-09-28',
        },
      ],
    })
    const texts = () =>
      screen
        .getAllByRole('textbox', { name: 'Texte du point d’attention' })
        .map((i) => (i as HTMLInputElement).value)
    expect(texts()).toEqual(['Échu aujourd’hui', 'Échu hier', 'Terminé'])
    expect(screen.getAllByText('En retard')).toHaveLength(1)
    const lateRow = screen.getByDisplayValue('Échu hier').closest('tr')!
    expect(within(lateRow).getByText('En retard')).toBeInTheDocument()
    expect(screen.getByText('2 ouverts dont 1 en retard')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Masquer les points terminés'))
    expect(texts()).toEqual(['Échu aujourd’hui', 'Échu hier'])

    await user.selectOptions(within(lateRow).getByRole('combobox', { name: /^Statut/ }), 'done')
    expect(texts()).toEqual(['Échu aujourd’hui'])
    expect(screen.queryByText('En retard')).not.toBeInTheDocument()
  })

  it('deletes a point with an "Annuler" toast', async () => {
    const { user } = await renderEditor('notes', {
      attentionPoints: [{ id: 'a', text: 'Point A', priority: 'medium', status: 'open' }],
    })
    await user.click(screen.getByRole('button', { name: 'Supprimer le point : Point A' }))
    expect(screen.queryByDisplayValue('Point A')).not.toBeInTheDocument()
    expect(toast).toHaveBeenCalledWith(
      'Point d’attention supprimé',
      expect.objectContaining({ duration: 5000 }),
    )
  })
})
