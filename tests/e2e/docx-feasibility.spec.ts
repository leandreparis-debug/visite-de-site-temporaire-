import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, test } from '@playwright/test'

const root = resolve(import.meta.dirname, '../..')

test.beforeAll(() => {
  execFileSync(
    'npx',
    ['vite', 'build', '--config', 'vite.probe.config.ts', '--logLevel', 'error'],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, PROBE: 'docx', VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true' },
    },
  )
})

test('docx generates a Word file in file://, under the CSP, lazily loaded', async ({ page }) => {
  // Single file: the dynamic import is inlined, no separate chunk.
  expect(readdirSync(resolve(root, 'dist-probe/docx'))).toEqual(['docx-probe.html'])
  const problems: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('request', (r) => {
    if (!/^(file|data|blob):/.test(r.url())) problems.push(`request: ${r.url()}`)
  })
  page.on('worker', (w) => problems.push(`worker created: ${w.url()}`))

  await page.goto(pathToFileURL(resolve(root, 'dist-probe/docx/docx-probe.html')).href)
  await page.getByRole('button', { name: 'Générer' }).click()
  await expect(page.locator('#result')).toContainText('"ok"', { timeout: 30_000 })
  const result = JSON.parse((await page.locator('#result').textContent()) ?? '{}') as {
    ok: boolean
    zip: boolean
    bytes: number
    error?: string
  }
  console.log('[feasibility docx]', JSON.stringify(result))
  expect(result.error).toBeUndefined()
  expect(result).toMatchObject({ ok: true, zip: true })
  expect(result.bytes).toBeGreaterThan(5_000)
  expect(problems).toEqual([])
})
