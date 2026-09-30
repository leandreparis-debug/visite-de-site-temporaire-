import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addPhoto } from '@/features/photos/photosRepo'
import type { ReportAssets } from '@/features/report/render/renderReportDocx'
import type { PrepareAssetsInput } from '@/features/report/render/prepareReportAssets'
import { ReportTab } from '@/features/report/ReportTab'
import { getMeta } from '@/lib/db/meta'
import type * as DownloadModule from '@/lib/download'
import { downloadBlob } from '@/lib/download'
import { makeBlob, makePhotoInput } from '@/test/fixtures'
import { makeReportVisit } from '@/test/reportFixtures'
import { seedVisit } from '@/test/seed'
import type { Visit } from '@/types/visit'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn() }),
  Toaster: () => null,
}))
vi.mock('@/lib/download', async (importOriginal) => ({
  ...(await importOriginal<typeof DownloadModule>()),
  downloadBlob: vi.fn(),
}))

/** Controls the (mocked) image preparation and document assembly. */
const control = vi.hoisted(() => ({
  prepare: null as null | ((input: PrepareAssetsInput) => Promise<ReportAssets>),
  render: null as null | (() => Promise<Blob>),
}))
vi.mock('@/features/report/render/prepareReportAssets', () => ({
  prepareReportAssets: (input: PrepareAssetsInput) => control.prepare!(input),
  rasterizeLogo: () =>
    Promise.resolve({ data: new Uint8Array([1]), type: 'png', width: 4, height: 1 }),
}))
vi.mock('@/features/report/render/renderReportDocx', () => ({
  renderReportDocx: () => control.render!(),
}))

const emptyAssets: ReportAssets = {
  logo: { data: new Uint8Array(), type: 'png', width: 1, height: 1 },
  plans: new Map(),
  photos: new Map(),
}

async function setup(overrides: Partial<Visit> = {}, photoCount = 0) {
  const base = makeReportVisit(overrides)
  const visit = await seedVisit(
    { title: base.title, siteName: base.site.name, updatedAt: '2026-09-20T10:00:00.000Z' },
    { ...base, id: 'visit-report' },
  )
  for (let i = 0; i < photoCount; i++) {
    await addPhoto(
      makePhotoInput(visit.id, {
        blob: makeBlob('x'.repeat(400_000)),
        width: 2000,
        height: 1500,
        caption: i === 0 ? '' : `Photo ${i}`,
      }),
    )
  }
  const flush = vi.fn(() => Promise.resolve(true))
  const update = vi.fn()
  const user = userEvent.setup()
  render(<ReportTab visit={visit} update={update} flush={flush} />)
  const contents = await screen.findByRole('region', { name: 'Contenu du rapport' })
  return { visit, flush, update, user, contents }
}

const checkbox = (name: RegExp) => screen.getByRole('checkbox', { name })
const estimateText = () => screen.getByText(/^Taille estimée/).textContent

describe('ReportTab', () => {
  afterEach(() => {
    vi.clearAllMocks()
    control.prepare = null
    control.render = null
  })

  it('disables empty sections, with the mention "vide"', async () => {
    await setup({ doClaims: [], insurances: [], pins: [], nextPinNumber: 1 })
    const doBox = checkbox(/Dommages-Ouvrage et assurances/)
    expect(doBox).toBeDisabled()
    expect(doBox).not.toBeChecked()
    expect(screen.getByText(/Dommages-Ouvrage et assurances/).closest('label')).toHaveTextContent(
      '— vide',
    )
    // No photo stored: the photo sheet and the plans are empty too.
    expect(checkbox(/Planche photos/)).toBeDisabled()
    expect(checkbox(/Plans annotés/)).toBeDisabled()
    expect(checkbox(/Projets et coûts/)).toBeEnabled()
    expect(checkbox(/Projets et coûts/)).toBeChecked()
  })

  it('updates the estimated size with the options', async () => {
    const { user } = await setup({}, 3)
    await screen.findByText(/3 photos \(1 sans légende\)/)
    const standard = estimateText()
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Qualité des images' })).getByText('Allégée'),
    )
    const light = estimateText()
    expect(light).not.toBe(standard)
    await user.click(checkbox(/Planche photos/))
    expect(estimateText()).not.toBe(light)
    expect(estimateText()).toMatch(/environ \d+ Ko/)
  })

  it('links each point to check to its tab', async () => {
    await setup({ author: undefined })
    const checks = screen.getByRole('region', { name: 'Points à vérifier' })
    expect(within(checks).getByRole('link', { name: 'Rédacteur non renseigné' })).toHaveAttribute(
      'href',
      '#/visits/visit-report/general',
    )
    expect(
      within(checks).getByRole('link', { name: /Section de notes « Quais » vide/ }),
    ).toHaveAttribute('href', '#/visits/visit-report/notes')
  })

  it('flushes, shows the progress, downloads and records the date', async () => {
    let finish!: () => void
    control.prepare = async (input) => {
      input.onProgress?.({ stage: 'photos', done: 11, total: 42 })
      await new Promise<void>((resolve) => {
        finish = resolve
      })
      return emptyAssets
    }
    control.render = () => Promise.resolve(makeBlob('x'.repeat(4_400_000)))
    const { flush, user } = await setup()
    await user.click(screen.getByRole('button', { name: 'Générer le rapport Word' }))
    expect(flush).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Photos 12 / 42…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Générer le rapport Word' })).toBeDisabled()
    await act(async () => {
      finish()
      await Promise.resolve()
    })
    await vi.waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledTimes(1)
    })
    expect(vi.mocked(downloadBlob).mock.calls[0]?.[1]).toBe(
      'CR - Entrepôt Lyon Nord - 2026-09-28.docx',
    )
    await vi.waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Rapport généré (4,2 Mo)', expect.anything())
    })
    await vi.waitFor(async () => {
      expect(Object.keys((await getMeta('reportGeneratedAt')) ?? {})).toEqual(['visit-report'])
    })
    expect(await screen.findByText(/^Rapport généré le /)).toBeInTheDocument()
  })

  it('shows the error with "Réessayer", which runs the generation again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    control.prepare = () => Promise.resolve(emptyAssets)
    control.render = () => Promise.reject(new Error('boom'))
    const { user, flush } = await setup()
    await user.click(screen.getByRole('button', { name: 'Générer le rapport Word' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Génération impossible.')
    expect(downloadBlob).not.toHaveBeenCalled()

    control.render = () => Promise.resolve(makeBlob('docx'))
    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))
    await vi.waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledTimes(1)
    })
    expect(flush).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('stops before generating when the pending changes cannot be saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    control.prepare = vi.fn(() => Promise.resolve(emptyAssets))
    const { user, flush } = await setup()
    flush.mockResolvedValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'Générer le rapport Word' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Les dernières modifications n’ont pas pu être enregistrées',
    )
    expect(control.prepare).not.toHaveBeenCalled()
  })
})
