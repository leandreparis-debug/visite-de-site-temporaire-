import { AppError } from '@/lib/errors'

/** Long side (px) of a rendered plan page. */
export const PDF_TARGET_LONG_SIDE = 4096
/** Browser canvas limit we never exceed. */
export const CANVAS_MAX_SIDE = 8192
/** Long side of page thumbnails in the import dialog. */
export const PDF_THUMBNAIL_SIDE = 240
/** Above this PNG size, the plan is encoded as JPEG 0.9. */
export const PNG_MAX_BYTES = 6 * 1024 * 1024
export const PLAN_JPEG_QUALITY = 0.9
/** Larger plan files are refused. */
export const PLAN_MAX_SOURCE_BYTES = 80 * 1024 * 1024

export const PDF_PASSWORD_MESSAGE =
  'Ce PDF est protégé par un mot de passe. Exportez-le sans protection ou en PNG.'
export const PDF_CORRUPTED_MESSAGE =
  'Ce PDF est endommagé ou illisible. Exportez-le de nouveau depuis AutoCAD (PDF ou PNG).'
export const PDF_DEGRADED_MESSAGE =
  'Certains éléments de ce PDF (images compressées JPEG 2000 ou JBIG2) ne peuvent pas être affichés ici. Si le plan paraît incomplet, exportez-le en PNG depuis AutoCAD.'
export const PLAN_TOO_LARGE_MESSAGE = 'Fichier trop lourd (plus de 80 Mo).'

/** A file that cannot become a plan (French message for the user). */
export class PlanImportError extends AppError {}

export interface RenderedPlan {
  blob: Blob
  width: number
  height: number
  mimeType: 'image/png' | 'image/jpeg'
  /** Some PDF content (JPX/JBIG2 images…) could not be rendered. */
  degraded: boolean
}

/** Minimal page API used here (pdf.js page, or a fake in tests). */
export interface PdfPageHandle {
  /** Size at scale 1 (PDF points). */
  width: number
  height: number
  /** Renders on a white background at `scale`; resolves when done. */
  render: (canvas: HTMLCanvasElement, scale: number) => Promise<void>
  cleanup: () => void
}

export interface PdfDocumentHandle {
  pageCount: number
  getPage: (pageNumber: number) => Promise<PdfPageHandle>
  destroy: () => Promise<void>
}

/** Everything that touches pdf.js and canvas, injectable for tests. */
export interface PdfBackend {
  open: (data: Uint8Array) => Promise<PdfDocumentHandle>
  createCanvas: (width: number, height: number) => HTMLCanvasElement
  encode: (
    canvas: HTMLCanvasElement,
    type: 'image/png' | 'image/jpeg',
    quality?: number,
  ) => Promise<Blob>
  /** Runs `task` and reports whether pdf.js warned about content it could not render. */
  watchWarnings: <T>(task: () => Promise<T>) => Promise<{ result: T; degraded: boolean }>
}

/**
 * Scale to render a page of `width × height` points so that its long side
 * reaches `target` px (small pages are enlarged, large ones reduced), never
 * exceeding `maxSide` px (canvas limit).
 */
export function computePdfRenderScale(
  width: number,
  height: number,
  target = PDF_TARGET_LONG_SIDE,
  maxSide = CANVAS_MAX_SIDE,
): number {
  const longSide = Math.max(width, height)
  return Math.min(target, maxSide) / longSide
}

function sizeAt(page: PdfPageHandle, scale: number) {
  return {
    width: Math.max(1, Math.round(page.width * scale)),
    height: Math.max(1, Math.round(page.height * scale)),
  }
}

function toImportError(error: unknown): PlanImportError {
  if (error instanceof PlanImportError) return error
  const name = error instanceof Error ? error.name : ''
  if (name === 'PasswordException') {
    return new PlanImportError(PDF_PASSWORD_MESSAGE, 'Password-protected PDF', { cause: error })
  }
  return new PlanImportError(PDF_CORRUPTED_MESSAGE, `Unreadable PDF (${name || 'error'})`, {
    cause: error,
  })
}

export interface LoadedPdf {
  pageCount: number
  /** Small PNG of a page (≈240 px) for the page picker. */
  renderThumbnail: (pageNumber: number) => Promise<Blob>
  /** Page rendered at 4096 px on its long side, PNG (or JPEG 0.9 above 6 MB). */
  renderPage: (pageNumber: number) => Promise<RenderedPlan>
  /** Frees the document (call when the dialog closes). */
  close: () => Promise<void>
}

/**
 * Opens a PDF plan.
 *
 * @param pdf rendering backend: `pdfjsBackend` in the app, a fake in tests.
 * @throws {PlanImportError} too large (> 80 MB), password-protected, corrupted.
 */
export async function loadPdf(file: Blob, pdf: PdfBackend): Promise<LoadedPdf> {
  if (file.size > PLAN_MAX_SOURCE_BYTES) {
    throw new PlanImportError(PLAN_TOO_LARGE_MESSAGE, `Plan too large: ${file.size} bytes`)
  }
  let document: PdfDocumentHandle
  try {
    document = await pdf.open(new Uint8Array(await file.arrayBuffer()))
  } catch (error) {
    throw toImportError(error)
  }

  const withPage = async <T>(pageNumber: number, run: (page: PdfPageHandle) => Promise<T>) => {
    let page: PdfPageHandle | undefined
    try {
      page = await document.getPage(pageNumber)
      return await run(page)
    } catch (error) {
      throw toImportError(error)
    } finally {
      page?.cleanup()
    }
  }

  const draw = async (page: PdfPageHandle, scale: number) => {
    const { width, height } = sizeAt(page, scale)
    const canvas = pdf.createCanvas(width, height)
    const { degraded } = await pdf.watchWarnings(() => page.render(canvas, scale))
    return { canvas, width, height, degraded }
  }

  return {
    pageCount: document.pageCount,

    renderThumbnail: (pageNumber) =>
      withPage(pageNumber, async (page) => {
        const scale = computePdfRenderScale(page.width, page.height, PDF_THUMBNAIL_SIDE)
        const { canvas } = await draw(page, scale)
        return pdf.encode(canvas, 'image/png')
      }),

    renderPage: (pageNumber) =>
      withPage(pageNumber, async (page) => {
        const { canvas, width, height, degraded } = await draw(
          page,
          computePdfRenderScale(page.width, page.height),
        )
        const png = await pdf.encode(canvas, 'image/png')
        if (png.size <= PNG_MAX_BYTES) {
          return { blob: png, width, height, mimeType: 'image/png', degraded }
        }
        const jpeg = await pdf.encode(canvas, 'image/jpeg', PLAN_JPEG_QUALITY)
        return { blob: jpeg, width, height, mimeType: 'image/jpeg', degraded }
      }),

    close: () => document.destroy(),
  }
}
