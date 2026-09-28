/**
 * Feasibility probe: pdf.js in the main thread ("fake worker"), bundled in a
 * single HTML file with the production CSP. Renders page 1 of the chosen PDF.
 */
import { pdfjsBackend } from '@/features/plan/import/pdfjsBackend'
import { loadPdf } from '@/features/plan/import/renderPdfPage'

const input = document.getElementById('file') as HTMLInputElement
const result = document.getElementById('result') as HTMLPreElement
const output = document.getElementById('output') as HTMLImageElement

input.addEventListener('change', () => {
  const file = input.files?.[0]
  if (!file) return
  void (async () => {
    const started = performance.now()
    try {
      const pdf = await loadPdf(file, pdfjsBackend)
      const page = await pdf.renderPage(1)
      await pdf.close()
      output.src = URL.createObjectURL(page.blob)
      result.textContent = JSON.stringify({
        ok: true,
        pageCount: pdf.pageCount,
        width: page.width,
        height: page.height,
        mimeType: page.mimeType,
        bytes: page.blob.size,
        ms: Math.round(performance.now() - started),
        workerCreated: (globalThis as { __workerCreated?: boolean }).__workerCreated === true,
      })
    } catch (error) {
      const cause = (error as { cause?: unknown }).cause
      result.textContent = JSON.stringify({
        ok: false,
        error: String(error),
        cause: String(cause),
        stack: cause instanceof Error ? cause.stack : '',
      })
    }
  })()
})
