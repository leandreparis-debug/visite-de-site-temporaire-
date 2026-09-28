import { OFFLINE_DOCUMENT_OPTIONS, pdfjs } from './pdfjs'
import type { PdfBackend } from './renderPdfPage'

/** pdf.js warnings meaning that some content could not be rendered without WASM. */
const DEGRADING_WARNING = /jpx|jpeg ?2000|openjpeg|jbig2|wasm|unable to decode image/i
/** Expected with our setup (pdf.js in the main thread): not worth a console message. */
const EXPECTED_WARNING = /^Warning: Setting up fake worker/

/**
 * Runs `task` while intercepting pdf.js warnings (`console.warn("Warning: …")`):
 * the expected "fake worker" notice is dropped, other messages are passed
 * through, and `onWarning` sees each pdf.js warning.
 */
async function withPdfWarnings<T>(
  task: () => Promise<T>,
  onWarning: (text: string) => void,
): Promise<T> {
  const original = console.warn
  console.warn = (...args: unknown[]) => {
    const text = args.map(String).join(' ')
    if (text.startsWith('Warning:')) onWarning(text)
    if (!EXPECTED_WARNING.test(text)) original.apply(console, args)
  }
  try {
    return await task()
  } finally {
    console.warn = original
  }
}

/** Real backend: pdf.js (main thread) and DOM canvas. */
export const pdfjsBackend: PdfBackend = {
  async open(data) {
    const loadingTask = pdfjs.getDocument({ data, ...OFFLINE_DOCUMENT_OPTIONS })
    let document
    try {
      document = await withPdfWarnings(
        () => loadingTask.promise,
        () => undefined,
      )
    } catch (error) {
      await loadingTask.destroy()
      throw error
    }
    return {
      pageCount: document.numPages,
      async getPage(pageNumber) {
        const page = await document.getPage(pageNumber)
        const { width, height } = page.getViewport({ scale: 1 })
        return {
          width,
          height,
          render: async (canvas, scale) => {
            await page.render({
              canvas,
              viewport: page.getViewport({ scale }),
              background: '#ffffff',
            }).promise
          },
          cleanup: () => {
            page.cleanup()
          },
        }
      },
      destroy: () => loadingTask.destroy(),
    }
  },

  createCanvas(width, height) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  },

  encode(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error(`${type} encoding failed`))
        },
        type,
        quality,
      )
    })
  },

  /**
   * pdf.js reports content it cannot decode (JPX/JBIG2 without WASM…) as
   * warnings: they are captured during the render to flag a degraded plan.
   */
  async watchWarnings(task) {
    let degraded = false
    const result = await withPdfWarnings(task, (text) => {
      if (DEGRADING_WARNING.test(text)) degraded = true
    })
    return { result, degraded }
  },
}
