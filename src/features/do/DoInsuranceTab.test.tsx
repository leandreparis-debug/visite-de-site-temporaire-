import { act, screen, within } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DO_STEP_SEQUENCE } from '@/features/do/doView'
import { getVisit } from '@/features/visits/visitsRepo'
import { renderEditor } from '@/test/renderEditor'
import type { DoClaim, DoStep, DoStepStatus, DoStepType } from '@/types/visit'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
  Toaster: () => null,
}))

/** Today in these tests: 28 September 2026. */
const TODAY = '2026-09-28'

function makeClaim(
  options: {
    statuses?: Partial<Record<DoStepType, DoStepStatus>>
    without?: DoStepType[]
  } & Partial<Omit<DoClaim, 'steps'>> = {},
): DoClaim {
  const { statuses = {}, without = [], ...fields } = options
  return {
    id: 'claim-1',
    reference: 'DO-2026-014',
    description: 'Infiltrations toiture',
    steps: DO_STEP_SEQUENCE.filter((type) => !without.includes(type)).map((type): DoStep => ({
      id: `s-${type}`,
      type,
      status: statuses[type] ?? 'todo',
    })),
    ...fields,
  }
}

const card = () => screen.getByRole('article', { name: 'DO-2026-014' })
const stepTypes = () =>
  [...card().querySelectorAll('[data-step-type]')].map((li) => li.getAttribute('data-step-type'))
const storedClaim = async (visitId: string) =>
  vi.waitFor(
    async () => {
      const claim = (await getVisit(visitId)).doClaims[0]
      if (!claim) throw new Error('not saved yet')
      return claim
    },
    { timeout: 3000 },
  )
/** Last "Annuler" action passed to `toast(...)`. */
function lastToastAction(): () => void {
  const options = vi.mocked(toast).mock.calls.at(-1)?.[1] as
    { action?: { onClick: () => void } } | undefined
  const onClick = options?.action?.onClick
  if (!onClick) throw new Error('no toast action')
  return onClick
}

describe('DoInsuranceTab', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 8, 28, 12))
  })
  afterEach(() => {
    window.history.replaceState(null, '', '#/')
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('adds a contract from the quick entry row and shows "Expire dans N j"', async () => {
    const { visit, user } = await renderEditor('do-insurance')
    expect(screen.getByText('Aucun contrat renseigné.')).toBeInTheDocument()
    expect(screen.getByText('Aucun sinistre DO suivi sur ce site.')).toBeInTheDocument()

    const form = screen.getByRole('form', { name: 'Ajouter un contrat' })
    await user.selectOptions(within(form).getByLabelText('Type'), 'multirisque')
    // Insurer required: Enter on an empty insurer adds nothing.
    await user.type(within(form).getByLabelText('N° de police'), 'MR-1{Enter}')
    expect(screen.getByText('Aucun contrat renseigné.')).toBeInTheDocument()
    await user.type(within(form).getByLabelText('Assureur'), '  AXA France ')
    await user.type(within(form).getByLabelText('Date de fin'), '2026-10-21')
    await user.type(within(form).getByLabelText('Assureur'), '{Enter}')

    expect(screen.getByLabelText('Assureur : Multirisque AXA France')).toHaveValue('AXA France')
    expect(screen.getByText(/^Expire dans 23\sj$/)).toBeInTheDocument()
    expect(within(form).getByLabelText('Assureur')).toHaveValue('')
    const banner = screen.getByRole('navigation', { name: 'Synthèse DO et assurances' })
    expect(
      within(banner).getByRole('button', { name: '1 contrat dont 1 expire bientôt' }),
    ).toHaveAttribute('data-tone', 'warning')
    await vi.waitFor(
      async () => {
        expect((await getVisit(visit.id)).insurances).toEqual([
          expect.objectContaining({
            type: 'multirisque',
            insurer: 'AXA France',
            policyNumber: 'MR-1',
            endDate: '2026-10-21',
          }),
        ])
      },
      { timeout: 3000 },
    )
  })

  it('declares a claim with its 10 steps through the dialog', async () => {
    const { visit, user } = await renderEditor('do-insurance', {
      insurances: [{ id: 'i1', type: 'dommages_ouvrage', insurer: 'SMABTP' }],
    })
    await user.click(screen.getByRole('button', { name: 'Déclarer un sinistre' }))
    const dialog = screen.getByRole('dialog', { name: 'Déclarer un sinistre DO' })
    // The only DO contract's insurer is prefilled.
    expect(within(dialog).getByLabelText('Assureur')).toHaveValue('SMABTP')
    await user.click(within(dialog).getByRole('button', { name: 'Déclarer' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('La description est obligatoire')

    await user.type(within(dialog).getByLabelText('Description du sinistre'), 'Fissure dallage')
    await user.type(within(dialog).getByLabelText('Référence'), 'DO-2026-014')
    await user.type(within(dialog).getByLabelText('Date de déclaration'), '2026-09-01')
    await user.click(within(dialog).getByRole('button', { name: 'Déclarer' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Sinistre déclaré')
    expect(stepTypes()).toEqual([...DO_STEP_SEQUENCE])
    expect(within(card()).getByText('En cours : Déclaration du sinistre')).toBeInTheDocument()
    expect(within(card()).getByText('0 / 10 étapes')).toBeInTheDocument()
    const claim = await storedClaim(visit.id)
    expect(claim).toMatchObject({
      description: 'Fissure dallage',
      reference: 'DO-2026-014',
      insurer: 'SMABTP',
      declaredAt: '2026-09-01',
    })
    expect(new Set(claim.steps.map((s) => s.id)).size).toBe(10)
  })

  it('fills today’s date when "Déclaration" is set to Terminé', async () => {
    const { visit, user } = await renderEditor('do-insurance', { doClaims: [makeClaim()] })
    await user.selectOptions(
      within(card()).getByLabelText('Statut : Déclaration du sinistre'),
      'done',
    )
    expect(within(card()).getByLabelText('Date : Déclaration du sinistre')).toHaveValue(TODAY)
    expect(within(card()).getByText('1 / 10 étapes')).toBeInTheDocument()
    expect(
      within(card()).getByText('En cours : Accusé de réception de l’assureur'),
    ).toBeInTheDocument()
    await vi.waitFor(
      async () => {
        expect((await storedClaim(visit.id)).steps[0]).toMatchObject({
          status: 'done',
          date: TODAY,
        })
      },
      { timeout: 3000 },
    )
  })

  it('shows an overdue deadline in red in the box, the banner and the tab', async () => {
    // Declared 70 days ago: the insurer's position (60 days) is 10 days late.
    await renderEditor('do-insurance', { doClaims: [makeClaim({ declaredAt: '2026-07-20' })] })
    const deadlines = within(card()).getByRole('region', { name: 'Délais' })
    expect(deadlines).toHaveTextContent('Calculés à partir de la déclaration du 20/07/2026.')
    const overdue = deadlines.querySelector('[data-deadline="coverage_decision"]')!
    expect(overdue).toHaveAttribute('data-state', 'overdue')
    expect(overdue).toHaveClass('text-danger')
    expect(overdue).toHaveTextContent(
      /Position sur la garantie attendue avant le 18\/09\/2026 — dépassé de 10\sj/,
    )
    expect(deadlines).toHaveTextContent(
      'Délai indicatif (art. L242-1 du Code des assurances), à vérifier selon le contrat',
    )
    expect(within(card()).getByText('Délai dépassé')).toBeInTheDocument()

    const banner = screen.getByRole('navigation', { name: 'Synthèse DO et assurances' })
    const item = within(banner).getByRole('button', { name: '1 délai dépassé' })
    expect(item).toHaveAttribute('data-tone', 'danger')
    expect(item).toHaveClass('text-danger')
    expect(
      screen.getByRole('tab', { name: /^DO & assurances \(1\)\s*— alerte$/ }),
    ).toBeInTheDocument()
  })

  it('asks for a date when there is no reference date', async () => {
    await renderEditor('do-insurance', { doClaims: [makeClaim()] })
    expect(within(card()).getByRole('region', { name: 'Délais' })).toHaveTextContent(
      'Renseignez la date de déclaration pour calculer les délais.',
    )
    expect(screen.getByRole('tab', { name: 'DO & assurances (1)' })).toBeInTheDocument()
  })

  it('"Non applicable" removes a step, "Annuler" puts it back', async () => {
    const { user } = await renderEditor('do-insurance', { doClaims: [makeClaim()] })
    await user.click(within(card()).getByRole('button', { name: 'Non applicable : Expertise' }))
    expect(stepTypes()).not.toContain('expertise')
    expect(within(card()).getByText('0 / 9 étapes')).toBeInTheDocument()
    expect(toast).toHaveBeenCalledWith(
      'Étape retirée',
      expect.objectContaining({ description: 'Expertise', duration: 5000 }),
    )
    act(lastToastAction())
    expect(stepTypes()).toEqual([...DO_STEP_SEQUENCE])
  })

  it('"Rétablir une étape" restores a removed step at its canonical position', async () => {
    const { user } = await renderEditor('do-insurance', {
      doClaims: [makeClaim({ without: ['expert_appointed', 'expertise'] })],
    })
    await user.click(within(card()).getByRole('button', { name: /Rétablir une étape \(2\)/ }))
    const items = screen.getAllByRole('menuitem').map((item) => item.textContent)
    expect(items).toEqual(['Désignation de l’expert', 'Expertise'])
    await user.click(screen.getByRole('menuitem', { name: 'Expertise' }))
    expect(stepTypes()).toEqual(DO_STEP_SEQUENCE.filter((t) => t !== 'expert_appointed'))
    expect(stepTypes()[2]).toBe('expertise')
  })

  it('shows an error on an invalid amount and restores the previous value on blur', async () => {
    const { visit, user } = await renderEditor('do-insurance', {
      doClaims: [makeClaim({ claimedAmountCents: 1_500_000 })],
    })
    const claimed = within(card()).getByLabelText('Montant réclamé')
    expect(claimed).toHaveValue('15\u202f000,00\u00a0€')
    await user.clear(claimed)
    await user.type(claimed, '12 5OO')
    expect(within(card()).getByRole('alert')).toHaveTextContent('Montant invalide')
    expect(claimed).toHaveAttribute('aria-invalid', 'true')
    await user.tab()
    expect(claimed).toHaveValue('15\u202f000,00\u00a0€')
    expect(within(card()).queryByRole('alert')).not.toBeInTheDocument()

    await user.clear(claimed)
    await user.type(claimed, '12 500,50')
    await user.tab()
    expect(claimed).toHaveValue('12\u202f500,50\u00a0€')
    await vi.waitFor(
      async () => {
        expect((await getVisit(visit.id)).doClaims[0]?.claimedAmountCents).toBe(1_250_050)
      },
      { timeout: 3000 },
    )
  })

  it('warns when the compensated amount exceeds the claimed amount', async () => {
    await renderEditor('do-insurance', {
      doClaims: [makeClaim({ claimedAmountCents: 100_000, compensatedAmountCents: 150_000 })],
    })
    const warning = within(card()).getByText(/le montant indemnisé .* dépasse le montant réclamé/)
    expect(warning.closest('ul')).toHaveClass('text-warning')
  })

  it('collapses a closed claim by default', async () => {
    const { user } = await renderEditor('do-insurance', {
      doClaims: [
        makeClaim({ statuses: Object.fromEntries(DO_STEP_SEQUENCE.map((t) => [t, 'done'])) }),
      ],
    })
    const toggle = within(card()).getByRole('button', { name: 'Déplier le sinistre DO-2026-014' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(card()).getByText('Clôturé')).toBeInTheDocument()
    expect(within(card()).getByText('Clôturé · 10 / 10 étapes')).toBeInTheDocument()
    expect(
      within(card()).queryByRole('list', { name: 'Étapes du sinistre' }),
    ).not.toBeInTheDocument()
    await user.click(toggle)
    expect(within(card()).getByRole('list', { name: 'Étapes du sinistre' })).toBeInTheDocument()
  })

  it('deletes a claim after confirmation', async () => {
    const { visit, user } = await renderEditor('do-insurance', { doClaims: [makeClaim()] })
    await user.click(
      within(card()).getByRole('button', { name: 'Supprimer le sinistre DO-2026-014' }),
    )
    const dialog = screen.getByRole('alertdialog', {
      name: 'Supprimer le sinistre « DO-2026-014 » ?',
    })
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    expect(screen.getByText('Aucun sinistre DO suivi sur ce site.')).toBeInTheDocument()
    await vi.waitFor(
      async () => {
        expect((await getVisit(visit.id)).doClaims).toEqual([])
      },
      { timeout: 3000 },
    )
  })
})
