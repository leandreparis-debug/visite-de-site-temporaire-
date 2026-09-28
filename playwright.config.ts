import { defineConfig, devices } from '@playwright/test'

/**
 * E2E tests run against the production build opened via file:// (see
 * tests/e2e/smoke.spec.ts). `npm run test:e2e` builds first; no web server.
 *
 * PW_CHROMIUM_PATH lets you point to an already installed Chromium/Chrome
 * binary when `npx playwright install chromium` is not possible.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: process.env.PW_CHROMIUM_PATH || undefined,
          // UTF-8 locale: without it, Chromium on a bare Linux saves downloads
          // with accented names ("Entrepôt…") as "download".
          env: { ...process.env, LANG: process.env.LANG || 'C.UTF-8' },
        },
      },
    },
  ],
})
