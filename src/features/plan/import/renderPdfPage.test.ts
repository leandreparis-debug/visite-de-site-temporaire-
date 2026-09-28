import { describe, expect, it, vi } from 'vitest'
import {
  computePdfRenderScale,
  loadPdf,
  PDF_CORRUPTED_MESSAGE,
  PDF_PASSWORD_MESSAGE,
  PlanImportError,
  PNG_MAX_BYTES,
  type PdfBackend,
  type PdfDocumentHandle,
} from '@/features/plan/import/renderPdfPage'
import { toUserMessage } from '@/lib/errors'

function fakeBackend(
  options: {
    page?: { width: number; height: number }
    pngBytes?: number
    open?: () => Promise<PdfDocumentHandle>
    renderFails?: boolean
    degraded?: boolean
  } = {},
) {
  const cleanup = vi.fn()
  const destroy = vi.fn(() => Promise.resolve())
  const render = vi.fn((_canvas: HTMLCanvasElement, _scale: number) =>
    options.renderFails ? Promise.reject(new Error('boom')) : Promise.resolve(),
  )
  const encode = vi.fn((_canvas: HTMLCanvasElement, type: string) =>
    Promise.resolve(
      new Blob([new Uint8Array(type === 'image/png' ? (options.pngBytes ?? 100) : 50)], { type }),
    ),
  )
  const backend: PdfBackend = {
    open:
      options.open ??
      (() =>
        Promise.resolve({
          pageCount: 2,
          getPage: () =>
            Promise.resolve({
              ...(options.page ?? { width: 1190.55, height: 841.89 }),
              render,
              cleanup,
            }),
          destroy,
        })),
    createCanvas: (width, height) => ({ width, height }) as HTMLCanvasElement,
    encode,
    watchWarnings: async (task) => ({ result: await task(), degraded: options.degraded ?? false }),
  }
  return { backend, cleanup, destroy, render, encode }
}

const pdfFile = () => new File(['%PDF-1.7'], 'plan.pdf', { type: 'application/pdf' })
const rejection = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e,
  )

describe('computePdfRenderScale', () => {
  it('targets 4096 px on the long side, enlarging small pages', () => {
    expect(computePdfRenderScale(1190.55, 841.89) * 1190.55).toBeCloseTo(4096)
    expect(computePdfRenderScale(595, 842) * 842).toBeCloseTo(4096)
    expect(computePdfRenderScale(200, 100)).toBeCloseTo(20.48)
  })

  it('never exceeds 8192 px', () => {
    expect(computePdfRenderScale(100, 50, 20_000) * 100).toBe(8192)
    expect(computePdfRenderScale(100, 50, 240) * 100).toBe(240)
  })
})

describe('loadPdf', () => {
  it('renders a page as PNG at 4096 px and frees the page', async () => {
    const { backend, cleanup, render } = fakeBackend()
    const pdf = await loadPdf(pdfFile(), backend)
    expect(pdf.pageCount).toBe(2)
    const page = await pdf.renderPage(2)
    expect(page).toMatchObject({
      width: 4096,
      height: 2896,
      mimeType: 'image/png',
      degraded: false,
    })
    expect(render.mock.calls[0]?.[1]).toBeCloseTo(4096 / 1190.55)
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('switches to JPEG 0.9 above 6 MB of PNG', async () => {
    const { backend, encode } = fakeBackend({ pngBytes: PNG_MAX_BYTES + 1 })
    const page = await (await loadPdf(pdfFile(), backend)).renderPage(1)
    expect(page.mimeType).toBe('image/jpeg')
    expect(encode).toHaveBeenLastCalledWith(expect.anything(), 'image/jpeg', 0.9)
  })

  it('renders 240 px thumbnails', async () => {
    const { backend, render } = fakeBackend()
    await (await loadPdf(pdfFile(), backend)).renderThumbnail(1)
    expect((render.mock.calls[0]?.[1] ?? 0) * 1190.55).toBeCloseTo(240)
  })

  it('reports a degraded render (unsupported images)', async () => {
    const { backend } = fakeBackend({ degraded: true })
    expect((await (await loadPdf(pdfFile(), backend)).renderPage(1)).degraded).toBe(true)
  })

  it('gives French messages for protected and corrupted PDFs', async () => {
    const password = Object.assign(new Error('No password given'), { name: 'PasswordException' })
    const protectedError = await rejection(
      loadPdf(pdfFile(), fakeBackend({ open: () => Promise.reject(password) }).backend),
    )
    expect(protectedError).toBeInstanceOf(PlanImportError)
    expect(toUserMessage(protectedError)).toBe(PDF_PASSWORD_MESSAGE)

    const invalid = Object.assign(new Error('Invalid PDF structure.'), {
      name: 'InvalidPDFException',
    })
    const corrupted = await rejection(
      loadPdf(pdfFile(), fakeBackend({ open: () => Promise.reject(invalid) }).backend),
    )
    expect(toUserMessage(corrupted)).toBe(PDF_CORRUPTED_MESSAGE)
  })

  it('refuses files over 80 MB', async () => {
    const big = pdfFile()
    Object.defineProperty(big, 'size', { value: 80 * 1024 * 1024 + 1 })
    expect(toUserMessage(await rejection(loadPdf(big, fakeBackend().backend)))).toBe(
      'Fichier trop lourd (plus de 80 Mo).',
    )
  })

  it('frees the page even when rendering fails, and the document on close', async () => {
    const { backend, cleanup, destroy } = fakeBackend({ renderFails: true })
    const pdf = await loadPdf(pdfFile(), backend)
    const error = await rejection(pdf.renderPage(1))
    expect(toUserMessage(error)).toBe(PDF_CORRUPTED_MESSAGE)
    expect(cleanup).toHaveBeenCalledOnce()
    await pdf.close()
    expect(destroy).toHaveBeenCalledOnce()
  })
})
