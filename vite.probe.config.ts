import { fileURLToPath, URL } from 'node:url'
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

/**
 * Builds a feasibility probe exactly like the app (single file + CSP).
 * `PROBE=pdf` (default) or `PROBE=docx` selects `tests/feasibility/<probe>-probe.html`.
 */
const probe = process.env.PROBE ?? 'pdf'

export default mergeConfig(
  base,
  defineConfig({
    root: fileURLToPath(new URL('./tests/feasibility', import.meta.url)),
    build: {
      outDir: fileURLToPath(new URL(`./dist-probe/${probe}`, import.meta.url)),
      emptyOutDir: true,
      rolldownOptions: {
        input: fileURLToPath(new URL(`./tests/feasibility/${probe}-probe.html`, import.meta.url)),
      },
    },
  }),
)
