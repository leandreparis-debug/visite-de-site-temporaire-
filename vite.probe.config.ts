import { fileURLToPath, URL } from 'node:url'
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

/** Builds the pdf.js feasibility probe exactly like the app (single file + CSP). */
export default mergeConfig(
  base,
  defineConfig({
    root: fileURLToPath(new URL('./tests/feasibility', import.meta.url)),
    build: {
      outDir: fileURLToPath(new URL('./dist-probe', import.meta.url)),
      emptyOutDir: true,
      rolldownOptions: {
        input: fileURLToPath(new URL('./tests/feasibility/pdf-probe.html', import.meta.url)),
      },
    },
  }),
)
