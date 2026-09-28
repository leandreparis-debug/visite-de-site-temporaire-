/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * Content-Security-Policy injected in the production build only (the dev
 * server needs HMR websockets). It forbids any network access: everything the
 * page needs is inline, or data:/blob: URLs created locally.
 */
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  'media-src data: blob:',
  'connect-src data: blob:',
  'worker-src blob:',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

function offlineCsp(): Plugin {
  return {
    name: 'cp:offline-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend',
      },
    ],
  }
}

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

// The whole app ships as ONE self-contained dist/index.html opened via file://.
// See docs/DECISIONS.md.
export default defineConfig({
  base: './',
  // Version of package.json and build date, shown in the footer ("v1.0.0 — build du …").
  define: {
    // APP_VERSION overrides it (e2e test of an update between two builds).
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true }), offlineCsp()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2023',
    // Inline every asset (images, fonts…) as data: URIs, whatever its size.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 5000,
    rolldownOptions: {
      output: {
        // No code splitting: dynamic imports are bundled into the single entry.
        codeSplitting: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
