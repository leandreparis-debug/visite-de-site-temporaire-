/**
 * pdf.js set up to run ENTIRELY in the main thread (no Web Worker).
 *
 * The worker module is bundled statically and exposed as
 * `globalThis.pdfjsWorker`: pdf.js then uses its "fake worker" (same thread)
 * and never calls `new Worker` nor loads any file. Required by the single
 * `index.html` opened via `file://` with a CSP that forbids any request.
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.mjs'

declare global {
  var pdfjsWorker: { WorkerMessageHandler: unknown } | undefined
}

globalThis.pdfjsWorker = { WorkerMessageHandler }

/** Options that keep pdf.js offline: no worker, no font/CMap/WASM download, no eval. */
export const OFFLINE_DOCUMENT_OPTIONS = {
  // Ignored by pdf.js ≥ 5 (no eval anymore), kept for the CSP intent.
  isEvalSupported: false,
  useSystemFonts: true,
  // No cMapUrl / standardFontDataUrl / wasmUrl: nothing is ever fetched.
  useWorkerFetch: false,
  // Only errors in the console (warnings are captured, see renderPdfPage).
  verbosity: pdfjs.VerbosityLevel.WARNINGS,
} as const

export { pdfjs }
