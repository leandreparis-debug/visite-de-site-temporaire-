import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addPhoto, listPhotos } from '@/features/photos/photosRepo'
import { updateVisit } from '@/features/visits/visitsRepo'
import { makePhotoInput } from '@/test/fixtures'
import { renderEditor } from '@/test/renderEditor'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
  Toaster: () => null,
}))

/** Opens the photos tab of a visit holding 3 photos (A general, B defect, C general). */
async function setup() {
  const view = await renderEditor('general')
  const ids: string[] = []
  for (const [caption, category] of [
    ['A', 'general'],
    ['B', 'defect'],
    ['C', 'general'],
  ] as const) {
    ids.push((await addPhoto(makePhotoInput(view.visit.id, { caption, category }))).id)
  }
  // Pin n°12 on photo B.
  await updateVisit(view.visit.id, (v) => ({
    ...v,
    nextPinNumber: 13,
    pins: [{ id: 'pin', planId: 'plan', photoId: ids[1]!, x: 0.5, y: 0.5, number: 12 }],
  }))
  await view.user.click(screen.getByRole('tab', { name: /^Photos/ }))
  await screen.findByRole('list', { name: 'Photos' })
  await vi.waitFor(() => {
    expect(shownAlts()).toHaveLength(3)
  })
  return { ...view, ids }
}

const shownAlts = () =>
  within(screen.getByRole('list', { name: 'Photos' }))
    .getAllByRole('img')
    .map((img) => img.getAttribute('alt'))

describe('PhotosTab', () => {
  beforeEach(() => {
    let n = 0
    Object.assign(URL, {
      createObjectURL: vi.fn(() => `blob:test/${++n}`),
      revokeObjectURL: vi.fn(),
    })
  })
  afterEach(() => {
    window.history.replaceState(null, '', '#/')
    vi.clearAllMocks()
  })

  it('shows the empty drop zone and the count in the tab', async () => {
    const { user } = await renderEditor('photos')
    expect(
      await screen.findByText('Glissez vos photos ici ou cliquez sur Ajouter'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('JPEG, PNG, WebP — les photos sont automatiquement allégées'),
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Photos (0)' })).toBeInTheDocument()
    expect(user).toBeDefined()
  })

  it('lists photos with number, pin badge and count; filters by category', async () => {
    const { user } = await setup()
    expect(screen.getByRole('tab', { name: 'Photos (3)' })).toBeInTheDocument()
    expect(shownAlts()).toEqual(['A', 'B', 'C'])
    expect(screen.getByText('Plan n°12')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Désordre (1)' }))
    expect(shownAlts()).toEqual(['B'])
    await user.click(screen.getByRole('button', { name: 'Toutes (3)' }))
    expect(shownAlts()).toEqual(['A', 'B', 'C'])
  })

  it('reorders with Alt+→ on a focused photo', async () => {
    const { user, visit } = await setup()
    screen.getByRole('button', { name: 'Ouvrir : A' }).focus()
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}')
    await vi.waitFor(async () => {
      expect((await listPhotos(visit.id)).map((p) => p.caption)).toEqual(['B', 'A', 'C'])
    })
    await vi.waitFor(() => {
      expect(shownAlts()).toEqual(['B', 'A', 'C'])
    })
    expect(screen.getByRole('button', { name: 'Ouvrir : A' })).toHaveFocus()
  })

  it('shows the bulk toolbar on selection; Ctrl+A selects all', async () => {
    const { user } = await setup()
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Sélectionner la photo 1' }))
    const toolbar = screen.getByRole('toolbar', { name: 'Actions sur la sélection' })
    expect(toolbar).toHaveTextContent('1 sélectionnée')
    screen.getByRole('button', { name: 'Ouvrir : A' }).focus()
    await user.keyboard('{Control>}a{/Control}')
    expect(toolbar).toHaveTextContent('3 sélectionnées')
    await user.click(within(toolbar).getByRole('button', { name: 'Tout désélectionner' }))
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })

  it('names the pins removed when deleting selected photos', async () => {
    const { user, visit } = await setup()
    await user.click(screen.getByRole('checkbox', { name: 'Sélectionner la photo 1' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sélectionner la photo 2' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Supprimer 2 photos ?' })
    expect(dialog).toHaveTextContent('1 repère sera retiré du plan (n°12).')
    expect(dialog).toHaveTextContent('Les numéros de repère ne sont jamais réattribués')
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    await vi.waitFor(async () => {
      expect((await listPhotos(visit.id)).map((p) => p.caption)).toEqual(['C'])
    })
    await vi.waitFor(() => {
      expect(shownAlts()).toEqual(['C'])
    })
  })

  it('saves the caption 600 ms after typing', async () => {
    const { user, visit } = await setup()
    const caption = screen.getByRole('textbox', { name: 'Légende de la photo 3' })
    await user.clear(caption)
    await user.type(caption, 'Chéneau nord')
    expect((await listPhotos(visit.id))[2]?.caption).toBe('C')
    await act(() => new Promise((resolve) => setTimeout(resolve, 700)))
    expect((await listPhotos(visit.id))[2]?.caption).toBe('Chéneau nord')
    expect(caption).toHaveValue('Chéneau nord')
  })
})
