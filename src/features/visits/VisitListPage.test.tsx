import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_NOTICE_TEXT } from '@/features/visits/StorageNotice'
import { VisitListPage } from '@/features/visits/VisitListPage'
import { addPhoto } from '@/features/photos/photosRepo'
import { makePhotoInput } from '@/test/fixtures'
import { seedVisit } from '@/test/seed'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

async function seedThree() {
  const lyon = await seedVisit({
    title: 'Visite annuelle',
    siteName: 'Entrepôt Lyon Nord',
    date: '2026-03-01',
    updatedAt: '2026-09-20T10:00:00.000Z',
  })
  await seedVisit({
    title: 'Réunion travaux toiture',
    siteName: 'Bâtiment Marseille',
    kind: 'meeting',
    date: '2026-09-01',
    updatedAt: '2026-09-27T10:00:00.000Z',
  })
  await seedVisit({
    title: 'Contrôle quais',
    siteName: 'Arras Logistique',
    date: '2026-06-15',
    updatedAt: '2026-09-25T10:00:00.000Z',
  })
  await addPhoto(makePhotoInput(lyon.id))
}

const cardTitles = () =>
  within(screen.getByRole('list', { name: 'Visites' }))
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent)

describe('VisitListPage', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '#/')
  })

  it('shows skeletons while loading, then the empty state', async () => {
    render(<VisitListPage />)
    expect(screen.getByLabelText('Chargement des visites')).toBeInTheDocument()
    expect(await screen.findByText('Aucune visite pour le moment')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer ma première visite' })).toBeInTheDocument()
  })

  it('lists visits sorted by last modification, with details', async () => {
    await seedThree()
    render(<VisitListPage />)
    await screen.findByRole('list', { name: 'Visites' })
    // addPhoto touched "Visite annuelle": it is now the most recent.
    expect(cardTitles()).toEqual(['Visite annuelle', 'Réunion travaux toiture', 'Contrôle quais'])

    const card = screen.getByRole('link', { name: 'Visite annuelle' }).closest('article')!
    expect(within(card).getByText('Visite technique')).toBeInTheDocument()
    expect(within(card).getByText('Entrepôt Lyon Nord')).toBeInTheDocument()
    expect(within(card).getByText('1 mars 2026')).toBeInTheDocument()
    expect(within(card).getByText(/^Modifiée /)).toBeInTheDocument()
    expect(within(card).getByText('1 photo')).toBeInTheDocument()
    expect(within(card).getByText('0 repère')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Visite annuelle' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^#\/visits\/[\w-]+\/general$/) as string,
    )
  })

  it('sorts by visit date and by site', async () => {
    await seedThree()
    const user = userEvent.setup()
    render(<VisitListPage />)
    await screen.findByRole('list', { name: 'Visites' })
    const sort = screen.getByRole('combobox', { name: 'Trier les visites' })
    await user.selectOptions(sort, 'date')
    expect(cardTitles()).toEqual(['Réunion travaux toiture', 'Contrôle quais', 'Visite annuelle'])
    await user.selectOptions(sort, 'site')
    expect(cardTitles()).toEqual(['Contrôle quais', 'Réunion travaux toiture', 'Visite annuelle'])
  })

  it('searches on title and site, ignoring accents and case', async () => {
    await seedThree()
    const user = userEvent.setup()
    render(<VisitListPage />)
    const search = await screen.findByRole('searchbox', { name: /Rechercher/ })

    await user.type(search, 'entrepot')
    expect(cardTitles()).toEqual(['Visite annuelle'])
    await user.clear(search)
    await user.type(search, 'REUNION')
    expect(cardTitles()).toEqual(['Réunion travaux toiture'])
    await user.clear(search)
    await user.type(search, 'bâtiment toiture')
    expect(cardTitles()).toEqual(['Réunion travaux toiture'])
  })

  it('filters by type', async () => {
    await seedThree()
    const user = userEvent.setup()
    render(<VisitListPage />)
    await screen.findByRole('list', { name: 'Visites' })
    const group = screen.getByRole('radiogroup', { name: 'Filtrer par type' })
    await user.click(within(group).getByRole('radio', { name: 'Réunion' }))
    expect(cardTitles()).toEqual(['Réunion travaux toiture'])
    await user.click(within(group).getByRole('radio', { name: 'Visite technique' }))
    expect(cardTitles()).toEqual(['Visite annuelle', 'Contrôle quais'])
    await user.click(within(group).getByRole('radio', { name: 'Tous' }))
    expect(cardTitles()).toHaveLength(3)
  })

  it('"Effacer les filtres" resets search and type filter', async () => {
    await seedThree()
    const user = userEvent.setup()
    render(<VisitListPage />)
    const search = await screen.findByRole('searchbox', { name: /Rechercher/ })
    await user.click(screen.getByRole('radio', { name: 'Réunion' }))
    await user.type(search, 'introuvable')
    expect(screen.getByText('Aucune visite ne correspond à votre recherche')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Effacer les filtres' }))
    expect(search).toHaveValue('')
    expect(screen.getByRole('radio', { name: 'Tous' })).toBeChecked()
    expect(cardTitles()).toHaveLength(3)
  })

  it('deletes a visit from its card menu after confirmation', async () => {
    await seedThree()
    const user = userEvent.setup()
    render(<VisitListPage />)
    await screen.findByRole('list', { name: 'Visites' })

    await user.click(screen.getByRole('button', { name: 'Actions pour « Visite annuelle »' }))
    await user.click(screen.getByRole('menuitem', { name: 'Supprimer' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Supprimer la visite ?' })
    expect(await within(dialog).findByText(/ainsi que 1 photo/)).toBeInTheDocument()
    expect(
      within(dialog).getByText(/Cette action est définitive. Générez le rapport Word avant/),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText('Aucun rapport n’a été généré pour cette visite.'),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    await vi.waitFor(() => {
      expect(cardTitles()).toEqual(['Réunion travaux toiture', 'Contrôle quais'])
    })
    const { toast } = await import('sonner')
    expect(toast.success).toHaveBeenCalledWith('Visite supprimée')
  })

  it('duplicates a visit from its card menu and opens the copy', async () => {
    await seedThree()
    const user = userEvent.setup()
    render(<VisitListPage />)
    await screen.findByRole('list', { name: 'Visites' })

    await user.click(screen.getByRole('button', { name: 'Actions pour « Contrôle quais »' }))
    await user.click(screen.getByRole('menuitem', { name: 'Dupliquer' }))
    const dialog = screen.getByRole('dialog', { name: 'Dupliquer la visite' })
    expect(within(dialog).getByText('Participants (marqués absents)')).toBeInTheDocument()
    expect(within(dialog).getByText('Repères sur les plans')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Dupliquer' }))
    await vi.waitFor(() => {
      expect(window.location.hash).toMatch(/^#\/visits\/[\w-]+\/general$/)
    })
    expect(await screen.findByRole('link', { name: 'Copie — Contrôle quais' })).toBeInTheDocument()
  })

  it('shows an explicit message when storage is unavailable', async () => {
    const repo = await import('@/features/visits/visitsRepo')
    const { StorageUnavailableError } = await import('@/lib/errors')
    vi.spyOn(repo, 'listVisitSummaries').mockRejectedValue(new StorageUnavailableError())
    render(<VisitListPage />)
    expect(await screen.findByText('Impossible d’afficher les visites')).toBeInTheDocument()
    expect(screen.getByText(/stockage local du navigateur est indisponible/)).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})

describe('VisitListPage — storage notice', () => {
  it('explains where the visits are stored, and stays closed once closed', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<VisitListPage />)
    const notice = await screen.findByRole('note', { name: 'Où sont enregistrées les visites' })
    expect(notice).toHaveTextContent(STORAGE_NOTICE_TEXT)
    await user.click(within(notice).getByRole('button', { name: 'Fermer ce message' }))
    await vi.waitFor(() => {
      expect(screen.queryByRole('note')).not.toBeInTheDocument()
    })
    unmount()
    render(<VisitListPage />)
    await screen.findByText('Aucune visite pour le moment')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
