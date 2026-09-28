import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { addPhoto } from '@/features/photos/photosRepo'
import { PlanTab } from '@/features/plan/PlanTab'
import { addPlan } from '@/features/plan/plansRepo'
import type { VisitUpdater } from '@/features/visits/useVisitDraft'
import { createVisit } from '@/features/visits/visitsRepo'
import { makePhotoInput, makePlanInput } from '@/test/fixtures'
import type { Visit } from '@/types/visit'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
  Toaster: () => null,
}))

/** PlanTab with an in-memory visit; counts the `update` calls. */
function Harness({ initial, onUpdate }: { initial: Visit; onUpdate: () => void }) {
  const [visit, setVisit] = useState(initial)
  return (
    <PlanTab
      visit={visit}
      update={(updater: VisitUpdater) => {
        onUpdate()
        setVisit((current) => updater(current))
      }}
    />
  )
}

async function setup(options: { plans?: number; pins?: boolean } = {}) {
  const visit = await createVisit({
    kind: 'technical_visit',
    title: 'V',
    date: '2026-09-28',
    siteName: 'Site',
  })
  const photos = []
  for (const caption of ['Photo A', 'Photo B', 'Photo C']) {
    photos.push(await addPhoto(makePhotoInput(visit.id, { caption })))
  }
  const plans = []
  for (let i = 1; i <= (options.plans ?? 1); i++) {
    plans.push(
      await addPlan(makePlanInput(visit.id, { name: `Plan ${i}`, width: 2000, height: 1000 })),
    )
  }
  const initial: Visit = options.pins
    ? {
        ...visit,
        nextPinNumber: 5,
        pins: [
          { id: 'pin-a', planId: plans[0]!.id, photoId: photos[0]!.id, x: 0.25, y: 0.5, number: 3 },
          { id: 'pin-b', planId: plans[0]!.id, photoId: photos[1]!.id, x: 0.75, y: 0.5, number: 4 },
        ],
      }
    : visit
  window.history.replaceState(null, '', `#/visits/${visit.id}/plan`)
  const onUpdate = vi.fn()
  const user = userEvent.setup()
  render(<Harness initial={initial} onUpdate={onUpdate} />)
  return { visit, photos, plans, onUpdate, user }
}

describe('PlanTab', () => {
  beforeEach(() => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })
    // jsdom has no layout: give the plan area a size.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 1000,
      height: 500,
      right: 1000,
      bottom: 500,
      toJSON: () => ({}),
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    window.history.replaceState(null, '', '#/')
  })

  it('shows the empty state without plan', async () => {
    const visit = await createVisit({
      kind: 'meeting',
      title: 'V',
      date: '2026-09-28',
      siteName: 'S',
    })
    render(<Harness initial={visit} onUpdate={vi.fn()} />)
    expect(
      await screen.findByText('Importez le plan de l’entrepôt (PDF ou image)'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Astuce : depuis AutoCAD, un export PDF ou PNG convient.'),
    ).toBeInTheDocument()
  })

  it('keeps the active plan in the URL', async () => {
    const { plans, user } = await setup({ plans: 2 })
    await waitFor(() => {
      expect(window.location.hash).toMatch(new RegExp(`\\?p=${plans[0]!.id}$`))
    })
    await user.click(screen.getByRole('button', { name: 'Plan 2' }))
    await waitFor(() => {
      expect(window.location.hash).toMatch(new RegExp(`\\?p=${plans[1]!.id}$`))
    })
    expect(screen.getByRole('button', { name: 'Plan 2' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('lists unplaced photos by default, all or placed on demand', async () => {
    const { user } = await setup({ pins: true })
    const list = await screen.findByRole('list', { name: 'Photos à placer' })
    await waitFor(() => {
      expect(within(list).getAllByRole('button')).toHaveLength(1)
    })
    expect(within(list).getByRole('button', { name: /Photo C — non placée/ })).toBeInTheDocument()
    await user.click(screen.getByText('Toutes'))
    expect(
      within(screen.getByRole('list', { name: 'Photos à placer' })).getAllByRole('button'),
    ).toHaveLength(3)
    await user.click(screen.getByText('Placées', { exact: true }))
    expect(
      within(screen.getByRole('list', { name: 'Photos à placer' })).getByRole('button', {
        name: /repère n°3/,
      }),
    ).toBeInTheDocument()
  })

  it('click mode: banner, Escape cancels, click on the plan places the photo', async () => {
    const { user, onUpdate } = await setup({ pins: true })
    const list = await screen.findByRole('list', { name: 'Photos à placer' })
    await user.click(within(list).getByRole('button', { name: /Photo C/ }))
    expect(
      screen.getByText('Cliquez sur le plan pour placer la photo n°3 — Échap pour annuler'),
    ).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByText(/Cliquez sur le plan/)).not.toBeInTheDocument()

    // Keyboard placement: Enter on the thumbnail, then Enter on the plan (center of the view).
    within(list)
      .getByRole('button', { name: /Photo C/ })
      .focus()
    await user.keyboard('{Enter}')
    screen.getByTestId('plan-canvas').focus()
    await user.keyboard('{Enter}')
    expect(onUpdate).toHaveBeenCalledOnce()
    expect(toast.success).toHaveBeenCalledWith('Repère n°5 ajouté')
    expect(screen.getByRole('button', { name: /^Repère n°5/ })).toBeInTheDocument()
  })

  it('moves a pin with the keyboard: one update per key press, and one per mouse drag', async () => {
    const { user, onUpdate } = await setup({ pins: true })
    const pin = await screen.findByRole('button', { name: /^Repère n°3/ })
    pin.focus()
    await user.keyboard('{ArrowRight}')
    expect(onUpdate).toHaveBeenCalledTimes(1)
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}')
    expect(onUpdate).toHaveBeenCalledTimes(2)

    // Mouse drag with many moves: a single update at release.
    const canvas = screen.getByTestId('plan-canvas')
    fireEvent.pointerDown(pin, { button: 0, pointerId: 1, clientX: 300, clientY: 250 })
    for (let step = 1; step <= 10; step++) {
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 300 + step * 10, clientY: 250 })
    }
    expect(onUpdate).toHaveBeenCalledTimes(2)
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 400, clientY: 250 })
    expect(onUpdate).toHaveBeenCalledTimes(3)
  })

  it('"Retirer du plan" then "Annuler" restores the same number', async () => {
    const { user } = await setup({ pins: true })
    const pin = await screen.findByRole('button', { name: /^Repère n°4/ })
    pin.focus()
    await user.keyboard('{Delete}')
    expect(screen.queryByRole('button', { name: /^Repère n°4/ })).not.toBeInTheDocument()
    expect(toast).toHaveBeenCalledWith(
      'Repère n°4 retiré du plan',
      expect.objectContaining({ duration: 5000 }),
    )
    const options = vi.mocked(toast).mock.calls[0]?.[1] as unknown as {
      action: { onClick: () => void }
    }
    act(() => {
      options.action.onClick()
    })
    expect(screen.getByRole('button', { name: /^Repère n°4/ })).toBeInTheDocument()
  })

  it('announces the pin numbers removed with a plan', async () => {
    const { user } = await setup({ plans: 2, pins: true })
    await user.click(await screen.findByRole('button', { name: 'Plan « Plan 1 »' }))
    await user.click(screen.getByRole('menuitem', { name: 'Supprimer le plan' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Supprimer le plan « Plan 1 » ?' })
    expect(dialog).toHaveTextContent(
      '2 repères seront retirés (n°3, n°4). Les photos sont conservées.',
    )
  })
})
