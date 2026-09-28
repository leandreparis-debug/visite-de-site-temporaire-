import { act, screen, within } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getVisit } from '@/features/visits/visitsRepo'
import type * as DownloadModule from '@/lib/download'
import { downloadBlob } from '@/lib/download'
import { renderEditor } from '@/test/renderEditor'
import type { Cost, Project } from '@/types/visit'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
  Toaster: () => null,
}))
vi.mock('@/lib/download', async (importOriginal) => ({
  ...(await importOriginal<typeof DownloadModule>()),
  downloadBlob: vi.fn(),
}))

const PROJECTS: Project[] = [
  { id: 'p-roof', name: 'Réfection toiture', status: 'planned' },
  { id: 'p-docks', name: 'Mise aux normes quais', status: 'in_progress' },
]
const COSTS: Cost[] = [
  {
    id: 'c1',
    label: 'Devis étanchéité',
    category: 'works',
    projectId: 'p-roof',
    amountHtCents: 1_250_050,
    vatRateBp: 2000,
    status: 'quote',
    supplier: 'Étanchéité SA',
  },
  {
    id: 'c2',
    label: 'Diagnostic',
    category: 'study',
    projectId: 'p-roof',
    amountHtCents: 185_000,
    vatRateBp: 1000,
    status: 'invoiced',
  },
  {
    id: 'c3',
    label: 'Niveleurs',
    category: 'works',
    projectId: 'p-docks',
    amountHtCents: 3_200_000,
    vatRateBp: 2000,
    status: 'committed',
  },
  {
    id: 'c4',
    label: 'Nettoyage',
    category: 'maintenance',
    amountHtCents: 5,
    vatRateBp: 550,
    status: 'estimate',
  },
]

/** Text with every kind of space collapsed to a regular space. */
const plain = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim()
const euros = (cents: number) =>
  plain(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100))
const groupHeaders = () =>
  [...document.querySelectorAll('[data-group-header] button')].map((b) => plain(b.textContent))
const groupHeaderRow = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[data-group-header]')].find((row) =>
    plain(row.textContent).startsWith(label),
  )!
const costRows = () => document.querySelectorAll('tr[data-cost-id]')
const lastToastAction = () => {
  const options = vi.mocked(toast).mock.calls.at(-1)?.[1] as
    { action?: { onClick: () => void } } | undefined
  return options!.action!.onClick
}
const openTab = (overrides: { projects?: Project[]; costs?: Cost[] } = {}) =>
  renderEditor('projects-costs', { projects: PROJECTS, costs: COSTS, ...overrides })

describe('ProjectsCostsTab', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '#/')
    vi.clearAllMocks()
  })

  it('adds a project and a cost from the quick entry rows, with the right TTC', async () => {
    const { visit, user } = await renderEditor('projects-costs')
    expect(screen.getByText('Aucun projet connu sur ce site.')).toBeInTheDocument()
    expect(screen.getByText('Aucun coût renseigné.')).toBeInTheDocument()

    const projectForm = screen.getByRole('form', { name: 'Ajouter un projet' })
    await user.type(within(projectForm).getByLabelText('Nom du projet'), '  Sprinklage {Enter}')
    expect(screen.getByRole('article', { name: 'Sprinklage' })).toBeInTheDocument()
    expect(within(projectForm).getByLabelText('Nom du projet')).toHaveValue('')
    expect(screen.getByRole('tab', { name: 'Projets & coûts (1)' })).toBeInTheDocument()

    const costForm = screen.getByRole('form', { name: 'Ajouter un coût' })
    await user.type(within(costForm).getByLabelText('Libellé'), 'Têtes sprinkler')
    await user.type(within(costForm).getByLabelText('Montant HT'), '1 000')
    await user.selectOptions(within(costForm).getByLabelText('TVA'), '550')
    await user.selectOptions(within(costForm).getByLabelText('Projet'), 'Sprinklage')
    await user.type(within(costForm).getByLabelText('Libellé'), '{Enter}')

    const row = costRows()[0] as HTMLElement
    expect(within(row).getByLabelText('Libellé : Têtes sprinkler')).toHaveValue('Têtes sprinkler')
    expect(plain(row.querySelector('[data-column="vat"]')!.textContent)).toBe(euros(5_500))
    expect(plain(row.querySelector('[data-column="ttc"]')!.textContent)).toBe(euros(105_500))
    expect(within(costForm).getByLabelText('Libellé')).toHaveValue('')
    await vi.waitFor(
      async () => {
        const stored = await getVisit(visit.id)
        expect(stored.costs).toEqual([
          expect.objectContaining({
            label: 'Têtes sprinkler',
            amountHtCents: 100_000,
            vatRateBp: 550,
            status: 'estimate',
            projectId: stored.projects[0]?.id,
          }),
        ])
      },
      { timeout: 3000 },
    )
  })

  it('blocks the quick entry on an invalid or missing amount', async () => {
    const { user } = await renderEditor('projects-costs')
    const costForm = screen.getByRole('form', { name: 'Ajouter un coût' })
    await user.type(within(costForm).getByLabelText('Libellé'), 'Devis')
    await user.type(within(costForm).getByLabelText('Montant HT'), '12,345{Enter}')
    expect(within(costForm).getByRole('alert')).toHaveTextContent('Montant invalide')
    expect(within(costForm).getByLabelText('Montant HT')).toHaveFocus()
    expect(screen.getByText('Aucun coût renseigné.')).toBeInTheDocument()

    await user.clear(within(costForm).getByLabelText('Montant HT'))
    await user.type(within(costForm).getByLabelText('Libellé'), '{Enter}')
    expect(within(costForm).getByRole('alert')).toHaveTextContent('Saisissez le montant HT')
    expect(screen.getByText('Aucun coût renseigné.')).toBeInTheDocument()
  })

  it('shows correct subtotals and stage totals, and changes the grouping', async () => {
    const { user } = await openTab()
    expect(groupHeaders()).toEqual([
      'Mise aux normes quais · 1 ligne',
      'Réfection toiture · 2 lignes',
      'Non rattachés · 1 ligne',
    ])
    const roof = plain(groupHeaderRow('Réfection toiture').textContent)
    expect(roof).toContain(euros(1_435_050))
    // VAT: 2 500,10 + 185,00 (rounded line by line), TTC = HT + VAT.
    expect(roof).toContain(euros(268_510))
    expect(roof).toContain(euros(1_703_560))

    const cells = [...document.querySelectorAll('[data-grand-total] > *')].map((cell) =>
      plain(cell.textContent),
    )
    expect(cells).toEqual([
      'Total général',
      euros(4_635_055),
      '',
      euros(908_510),
      euros(5_543_565),
      '',
    ])
    expect(
      [...document.querySelectorAll('[data-stage-total] th')].map((th) => th.textContent),
    ).toEqual(['Estimations', 'Devis reçus', 'Engagé', 'Facturé'])

    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Grouper par' })).getByText('Statut'),
    )
    expect(groupHeaders()).toEqual([
      'Estimation · 1 ligne',
      'Devis reçu · 1 ligne',
      'Engagé · 1 ligne',
      'Facturé · 1 ligne',
    ])
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Grouper par' })).getByText('Catégorie'),
    )
    expect(groupHeaders()).toEqual([
      'Travaux · 2 lignes',
      'Maintenance · 1 ligne',
      'Étude · 1 ligne',
    ])
    expect(plain(groupHeaderRow('Travaux').textContent)).toContain(euros(4_450_050))

    // Collapsing a group hides its lines but keeps its subtotal.
    await user.click(screen.getByRole('button', { name: /^Travaux/ }))
    expect(screen.getByRole('button', { name: /^Travaux/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(costRows()).toHaveLength(2)
  })

  it('"Voir les coûts" opens the project group and preselects it in the quick entry', async () => {
    const { user } = await openTab()
    await user.click(screen.getByRole('button', { name: /^Réfection toiture/ }))
    expect(costRows()).toHaveLength(2)
    const card = screen.getByRole('article', { name: 'Réfection toiture' })
    expect(
      within(card).getByRole('region', { name: 'Coûts liés : Réfection toiture' }),
    ).toHaveTextContent(/2 lignes/)
    await user.click(within(card).getByRole('button', { name: 'Voir les coûts' }))
    expect(screen.getByRole('button', { name: /^Réfection toiture/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(costRows()).toHaveLength(4)
    const costForm = screen.getByRole('form', { name: 'Ajouter un coût' })
    expect(within(costForm).getByLabelText('Projet')).toHaveValue('p-roof')
  })

  it('deletes a project with costs through the 3-choice dialog, then undoes it', async () => {
    const { visit, user } = await openTab()
    await user.click(screen.getByRole('button', { name: 'Supprimer le projet Réfection toiture' }))
    const dialog = screen.getByRole('alertdialog', {
      name: 'Supprimer le projet « Réfection toiture » ?',
    })
    expect(plain(dialog.textContent)).toContain(
      `Ce projet a 2 lignes de coûts (${euros(1_435_050)} HT).`,
    )
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Annuler', 'Conserver les coûts (non rattachés)', 'Supprimer aussi les coûts'])
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(screen.getByRole('article', { name: 'Réfection toiture' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Supprimer le projet Réfection toiture' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Conserver les coûts (non rattachés)',
      }),
    )
    expect(screen.queryByRole('article', { name: 'Réfection toiture' })).not.toBeInTheDocument()
    expect(groupHeaders()).toEqual(['Mise aux normes quais · 1 ligne', 'Non rattachés · 3 lignes'])
    expect(toast).toHaveBeenCalledWith(
      'Projet supprimé',
      expect.objectContaining({ duration: 8000 }),
    )

    act(lastToastAction())
    expect(groupHeaders()).toEqual([
      'Mise aux normes quais · 1 ligne',
      'Réfection toiture · 2 lignes',
      'Non rattachés · 1 ligne',
    ])
    await vi.waitFor(
      async () => {
        const stored = await getVisit(visit.id)
        expect({ projects: stored.projects, costs: stored.costs }).toEqual({
          projects: PROJECTS,
          costs: COSTS,
        })
      },
      { timeout: 3000 },
    )

    // "Supprimer aussi les coûts" removes the lines too.
    await user.click(screen.getByRole('button', { name: 'Supprimer le projet Réfection toiture' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Supprimer aussi les coûts',
      }),
    )
    expect(costRows()).toHaveLength(2)
  })

  it('deletes a project without costs immediately, with "Annuler"', async () => {
    const { user } = await openTab({ costs: [] })
    await user.click(screen.getByRole('button', { name: 'Supprimer le projet Réfection toiture' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Réfection toiture' })).not.toBeInTheDocument()
    act(lastToastAction())
    expect(screen.getByRole('article', { name: 'Réfection toiture' })).toBeInTheDocument()
  })

  it('links 2 selected lines to a project', async () => {
    const { visit, user } = await openTab()
    await user.click(screen.getByLabelText('Sélectionner : Niveleurs'))
    await user.click(screen.getByLabelText('Sélectionner : Nettoyage'))
    const toolbar = screen.getByRole('toolbar', { name: 'Actions sur la sélection' })
    expect(toolbar).toHaveTextContent('2 lignes sélectionnées')
    await user.click(within(toolbar).getByRole('button', { name: 'Rattacher au projet…' }))
    await user.click(screen.getByRole('menuitem', { name: 'Réfection toiture' }))
    expect(groupHeaders()).toEqual(['Réfection toiture · 4 lignes'])
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    await vi.waitFor(
      async () => {
        expect((await getVisit(visit.id)).costs.map((c) => c.projectId)).toEqual([
          'p-roof',
          'p-roof',
          'p-roof',
          'p-roof',
        ])
      },
      { timeout: 3000 },
    )
  })

  it('"Copier pour Excel" writes the TSV of every line to the clipboard', async () => {
    const { user } = await openTab()
    // After userEvent.setup(), which installs its own clipboard stub.
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    // Collapsed groups are exported too.
    await user.click(screen.getByRole('button', { name: /^Réfection toiture/ }))
    await user.click(screen.getByRole('button', { name: 'Copier pour Excel' }))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0]).toEqual([
      [
        'Projet\tLibellé\tCatégorie\tFournisseur\tStatut\tMontant HT\tTaux TVA\tTVA\tTTC\tCommentaire',
        'Mise aux normes quais\tNiveleurs\tTravaux\t\tEngagé\t32000,00\t20\t6400,00\t38400,00\t',
        'Réfection toiture\tDevis étanchéité\tTravaux\tÉtanchéité SA\tDevis reçu\t12500,50\t20\t2500,10\t15000,60\t',
        'Réfection toiture\tDiagnostic\tÉtude\t\tFacturé\t1850,00\t10\t185,00\t2035,00\t',
        '\tNettoyage\tMaintenance\t\tEstimation\t0,05\t5,5\t0,00\t0,05\t',
      ].join('\r\n'),
    ])
    expect(toast.success).toHaveBeenCalledWith('Tableau copié — collez-le dans Excel (Ctrl+V)')
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('downloads a CSV when the clipboard fails', async () => {
    const { user } = await openTab()
    const writeText = vi.fn(() => Promise.reject(new Error('denied')))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await user.click(screen.getByRole('button', { name: 'Copier pour Excel' }))
    expect(downloadBlob).toHaveBeenCalledTimes(1)
    const [blob, fileName] = vi.mocked(downloadBlob).mock.calls[0]!
    expect(fileName).toBe('Entrepôt Lyon - coûts - 2026-09-28.csv')
    // UTF-8 BOM bytes (Blob.text() would strip it while decoding).
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = await blob.text()
    expect(text.split('\r\n')[0]).toBe(
      'Projet;Libellé;Catégorie;Fournisseur;Statut;Montant HT;Taux TVA;TVA;TTC;Commentaire',
    )
    const [title, options] = vi.mocked(toast.info).mock.calls[0]!
    expect(title).toBe('Copie impossible : le tableau a été téléchargé au format CSV')
    expect((options as { description: string }).description).toContain(fileName)
  })
})
